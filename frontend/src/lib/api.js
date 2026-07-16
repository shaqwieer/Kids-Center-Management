/** Axios instance. Token is read from localStorage so this stays store-free. */
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('farfasha_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    if (err.response?.status === 401 && !url.includes('/auth/login') && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(err);
  },
);

/** Extract a human-friendly error message from an axios error. */
export function apiError(err, fallback = 'error_generic') {
  return err?.response?.data?.error?.message || fallback;
}

/**
 * Map a staff-account error onto a translatable key, so the UI can explain the
 * refusal in the reader's language instead of echoing the server's English.
 */
export function teamErrorKey(err, fallback = 'error_generic') {
  const e = err?.response?.data?.error;
  if (!e) return fallback;
  const code = e.details?.code;
  if (code === 'last_manager') return 'tm_err_last_manager';
  if (code === 'self_delete') return 'tm_err_self_delete';
  if (e.code === 'conflict') return 'tm_err_email';
  if (e.code === 'bad_request') return 'tm_err_invalid';
  return fallback;
}

export default api;
