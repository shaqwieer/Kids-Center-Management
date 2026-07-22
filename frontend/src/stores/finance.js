import { defineStore } from 'pinia';
import api from '@/lib/api.js';

export const useFinanceStore = defineStore('finance', {
  state: () => ({ data: null, period: 'month' }),
  actions: {
    async fetch(period = this.period, lang = 'ar') {
      this.period = period;
      const { data } = await api.get('/finance/summary', { params: { period, lang } });
      this.data = data.finance;
      return data.finance;
    },
    async createExpense(payload) {
      const { data } = await api.post('/expenses', payload);
      return data.expense;
    },
    async updateExpense(id, payload) {
      const { data } = await api.put(`/expenses/${id}`, payload);
      return data.expense;
    },
    async deleteExpense(id) { await api.delete(`/expenses/${id}`); },
  },
});
