/**
 * GpsCaptureScreen
 *
 * Full-screen OSM map with live GPS, accuracy indicator, and screenshot capture.
 * Returns { screenshotPath, latitude, longitude, altitude, accuracy, timestamp }
 *
 * Accuracy target: ≤10m (green = GPS LOCKED, ready to capture).
 * Uses getCurrentPosition polling every 2s — proven to show 100→20→10→5m improvement.
 *
 * Status tiers:
 *   ≤10m  → green  (#22c55e) — GPS LOCKED, ready
 *   11-20m → amber (#f59e0b) — Stabilizing, improving
 *   >20m  → red   (#ef4444) — weak / no fix
 *
 * Capture button disabled until map is ready AND accuracy ≤ 10m.
 * Capture has a 10s timeout — if it fails, an error is shown immediately.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView, Modal,
  Platform, PermissionsAndroid, Alert, ActivityIndicator
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import ViewShot from 'react-native-view-shot';
import { NativeModules } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

const { WatermarkModule } = NativeModules;

// ─── Helpers ──────────────────────────────────────────────────────────────

type GpsTier = 'searching' | 'stabilizing' | 'locked' | 'nofix';

function accuracyTier(acc: number): { color: string; status: GpsTier } {
  if (acc <= 10) return { color: '#22c55e', status: 'locked' };
  if (acc <= 20) return { color: '#f59e0b', status: 'stabilizing' };
  return { color: '#ef4444', status: 'nofix' };
}

function fmtCoord(n: number): string {
  return n.toFixed(6);
}

function formatTs(): string {
  return new Date().toISOString().replace('T', ' ').substring(0, 19);
}

/** Wrap a promise with a timeout — resolves to null on timeout */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<T | null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

async function reqPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'ThufuDeploy needs location access to capture GPS coordinates on the map.',
        buttonNeutral: 'Ask Later', buttonNegative: 'Cancel', buttonPositive: 'OK',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch { return false; }
}

async function getFix(): Promise<{ lat: number; lng: number; alt: number | null; accuracy: number }> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        alt: pos.coords.altitude ?? null,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

