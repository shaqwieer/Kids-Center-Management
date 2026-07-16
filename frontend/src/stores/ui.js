import { defineStore } from 'pinia';
import { i18n } from '@/i18n';

export const useUiStore = defineStore('ui', {
  state: () => ({
    locale: localStorage.getItem('farfasha_lang') || 'ar',
    clock24: false,
    toasts: [],
    _tid: 0,
  }),
  getters: {
    dir: (s) => (s.locale === 'ar' ? 'rtl' : 'ltr'),
    isAr: (s) => s.locale === 'ar',
  },
  actions: {
    applyLocale() {
      i18n.global.locale.value = this.locale;
      document.documentElement.lang = this.locale;
      document.documentElement.dir = this.dir;
      localStorage.setItem('farfasha_lang', this.locale);
    },
    setLang(l) {
      this.locale = l;
      this.applyLocale();
    },
    toggleLang() {
      this.setLang(this.locale === 'ar' ? 'en' : 'ar');
    },
    toast(msg, type = 'info') {
      const id = (this._tid += 1);
      this.toasts.push({ id, msg, type });
      setTimeout(() => this.dismiss(id), 2600);
    },
    dismiss(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },
  },
});
