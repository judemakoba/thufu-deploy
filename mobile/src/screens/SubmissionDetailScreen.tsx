import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getSubmission } from '../lib/api';
import { useEffect, useState } from 'react';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'SubmissionDetail'>;
  route: RouteProp<RootStackParamList, 'SubmissionDetail'>;
};

export default function SubmissionDetailScreen({ route }: Props) {
  const { submissionId } = route.params;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSubmission(submissionId)
      .then(r => setData(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [submissionId]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;
  if (!data) return <View style={styles.centered}><Text>Submission not found</Text></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.atcId}>{data.site_id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: data.status === 'approved' ? '#d1fae5' : data.status === 'rejected' ? '#fee2e2' : '#dbeafe' }]}>
          <Text style={{ color: data.status === 'approved' ? '#059669' : data.status === 'rejected' ? '#dc2626' : '#2563eb', fontSize: 14, fontWeight: '600' }}>
            {data.status?.toUpperCase()}
          </Text>
        </View>
      </View>
      <Text style={styles.siteName}>{data.site_name}</Text>
      <Text style={styles.meta}>Type: {data.record_type}</Text>
      <Text style={styles.meta}>Submitted: {data.submitted_at ? new Date(data.submitted_at).toLocaleString() : '—'}</Text>
      {data.review_notes && (
        <View style={styles.reviewNotes}>
          <Text style={styles.reviewLabel}>Review Notes:</Text>
          <Text style={styles.reviewText}>{data.review_notes}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  atcId: { fontFamily: 'monospace', fontSize: 18, fontWeight: '700', color: '#2563eb' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  siteName: { fontSize: 22, fontWeight: 'bold', color: '#111827', marginBottom: 12 },
  meta: { fontSize: 14, color: '#6b7280', marginBottom: 6 },
  reviewNotes: { marginTop: 20, backgroundColor: '#f3f4f6', padding: 16, borderRadius: 12 },
  reviewLabel: { fontWeight: '600', color: '#374151', marginBottom: 6 },
  reviewText: { color: '#4b5563', fontSize: 14, lineHeight: 20 },
});
