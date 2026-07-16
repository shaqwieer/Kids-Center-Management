import { createI18n } from 'vue-i18n';
import ar from './ar.js';
import en from './en.js';

const saved = localStorage.getItem('farfasha_lang');

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: saved || 'ar',
  fallbackLocale: 'en',
  messages: { ar, en },
});

export const t = (key, ...args) => i18n.global.t(key, ...args);

export default i18n;
