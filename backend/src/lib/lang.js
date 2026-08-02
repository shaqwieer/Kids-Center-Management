/**
 * Which language an outbound message goes out in.
 *
 * Was hardcoded to 'ar' in the worker, which meant the English templates the
 * settings screen lets a manager write were never sent to anyone. The order is
 * deliberate: the guardian's own choice beats the centre default, because she
 * picked it while filling the registration form in front of her.
 */
export const SUPPORTED_LANGS = ['ar', 'en'];
export const FALLBACK_LANG = 'ar';

/** Anything unrecognised (null, '', 'fr', 'AR-sa') collapses to null. */
export function normalizeLang(value) {
  const v = String(value || '').trim().slice(0, 2).toLowerCase();
  return SUPPORTED_LANGS.includes(v) ? v : null;
}

/**
 * @param {string|null} customerLang  customers.lang — the language she registered in
 * @param {string|null} defaultLang   settings.default_lang — the centre default
 */
export function resolveLang(customerLang, defaultLang) {
  return normalizeLang(customerLang) || normalizeLang(defaultLang) || FALLBACK_LANG;
}

/**
 * Pick one template body. Falls back to the other language rather than sending
 * nothing: a half-configured install should still reach the customer, and the
 * caller treats an empty string as "skip this send" anyway.
 */
export function pickTemplate(waTemplates, type, lang) {
  const group = waTemplates?.[type] || {};
  const primary = group[lang];
  if (primary && primary.trim()) return primary;
  const other = group[lang === 'ar' ? 'en' : 'ar'];
  return other && other.trim() ? other : '';
}
