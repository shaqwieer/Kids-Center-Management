/**
 * Session business logic — the correctness core.
 *
 * Server owns every timestamp. Every start/add-time/end bumps schedule_version;
 * BullMQ jobs are (re)scheduled against the new version and the worker ignores
 * stale versions, so add-time can never leave an orphaned notification firing.
 */
import { db } from '../../config/db.js';
import { ApiError } from '../../utils/http.js';
import { env } from '../../config/env.js';
import { computeEndsAt, computeLate, deriveLiveState, priceForDuration, MINUTE_MS } from '../../lib/timing.js';
import { getSettings } from '../settings/settings.service.js';
import { emitToTenant } from '../../realtime/emitter.js';
import { scheduleJobs, removeJobs, scheduleReview } from '../../queue/scheduler.js';
import { makeQrToken } from '../../utils/codes.js';
import { ensureReviewForSession } from '../reviews/reviews.service.js';
import {
  getSessionRow, listActiveRows, insertSession, updateSession, toSessionDTO,
} from './sessions.repo.js';

async function loadSettingsView(tenantId) {
  const s = await getSettings(tenantId);
  return { durations: s.durations, currency: s.currency, late_fee_per_minute: Number(s.late_fee_per_minute) };
}

export async function getActiveSessions(tenantId) {
  const [rows, settings] = await Promise.all([listActiveRows(tenantId), loadSettingsView(tenantId)]);
  return rows.map((r) => toSessionDTO(r, settings));
}

export async function getSessionDTO(tenantId, sessionId) {
  const row = await getSessionRow(sessionId);
  if (!row || row.tenant_id !== tenantId) throw ApiError.notFound('Session not found');
  const settings = await loadSettingsView(tenantId);
  return toSessionDTO(row, settings);
}

/**
 * Start one session PER selected child (all with the same duration/start).
 * Schedules warn_5 + time_up jobs and emits `session:created` for each.
 */
export async function startSessions({ tenantId, tenantSlug, userId, customerId, childIds, durationMinutes }) {
  const settings = await getSettings(tenantId);
  const durView = { durations: settings.durations, currency: settings.currency };

  const allowed = (settings.durations || []).some((d) => Number(d.min) === Number(durationMinutes));
  if (!allowed) throw ApiError.badRequest('Duration is not allowed by settings', { durationMinutes });

  if (!Array.isArray(childIds) || childIds.length === 0) {
    throw ApiError.badRequest('At least one child is required');
  }

  const customer = await db('customers').where({ id: customerId, tenant_id: tenantId }).first();
  if (!customer) throw ApiError.notFound('Customer not found');

  const children = await db('children').whereIn('id', childIds).andWhere('customer_id', customerId);
  if (children.length !== childIds.length) {
    throw ApiError.badRequest('One or more children do not belong to this customer');
  }

  const nowMs = Date.now();
  const endsAtMs = computeEndsAt(nowMs, durationMinutes);
  const startedAt = new Date(nowMs);
  const endsAt = new Date(endsAtMs);

  const created = [];
  for (const child of children) {
    // eslint-disable-next-line no-await-in-loop
    const row = await insertSession({
      tenant_id: tenantId,
      customer_id: customerId,
      child_id: child.id,
      duration_minutes: durationMinutes,
      started_at: startedAt,
      ends_at: endsAt,
      status: 'active',
      started_by: userId,
      schedule_version: 1,
      // Opaque link the mother taps from her WhatsApp warning to add an hour.
      guest_token: makeQrToken(),
    });
    // eslint-disable-next-line no-await-in-loop
    await scheduleJobs({ sessionId: row.id, tenantId, tenantSlug, endsAtMs, version: 1, nowMs });
    const dto = toSessionDTO(row, durView);
    emitToTenant(tenantSlug, 'session:created', { session: dto });
    created.push(dto);
  }
  return created;
}

/**
 * Extend a running session; cancels old jobs and reschedules against a new version.
 * `by` is 'staff' (reception tapped +time) or 'guardian' (the mother used her
 * WhatsApp link). Guardian minutes are tallied separately so the checkout screen
 * and the finance ledger can show what she added herself.
 */
export async function addTime({ tenantId, tenantSlug, sessionId, minutes, by = 'staff' }) {
  const row = await getSessionRow(sessionId);
  if (!row || row.tenant_id !== tenantId) throw ApiError.notFound('Session not found');
  if (row.status === 'completed') throw ApiError.badRequest('Session already completed');
  if (!minutes || minutes <= 0) throw ApiError.badRequest('minutes must be positive');

  const settings = await loadSettingsView(tenantId);
  const nowMs = Date.now();
  const newEndsMs = new Date(row.ends_at).getTime() + Math.round(minutes) * MINUTE_MS;
  const newVersion = row.schedule_version + 1;
  const newStatus = deriveLiveState(nowMs, newEndsMs); // back to active/warned if pushed into the future

  const updated = await updateSession(sessionId, {
    ends_at: new Date(newEndsMs),
    schedule_version: newVersion,
    status: newStatus,
    guardian_added_minutes: by === 'guardian'
      ? (row.guardian_added_minutes || 0) + Math.round(minutes)
      : (row.guardian_added_minutes || 0),
  });

  await removeJobs(sessionId, row.schedule_version); // best-effort tidy of old version
  await scheduleJobs({ sessionId, tenantId, tenantSlug, endsAtMs: newEndsMs, version: newVersion, nowMs });

  const dto = toSessionDTO(updated, settings);
  emitToTenant(tenantSlug, 'session:updated', { session: dto });
  return dto;
}

