/**
 * Proves the notification delivery path: when a warn_5 job fires (matching
 * version, active session) the worker transitions state, sends via the WhatsApp
 * adapter (log mode), and records a 'sent' notification row with a provider id.
 * Run: node scripts/notify-proof.mjs
 */
import assert from 'node:assert/strict';
import { db } from '../src/config/db.js';
import { getDefaultTenant } from '../src/modules/tenants/tenants.service.js';
import { startSessions } from '../src/modules/sessions/sessions.service.js';
import { processSessionJob } from '../src/queue/worker.js';
import { sessionQueue } from '../src/queue/connection.js';
import { removeJobs } from '../src/queue/scheduler.js';
import { createRedisConnection } from '../src/config/redis.js';
import { SOCKET_CHANNEL } from '../src/realtime/emitter.js';

let ok = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };

async function main() {
  const sub = createRedisConnection();
  const events = [];
  await sub.subscribe(SOCKET_CHANNEL);
  sub.on('message', (_c, m) => events.push(JSON.parse(m)));

  const tenant = await getDefaultTenant();
  const manager = await db('users').where({ tenant_id: tenant.id, role: 'manager' }).first();
  const cust = await db('customers').where({ tenant_id: tenant.id }).first();
  const child = await db('children').where({ customer_id: cust.id }).first();

  const [s] = await startSessions({
    tenantId: tenant.id, tenantSlug: tenant.slug, userId: manager.id,
    customerId: cust.id, childIds: [child.id], durationMinutes: 60,
  });
  const row = await db('sessions').where({ id: s.id }).first();

  console.log('\nFire warn_5 (matching version, active session) via the worker processor:');
  const res = await processSessionJob({
    data: { type: 'warn_5', sessionId: s.id, tenantId: tenant.id, tenantSlug: tenant.slug, version: row.schedule_version },
  });
  assert.equal(res.sent, true); pass('worker reports sent=true');
  assert.ok(String(res.providerMessageId).startsWith('log_')); pass('provider_message_id from log adapter');

  const notif = await db('notifications').where({ session_id: s.id, type: 'warn_5' }).first();
  assert.ok(notif); pass('notification row created');
  assert.equal(notif.status, 'sent'); pass("notification status = 'sent'");
  assert.ok(notif.provider_message_id); pass('notification has provider_message_id');
  assert.ok(notif.sent_at); pass('notification sent_at set');

  const after = await db('sessions').where({ id: s.id }).first();
  assert.equal(after.status, 'warned'); pass("session status transitioned to 'warned'");

  await new Promise((r) => setTimeout(r, 300));
  const evs = events.filter((e) => (e.payload?.session?.id === s.id) || (e.payload?.session_id === s.id)).map((e) => e.event);
  assert.ok(evs.includes('session:updated')); pass('emitted session:updated');
  assert.ok(evs.includes('notification:sent')); pass('emitted notification:sent');

  // cleanup
  await removeJobs(s.id, row.schedule_version);
  await db('notifications').where({ session_id: s.id }).del();
  await db('sessions').where({ id: s.id }).del();

  console.log(`\n✅ NOTIFY PROOF PASSED — ${ok} assertions.\n`);
  await sub.quit();
  await sessionQueue.close();
  await db.destroy();
  process.exit(0);
}

main().catch((err) => { console.error('\n❌ NOTIFY PROOF FAILED:', err); process.exit(1); });
