import { defineStore } from 'pinia';
import api from '@/lib/api.js';

/**
 * Party & workshop bookings. The public actions hit `/public/*` and are used by
 * the no-login booking page, so they must never rely on a token being present.
 */
export const useBookingsStore = defineStore('bookings', {
  state: () => ({ list: [], config: null, loading: false }),
  actions: {
    async fetch(params = {}) {
      this.loading = true;
      try {
        const { data } = await api.get('/bookings', { params });
        this.list = data.bookings;
        return data.bookings;
      } finally {
        this.loading = false;
      }
    },
    async availability(type, date, { pub = false } = {}) {
      const url = pub ? '/public/booking/availability' : '/bookings/availability';
      const { data } = await api.get(url, { params: { type, date } });
      return data;
    },
    async create(payload) {
      const { data } = await api.post('/bookings', payload);
      return data.booking;
    },
    async update(id, patch) {
      const { data } = await api.put(`/bookings/${id}`, patch);
      const i = this.list.findIndex((b) => b.id === id);
      if (i !== -1) this.list[i] = data.booking;
      return data.booking;
    },

    // ---- public (no auth) ----
    async publicConfig() {
      const { data } = await api.get('/public/booking/config');
      this.config = data.config;
      return data.config;
    },
    async publicQuote(params) {
      const { data } = await api.get('/public/booking/quote', { params });
      return data.quote;
    },
    async publicCreate(payload) {
      const { data } = await api.post('/public/booking', payload);
      return data.booking;
    },
  },
});
