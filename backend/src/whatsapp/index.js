/**
 * Provider-agnostic WhatsApp facade.
 *
 * `sendWhatsApp({ templateType, lang, to, vars, template })` renders the body,
 * normalises the phone, and dispatches to the configured adapter. When WhatsApp
 * is disabled (WHATSAPP_ENABLED=false) it always uses the `log` adapter so the
 * system runs end-to-end without a real account. Adding a new BSP means adding
 * one adapter file — no changes to the domain/queue code.
 */
import { env } from '../config/env.js';
import { renderTemplate, normalizePhone } from './templates.js';
import { createLogAdapter } from './providers/log.js';
import { createMetaAdapter } from './providers/meta.js';
import { createTwilioAdapter } from './providers/twilio.js';
import { createUnifonicAdapter } from './providers/unifonic.js';
import { createWhatsloopAdapter } from './providers/whatsloop.js';

let adapter = null;

export function getAdapter() {
  if (adapter) return adapter;
  const provider = env.whatsapp.enabled ? env.whatsapp.provider : 'log';
  switch (provider) {
    case 'meta':
      adapter = createMetaAdapter({
        ...env.whatsapp.meta,
        defaultCountry: env.whatsapp.defaultCountry,
        langMap: { ar: 'ar', en: 'en' },
      });
      break;
    case 'twilio':
      adapter = createTwilioAdapter(env.whatsapp.twilio);
      break;
    case 'unifonic':
      adapter = createUnifonicAdapter(env.whatsapp.unifonic);
      break;
    case 'whatsloop':
      adapter = createWhatsloopAdapter(env.whatsapp.whatsloop);
      break;
    case 'log':
    default:
      adapter = createLogAdapter();
      break;
  }
  return adapter;
}

/** For tests / hot-reload. */
export function resetAdapter() {
  adapter = null;
}

/**
 * @param {object} p
 * @param {'welcome'|'warn_5'|'time_up'} p.templateType
 * @param {'ar'|'en'} p.lang
 * @param {string} p.to             raw phone (05.. or intl)
 * @param {object} p.vars           { name, child, minutes, code }
 * @param {string} p.template       the settings template string for this type+lang
 * @returns {Promise<{providerMessageId: string|null, body: string, to: string}>}
 */
export async function sendWhatsApp({ templateType, lang, to, vars, template }) {
  const body = renderTemplate(template, vars);
  const dest = normalizePhone(to, env.whatsapp.defaultCountry);
  const a = getAdapter();
  const { providerMessageId } = await a.send({ templateType, lang, to: dest, vars, body });
  return { providerMessageId, body, to: dest };
}

export { renderTemplate, normalizePhone };
