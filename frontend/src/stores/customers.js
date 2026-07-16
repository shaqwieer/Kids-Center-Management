import { defineStore } from 'pinia';
import api from '@/lib/api.js';

export const useCustomersStore = defineStore('customers', {
  state: () => ({
    list: [],
    current: null,
  }),
  actions: {
    async search(q = '') {
      const { data } = await api.get('/customers', { params: q ? { search: q } : {} });
      this.list = data.customers;
      return data.customers;
    },
    async get(id) {
      const { data } = await api.get(`/customers/${id}`);
      this.current = data.customer;
      return data.customer;
    },
    async create(payload) {
      const { data } = await api.post('/customers', payload);
      return data.customer;
    },
    async update(id, payload) {
      const { data } = await api.put(`/customers/${id}`, payload);
      this.current = data.customer;
      return data.customer;
    },
    async lookup({ qr, phone }) {
      const { data } = await api.get('/customers/lookup', { params: { qr, phone } });
      return data.customer;
    },
    // Public (no auth) — registration + card
    async register(payload) {
      const { data } = await api.post('/public/register', payload);
      return data.customer;
    },
    async card(qrToken) {
      const { data } = await api.get(`/public/customers/${qrToken}`);
      return data.customer;
    },
  },
});
