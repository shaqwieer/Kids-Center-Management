/**
 * WhatsLoop WhatsApp adapter (POST {baseUrl}/messages/send-text).
 *
 * Every notification this system sends (welcome / warn_5 / time_up / review) is
 * already rendered to plain text by `renderTemplate`, so send-text covers the
 * whole surface — no per-type approved templates to register, unlike Meta.
 *
 * `to` arrives pre-normalised by `normalizePhone` as bare E.164 digits
 * (05xxxxxxxx -> 9665xxxxxxxx), which is exactly the format WhatsLoop expects.
 *
 * Errors THROW so BullMQ retries with its configured backoff (3 attempts,
 * exponential from 5s — see queue/connection.js) and the worker records the
 * message in `notifications.error`; the HTTP status is kept in the message
 * because that column is the only place a failure is visible after the fact.
 */

/** Sends are capped at 30/min by WhatsLoop; a short Retry-After is worth waiting out in-process. */
const MAX_INLINE_RETRY_MS = 5000;
/** WhatsLoop rejects a text body longer than this (SendTextRequest.message maxLength). */
const MAX_MESSAGE_LEN = 4096;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** `data` is the message id as a bare string on WhatsLoop's send endpoints; tolerate an object too. */
function extractMessageId(data) {
  if (typeof data === 'string') return data || null;
  if (data && typeof data === 'object') {
    return data.id ?? data.message_id ?? data.messageId ?? data.key?.id ?? null;
  }
  return null;
}

/** Retry-After is seconds (or an HTTP date); return ms, or null when unusable. */
function retryAfterMs(header) {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const at = Date.parse(header);
  return Number.isNaN(at) ? null : Math.max(0, at - Date.now());
}

export function createWhatsloopAdapter(cfg) {
  const { token, channelId } = cfg;
  const baseUrl = String(cfg.baseUrl || '').replace(/\/+$/, '');

  return {
    name: 'whatsloop',
    async send({ to, body }) {
      if (!token) throw new Error('WhatsLoop not configured (WHATSLOOP_TOKEN)');
      if (!baseUrl) throw new Error('WhatsLoop not configured (WHATSLOOP_BASE_URL)');

      const payload = { to, message: String(body || '').slice(0, MAX_MESSAGE_LEN) };
      // Optional: omit the key entirely rather than sending an explicit null.
      if (channelId) payload.channel_id = Number(channelId);

      const post = () =>
        fetch(`${baseUrl}/messages/send-text`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(payload),
        });

      let res = await post();

      // Rate limited: honour a short Retry-After once, else hand it to BullMQ's backoff.
      if (res.status === 429) {
        const waitMs = retryAfterMs(res.headers?.get?.('Retry-After'));
        if (waitMs !== null && waitMs <= MAX_INLINE_RETRY_MS) {
          await sleep(waitMs);
          res = await post();
        }
      }

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.success === false) {
        const detail = data?.message || res.statusText || 'request failed';
        throw new Error(`WhatsLoop error ${res.status}: ${detail}`);
      }

      // A delivered message with an unparseable id is still delivered — never throw here.
      return { providerMessageId: extractMessageId(data?.data) };
    },
  };
}