// OSM HTML — renders map, marker, accuracy circle, live coords overlay
function buildHtml(lat: number, lng: number, accuracy: number): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#1a1a2e}
#map{width:100vw;height:100vh;position:relative;overflow:hidden}
.leaflet-container{width:100%;height:100%;background:#1a1a2e}
#coords{
  position:absolute;bottom:0;left:0;right:0;
  background:rgba(0,0,0,0.82);
  color:#fff;font-family:monospace;font-size:13px;
  padding:8px 14px;z-index:1000;
  display:flex;gap:18px;flex-wrap:wrap;
}
.stat{opacity:.9}
.stat span{color:#93c5fd;font-weight:600}
</style>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
</head>
<body>
<div id="map">
  <div id="coords">
    <div class="stat">LAT <span id="lat">${fmtCoord(lat)}</span></div>
    <div class="stat">LNG <span id="lng">${fmtCoord(lng)}</span></div>
    <div class="stat">ACC <span id="acc">&lt;${Math.round(accuracy)}m</span></div>
    <div class="stat">ALT <span id="alt">--</span></div>
  </div>
</div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${lat},${lng}],17);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
var marker=null;
var accRing=null;
function updatePos(lat,lng,acc,alt){
  document.getElementById('lat').textContent=lat.toFixed(6);
  document.getElementById('lng').textContent=lng.toFixed(6);
  document.getElementById('acc').textContent='<'+Math.round(acc)+'m';
  document.getElementById('alt').textContent=alt?Math.round(alt)+'m':'--';
  if(!marker){marker=L.circleMarker([lat,lng],{radius:8,fillColor:'#3b82f6',color:'#fff',weight:2,fillOpacity:1}).addTo(map);}
  else marker.setLatLng([lat,lng]);
  if(!accRing){accRing=L.circle([lat,lng],acc,{fillColor:'#3b82f6',fillOpacity:.08,color:'#3b82f6',weight:2,opacity:.4}).addTo(map);}
  else{accRing.setLatLng([lat,lng]);accRing.setRadius(acc);}
  map.setView([lat,lng],map.getZoom());
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'gps_update',lat,lng,acc,alt:alt||0}));
}
updatePos(${lat},${lng},${accuracy},null);
window.addEventListener('message',function(e){
  try{var d=JSON.parse(e.data);if(d.type==='position')updatePos(d.lat,d.lng,d.acc,d.alt);}catch{}
});
window.onRNMapReady=function(){window.ReactNativeWebView.postMessage(JSON.stringify({type:'map_ready'}));};
window.mapReady=true;
window.ReactNativeWebView.postMessage(JSON.stringify({type:'map_ready'}));
</script>
</body>
</html>`;
}

// ─── Props ────────────────────────────────────────────────────────────────
interface GpsCaptureScreenProps {
  visible: boolean;
  siteId: string;
  siteName: string;
  onResult: (data: {
    screenshotPath: string;
    latitude: number;
    longitude: number;
    altitude: number;
    accuracy: number;
    timestamp: string;
  }) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────
export default function GpsCaptureScreen({ visible, siteId, siteName, onResult, onClose }: GpsCaptureScreenProps) {
  const webViewRef = useRef<WebView>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(false);

  const [html, setHtml] = useState<string>('');
  const [mapReady, setMapReady] = useState(false);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number; alt: number | null; accuracy: number } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [tier, setTier] = useState<{ color: string; status: GpsTier }>({ color: '#f59e0b', status: 'searching' });

  const statusLabel = (() => {
    if (tier.status === 'locked') return 'GPS LOCKED — Ready to capture';
    if (tier.status === 'stabilizing') return `Accuracy: <${Math.round(currentPos?.accuracy ?? 0)}m — stabilizing...`;
    if (tier.status === 'nofix') return 'Weak signal — move outdoors';
    return 'Searching for GPS...';
  })();

  const canCapture = mapReady && tier.status === 'locked' && !capturing;

  // ── GPS polling — non-async, uses refs for stability ──────────────────
  useEffect(() => {
    if (!visible) return;
    mountedRef.current = true;
    let pollCount = 0;

    const startPolling = async () => {
      const ok = await reqPermission();
      if (!ok || !mountedRef.current) { onClose(); return; }

      // First fix
      try {
        const pos = await getFix();
        if (!mountedRef.current) return;
        setCurrentPos(pos);
        setTier(accuracyTier(pos.accuracy));
        setHtml(buildHtml(pos.lat, pos.lng, pos.accuracy));
        setMapReady(true);
      } catch {
        if (!mountedRef.current) return;
        setHtml(buildHtml(0.3476, 32.5825, 999));
      }

      // Poll every 2s
      pollTimerRef.current = setInterval(async () => {
        if (!mountedRef.current) return;
        pollCount++;
        try {
          const p = await getFix();
          if (!mountedRef.current) return;
          setCurrentPos(p);
          setTier(accuracyTier(p.accuracy));
          if (webViewRef.current) {
            webViewRef.current.injectJavaScript(
              `updatePos(${p.lat},${p.lng},${p.accuracy},${p.alt || 0})`
            );
          }
        } catch {
          // Keep polling
        }
        // Give up after 60s
        if (pollCount >= 30) {
          if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
        }
      }, 2000);
    };

    startPolling();

    // Clean unmount — synchronous, no async issues
    return () => {
      mountedRef.current = false;
      if (pollTimerRef.current) { clearInterval(pollTimerRef.current); pollTimerRef.current = null; }
    };
  }, [visible]);

  // ── Capture with 10s timeout ──────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    if (!currentPos || !viewShotRef.current) return;
    setCapturing(true);
    try {
      // Wrap capture in 10s timeout — prevents infinite hang
      const uri = await withTimeout(
        (viewShotRef.current as any).capture(),
        10000,
      );
      if (!uri) {
        Alert.alert('Capture Failed', 'Screenshot timed out. Please try again.');
        setCapturing(false);
        return;
      }

      const ts = formatTs();
      // Wrap watermark in 10s timeout too
      const resultUri = await withTimeout(
        WatermarkModule.addWatermark(uri, siteId, siteName, currentPos.lat, currentPos.lng, ts),
        10000,
      );
      if (!resultUri) {
        // Watermark failed — use unwatermarked image so user doesn't lose their capture
        onResult({
          screenshotPath: uri,
          latitude: currentPos.lat,
          longitude: currentPos.lng,
          altitude: currentPos.alt || 0,
          accuracy: currentPos.accuracy,
          timestamp: ts,
        });
        return;
      }

      onResult({
        screenshotPath: resultUri,
        latitude: currentPos.lat,
        longitude: currentPos.lng,
        altitude: currentPos.alt || 0,
        accuracy: currentPos.accuracy,
        timestamp: ts,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Capture Failed', msg);
    } finally {
      setCapturing(false);
    }
  }, [currentPos, siteId, siteName, onResult]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>📍 GPS Screenshot Capture</Text>
          <View style={styles.closeBtn} />
        </View>

        {/* Status bar */}
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, { backgroundColor: tier.color }]} />
          <Text style={[styles.statusText, { color: tier.color }]}>{statusLabel}</Text>
        </View>

        {/* Accuracy details row */}
        {currentPos && (
          <View style={styles.coordsRow}>
            <Text style={styles.coordItem}>LAT  {fmtCoord(currentPos.lat)}</Text>
            <Text style={styles.coordItem}>LNG  {fmtCoord(currentPos.lng)}</Text>
            <Text style={styles.coordItem}>ACC  &lt;{Math.round(currentPos.accuracy)}m</Text>
            <Text style={styles.coordItem}>ALT  {currentPos.alt ? `${Math.round(currentPos.alt)}m` : '--'}</Text>
          </View>
        )}

        {/* OSM Map WebView (captured by ViewShot) */}
        <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.9 }} style={styles.mapContainer}>
          {html ? (
            <WebView
              ref={webViewRef}
              source={{ html, baseUrl: '' }}
              style={styles.webview}
              scrollEnabled={false}
              onMessage={(e: WebViewMessageEvent) => {
                try {
                  const d = JSON.parse(e.nativeEvent.data);
                  if (d.type === 'map_ready') setMapReady(true);
                } catch { /* ignore */ }
              }}
              // Reliable: mark map ready as soon as page finishes loading
              onLoadEnd={() => setMapReady(true)}
              javaScriptEnabled
              domStorageEnabled={false}
              originWhitelist={['*']}
            />
          ) : (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color="#3b82f6" />
              <Text style={styles.loadingText}>Getting GPS fix...</Text>
            </View>
          )}
        </ViewShot>

        {/* Site info badge */}
        <View style={styles.siteBadge}>
          <Text style={styles.siteBadgeId}>{siteId}</Text>
          <Text style={styles.siteBadgeName}>{siteName}</Text>
        </View>

        {/* Footer + Capture button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.captureBtn, !canCapture && styles.captureBtnDisabled]}
            onPress={handleCapture}
            disabled={!canCapture}
          >
            {capturing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.captureBtnText}>TAP CAPTURE</Text>
            )}
          </TouchableOpacity>
          {!canCapture && (
            <Text style={styles.footerHint}>
              {tier.status === 'locked' ? ''
                : tier.status === 'searching' ? 'Waiting for GPS fix...'
                : tier.status === 'stabilizing' ? 'Keep still — accuracy improving...'
                : 'Move outdoors for GPS signal'}
            </Text>
          )}
        </View>

      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f23' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#1a1a2e', borderBottomWidth: 1, borderBottomColor: '#2a2a4e',
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { color: '#fff', fontSize: 20 },
  headerTitle: { color: '#fff', fontSize: 15, fontWeight: '700', fontFamily: 'monospace' },
  statusBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#1a1a2e',
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  statusText: { fontSize: 13, fontWeight: '600', flex: 1, fontFamily: 'monospace' },
  coordsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16,
    paddingHorizontal: 16, paddingVertical: 6,
    backgroundColor: '#12122a',
    borderBottomWidth: 1, borderBottomColor: '#2a2a4e',
  },
  coordItem: { color: '#94a3b8', fontSize: 12, fontFamily: 'monospace', minWidth: 130 },
  mapContainer: { flex: 1, backgroundColor: '#1a1a2e' },
  webview: { flex: 1, backgroundColor: '#1a1a2e' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#94a3b8', marginTop: 12, fontFamily: 'monospace' },
  siteBadge: {
    position: 'absolute', top: 68, left: 12,
    backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  siteBadgeId: { color: '#fff', fontSize: 12, fontWeight: '700', fontFamily: 'monospace' },
  siteBadgeName: { color: '#94a3b8', fontSize: 11, fontFamily: 'monospace' },
  footer: {
    backgroundColor: '#1a1a2e',
    padding: 16, paddingBottom: 36, alignItems: 'center',
    borderTopWidth: 1, borderTopColor: '#2a2a4e',
  },
  captureBtn: {
    backgroundColor: '#3b82f6', borderRadius: 12,
    paddingVertical: 16, paddingHorizontal: 48,
    alignItems: 'center', justifyContent: 'center', width: '100%',
  },
  captureBtnDisabled: { backgroundColor: '#334155', opacity: 0.6 },
  captureBtnText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 1.5, fontFamily: 'monospace' },
  footerHint: { color: '#64748b', fontSize: 12, marginTop: 10, fontFamily: 'monospace' },
});
