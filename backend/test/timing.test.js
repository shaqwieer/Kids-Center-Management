import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEndsAt, computeDelays, computeLate, deriveLiveState, priceForDuration, MINUTE_MS,
  isOpenPlay, isSellableDuration,
} from '../src/lib/timing.js';

test('computeEndsAt adds duration in minutes', () => {
  const start = 1_000_000_000_000;
  assert.equal(computeEndsAt(start, 60), start + 60 * MINUTE_MS);
  assert.equal(computeEndsAt(start, 30), start + 30 * MINUTE_MS);
});

test('computeDelays for a normal 60-min session', () => {
  const now = 1_000_000_000_000;
  const endsAt = computeEndsAt(now, 60);
  const { warn5, timeup } = computeDelays(now, endsAt);
  assert.equal(warn5, 55 * MINUTE_MS);
  assert.equal(timeup, 60 * MINUTE_MS);
});

test('computeDelays: duration under 5 min -> warn fires immediately (0)', () => {
  const now = 1_000_000_000_000;
  const endsAt = computeEndsAt(now, 3);
  const { warn5, timeup } = computeDelays(now, endsAt);
  assert.equal(warn5, 0); // warn moment already passed
  assert.equal(timeup, 3 * MINUTE_MS);
});

test('computeDelays: past end -> both zero (never negative)', () => {
  const now = 1_000_000_000_000;
  const endsAt = now - 10 * MINUTE_MS;
  const { warn5, timeup } = computeDelays(now, endsAt);
  assert.equal(warn5, 0);
  assert.equal(timeup, 0);
});

test('computeLate: on time -> no fee', () => {
  const endsAt = 1_000_000_000_000;
  assert.deepEqual(computeLate(endsAt, endsAt, 1.5), { lateMinutes: 0, lateFee: 0 });
  assert.deepEqual(computeLate(endsAt, endsAt - 5 * MINUTE_MS, 1.5), { lateMinutes: 0, lateFee: 0 });
});

test('computeLate: partial minute rounds up; fee = minutes * rate', () => {
  const endsAt = 1_000_000_000_000;
  const endedAt = endsAt + 6 * MINUTE_MS + 5000; // 6m5s over
  const { lateMinutes, lateFee } = computeLate(endsAt, endedAt, 1.5);
  assert.equal(lateMinutes, 7);
  assert.equal(lateFee, 10.5);
});

test('computeLate: rate 0 disables fee', () => {
  const endsAt = 1_000_000_000_000;
  assert.deepEqual(computeLate(endsAt, endsAt + 30 * MINUTE_MS, 0), { lateMinutes: 30, lateFee: 0 });
});

test('deriveLiveState boundaries', () => {
  const now = 1_000_000_000_000;
  assert.equal(deriveLiveState(now, now + 20 * MINUTE_MS), 'active');
  assert.equal(deriveLiveState(now, now + 5 * MINUTE_MS), 'warned');
  assert.equal(deriveLiveState(now, now + 1 * MINUTE_MS), 'warned');
  assert.equal(deriveLiveState(now, now), 'overtime');
  assert.equal(deriveLiveState(now, now - 1), 'overtime');
});

test('add-time while overtime pushes session back to active', () => {
  const now = 1_000_000_000_000;
  const endsAt = now - 3 * MINUTE_MS; // 3 min overtime
  assert.equal(deriveLiveState(now, endsAt), 'overtime');
  const newEndsAt = endsAt + 15 * MINUTE_MS; // +15 min
  assert.equal(deriveLiveState(now, newEndsAt), 'active');
  // delays recomputed from now, both positive
  const { warn5, timeup } = computeDelays(now, newEndsAt);
  assert.ok(warn5 >= 0 && timeup > 0);
  assert.equal(timeup, 12 * MINUTE_MS);
});

test('priceForDuration maps duration to price', () => {
  const durations = [{ min: 30, price: 25 }, { min: 60, price: 40 }, { min: 120, price: 70 }];
  assert.equal(priceForDuration(durations, 60), 40);
  assert.equal(priceForDuration(durations, 999), 0);
});

test('open play (0) is priced like any tier but has no end to be late for', () => {
  const durations = [{ min: 30, price: 55 }, { min: 60, price: 75 }, { min: 0, price: 115 }];
  assert.ok(isOpenPlay(0));
  assert.ok(!isOpenPlay(60));
  assert.ok(!isOpenPlay(null));
  assert.equal(priceForDuration(durations, 0), 115);
  // Ended hours later: still no late minutes, no fee.
  assert.deepEqual(computeLate(null, Date.now(), 1.5), { lateMinutes: 0, lateFee: 0 });
});

test('a retired tier keeps its price but can no longer be sold', () => {
  const durations = [{ min: 60, price: 75 }, { min: 120, price: 115, retired: true }, { min: 0, price: 115 }];
  assert.equal(priceForDuration(durations, 120), 115); // past 2-hour visits keep their revenue
  assert.ok(!isSellableDuration(durations, 120));
  assert.ok(isSellableDuration(durations, 60));
  assert.ok(isSellableDuration(durations, 0));
  assert.ok(!isSellableDuration(durations, 45));
});
