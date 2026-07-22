import { defineStore } from 'pinia';
import api from '@/lib/api.js';

/** Analytics + reviews rollup + the Excel export download. */
export const useInsightsStore = defineStore('insights', {
  state: () => ({ data: null, reviews: null, period: 'month' }),
  actions: {
    async fetch(period = this.period, lang = 'ar') {
      this.period = period;
      const [a, r] = await Promise.all([
        api.get('/analytics/insights', { params: { period, lang } }),
        api.get('/reviews/summary', { params: { period } }),
      ]);
      this.data = a.data;
      this.reviews = r.data;
      return this.data;
    },

    /**
     * Excel comes back as a binary blob, so it is fetched with responseType
     * 'blob' and handed to a throwaway object URL — that keeps the auth header
     * on the request, which a plain <a href> download could not do.
     */
    async exportExcel({ type = 'full', period = this.period, lang = 'ar', start, end } = {}) {
      const res = await api.get('/reports/export', {
        params: { type, period, lang, start, end },
        responseType: 'blob',
      });
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename="?([^"]+)"?/);
      const filename = match ? match[1] : `farfasha-${type}.xlsx`;

      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return filename;
    },
  },
});
