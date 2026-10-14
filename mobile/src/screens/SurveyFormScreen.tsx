import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Switch, Platform, PermissionsAndroid, Image, Linking, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchCamera, launchImageLibrary, CameraOptions, ImagePickerResponse } from 'react-native-image-picker';
import Geolocation from '@react-native-community/geolocation';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { getTemplate, syncSubmission, addToQueue } from '../lib/api';
import GpsCaptureScreen from './GpsCaptureScreen';

// ─────────────────────────────────────────────────────────────────────────────
// PERMISSION HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Request camera permission on Android */
async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
      {
        title: 'Camera Permission',
        message: 'ThufuDeploy needs camera access to photograph site equipment, name plates, and survey documentation.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'Allow',
      },
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  } catch { return false; }
}

/** Request storage permission on Android (saving drafts) */
async function requestStoragePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version < 33) {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        { title: 'Storage Permission', message: 'ThufuDeploy needs storage access to save survey drafts and photos.', buttonNeutral: 'Ask Me Later', buttonNegative: 'Cancel', buttonPositive: 'Allow' },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch { return false; }
  }
  return true;
}

/** Open device settings page */
function openSettings(): void { Linking.openSettings(); }

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SurveyForm'>;
  route: RouteProp<RootStackParamList, 'SurveyForm'>;
};

interface Question {
  id: string;
  field_name: string;
  label: string;
  input_type: string;
  required: number;
  options: string | null;
}

interface Section {
  id: string;
  name: string;
  questions: Question[];
}

