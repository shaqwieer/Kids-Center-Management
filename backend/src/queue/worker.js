/**
 * BullMQ worker that fires the scheduled session notifications.
 *
 * VERSION GUARD: it re-reads the session and ignores the job unless
 * job.data.version === session.schedule_version and the session isn't completed.
 * This makes any stale/orphaned job from a prior add-time completely harmless.
 *
 * State transitions (warned/overtime) happen independently of message delivery
 * so the dashboard is always correct even if WhatsApp send fails and retries.
 */
import { Worker } from 'bullmq';
import { SESSION_QUEUE } from './connection.js';
import { createRedisConnection } from '../config/redis.js';
import { getSessionRow } from '../modules/sessions/sessions.repo.js';
import { markWarned, markOvertime, guestExtendUrl } from '../modules/sessions/sessions.service.js';
import { getSettings } from '../modules/settings/settings.service.js';
import { ensureNotification, markSent, markFailed } from '../modules/notifications/notifications.service.js';
import { markReviewSent } from '../modules/reviews/reviews.service.js';
import { emitToTenant } from '../realtime/emitter.js';
import { sendWhatsApp } from '../whatsapp/index.js';
import { stripPlaceholderLines } from '../whatsapp/templates.js';
import { env } from '../config/env.js';
import { db } from '../config/db.js';
import { MINUTE_MS } from '../lib/timing.js';

function overtimeMinutes(row) {
  const over = Date.now() - new Date(row.ends_at).getTime();
  return over > 0 ? Math.ceil(over / MINUTE_MS) : 0;
}

const reviewUrl = (token) => `${env.appBaseUrl.replace(/\/$/, '')}/r/${token}`;

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

  const settings = await getSettings(tenantId);
  if (!settings.reviews_enabled) return { skipped: 'reviews-disabled' };

  const row = await getSessionRow(sessionId);
  if (!row) return { skipped: 'session-gone' };

  const lang = 'ar';
  const template = settings.wa_templates?.review?.[lang] || settings.wa_templates?.review?.en || '';
  // An install that never got a review template would otherwise send a blank
  // WhatsApp message. Skip rather than message her with nothing.
  if (!template.trim()) return { skipped: 'no-review-template' };

  await ensureNotification(sessionId, 'review');

  try {
    const { providerMessageId, body, to } = await sendWhatsApp({
      templateType: 'review',
      lang,
      to: row.customer_phone,
      vars: { name: row.customer_full_name, center: settings.center_name, link: reviewUrl(review.token) },
      template,
    });
    await markReviewSent(reviewId);
    await markSent(sessionId, 'review', providerMessageId);
    emitToTenant(tenantSlug, 'notification:sent', {
      session_id: sessionId, type: 'review', provider_message_id: providerMessageId, to, body,
    });
    return { sent: true, providerMessageId };
  } catch (err) {
    await markFailed(sessionId, 'review', err.message);
    throw err;
  }
}

export async function processSessionJob(job) {
  const { type, sessionId, tenantId, tenantSlug, version } = job.data;

  if (type === 'review') return processReviewJob(job);

  const row = await getSessionRow(sessionId);
  if (!row) return { skipped: 'session-gone' };
  if (row.status === 'completed') return { skipped: 'completed' };
  if (row.schedule_version !== version) return { skipped: 'stale-version' };

  const settings = await getSettings(tenantId);
  await ensureNotification(sessionId, type);

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
  const lang = 'ar'; // Arabic default; customer language preference can be added later
  // The 5-minute warning carries her self-extend link, so "add an hour" is one
  // tap from the notification rather than a phone call to reception.
  const extendLink = type === 'warn_5' && settings.guardian_extend_enabled && row.guest_token
    ? guestExtendUrl(row.guest_token)
    : '';
  const vars = type === 'time_up'
    ? { child: row.child_name, minutes: overtimeMinutes(row), center: settings.center_name }
    : { child: row.child_name, center: settings.center_name, link: extendLink };

  let template = settings.wa_templates?.[type]?.[lang]
    || settings.wa_templates?.[type]?.en
    || '';
  // No link to offer (feature off, or a session started before guest tokens
  // existed) — take the whole invitation out rather than send a dead prompt.
  if (type === 'warn_5' && !extendLink) template = stripPlaceholderLines(template, ['link']);

  try {
    const { providerMessageId, body, to } = await sendWhatsApp({
      templateType: type, lang, to: row.customer_phone, vars, template,
    });
    await markSent(sessionId, type, providerMessageId);
    emitToTenant(tenantSlug, 'notification:sent', {
      session_id: sessionId, type, provider_message_id: providerMessageId, to, body,
    });
    return { sent: true, providerMessageId };
  } catch (err) {
    await markFailed(sessionId, type, err.message);
    throw err; // let BullMQ retry with backoff
  }
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
