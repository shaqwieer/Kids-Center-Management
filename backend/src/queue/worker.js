/**
 * BullMQ worker that fires every outbound message.
 *
 * Two families of job share this queue:
 *
 *   SESSION-TIMED (warn_5, time_up, review) — anchored to a session.
 *     VERSION GUARD: warn_5/time_up re-read the session and ignore the job
 *     unless job.data.version === session.schedule_version and the session
 *     isn't completed. Any stale/orphaned job from a prior add-time is
 *     completely harmless.
 *     State transitions (warned/overtime) happen independently of message
 *     delivery so the dashboard is always correct even if WhatsApp fails and
 *     retries.
 *
 *   EVENT-DRIVEN (welcome, booking_confirmed) — anchored to a customer or a
 *     booking, with no session and nothing to version. They re-read their row,
 *     skip if the notification is already 'sent', and are idempotent on the
 *     notifications unique constraint.
 *
 * Language is resolved per message (guardian's own choice, else the centre
 * default) — it used to be hardcoded 'ar', which made the English templates a
 * manager can write in Settings unreachable.
 */
import { Worker } from 'bullmq';
import { DateTime } from 'luxon';
import { SESSION_QUEUE } from './connection.js';
import { createRedisConnection } from '../config/redis.js';
import { getSessionRow } from '../modules/sessions/sessions.repo.js';
import { markWarned, markOvertime, guestExtendUrl } from '../modules/sessions/sessions.service.js';
import { getSettings } from '../modules/settings/settings.service.js';
import {
  ensureNotification, markSent, markFailed, alreadySent,
} from '../modules/notifications/notifications.service.js';
import { markReviewSent } from '../modules/reviews/reviews.service.js';
import { emitToTenant } from '../realtime/emitter.js';
import { sendWhatsApp } from '../whatsapp/index.js';
import { stripPlaceholderLines } from '../whatsapp/templates.js';
import { resolveLang, pickTemplate } from '../lib/lang.js';
import { env } from '../config/env.js';
import { db } from '../config/db.js';
import { ZONE } from '../utils/time.js';
import { MINUTE_MS } from '../lib/timing.js';

function overtimeMinutes(row) {
  const over = Date.now() - new Date(row.ends_at).getTime();
  return over > 0 ? Math.ceil(over / MINUTE_MS) : 0;
}

const reviewUrl = (token) => `${env.appBaseUrl.replace(/\/$/, '')}/r/${token}`;

/**
 * Deliver one message and record it. Every send in this file funnels through
 * here so the notification row, the socket event and the failure handling are
 * identical no matter which anchor the message hangs off.
 */
async function deliver({ target, type, lang, to, vars, template, tenantSlug }) {
  // The socket payload stays snake_case — the dashboard has always keyed off
  // `session_id`, and renaming it would silently break the live activity feed.
  const anchorPayload = {
    session_id: target.sessionId || null,
    customer_id: target.customerId || null,
    booking_id: target.bookingId || null,
  };

  await ensureNotification(target, type);
  try {
    const { providerMessageId, body, to: dest } = await sendWhatsApp({
      templateType: type, lang, to, vars, template,
    });
    await markSent(target, type, providerMessageId);
    emitToTenant(tenantSlug, 'notification:sent', {
      ...anchorPayload, type, lang, provider_message_id: providerMessageId, to: dest, body,
    });
    return { sent: true, providerMessageId };
  } catch (err) {
    await markFailed(target, type, err.message);
    throw err; // let BullMQ retry with backoff
  }
}

/**
 * Registration welcome. Fires once per customer, right after she registers —
 * this is the message that carries her customer code for the next visit.
 */
async function processWelcomeJob(job) {
  const { customerId, tenantId, tenantSlug } = job.data;

  const customer = await db('customers').where({ id: customerId, tenant_id: tenantId }).first();
  if (!customer) return { skipped: 'customer-gone' };
  if (await alreadySent({ customerId }, 'welcome')) return { skipped: 'already-sent' };

  const settings = await getSettings(tenantId);
  const lang = resolveLang(customer.lang, settings.default_lang);
  const template = pickTemplate(settings.wa_templates, 'welcome', lang);
  // An install that never got a welcome template would otherwise send a blank
  // WhatsApp message. Skip rather than message her with nothing.
  if (!template.trim()) return { skipped: 'no-welcome-template' };

  return deliver({
    target: { customerId },
    type: 'welcome',
    lang,
    to: customer.phone,
    vars: {
      name: customer.full_name,
      code: customer.customer_code,
      center: settings.center_name,
    },
    template,
    tenantSlug,
  });
}

/**
 * Party/workshop confirmation. Only a CONFIRMED booking gets one — a public
 * booking sits at `pending` (its slot is held) until staff confirm it, and
 * that transition is what enqueues this job.
 */