function parseOptions(opts: string | null): { value: string; label: string }[] {
  if (!opts) return [];
  try { return JSON.parse(opts); } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function SurveyFormScreen({ navigation, route }: Props) {
  const { assignmentId, templateId, recordType, site_id, site_name } = route.params;

  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [gps, setGps] = useState<{ lat: number; lng: number; alt: number; accuracy: number } | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [showGpsCapture, setShowGpsCapture] = useState(false);
  const [gpsScreenshotField, setGpsScreenshotField] = useState<string>('');
  const gpsWatchIdRef = useRef<number | null>(null);
  const gpsFilledRef = useRef(false); // fill answers once on first good fix

  // Load saved draft
  const loadDraft = async () => {
    const raw = await AsyncStorage.getItem(`draft_${assignmentId}`);
    if (raw) {
      const draft = JSON.parse(raw);
      setDraftId(draft.submission_id);
      setAnswers(draft.answers || {});
      setPhotos(draft.photos || {});
    }
  };

  // Auto-fill GPS — polls getCurrentPosition every 2s, fills on first fix, then stops
  const autoFill = async () => {
    // Technician name
    try {
      const userRaw = await AsyncStorage.getItem('thufu_user');
      if (userRaw) {
        const user = JSON.parse(userRaw);
        setAnswers(prev => ({ ...prev, technician_name: user.full_name || user.name || '' }));
      }
    } catch { /* ignore */ }

    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 60s max

    const poll = async () => {
      if (gpsFilledRef.current) return; // already filled
      attempts++;
      try {
        const pos = await new Promise<Geolocation.GeoPosition>((resolve, reject) => {
          Geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0,
          });
        });
        const { latitude, longitude, altitude, accuracy } = pos.coords;
        setGps({ lat: latitude, lng: longitude, alt: altitude ?? 0, accuracy });
        if (!gpsFilledRef.current) {
          gpsFilledRef.current = true;
          clearInterval(gpsWatchIdRef.current ?? undefined);
          gpsWatchIdRef.current = null;
          setAnswers(prev => ({
            ...prev,
            latitude,
            longitude,
            altitude: altitude ?? 0,
            gps_accuracy: accuracy,
            survey_date: new Date().toISOString(),
          }));
        }
      } catch (err) {
        if (attempts >= MAX_ATTEMPTS) {
          clearInterval(gpsWatchIdRef.current ?? undefined);
          gpsWatchIdRef.current = null;
          const msg = err instanceof Error ? err.message : 'Unknown error';
          if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('denied')) {
            Alert.alert('Location Permission Required', 'ThufuDeploy needs location access. Please enable it in Settings.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: openSettings },
            ]);
          } else {
            Alert.alert('GPS Error', 'Could not get GPS coordinates: ' + msg + '. Coordinates can be entered manually.');
          }
        }
      }
    };

    // Immediate first attempt
    await poll();
    // Then poll every 2s
    if (!gpsFilledRef.current) {
      gpsWatchIdRef.current = setInterval(poll, 2000) as unknown as number;
    }
  };

  useEffect(() => {
    const init = async () => {
      await requestStoragePermission();
      await loadDraft();
      await autoFill();
      try {
        const res = await getTemplate(templateId);
        setSections(res.data.data.sections || []);
      } catch {
        Alert.alert('Error', 'Failed to load form template. Check your connection.');
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => {
      // Stop GPS polling on unmount
      if (gpsWatchIdRef.current !== null) {
        clearInterval(gpsWatchIdRef.current);
        gpsWatchIdRef.current = null;
      }
    };
  }, []);

  // Auto-save draft
  const saveDraft = async (a: Record<string, unknown>, p: Record<string, string[]>) => {
    await AsyncStorage.setItem(`draft_${assignmentId}`, JSON.stringify({
      submission_id: draftId, assignment_id: assignmentId, site_id: site_id,
      answers: a, photos: p, saved_at: Date.now(),
    }));
  };

  const handleAnswer = (field: string, value: unknown) => {
    const updated = { ...answers, [field]: value };
    setAnswers(updated);
    saveDraft(updated, photos);
  };

  const takePhoto = async (fieldName: string) => {
    const hasCamera = await requestCameraPermission();
    if (!hasCamera) {
      Alert.alert('Camera Permission Required', 'ThufuDeploy needs camera access. Please enable it in Settings.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: openSettings },
      ]);
      return;
    }
    const options: CameraOptions = {
      mediaType: 'photo', cameraType: 'back',
      maxWidth: 1920, maxHeight: 1920, quality: 0.7, saveToPhotos: false,
    };
    launchCamera(options, (response: ImagePickerResponse) => {
      if (response.didCancel) return;
      if (response.errorCode) { Alert.alert('Camera Error', response.errorMessage || 'Failed to open camera.'); return; }
      const asset = response.assets?.[0];
      if (asset?.uri) {
        const updated = { ...photos, [fieldName]: [...(photos[fieldName] || []), asset.uri] };
        setPhotos(updated);
        handleAnswer(fieldName, updated[fieldName]);
      }
    });
  };

  const pickPhoto = async (fieldName: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const options: CameraOptions = { mediaType: 'photo', selectionLimit: 10, maxWidth: 1920, maxHeight: 1920, quality: 0.7 } as any;
    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel) return;
      if (response.errorCode) { Alert.alert('Gallery Error', response.errorMessage || 'Failed to open gallery.'); return; }
      const uris = (response.assets || []).map(a => a.uri).filter(Boolean) as string[];
      if (uris.length > 0) {
        const updated = { ...photos, [fieldName]: [...(photos[fieldName] || []), ...uris] };
        setPhotos(updated);
        handleAnswer(fieldName, updated[fieldName]);
      }
    });
  };

  const removePhoto = (fieldName: string, index: number) => {
    const updated = [...(photos[fieldName] || [])];
    updated.splice(index, 1);
    setPhotos({ ...photos, [fieldName]: updated });
    handleAnswer(fieldName, updated);
  };

  const handleSubmit = async () => {
    const missing: string[] = [];
    for (const section of sections) {
      for (const q of section.questions) {
        if (q.required === 1) {
          const val = answers[q.field_name];
          if (!val || (Array.isArray(val) && val.length === 0)) missing.push(q.label);
        }
      }
    }
    if (missing.length > 0) {
      Alert.alert('Missing Required Fields', `Please fill:\n${missing.join('\n')}`);
      return;
    }
    Alert.alert('Submit Survey', 'Save and submit this survey?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Submit', onPress: async () => {
          setSaving(true);
          try {
            const payload = {
              record_type: recordType,
              submission_id: draftId || undefined,
              site_id: site_id,
              answers: { ...answers, contractor_name: 'Innovis' },
            };
            try {
              const res = await syncSubmission(payload);
              setDraftId(res.data.data.submission_id);
              await AsyncStorage.removeItem(`draft_${assignmentId}`);
              Alert.alert('Success', 'Survey submitted successfully!');
              navigation.navigate('Home');
            } catch {
              await addToQueue({ type: 'sync', payload, timestamp: Date.now() });
              Alert.alert('Offline Saved', 'No internet. Your survey will sync when online.');
              navigation.navigate('Home');
            }
          } finally { setSaving(false); }
        },
      },
    ]);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try { await saveDraft(answers, photos); Alert.alert('Draft Saved', 'Your progress has been saved locally.'); }
    finally { setSaving(false); }
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;

  const currentSectionData = sections[currentSection];
  const progress = sections.length > 0 ? ((currentSection + 1) / sections.length) * 100 : 0;

  return (
    <View style={styles.container}>

      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.progressText}>
        <Text style={styles.sectionLabel}>{currentSectionData?.name || 'Loading...'}</Text>
        <Text style={styles.sectionCount}>{currentSection + 1} / {sections.length}</Text>
      </View>

      {/* GPS Status */}
      {gps && (
        <View style={styles.gpsBadge}>
          <Text style={styles.gpsText}>📍 {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)} (±{Math.round(gps.accuracy)}m)</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        {currentSectionData?.questions.map(q => (
          <View key={q.id} style={styles.field}>
            <View style={styles.fieldHeader}>
              <Text style={styles.fieldLabel}>{q.label}</Text>
              {q.required === 1 && <Text style={styles.required}>*</Text>}
            </View>

            {/* Text / Number / Textarea */}
            {(q.input_type === 'text' || q.input_type === 'number' || q.input_type === 'textarea') && (
              <TextInput
                style={[styles.input, q.input_type === 'textarea' && styles.textarea]}
                value={String(answers[q.field_name] || '')}
                onChangeText={val => handleAnswer(q.field_name, val)}
                placeholder={`Enter ${q.label.toLowerCase()}`}
                multiline={q.input_type === 'textarea'}
                keyboardType={q.input_type === 'number' ? 'numeric' : 'default'}
              />
            )}

            {/* GPS Auto-fill */}
            {q.input_type === 'gps' && (
              <View>
                <TextInput
                  style={[styles.input, { backgroundColor: '#f9fafb' }]}
                  value={gps ? String(answers[q.field_name] || '') : 'Capturing GPS...'}
                  editable={false}
                  placeholder="GPS auto-filled"
                />
                <TouchableOpacity style={styles.gpsButton} onPress={autoFill}>
                  <Text style={styles.gpsButtonText}>🔄 Refresh GPS</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Date (auto) */}
            {q.input_type === 'date' && (
              <TextInput
                style={[styles.input, { backgroundColor: '#f9fafb' }]}
                value={answers[q.field_name] ? String(answers[q.field_name]).split('T')[0] : new Date().toISOString().split('T')[0]}
                editable={false}
              />
            )}

            {/* Dropdown */}
            {q.input_type === 'dropdown' && parseOptions(q.options).length > 0 && (
              <View style={styles.optionsGrid}>
                {parseOptions(q.options).map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.optionButton, answers[q.field_name] === opt.value && styles.optionSelected]}
                    onPress={() => handleAnswer(q.field_name, opt.value)}
                  >
                    <Text style={[styles.optionText, answers[q.field_name] === opt.value && styles.optionTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Checkbox */}
            {q.input_type === 'checkbox' && (
              <Switch
                value={!!answers[q.field_name]}
                onValueChange={val => handleAnswer(q.field_name, val)}
                trackColor={{ false: '#e5e7eb', true: '#93c5fd' }}
                thumbColor={answers[q.field_name] ? '#2563eb' : '#f9fafb'}
              />
            )}

            {/* Multiselect */}
            {q.input_type === 'multiselect' && parseOptions(q.options).length > 0 && (
              <View style={styles.optionsGrid}>
                {parseOptions(q.options).map(opt => {
                  const selected = (answers[q.field_name] as string[] || []).includes(opt.value);
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.optionButton, selected && styles.optionSelected]}
                      onPress={() => {
                        const current = answers[q.field_name] as string[] || [];
                        const updated = selected ? current.filter(v => v !== opt.value) : [...current, opt.value];
                        handleAnswer(q.field_name, updated);
                      }}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>✓ {opt.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Photo — GPS Screenshot special case */}
            {q.input_type === 'photo' && q.field_name === 'gps_screenshot' && (
              <View>
                <TouchableOpacity
                  style={[styles.photoButton, { backgroundColor: '#0f766e' }]}
                  onPress={() => { setGpsScreenshotField(q.field_name); setShowGpsCapture(true); }}
                >
                  <Text style={styles.photoButtonText}>📍 Capture GPS Screenshot</Text>
                </TouchableOpacity>
                {(photos[q.field_name] || []).length > 0 && (
                  <ScrollView horizontal style={styles.photoPreviewRow} showsHorizontalScrollIndicator={false}>
                    {(photos[q.field_name] || []).map((uri, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.photoThumb}
                        onPress={() => setPreviewPhoto(uri)}
                        activeOpacity={0.85}
                      >
                        <Image source={{ uri }} style={styles.photoThumbImg} />
                        <View style={styles.photoMagnify}>
                          <Text style={styles.photoMagnifyText}>⤢</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.photoRemove}
                          onPress={() => removePhoto(q.field_name, idx)}
                        >
                          <Text style={{ color: '#fff', fontSize: 11 }}>✕</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                {(photos[q.field_name] || []).length === 0 && (
                  <Text style={styles.photoCount}>No GPS screenshot captured yet</Text>
                )}
              </View>
            )}

            {/* Photo — regular camera */}
            {q.input_type === 'photo' && q.field_name !== 'gps_screenshot' && (
              <View>
                <View style={styles.photoActions}>
                  <TouchableOpacity style={styles.photoButton} onPress={() => takePhoto(q.field_name)}>
                    <Text style={styles.photoButtonText}>📷 Take Photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.photoButton, { backgroundColor: '#6b7280' }]} onPress={() => pickPhoto(q.field_name)}>
                    <Text style={styles.photoButtonText}>🖼️ Gallery</Text>
                  </TouchableOpacity>
                </View>
                {(photos[q.field_name] || []).length > 0 && (
                  <ScrollView horizontal style={styles.photoPreviewRow} showsHorizontalScrollIndicator={false}>
                    {(photos[q.field_name] || []).map((uri, idx) => (
                      <TouchableOpacity
                        key={idx}
                        style={styles.photoThumb}
                        onPress={() => setPreviewPhoto(uri)}
                        activeOpacity={0.85}
                      >
                        <Image source={{ uri }} style={styles.photoThumbImg} />
                        <View style={styles.photoMagnify}>
                          <Text style={styles.photoMagnifyText}>⤢</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.photoRemove}
                          onPress={() => removePhoto(q.field_name, idx)}
                        >
                          <Text style={{ color: '#fff', fontSize: 11 }}>✕</Text>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
                <Text style={styles.photoCount}>
                  {(photos[q.field_name] || []).length} photo(s) attached
                </Text>
              </View>
            )}

            {/* Signature placeholder */}
            {q.input_type === 'signature' && (
              <View style={styles.signatureBox}>
                <Text style={styles.signaturePlaceholder}>Signature pad (integrate react-native-signature-canvas)</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.bottomBtn}
          onPress={() => { if (currentSection > 0) setCurrentSection(cs => cs - 1); }}
          disabled={currentSection === 0}
        >
          <Text style={[styles.bottomBtnText, currentSection === 0 && styles.bottomBtnDisabled]}>← Previous</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveDraftBtn]} onPress={handleSaveDraft} disabled={saving}>
          <Text style={styles.saveDraftText}>{saving ? '...' : '💾 Save Draft'}</Text>
        </TouchableOpacity>

        {currentSection < sections.length - 1 ? (
          <TouchableOpacity style={styles.bottomBtn} onPress={() => setCurrentSection(cs => cs + 1)}>
            <Text style={styles.bottomBtnText}>Next →</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.bottomBtn, styles.submitBtn]} onPress={handleSubmit} disabled={saving}>
            <Text style={styles.submitBtnText}>{saving ? 'Submitting...' : '✅ Submit'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Full-Screen Photo Preview Modal ─────────────────────────────── */}
      <Modal visible={!!previewPhoto} transparent animationType="fade" onRequestClose={() => setPreviewPhoto(null)}>
        <View style={previewStyles.overlay}>
          <TouchableOpacity style={previewStyles.closeArea} onPress={() => setPreviewPhoto(null)} activeOpacity={1} />
          <Image source={{ uri: previewPhoto || '' }} style={previewStyles.fullImage} resizeMode="contain" />
          <TouchableOpacity style={previewStyles.closeBtn} onPress={() => setPreviewPhoto(null)}>
            <Text style={previewStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── GPS Screenshot Capture Modal ───────────────────────────────── */}
      <GpsCaptureScreen
        visible={showGpsCapture}
        siteId={site_id}
        siteName={site_name}
        onResult={(data) => {
          // Add to photos under the gps_screenshot field
          const fieldName = gpsScreenshotField || 'gps_screenshot';
          const updated = { ...photos, [fieldName]: [...(photos[fieldName] || []), data.screenshotPath] };
          setPhotos(updated);
          // Also fill in GPS answers
          setAnswers(prev => ({
            ...prev,
            latitude: data.latitude,
            longitude: data.longitude,
            altitude: data.altitude,
            gps_accuracy: data.accuracy,
          }));
          setGps({ lat: data.latitude, lng: data.longitude, alt: data.altitude, accuracy: data.accuracy });
          handleAnswer(fieldName, updated[fieldName]);
          setShowGpsCapture(false);
        }}
        onClose={() => setShowGpsCapture(false)}
      />

    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  progressBar: { height: 4, backgroundColor: '#e5e7eb' },
  progressFill: { height: 4, backgroundColor: '#2563eb' },
  progressText: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  sectionCount: { fontSize: 13, color: '#6b7280' },
  gpsBadge: { backgroundColor: '#dbeafe', paddingHorizontal: 16, paddingVertical: 6 },
  gpsText: { color: '#2563eb', fontSize: 12, fontWeight: '500' },
  scroll: { flex: 1 },
  field: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4 },
  fieldHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  required: { color: '#ef4444', marginLeft: 4, fontSize: 16 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#fff', color: '#1f2937' },
  textarea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#d1d5db', backgroundColor: '#fff' },
  optionSelected: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  optionText: { fontSize: 13, color: '#374151' },
  optionTextSelected: { color: '#fff', fontWeight: '600' },
  photoActions: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  photoButton: { flex: 1, backgroundColor: '#2563eb', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  photoButtonText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  photoPreviewRow: { flexDirection: 'row', marginBottom: 8 },
  photoThumb: { marginRight: 8, position: 'relative', borderRadius: 8, overflow: 'hidden' },
  photoThumbImg: { width: 72, height: 72 },
  photoMagnify: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1 },
  photoMagnifyText: { color: '#fff', fontSize: 10 },
  photoRemove: { position: 'absolute', top: -6, right: -6, backgroundColor: '#ef4444', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  photoCount: { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  gpsButton: { marginTop: 8, alignSelf: 'flex-start' },
  gpsButtonText: { color: '#2563eb', fontSize: 13, fontWeight: '500' },
  signatureBox: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 16, alignItems: 'center', backgroundColor: '#f9fafb' },
  signaturePlaceholder: { color: '#9ca3af', fontSize: 13 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e5e7eb', gap: 8 },
  bottomBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  bottomBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  bottomBtnDisabled: { color: '#d1d5db' },
  saveDraftBtn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  saveDraftText: { fontSize: 14, fontWeight: '500', color: '#6b7280' },
  submitBtn: { backgroundColor: '#10b981', borderColor: '#10b981' },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});

const previewStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '85%' },
  closeArea: { position: 'absolute', top: 0, left: 0, right: 0, height: '15%' },
  closeBtn: {
    position: 'absolute', top: 48, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 20 },
});
