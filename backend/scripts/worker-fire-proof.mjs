/**
 * AUTONOMOUS end-to-end proof of the #1 priority: a delayed BullMQ job is
 * promoted and executed by the ALREADY-RUNNING worker (the docker backend),
 * with NO direct call to the processor and NO worker started here.
 *
 * This script is a pure producer + DB poller + Redis subscriber. It enqueues a
 * real time_up job (~2.5s delay) for a fresh active session, then waits for the
 * live worker to: flip status -> overtime, record the notification as 'sent'
 * with a provider id, and publish session:updated to the socket bridge.
 *
 * Requires the docker stack running (its worker shares this Redis + DB).
 * Run: node scripts/worker-fire-proof.mjs
 */
import assert from 'node:assert/strict';
import { db } from '../src/config/db.js';
import { getDefaultTenant } from '../src/modules/tenants/tenants.service.js';
import { sessionQueue, DEFAULT_JOB_OPTS } from '../src/queue/connection.js';
import { timeupJobId } from '../src/queue/scheduler.js';
import { createRedisConnection } from '../src/config/redis.js';
import { SOCKET_CHANNEL } from '../src/realtime/emitter.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const sub = createRedisConnection();
  const events = [];
  await sub.subscribe(SOCKET_CHANNEL);
  sub.on('message', (_c, m) => events.push(JSON.parse(m)));

  const tenant = await getDefaultTenant();
  const manager = await db('users').where({ tenant_id: tenant.id, role: 'manager' }).first();
  const cust = await db('customers').where({ tenant_id: tenant.id }).first();
  const child = await db('children').where({ customer_id: cust.id }).first();

  const now = Date.now();
  const version = 5;
  const [ins] = await db('sessions').insert({
    tenant_id: tenant.id, customer_id: cust.id, child_id: child.id, duration_minutes: 60,
    started_at: new Date(now - 60 * 60000), ends_at: new Date(now), status: 'active',
    started_by: manager.id, schedule_version: version,
  }).returning('id');
  const sessionId = ins.id;

  console.log('Enqueuing a REAL time_up job (delay 2.5s). The LIVE docker worker must fire it.');
  await sessionQueue.add(
    'session-event',
    { type: 'time_up', sessionId, tenantId: tenant.id, tenantSlug: tenant.slug, version, endsAt: now },
    { ...DEFAULT_JOB_OPTS, jobId: timeupJobId(sessionId, version), delay: 2500 },
  );

  let ok = false;
  let notif = null;
  let sess = null;
  for (let i = 0; i < 30; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(500);
    // eslint-disable-next-line no-await-in-loop
    sess = await db('sessions').where({ id: sessionId }).first();
    // eslint-disable-next-line no-await-in-loop
    notif = await db('notifications').where({ session_id: sessionId, type: 'time_up' }).first();
    if (sess.status === 'overtime' && notif && notif.status === 'sent') { ok = true; break; }
  }

  assert.ok(ok, 'the running worker did not fire the delayed job within 15s');
  console.log('  ✓ the running worker autonomously promoted + executed the delayed job');
  assert.equal(sess.status, 'overtime');
  console.log('  ✓ session.status flipped to overtime');
  assert.equal(notif.status, 'sent');
  console.log('  ✓ notification recorded as sent');
  assert.ok(notif.provider_message_id);
  console.log(`  ✓ provider_message_id set (${notif.provider_message_id})`);

  await sleep(400);
  const emitted = events.some((e) => e.event === 'session:updated' && e.payload?.session?.id === sessionId);
  assert.ok(emitted, 'worker did not publish session:updated');
  console.log('  ✓ worker published session:updated to the socket bridge (live dashboards update)');

  await db('notifications').where({ session_id: sessionId }).del();
  await db('sessions').where({ id: sessionId }).del();

  console.log('\n✅ AUTONOMOUS WORKER-FIRE PROOF PASSED — BullMQ scheduling fires end-to-end.\n');
  await sub.quit();
  await sessionQueue.close();
  await db.destroy();
  process.exit(0);
}

main().catch((err) => { console.error('\n❌ WORKER-FIRE PROOF FAILED:', err.message); process.exit(1); });
