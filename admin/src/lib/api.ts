import axios from 'axios';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('thufu_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 → redirect to login
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('thufu_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Auth
export const login = (email: string, password: string) =>
  api.post('/admin/auth/login', { email, password });

export const getProfile = () => api.get('/admin/auth/profile');

// Sites
export const listSites = (params?: { page?: number; limit?: number; search?: string }) =>
  api.get('/admin/sites', { params });

export const createSite = (data: Record<string, unknown>) =>
  api.post('/admin/sites', data);

export const updateSite = (id: string, data: Record<string, unknown>) =>
  api.patch(`/admin/sites/${id}`, data);

export const deleteSite = (id: string) =>
  api.delete(`/admin/sites/${id}`);

// Templates
export const listTemplates = () => api.get('/admin/templates');
export const getTemplate = (id: string) => api.get(`/admin/templates/${id}`);

// Submissions
export const listSubmissions = (params?: { page?: number; status?: string; record_type?: string }) =>
  api.get('/admin/submissions', { params });

export const getSubmission = (id: string) => api.get(`/admin/submissions/${id}`);

export const updateSubmission = (id: string, data: { status?: string; review_notes?: string }) =>
  api.patch(`/admin/submissions/${id}`, data);

// Assignments
export const createAssignment = (data: Record<string, unknown>) =>
  api.post('/admin/assignments', data);

// Analytics
export const getAnalytics = () => api.get('/admin/analytics');

// Users
export const listUsers = () => api.get('/admin/users');

// Users (reviewers/surveyors)
export const registerUser = (data: Record<string, unknown>) =>
  api.post('/admin/auth/register', data);

export default api;
