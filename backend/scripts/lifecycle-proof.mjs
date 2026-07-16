/**
 * End-to-end proof of the session lifecycle against live Postgres + Redis + BullMQ.
 * Exercises start -> add-time -> end and asserts:
 *  - server-authoritative ends_at math
 *  - two delayed jobs scheduled with correct delays + version
 *  - add-time bumps version, removes old-version jobs, schedules new ones
 *  - the worker VERSION GUARD makes stale/orphaned jobs harmless (skipped)
 *  - late computation on end + jobs invalidated
 *  - socket events published for created/updated/ended
 * Run: node scripts/lifecycle-proof.mjs
 */
import assert from 'node:assert/strict';
import { db } from '../src/config/db.js';
import { getDefaultTenant } from '../src/modules/tenants/tenants.service.js';
import { startSessions, addTime, endSession } from '../src/modules/sessions/sessions.service.js';
import { processSessionJob } from '../src/queue/worker.js';
import { sessionQueue } from '../src/queue/connection.js';
import { warnJobId, timeupJobId } from '../src/queue/scheduler.js';
import { createRedisConnection } from '../src/config/redis.js';
import { SOCKET_CHANNEL } from '../src/realtime/emitter.js';

const MIN = 60_000;
const approx = (a, b, tolMs = 3000) => Math.abs(a - b) <= tolMs;
let ok = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };

async function main() {
  // capture emitted socket events
  const sub = createRedisConnection();
  const events = [];
  await sub.subscribe(SOCKET_CHANNEL);
  sub.on('message', (_c, m) => events.push(JSON.parse(m)));

  const tenant = await getDefaultTenant();
  const manager = await db('users').where({ tenant_id: tenant.id, role: 'manager' }).first();
  const cust = await db('customers').where({ tenant_id: tenant.id }).first();
  const child = await db('children').where({ customer_id: cust.id }).first();

  console.log('\n[1] START a 30-min session');
  const t0 = Date.now();
  const [s] = await startSessions({
    tenantId: tenant.id, tenantSlug: tenant.slug, userId: manager.id,
    customerId: cust.id, childIds: [child.id], durationMinutes: 30,
  });
  assert.equal(s.status, 'active'); pass('status = active');
  assert.ok(s.customer && s.child && s.price !== null); pass('DTO has customer, child, price');
  const startedMs = new Date(s.started_at).getTime();
  const endsMs = new Date(s.ends_at).getTime();
  assert.ok(approx(endsMs, startedMs + 30 * MIN)); pass('ends_at = started_at + 30min');
  assert.ok(approx(startedMs, t0)); pass('started_at = server now');

  let row = await db('sessions').where({ id: s.id }).first();
  assert.equal(row.schedule_version, 1); pass('schedule_version = 1');

  const wj = await sessionQueue.getJob(warnJobId(s.id, 1));
  const tj = await sessionQueue.getJob(timeupJobId(s.id, 1));
  assert.ok(wj && tj); pass('two delayed jobs scheduled (v1)');
  assert.ok(approx(wj.delay, 25 * MIN)); pass(`warn_5 delay ≈ 25min (${Math.round(wj.delay / MIN)}m)`);
  assert.ok(approx(tj.delay, 30 * MIN)); pass(`time_up delay ≈ 30min (${Math.round(tj.delay / MIN)}m)`);
  assert.equal(wj.data.version, 1); pass('job carries version=1');

  console.log('\n[2] ADD 15 minutes');
  const upd = await addTime({ tenantId: tenant.id, tenantSlug: tenant.slug, sessionId: s.id, minutes: 15 });
  const newEndsMs = new Date(upd.ends_at).getTime();
  assert.ok(approx(newEndsMs, endsMs + 15 * MIN)); pass('ends_at extended by 15min');
  row = await db('sessions').where({ id: s.id }).first();
  assert.equal(row.schedule_version, 2); pass('schedule_version bumped to 2');

  const wjOld = await sessionQueue.getJob(warnJobId(s.id, 1));
  const tjOld = await sessionQueue.getJob(timeupJobId(s.id, 1));
  assert.ok(!wjOld && !tjOld); pass('old v1 jobs removed (no orphans in Redis)');
  const wjNew = await sessionQueue.getJob(warnJobId(s.id, 2));
  const tjNew = await sessionQueue.getJob(timeupJobId(s.id, 2));
  assert.ok(wjNew && tjNew); pass('new v2 jobs scheduled');
  assert.ok(approx(tjNew.delay, 45 * MIN)); pass(`new time_up delay ≈ 45min (${Math.round(tjNew.delay / MIN)}m)`);

  console.log('\n[3] VERSION GUARD — a stale v1 job must be harmless');
  const stale = await processSessionJob({
    data: { type: 'warn_5', sessionId: s.id, tenantId: tenant.id, tenantSlug: tenant.slug, version: 1 },
  });
  assert.deepEqual(stale, { skipped: 'stale-version' }); pass('stale v1 job -> skipped (no send, no state change)');

  console.log('\n[4] END the session');
  const ended = await endSession({ tenantId: tenant.id, tenantSlug: tenant.slug, sessionId: s.id });
  assert.equal(ended.status, 'completed'); pass('status = completed');
  assert.ok(ended.ended_at); pass('ended_at set');
  assert.equal(ended.late_minutes, 0); pass('no late minutes (ended before ends_at)');
  const tjAfterEnd = await sessionQueue.getJob(timeupJobId(s.id, 2));
  assert.ok(!tjAfterEnd); pass('pending v2 jobs removed on end');
  row = await db('sessions').where({ id: s.id }).first();
  const completedGuard = await processSessionJob({
    data: { type: 'time_up', sessionId: s.id, tenantId: tenant.id, tenantSlug: tenant.slug, version: row.schedule_version },
  });
  assert.equal(completedGuard.skipped, 'completed'); pass('any job on a completed session -> skipped');

  console.log('\n[5] SOCKET events');
  await new Promise((r) => setTimeout(r, 300));
  const types = events.filter((e) => e.payload?.session?.id === s.id || e.payload?.id === s.id).map((e) => e.event);
  assert.ok(types.includes('session:created')); pass('emitted session:created');
  assert.ok(types.includes('session:updated')); pass('emitted session:updated');
  assert.ok(types.includes('session:ended')); pass('emitted session:ended');

  // cleanup the proof session so it doesn't clutter the seed
  await db('notifications').where({ session_id: s.id }).del();
  await db('sessions').where({ id: s.id }).del();

  console.log(`\n✅ LIFECYCLE PROOF PASSED — ${ok} assertions.\n`);
  await sub.quit();
  await sessionQueue.close();
  await db.destroy();
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ LIFECYCLE PROOF FAILED:', err);
  process.exit(1);
});