async function processBookingConfirmedJob(job) {
  const { bookingId, tenantId, tenantSlug } = job.data;

  const booking = await db('bookings').where({ id: bookingId, tenant_id: tenantId }).first();
  if (!booking) return { skipped: 'booking-gone' };
  if (booking.status !== 'confirmed') return { skipped: `status-${booking.status}` };
  if (await alreadySent({ bookingId }, 'booking_confirmed')) return { skipped: 'already-sent' };

  const settings = await getSettings(tenantId);
  // The booker may not be a registered customer at all, in which case there is
  // no language preference to honour and the centre default applies.
  const customer = booking.customer_id
    ? await db('customers').where({ id: booking.customer_id }).first()
    : null;
  const lang = resolveLang(customer?.lang, settings.default_lang);
  const template = pickTemplate(settings.wa_templates, 'booking_confirmed', lang);
  if (!template.trim()) return { skipped: 'no-booking-template' };

  // Times are stored UTC; she needs to read them in Riyadh time.
  const starts = DateTime.fromJSDate(new Date(booking.starts_at)).setZone(ZONE);

  return deliver({
    target: { bookingId },
    type: 'booking_confirmed',
    lang,
    to: booking.phone,
    vars: {
      name: booking.guardian_name,
      center: settings.center_name,
      ref: booking.reference,
      date: starts.toFormat('yyyy-LL-dd'),
      time: starts.toFormat('HH:mm'),
      count: booking.children_count,
      amount: `${Number(booking.amount)} ${settings.currency}`,
    },
    template,
    tenantSlug,
  });
}

/**
 * The "how was your visit?" ask. Unlike the timing jobs this one fires AFTER the
 * session is completed, so it deliberately runs before the live-session guards.
 */
async function processReviewJob(job) {
  const { sessionId, tenantId, tenantSlug, reviewId } = job.data;

  const review = await db('reviews').where({ id: reviewId }).first();
  if (!review) return { skipped: 'review-gone' };
  if (review.sent_at) return { skipped: 'already-sent' };
  if (review.submitted_at) return { skipped: 'already-answered' };
  // `sent_at` is stamped AFTER delivery, so a retry that crashed between the
  // send and that stamp would message her twice. The notification row is
  // written before the send, which closes that window.
  if (await alreadySent({ sessionId }, 'review')) return { skipped: 'already-sent' };

  const settings = await getSettings(tenantId);
  if (!settings.reviews_enabled) return { skipped: 'reviews-disabled' };

  const row = await getSessionRow(sessionId);
  if (!row) return { skipped: 'session-gone' };

  const lang = resolveLang(row.customer_lang, settings.default_lang);
  const template = pickTemplate(settings.wa_templates, 'review', lang);
  // An install that never got a review template would otherwise send a blank
  // WhatsApp message. Skip rather than message her with nothing.
  if (!template.trim()) return { skipped: 'no-review-template' };

  const res = await deliver({
    target: { sessionId },
    type: 'review',
    lang,
    to: row.customer_phone,
    vars: { name: row.customer_full_name, center: settings.center_name, link: reviewUrl(review.token) },
    template,
    tenantSlug,
  });
  await markReviewSent(reviewId);
  return res;
}

export async function processSessionJob(job) {
  const { type, sessionId, tenantId, tenantSlug, version } = job.data;

  // Event-driven jobs have no session to re-read and nothing to version.
  if (type === 'review') return processReviewJob(job);
  if (type === 'welcome') return processWelcomeJob(job);
  if (type === 'booking_confirmed') return processBookingConfirmedJob(job);

  const row = await getSessionRow(sessionId);
  if (!row) return { skipped: 'session-gone' };
  if (row.status === 'completed') return { skipped: 'completed' };
  if (row.schedule_version !== version) return { skipped: 'stale-version' };

  const settings = await getSettings(tenantId);

  // --- state transition (independent of delivery) ---
  let dto = null;
  if (type === 'warn_5') {
    const r = await markWarned(tenantId, sessionId);
    dto = r.dto;
    if (r.changed) emitToTenant(tenantSlug, 'session:updated', { session: dto });
  } else if (type === 'time_up') {
    const r = await markOvertime(tenantId, sessionId);
    dto = r.dto;
    if (r.changed) emitToTenant(tenantSlug, 'session:updated', { session: dto });
  }

  // --- message delivery ---
  const lang = resolveLang(row.customer_lang, settings.default_lang);
  // The 5-minute warning carries her self-extend link, so "add 30 minutes" is
  // one tap from the notification rather than a phone call to reception.
  const extendLink = type === 'warn_5' && settings.guardian_extend_enabled && row.guest_token
    ? guestExtendUrl(row.guest_token)
    : '';
  // `minutes` means different things per type — the extension she is being
  // offered, vs. how far past the end she already is.
  const vars = type === 'time_up'
    ? { child: row.child_name, minutes: overtimeMinutes(row), center: settings.center_name }
    : {
      child: row.child_name,
      center: settings.center_name,
      link: extendLink,
      minutes: Number(settings.guardian_extend_minutes) || 30,
    };

  let template = pickTemplate(settings.wa_templates, type, lang);
  // No link to offer (feature off, or a session started before guest tokens
  // existed) — take the whole invitation out rather than send a dead prompt.
  if (type === 'warn_5' && !extendLink) template = stripPlaceholderLines(template, ['link']);

  return deliver({
    target: { sessionId }, type, lang, to: row.customer_phone, vars, template, tenantSlug,
  });
}

export function startWorker() {
  const worker = new Worker(SESSION_QUEUE, processSessionJob, {
    connection: createRedisConnection(),
    concurrency: 5,
  });
  worker.on('failed', (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[worker] job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err?.message);
  });
  worker.on('completed', (job, res) => {
    if (res?.skipped) {
      // eslint-disable-next-line no-console
      console.log(`[worker] job ${job.id} skipped: ${res.skipped}`);
    }
  });
  // eslint-disable-next-line no-console
  console.log('[worker] session-jobs worker started');
  return worker;
}
