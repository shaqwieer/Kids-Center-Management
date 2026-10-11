import { defineStore } from 'pinia';
import api from '@/lib/api.js';
import { todayIso } from '@/lib/time.js';

let listSeq = 0;

export const useCustomersStore = defineStore('customers', {
  state: () => ({
    list: [],
    current: null,
    // Customers page sidebar: which day's visitors `list` holds ('' = everyone).
    // Kept here, not in the view, because the view remounts on every row click.
    date: todayIso(),
    loaded: false,
  }),
  actions: {
    async search(q = '') {
      const { data } = await api.get('/customers', { params: q ? { search: q } : {} });
      return data.customers;
    },
    /** Fill the Customers page sidebar for the selected day (or everyone). */
    async loadList(q = '') {
      const params = {};
      if (q) params.search = q;
      if (this.date) params.date = this.date;
      listSeq += 1;
      const mine = listSeq;
      const { data } = await api.get('/customers', { params });
      // Stepping through days fast can land replies out of order — latest wins.
      if (mine !== listSeq) return this.list;
      this.list = data.customers;
      this.loaded = true;
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
