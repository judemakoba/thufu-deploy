import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getMyAssignments } from '../lib/api';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'SurveyList'> };

export default function SurveyListScreen({ navigation }: Props) {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyAssignments()
      .then(r => setAssignments(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={assignments}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('SurveyForm', {
              assignmentId: item.id,
              templateId: item.template_id,
              recordType: item.record_type || 'ground_info',
            })}
          >
            <Text style={styles.atcId}>{item.site_id}</Text>
            <Text style={styles.siteName}>{item.site_name}</Text>
            <Text style={styles.template}>{item.template_name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: item.status === 'pending' ? '#fef3c7' : '#d1fae5' }]}>
              <Text style={{ color: item.status === 'pending' ? '#d97706' : '#059669', fontSize: 12, fontWeight: '600' }}>
                {item.status}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={styles.empty}>No assignments yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1 },
  atcId: { fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: '#2563eb', marginBottom: 4 },
  siteName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  template: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
});
