import { defineStore } from 'pinia';
import api from '@/lib/api.js';

/**
 * True once the token's own `exp` has passed. The server is still the authority
 * on every request — this only stops an expired session from being treated as a
 * live one, which would flash a protected page before the first 401 lands.
 * Anything unreadable counts as expired: a token we cannot parse is not a session.
 */
function expired(token) {
  try {
    const payload = token.split('.')[1];
    const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const { exp } = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
    return typeof exp !== 'number' || exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('farfasha_token') || null,
    user: JSON.parse(localStorage.getItem('farfasha_user') || 'null'),
    tenant: JSON.parse(localStorage.getItem('farfasha_tenant') || 'null'),
  }),
  getters: {
    isAuthed: (s) => !!s.token && !expired(s.token),
    isManager: (s) => s.user?.role === 'manager',
  },
  actions: {
    async login(email, password) {
      const { data } = await api.post('/auth/login', { email, password });
      this.token = data.token;
      this.user = data.user;
      this.tenant = data.tenant;
      localStorage.setItem('farfasha_token', data.token);
      localStorage.setItem('farfasha_user', JSON.stringify(data.user));
      localStorage.setItem('farfasha_tenant', JSON.stringify(data.tenant));
      return data;
    },
    async fetchMe() {
      try {
        const { data } = await api.get('/auth/me');
        this.user = data.user;
        localStorage.setItem('farfasha_user', JSON.stringify(data.user));
      } catch {
        this.logout();
      }
    },
    logout() {
      this.token = null;
      this.user = null;
      this.tenant = null;
      localStorage.removeItem('farfasha_token');
      localStorage.removeItem('farfasha_user');
      localStorage.removeItem('farfasha_tenant');
    },
  },
});
