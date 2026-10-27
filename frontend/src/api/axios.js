import axios from 'axios';
import { t } from '../i18n';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    // Backend messages (errors, validation) are English; translate them centrally so
    // every toast that shows `err.response.data.message` is localised without per-call code.
    const data = error.response?.data;
    if (data && typeof data === 'object') {
      if (typeof data.message === 'string') data.message = t(data.message);
      if (data.errors && typeof data.errors === 'object') {
        Object.keys(data.errors).forEach((field) => {
          if (Array.isArray(data.errors[field])) data.errors[field] = data.errors[field].map((m) => t(m));
        });
      }
    }

    return Promise.reject(error);
  }
);

export default api;
