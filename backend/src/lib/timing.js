/**
 * Pure, dependency-free session-timing math. These functions are the heart of
 * the server-authoritative timer and are unit-tested in isolation (no DB/Redis).
 *
 * All arguments/results are in epoch milliseconds unless noted.
 */

export const MINUTE_MS = 60_000;
export const WARN_LEAD_MIN = 5; // "5 minutes left" warning lead time

/** End timestamp for a session that starts at `startAtMs` and runs `durationMin`. */
export function computeEndsAt(startAtMs, durationMin) {
  return startAtMs + Math.round(durationMin) * MINUTE_MS;
}

/**
 * Delays (ms from `nowMs`) at which the two scheduled jobs must fire.
 * Never negative: a job whose moment has already passed fires immediately (0).
 * If the session is so short that the warning moment is already gone, warn5 = 0.
 */
export function computeDelays(nowMs, endsAtMs, warnLeadMin = WARN_LEAD_MIN) {
  const warnAt = endsAtMs - warnLeadMin * MINUTE_MS;
  return {
    warn5: Math.max(0, warnAt - nowMs),
    timeup: Math.max(0, endsAtMs - nowMs),
  };
}

/**
 * Late pickup relative to the (authoritative, possibly extended) scheduled end.
 * lateMinutes rounds UP any partial minute; lateFee = lateMinutes * ratePerMin.
 * ratePerMin = 0 disables late fees (returns 0).
 */
export function computeLate(endsAtMs, endedAtMs, ratePerMin = 0) {
  const overMs = endedAtMs - endsAtMs;
  const lateMinutes = overMs > 0 ? Math.ceil(overMs / MINUTE_MS) : 0;
  const rate = Number(ratePerMin) || 0;
  const lateFee = Math.round(lateMinutes * rate * 100) / 100;
  return { lateMinutes, lateFee };
}

/** Milliseconds remaining until `endsAtMs` (negative once overtime). */
export function remainingMs(nowMs, endsAtMs) {
  return endsAtMs - nowMs;
}

/**
 * Visual/business state derived purely from remaining time.
 * 'active' -> playing, 'warned' -> <=5min left, 'overtime' -> past end.
 * (The stored status is authoritative for completed; this derives the live view.)
 */
export function deriveLiveState(nowMs, endsAtMs, warnLeadMin = WARN_LEAD_MIN) {
  const rem = endsAtMs - nowMs;
  if (rem <= 0) return 'overtime';
  if (rem <= warnLeadMin * MINUTE_MS) return 'warned';
  return 'active';
}

/** Base price for a chosen duration from the settings durations list. */
export function priceForDuration(durations, durationMin) {
  if (!Array.isArray(durations)) return 0;
  const found = durations.find((d) => Number(d.min) === Number(durationMin));
  return found ? Number(found.price) || 0 : 0;
}
