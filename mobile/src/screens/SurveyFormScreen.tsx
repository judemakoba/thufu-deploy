import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, Switch, Platform, PermissionsAndroid, Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { getTemplate, syncSubmission, addToQueue } from '../lib/api';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SurveyForm'>;
  route: RouteProp<RootStackParamList, 'SurveyForm'>;
};

interface Question {
  id: string;
  field_name: string;
  label: string;
  input_type: string;
  required: number; // 0 or 1 from backend
  options: string | null; // JSON string from backend
}

function parseOptions(opts: string | null): { value: string; label: string }[] {
  if (!opts) return [];
  try { return JSON.parse(opts); } catch { return []; }
}

interface Section {
  id: string;
  name: string;
  questions: Question[];
}

// Auto-fill fields
const AUTOFILL_FIELDS = ['technician_name', 'survey_date', 'latitude', 'longitude', 'altitude', 'gps_accuracy'];

export default function SurveyFormScreen({ navigation, route }: Props) {
  const { assignmentId, templateId, recordType } = route.params;

  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [photos, setPhotos] = useState<Record<string, string[]>>({}); // field_name → URIs
  const [gps, setGps] = useState<{ lat: number; lng: number; alt: number; accuracy: number } | null>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [draftId, setDraftId] = useState<string | null>(null);

  // Load draft from local storage
  const loadDraft = async () => {
    const raw = await AsyncStorage.getItem(`draft_${assignmentId}`);
    if (raw) {
      const draft = JSON.parse(raw);
      setDraftId(draft.submission_id);
      setAnswers(draft.answers || {});
      setPhotos(draft.photos || {});
    }
  };

  // Auto-fill device data
  const autoFill = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location permission is needed for GPS auto-fill.');
      return;
    }

    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    const { latitude, longitude, altitude, accuracy } = location.coords;
    setGps({ lat: latitude, lng: longitude, alt: altitude || 0, accuracy });
    setAnswers(prev => ({
      ...prev,
      latitude, longitude, altitude,
      gps_accuracy: accuracy,
      survey_date: new Date().toISOString(),
    }));

    // Auto-fill technician name from stored profile
    const userRaw = await AsyncStorage.getItem('thufu_user');
    if (userRaw) {
      const user = JSON.parse(userRaw);
      setAnswers(prev => ({ ...prev, technician_name: user.full_name }));
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadDraft();
      await autoFill();

      try {
        const res = await getTemplate(templateId);
        setSections(res.data.data.sections || []);
      } catch (err) {
        Alert.alert('Error', 'Failed to load form template');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  // Auto-save draft to local storage
  const saveDraft = async (answersToSave: Record<string, unknown>, photosToSave: Record<string, string[]>) => {
    const draftData = {
      submission_id: draftId,
      assignment_id: assignmentId,
      site_id: route.params?.site_id || 'unknown',
      answers: answersToSave,
      photos: photosToSave,
      saved_at: Date.now(),
    };
    await AsyncStorage.setItem(`draft_${assignmentId}`, JSON.stringify(draftData));
  };

  const handleAnswer = (field: string, value: unknown) => {
    const updated = { ...answers, [field]: value };
    setAnswers(updated);
    saveDraft(updated, photos);
  };

  const takePhoto = async (fieldName: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Camera access required'); return; }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
     地理: gps ? { latitude: gps.lat, longitude: gps.lng } : undefined,
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      const updated = { ...photos, [fieldName]: [...(photos[fieldName] || []), uri] };
      setPhotos(updated);
      handleAnswer(fieldName, updated[fieldName]);
    }
  };

  const pickPhoto = async (fieldName: string) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Photo library access required'); return; }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      const uris = result.assets.map(a => a.uri);
      const updated = { ...photos, [fieldName]: [...(photos[fieldName] || []), ...uris] };
      setPhotos(updated);
      handleAnswer(fieldName, updated[fieldName]);
    }
  };

  const removePhoto = (fieldName: string, index: number) => {
    const updated = { ...photos[fieldName] || [] };
    updated.splice(index, 1);
    setPhotos({ ...photos, [fieldName]: updated });
    handleAnswer(fieldName, updated);
  };

  const handleSubmit = async () => {
    // Validate required fields
    const missing: string[] = [];
    for (const section of sections) {
      for (const q of section.questions) {
        if (q.required === 1) {
          const val = answers[q.field_name];
          if (!val || (Array.isArray(val) && val.length === 0)) {
            missing.push(q.label);
          }
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
            // Get site_id from draft or assignment
            const draftRaw = await AsyncStorage.getItem(`draft_${assignmentId}`);
            const siteId = draftRaw ? JSON.parse(draftRaw).site_id : 'unknown';

            const payload = {
              record_type: recordType,
              submission_id: draftId || undefined,
              site_id: siteId,
              answers: {
                ...answers,
                technician_contact: answers.technician_contact || '',
                contractor_name: 'Innovis',
              },
            };

            try {
              const res = await syncSubmission(payload);
              setDraftId(res.data.data.submission_id);
              await AsyncStorage.removeItem(`draft_${assignmentId}`);
              Alert.alert('Success', 'Survey submitted successfully!');
              navigation.navigate('Home');
            } catch {
              // Offline — add to queue
              await addToQueue({ type: 'sync', payload, timestamp: Date.now() });
              Alert.alert('Offline Saved', 'No internet connection. Your survey has been saved and will sync automatically when online.');
              navigation.navigate('Home');
            }
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const draftRaw = await AsyncStorage.getItem(`draft_${assignmentId}`);
      const siteId = draftRaw ? JSON.parse(draftRaw).site_id : 'unknown';

      await saveDraft(answers, photos);
      Alert.alert('Draft Saved', 'Your progress has been saved locally.');
    } finally {
      setSaving(false);
    }
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

            {/* Text / Number input */}
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

            {/* GPS Auto */}
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

            {/* Photo */}
            {q.input_type === 'photo' && (
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
                      <View key={idx} style={styles.photoThumb}>
                        <Image source={{ uri }} style={styles.photoThumbImg} />
                        <TouchableOpacity style={styles.photoRemove} onPress={() => removePhoto(q.field_name, idx)}>
                          <Text style={{ color: '#fff', fontSize: 12 }}>✕</Text>
                        </TouchableOpacity>
                      </View>
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
    </View>
  );
}

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
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, backgroundColor: '#fff' },
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
  photoThumb: { marginRight: 8, position: 'relative' },
  photoThumbImg: { width: 72, height: 72, borderRadius: 8 },
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
