import { defineStore } from 'pinia';
import api from '@/lib/api.js';

/**
 * Gift vouchers. The manager issues and cancels them; reception only looks one
 * up (scan or typed code) and redeems it through the normal session start.
 */
export const useVouchersStore = defineStore('vouchers', {
  state: () => ({ list: [], loading: false }),
  actions: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get('/vouchers');
        this.list = data.vouchers;
        return data.vouchers;
      } finally {
        this.loading = false;
      }
    },
    async create(payload) {
      const { data } = await api.post('/vouchers', payload);
      this.list = [...data.vouchers, ...this.list];
      return data.vouchers;
    },
    async cancel(id) {
      const { data } = await api.post(`/vouchers/${id}/void`);
      const i = this.list.findIndex((v) => v.id === id);
      if (i !== -1) this.list[i] = data.voucher;
      return data.voucher;
    },
    async lookup(code) {
      const { data } = await api.get('/vouchers/lookup', { params: { code } });
      return data.voucher;
    },
    async publicCard(token) {
      const { data } = await api.get(`/public/voucher/${token}`);
      return data.voucher;
    },
  },
});
