/**
 * Session business logic — the correctness core.
 *
 * Server owns every timestamp. Every start/add-time/end bumps schedule_version;
 * BullMQ jobs are (re)scheduled against the new version and the worker ignores
 * stale versions, so add-time can never leave an orphaned notification firing.
 */
import { db } from '../../config/db.js';
import { ApiError } from '../../utils/http.js';
import { computeEndsAt, computeLate, deriveLiveState, MINUTE_MS } from '../../lib/timing.js';
import { getSettings } from '../settings/settings.service.js';
import { emitToTenant } from '../../realtime/emitter.js';
import { scheduleJobs, removeJobs } from '../../queue/scheduler.js';
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
    });
    // eslint-disable-next-line no-await-in-loop
    await scheduleJobs({ sessionId: row.id, tenantId, tenantSlug, endsAtMs, version: 1, nowMs });
    const dto = toSessionDTO(row, durView);
    emitToTenant(tenantSlug, 'session:created', { session: dto });
    created.push(dto);
  }
  return created;
}

/** Extend a running session; cancels old jobs and reschedules against a new version. */
export async function addTime({ tenantId, tenantSlug, sessionId, minutes }) {
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

  const dto = toSessionDTO(updated, settings);
  emitToTenant(tenantSlug, 'session:ended', { id: sessionId, session: dto });
  return dto;
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
