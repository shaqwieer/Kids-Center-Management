/**
 * Sends ONE real WhatsApp message through WhatsLoop, to verify the live
 * credentials. This actually reaches a phone — run it against your OWN number.
 *
 * It deliberately ignores WHATSAPP_ENABLED (which stays false on dev machines
 * so the proof scripts can't message demo customers) and talks to the WhatsLoop
 * adapter directly.
 *
 *   node scripts/whatsloop-send.mjs 0501234567
 *   node scripts/whatsloop-send.mjs 966501234567 "نص مخصص"
 */
import { env } from '../src/config/env.js';
import { createWhatsloopAdapter } from '../src/whatsapp/providers/whatsloop.js';
import { normalizePhone } from '../src/whatsapp/templates.js';

const [rawTo, customText] = process.argv.slice(2);

if (!rawTo) {
  console.error('Usage: node scripts/whatsloop-send.mjs <phone> ["message"]');
  process.exit(1);
}

const cfg = env.whatsapp.whatsloop;
if (!cfg.token) {
  console.error('WHATSLOOP_TOKEN is not set in .env — nothing to send with.');
  process.exit(1);
}

const to = normalizePhone(rawTo, env.whatsapp.defaultCountry);
const message = customText || 'رسالة تجريبية من نظام Blend Play & Sip ✅';

console.log(`\nEndpoint : ${cfg.baseUrl}/messages/send-text`);
console.log(`To       : ${rawTo} -> ${to}`);
console.log(`Message  : ${message}\n`);

try {
  const { providerMessageId } = await createWhatsloopAdapter(cfg).send({ to, body: message });
  console.log(`✅ Sent. provider_message_id = ${providerMessageId ?? '(not returned)'}\n`);
} catch (err) {
  console.error(`❌ ${err.message}\n`);
  process.exit(1);
}
