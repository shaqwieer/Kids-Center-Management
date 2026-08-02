/**
 * Schedules the two delayed jobs (warn_5, time_up) for a session.
 *
 * Job IDs embed the session's schedule_version, e.g. `warn5:<id>:v3`. On every
 * add-time/end the version is bumped, so any lingering job from an old version
 * is ignored by the worker's version guard — orphaned jobs are HARMLESS. We
 * still best-effort remove old jobs to keep Redis tidy.
 */
import { sessionQueue, DEFAULT_JOB_OPTS } from './connection.js';
import { computeDelays } from '../lib/timing.js';

/**
 * JOB ID FORMAT — BullMQ rejects a custom id containing ':' UNLESS it splits
 * into exactly three parts (job.js: `jobId.includes(':') && split(':').length
 * !== 3` throws "Custom Id cannot contain :"). The versioned ids below are
 * three-part and legal; anything without a version must use '-' instead.
 *
 * `review:<id>` was two-part, so every review enqueue threw — and because
 * checkout deliberately swallows scheduling errors, the post-visit message was
 * silently never queued. Keep new ids hyphenated.
 */
export const warnJobId = (sessionId, version) => `warn5:${sessionId}:v${version}`;
export const timeupJobId = (sessionId, version) => `timeup:${sessionId}:v${version}`;
export const reviewJobId = (sessionId) => `review-${sessionId}`;
export const welcomeJobId = (customerId) => `welcome-${customerId}`;
export const bookingConfirmedJobId = (bookingId) => `bkconf-${bookingId}`;

/**
 * Enqueue the warn_5 + time_up jobs for the given (already-persisted) version.
 * @param {{sessionId:string, tenantId:string, tenantSlug:string, endsAtMs:number, version:number, nowMs?:number}} p
 */
export async function scheduleJobs({ sessionId, tenantId, tenantSlug, endsAtMs, version, nowMs = Date.now() }) {
  const { warn5, timeup } = computeDelays(nowMs, endsAtMs);
  const common = { sessionId, tenantId, tenantSlug, version, endsAt: endsAtMs };

  await sessionQueue.add(
    'session-event',
    { ...common, type: 'warn_5' },
    { ...DEFAULT_JOB_OPTS, jobId: warnJobId(sessionId, version), delay: warn5 },
  );
  await sessionQueue.add(
    'session-event',
    { ...common, type: 'time_up' },
    { ...DEFAULT_JOB_OPTS, jobId: timeupJobId(sessionId, version), delay: timeup },
  );
}

/**
 * Enqueue the post-visit review ask. No version guard is needed: the job id is
 * per-session, checkout is idempotent, and BullMQ dedupes a repeated jobId — so
 * a double checkout can never send her two "rate your visit" messages.
 */
export async function scheduleReview({ sessionId, tenantId, tenantSlug, reviewId, delayMs = 0 }) {
  await sessionQueue.add(
    'session-event',
    { type: 'review', sessionId, tenantId, tenantSlug, reviewId },
    { ...DEFAULT_JOB_OPTS, jobId: reviewJobId(sessionId), delay: Math.max(0, delayMs) },
  );
}

/**
 * Enqueue the registration welcome. Deliberately goes through the queue rather
 * than sending inline: registration is a form the mother is standing in front
 * of, and it must not wait on — or fail because of — an outbound HTTP call.
 * The per-customer job id plus the notifications unique row mean a retried
 * registration can never produce a second welcome.
 */
export async function scheduleWelcome({ customerId, tenantId, tenantSlug, delayMs = 0 }) {
  await sessionQueue.add(
    'session-event',
    { type: 'welcome', customerId, tenantId, tenantSlug },
    { ...DEFAULT_JOB_OPTS, jobId: welcomeJobId(customerId), delay: Math.max(0, delayMs) },
  );
}

/** Enqueue the party/workshop confirmation. Same idempotency story as above. */
export async function scheduleBookingConfirmed({ bookingId, tenantId, tenantSlug, delayMs = 0 }) {
  await sessionQueue.add(
    'session-event',
    { type: 'booking_confirmed', bookingId, tenantId, tenantSlug },
    { ...DEFAULT_JOB_OPTS, jobId: bookingConfirmedJobId(bookingId), delay: Math.max(0, delayMs) },
  );
}

/** Best-effort removal of a version's jobs. Never throws (correctness doesn't depend on it). */
export async function removeJobs(sessionId, version) {
  for (const jobId of [warnJobId(sessionId, version), timeupJobId(sessionId, version)]) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sessionQueue.remove(jobId);
    } catch {
      /* job may be active/gone — the version guard covers correctness */
    }
  }
}
