import axios from 'axios';
import toast from 'react-hot-toast';

const normalizeApiBaseURL = () => {
  const rawValue = String(import.meta.env.VITE_API_BASE_URL || '').trim();
  const invalidValues = new Set(['', 'undefined', 'null', 'false']);

  if (invalidValues.has(rawValue.toLowerCase())) {
    return '/api';
  }

  if (rawValue.startsWith('/')) {
    return rawValue;
  }

  try {
    const parsed = new URL(rawValue);
    const blockedHosts = new Set(['backend', 'localhost', '127.0.0.1', '0.0.0.0']);
    if (blockedHosts.has(parsed.hostname.toLowerCase())) {
      return '/api';
    }

    if (window.location.protocol === 'https:' && parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }

    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '/api';
  }
};

const apiBaseURL = normalizeApiBaseURL();
let isRedirectingToLogin = false;

const api = axios.create({
  baseURL: apiBaseURL,
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const url = err.config?.url || '';
      const isLoginRequest = url.includes('/auth/login');
      const isAlreadyOnLogin = window.location.hash?.startsWith('#/login');

      if (!isLoginRequest) {
        toast.error('Sessão expirada. Faça login novamente.', { id: 'auth-session-expired' });
      }

      if (!isLoginRequest && !isAlreadyOnLogin && !isRedirectingToLogin) {
        isRedirectingToLogin = true;
        window.location.assign(`${import.meta.env.BASE_URL}#/login`);
      }
    }
    return Promise.reject(err);
  }
);

export default api;
