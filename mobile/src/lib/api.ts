import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Thufu Deploy — Tailscale Funnel public URL
// For LAN testing: http://192.168.1.18:3001/api
const BASE_URL = 'https://pve.tailfd1512.ts.net/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('thufu_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 — clear token only for login failures, propagate auth errors for other endpoints
api.interceptors.response.use(
  r => r,
  (err) => {
    // Only clear token on 401 for login endpoint — sync/auth failures need different handling
    const isLogin = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && isLogin) {
      AsyncStorage.removeItem('thufu_token');
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email: string, password: string) =>
  api.post('/admin/auth/login', { email, password });

export const getProfile = () => api.get('/admin/auth/profile');

// Mobile sync (the critical offline-first endpoint)
export const syncSubmission = (data: {
  record_type: string;
  submission_id?: string;
  site_id: string;
  answers: Record<string, unknown>;
}) => api.post('/mobile/sync', data);

// Templates
export const getTemplate = (id: string) => api.get(`/mobile/templates/${id}`);
export const getMyAssignments = () => api.get('/mobile/my-assignments');

// Submissions
export const getSubmission = (id: string) => api.get(`/mobile/submissions/${id}`);
export const patchSubmission = (id: string, data: { status?: string }) =>
  api.patch(`/mobile/submissions/${id}`, data);

// Photo upload
export const uploadPhoto = (formData: FormData) =>
  api.post('/mobile/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// Offline queue management
export const OFFLINE_QUEUE_KEY = 'thufu_offline_queue';

export const addToQueue = async (item: {
  type: 'sync' | 'photo';
  payload: Record<string, unknown>;
  timestamp: number;
}) => {
  const queue = await getQueue();
  queue.push(item);
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

export const getQueue = async () => {
  const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
};

export const clearQueue = async () => {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([]));
};

export const processQueue = async () => {
  const queue = await getQueue();
  const remaining: unknown[] = [];

  for (const item of queue) {
    try {
      if (item.type === 'sync') {
        await syncSubmission(item.payload);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } };
      // Auth failure (401) — token invalid/expired, stop retrying and signal re-login
      if (axiosErr?.response?.status === 401) {
        await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
        throw new Error('AUTH_EXPIRED');
      }
      // Network/server errors — keep in queue for retry
      remaining.push(item);
    }
  }

  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
  return remaining;
};

export default api;
