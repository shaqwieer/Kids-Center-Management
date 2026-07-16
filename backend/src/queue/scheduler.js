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

export const warnJobId = (sessionId, version) => `warn5:${sessionId}:v${version}`;
export const timeupJobId = (sessionId, version) => `timeup:${sessionId}:v${version}`;

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