/** End a session now; computes late minutes/fee and invalidates pending jobs. */
export async function endSession({ tenantId, tenantSlug, sessionId }) {
  const row = await getSessionRow(sessionId);
  if (!row || row.tenant_id !== tenantId) throw ApiError.notFound('Session not found');
  const settings = await loadSettingsView(tenantId);

  if (row.status === 'completed') {
    return toSessionDTO(row, settings); // idempotent
  }

  const endedMs = Date.now();
  const endsMs = new Date(row.ends_at).getTime();
  const { lateMinutes, lateFee } = computeLate(endsMs, endedMs, settings.late_fee_per_minute);
  const newVersion = row.schedule_version + 1; // invalidate any pending job

  const updated = await updateSession(sessionId, {
    status: 'completed',
    ended_at: new Date(endedMs),
    late_minutes: lateMinutes,
    late_fee: lateFee,
    schedule_version: newVersion,
  });

  await removeJobs(sessionId, row.schedule_version);

  // Post-visit review: mint the link now (idempotent) and schedule the WhatsApp
  // ask for later, so she is not messaged while still putting shoes on.
  const full = await getSettings(tenantId);
  if (full.reviews_enabled) {
    try {
      const review = await ensureReviewForSession(tenantId, sessionId, row.customer_id);
      await scheduleReview({
        sessionId,
        tenantId,
        tenantSlug,
        reviewId: review.id,
        delayMs: Math.max(0, (Number(full.review_delay_minutes) || 0) * MINUTE_MS),
      });
    } catch (err) {
      // A review is a nice-to-have; it must never block a checkout.
      // eslint-disable-next-line no-console
      console.error('[sessions] review scheduling failed:', err?.message);
    }
  }

  const dto = toSessionDTO(updated, settings);
  emitToTenant(tenantSlug, 'session:ended', { id: sessionId, session: dto });
  return dto;
}

// ---- Guardian self-service (public, token-scoped) ---------------------------

/**
 * What the mother sees on /x/<guest_token>: her child, the live end time and the
 * price of one extension. No auth — the token IS the credential, and it only
 * ever exposes this one session.
 */
export async function getGuestSession(token) {
  const row = await db('sessions as s')
    .join('children as ch', 'ch.id', 's.child_id')
    .join('customers as c', 'c.id', 's.customer_id')
    .where('s.guest_token', token)
    .select('s.*', 'ch.name as child_name', 'c.full_name as customer_full_name')
    .first();
  if (!row) throw ApiError.notFound('Link not found');

  const settings = await getSettings(row.tenant_id);
  const extendMinutes = Number(settings.guardian_extend_minutes) || 60;

  return {
    token,
    center_name: settings.center_name,
    primary_color: settings.primary_color,
    currency: settings.currency,
    child_name: row.child_name,
    guardian_name: row.customer_full_name,
    ends_at: row.ends_at instanceof Date ? row.ends_at.toISOString() : row.ends_at,
    status: row.status,
    completed: row.status === 'completed',
    extend_enabled: Boolean(settings.guardian_extend_enabled) && row.status !== 'completed',
    extend_minutes: extendMinutes,
    // What the extension will cost, using the same duration price list as reception.
    extend_price: priceForDuration(settings.durations, extendMinutes),
    already_added_minutes: row.guardian_added_minutes || 0,
  };
}

/** She tapped "add an hour". Server-authoritative: it re-reads and re-schedules. */
export async function guardianExtend(token) {
  const row = await db('sessions').where({ guest_token: token }).first();
  if (!row) throw ApiError.notFound('Link not found');
  if (row.status === 'completed') throw ApiError.badRequest('This visit has already ended');

  const settings = await getSettings(row.tenant_id);
  if (!settings.guardian_extend_enabled) throw ApiError.forbidden('Self-extension is turned off');

  const tenant = await db('tenants').where({ id: row.tenant_id }).first();
  return addTime({
    tenantId: row.tenant_id,
    tenantSlug: tenant?.slug,
    sessionId: row.id,
    minutes: Number(settings.guardian_extend_minutes) || 60,
    by: 'guardian',
  });
}

/** Absolute URL the WhatsApp warning message links to. */
export function guestExtendUrl(guestToken) {
  return `${env.appBaseUrl.replace(/\/$/, '')}/x/${guestToken}`;
}

// ---- Worker transition helpers (atomic, conditional on current status) -------

/** warn_5 handler effect: active -> warned. Returns { changed, dto }. */
export async function markWarned(tenantId, sessionId) {
  const settings = await loadSettingsView(tenantId);
  const affected = await db('sessions').where({ id: sessionId, status: 'active' }).update({ status: 'warned' });
  const row = await getSessionRow(sessionId);
  return { changed: affected > 0, dto: toSessionDTO(row, settings) };
}

/** time_up handler effect: active|warned -> overtime. Returns { changed, dto }. */
export async function markOvertime(tenantId, sessionId) {
  const settings = await loadSettingsView(tenantId);
  const affected = await db('sessions')
    .where({ id: sessionId })
    .whereIn('status', ['active', 'warned'])
    .update({ status: 'overtime' });
  const row = await getSessionRow(sessionId);
  return { changed: affected > 0, dto: toSessionDTO(row, settings) };
}
