import { defineStore } from 'pinia';
import api from '@/lib/api.js';

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    data: null,
  }),
  actions: {
    async fetch() {
      const { data } = await api.get('/settings');
      this.data = data.settings;
      return data.settings;
    },
    async update(patch) {
      const { data } = await api.put('/settings', patch);
      this.data = data.settings;
      return data.settings;
    },
  },
});
