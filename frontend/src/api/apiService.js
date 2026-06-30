import axios from 'axios';

// Base Axios instance
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Request interceptor — attach JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ims_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — handle 401 globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('ims_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;

// ── Typed API helpers ─────────────────────────────────────

// Auth
export const authAPI = {
  login:    (body)      => api.post('/auth/login', body),
  register: (body)      => api.post('/auth/register', body),
  me:       ()          => api.get('/auth/me'),
  users:    ()          => api.get('/auth/users'),
  toggleUser: (id, is_active) => api.patch(`/auth/users/${id}/status`, { is_active }),
};

// Inventory
export const inventoryAPI = {
  list:       (params) => api.get('/inventory', { params }),
  byStage:    (stage)  => api.get(`/inventory/stage/${stage}`),
  get:        (id)     => api.get(`/inventory/${id}`),
  create:     (body)   => api.post('/inventory', body),
};

// Stages
export const stagesAPI = {
  advance: (itemId, body) => api.post(`/stages/advance/${itemId}`, body),
  reject:  (itemId, body) => api.post(`/stages/reject/${itemId}`,  body),
};

// Finished Goods
export const finishedGoodsAPI = {
  list: (params) => api.get('/finished-goods', { params }),
};

// Invoices
export const invoicesAPI = {
  list:         (params) => api.get('/invoices', { params }),
  get:          (id)     => api.get(`/invoices/${id}`),
  create:       (body)   => api.post('/invoices', body),
  download:     (id)     => api.get(`/invoices/${id}/download`),
  updateStatus: (id, status) => api.patch(`/invoices/${id}/status`, { status }),
};

// Notifications
export const notificationsAPI = {
  list:       (params) => api.get('/notifications', { params }),
  markRead:   (ids)    => api.patch('/notifications/read', { ids }),
  markAllRead: ()      => api.patch('/notifications/read-all'),
};

// Reports
export const reportsAPI = {
  summary:        ()       => api.get('/reports/summary'),
  avgTime:        ()       => api.get('/reports/avg-time'),
  rejectionRate:  ()       => api.get('/reports/rejection-rate'),
  invoicesSummary:()       => api.get('/reports/invoices-summary'),
  throughput:     (days)   => api.get('/reports/throughput', { params: { days } }),
};
