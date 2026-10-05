import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Alert, ActivityIndicator, PermissionsAndroid, Platform
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { getMyAssignments, processQueue } from '../lib/api';
import { format } from 'date-fns';

type Props = { navigation: NativeStackNavigationProp<RootStackParamList, 'Home'> };

interface Assignment {
  id: string;
  template_id: string;
  site_id: string;
  status: string;
  due_date: string | null;
  site_name: string;
  template_name: string;
}

export default function HomeScreen({ navigation }: Props) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  const fetchAssignments = async () => {
    try {
      const res = await getMyAssignments();
      setAssignments(res.data.data);
    } catch (err) {
      console.warn('Failed to fetch assignments:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const checkQueue = async () => {
    const raw = await AsyncStorage.getItem('thufu_offline_queue');
    const queue = raw ? JSON.parse(raw) : [];
    setQueueCount(queue.length);
  };

  const syncQueue = async () => {
    if (queueCount === 0) return;
    Alert.alert('Syncing...', `Processing ${queueCount} offline items`);
    const remaining = await processQueue();
    setQueueCount(remaining.length);
    if (remaining.length === 0) {
      Alert.alert('Success', 'All offline data synced!');
    }
  };

  const requestLocation = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  };

  useEffect(() => {
    fetchAssignments();
    checkQueue();

    // Process queue every time app comes to focus
    const unsubscribe = navigation.addListener('focus', () => {
      checkQueue();
    });

    return unsubscribe;
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchAssignments().then(checkQueue);
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: '#f59e0b', in_progress: '#3b82f6', submitted: '#8b5cf6',
      approved: '#10b981', rejected: '#ef4444', draft: '#6b7280',
    };
    return map[status] || '#6b7280';
  };

  const pending = assignments.filter(a => a.status === 'pending' || a.status === 'in_progress');
  const completed = assignments.filter(a => ['submitted', 'approved', 'rejected'].includes(a.status));

  const renderItem = ({ item }: { item: Assignment }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        if (item.status === 'pending' || item.status === 'in_progress') {
          navigation.navigate('SurveyForm', {
            assignmentId: item.id,
            templateId: item.template_id,
            recordType: item.template_name.toLowerCase().includes('ground') ? 'ground_info'
              : item.template_name.toLowerCase().includes('dcdb') ? 'dcdb_info' : 'tower_info',
          });
        } else {
          navigation.navigate('SubmissionDetail', { submissionId: item.id });
        }
      }}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.atcId}>{item.site_id}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: statusColor(item.status) }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={styles.siteName}>{item.site_name}</Text>
      <Text style={styles.templateName}>{item.template_name}</Text>
      {item.due_date && (
        <Text style={styles.dueDate}>Due: {format(new Date(item.due_date), 'dd MMM yyyy')}</Text>
      )}
    </TouchableOpacity>
  );

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#2563eb" /></View>;

  return (
    <View style={styles.container}>
      {/* Queue Banner */}
      {queueCount > 0 && (
        <TouchableOpacity style={styles.queueBanner} onPress={syncQueue}>
          <Text style={styles.queueText}>{queueCount} item(s) pending sync — tap to upload</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={assignments}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />}
        ListHeaderComponent={
          <>
            <Text style={styles.sectionTitle}>Pending ({pending.length})</Text>
            {pending.length === 0 && <Text style={styles.emptyText}>No pending assignments</Text>}
          </>
        }
        ListFooterComponent={
          completed.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Completed ({completed.length})</Text>
            </>
          ) : null
        }
      />

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.navIcon}>🏠</Text><Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('SurveyList')}>
          <Text style={styles.navIcon}>📋</Text><Text style={styles.navLabel}>Surveys</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.navIcon}>👤</Text><Text style={styles.navLabel}>Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  queueBanner: { backgroundColor: '#f59e0b', padding: 12, alignItems: 'center' },
  queueText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  atcId: { fontFamily: 'monospace', fontSize: 13, fontWeight: '700', color: '#2563eb' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  siteName: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 2 },
  templateName: { fontSize: 13, color: '#6b7280' },
  dueDate: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#374151', marginBottom: 12 },
  emptyText: { color: '#9ca3af', fontSize: 14, marginBottom: 16, fontStyle: 'italic' },
  bottomNav: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: '#fff', paddingBottom: 20, paddingTop: 8 },
  navItem: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  navIcon: { fontSize: 22 },
  navLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
});
