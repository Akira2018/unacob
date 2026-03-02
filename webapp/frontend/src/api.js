import axios from 'axios';
import toast from 'react-hot-toast';

const apiBaseURL = import.meta.env.VITE_API_BASE_URL || '/api';
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
