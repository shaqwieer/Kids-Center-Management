import { defineStore } from 'pinia';
import api from '@/lib/api.js';

export const useUsersStore = defineStore('users', {
  state: () => ({
    list: [],
    loading: false,
  }),
  getters: {
    managers: (s) => s.list.filter((u) => u.role === 'manager'),
    staff: (s) => s.list.filter((u) => u.role === 'staff'),
  },
  actions: {
    async fetch() {
      this.loading = true;
      try {
        const { data } = await api.get('/users');
        this.list = data.users;
        return data.users;
      } finally {
        this.loading = false;
      }
    },
    async create(payload) {
      const { data } = await api.post('/users', payload);
      this.list.push(data.user);
      return data.user;
    },
    async update(id, patch) {
      const { data } = await api.put(`/users/${id}`, patch);
      const i = this.list.findIndex((u) => u.id === id);
      if (i !== -1) this.list[i] = data.user;
      return data.user;
    },
    async remove(id) {
      await api.delete(`/users/${id}`);
      this.list = this.list.filter((u) => u.id !== id);
    },
  },
});
