/**
 * Proves the notification delivery path end to end, on the log adapter.
 *
 * Covers all five outbound messages and the three anchors they hang off:
 *   warn_5 / time_up / review  -> a SESSION
 *   welcome                    -> a CUSTOMER (registration; no session exists)
 *   booking_confirmed          -> a BOOKING
 *
 * Also pins the two things that were silently wrong before:
 *   - the message language follows the guardian, then the centre default
 *     (it used to be hardcoded 'ar', so English templates never went out)
 *   - warn_5's {minutes} comes from guardian_extend_minutes, so changing the
 *     setting changes the message instead of making it lie.
 *
 * Run: node scripts/notify-proof.mjs
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { db } from '../src/config/db.js';
import { getDefaultTenant } from '../src/modules/tenants/tenants.service.js';
import { startSessions } from '../src/modules/sessions/sessions.service.js';
import { processSessionJob } from '../src/queue/worker.js';
import { sessionQueue } from '../src/queue/connection.js';
import { removeJobs } from '../src/queue/scheduler.js';
import { createRedisConnection } from '../src/config/redis.js';
import { SOCKET_CHANNEL } from '../src/realtime/emitter.js';
import { getSettings, updateSettings } from '../src/modules/settings/settings.service.js';

let ok = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };
const token = () => crypto.randomBytes(16).toString('hex');

/** The job envelope the worker receives — there is no BullMQ in this proof. */
const job = (data) => ({ data });

async function main() {
  const sub = createRedisConnection();
  const events = [];
  await sub.subscribe(SOCKET_CHANNEL);
  sub.on('message', (_c, m) => events.push(JSON.parse(m)));
  const findSent = (pred) => events
    .filter((e) => e.event === 'notification:sent' && pred(e.payload))
    .map((e) => e.payload)
    .pop();
  /** Redis pub/sub is asynchronous — the emit lands a tick or two after the send. */
  const sentBody = async (pred) => {
    for (let i = 0; i < 40; i += 1) {
      const hit = findSent(pred);
      if (hit) return hit;
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error('notification:sent event never arrived');
  };

  const tenant = await getDefaultTenant();
  const manager = await db('users').where({ tenant_id: tenant.id, role: 'manager' }).first();
  const cust = await db('customers').where({ tenant_id: tenant.id }).first();
  const child = await db('children').where({ customer_id: cust.id }).first();
  const settings = await getSettings(tenant.id);

  const created = { sessions: [], customers: [], bookings: [] };

  // ---- 1. warn_5 on a live session ----------------------------------------
  console.log('\nFire warn_5 (matching version, active session) via the worker processor:');
  const [s] = await startSessions({
    tenantId: tenant.id, tenantSlug: tenant.slug, userId: manager.id,
    customerId: cust.id, childIds: [child.id], durationMinutes: 60,
  });
  created.sessions.push(s.id);
  const row = await db('sessions').where({ id: s.id }).first();

  const res = await processSessionJob(job({
    type: 'warn_5', sessionId: s.id, tenantId: tenant.id, tenantSlug: tenant.slug,
    version: row.schedule_version,
  }));
  assert.equal(res.sent, true); pass('worker reports sent=true');
  assert.ok(String(res.providerMessageId).startsWith('log_')); pass('provider_message_id from log adapter');

  const notif = await db('notifications').where({ session_id: s.id, type: 'warn_5' }).first();
  assert.ok(notif); pass('notification row created');
  assert.equal(notif.status, 'sent'); pass("notification status = 'sent'");
  assert.ok(notif.provider_message_id); pass('notification has provider_message_id');
  assert.ok(notif.sent_at); pass('notification sent_at set');
  assert.equal(notif.customer_id, null); pass('session-anchored row leaves customer_id null');

  const after = await db('sessions').where({ id: s.id }).first();
  assert.equal(after.status, 'warned'); pass("session status transitioned to 'warned'");

  await new Promise((r) => setTimeout(r, 300));
  const evs = events.filter((e) => (e.payload?.session?.id === s.id) || (e.payload?.session_id === s.id)).map((e) => e.event);
  assert.ok(evs.includes('session:updated')); pass('emitted session:updated');
  assert.ok(evs.includes('notification:sent')); pass('emitted notification:sent');

  // The extension length is a SETTING; the message must quote that number.
  const warnPayload = await sentBody((p) => p.session_id === s.id && p.type === 'warn_5');
  assert.ok(warnPayload.body.includes(String(settings.guardian_extend_minutes)));
  pass(`warn_5 body quotes guardian_extend_minutes (${settings.guardian_extend_minutes})`);
  assert.ok(!/نصف ساعة|another hour/.test(warnPayload.body));
  pass('warn_5 body no longer hardcodes a fixed extension length');

  // ---- 2. time_up must not claim a running overtime total ------------------
  console.log('\ntime_up fires AT the end, so it cannot report accumulated overtime:');
  const timeUpRes = await processSessionJob(job({
    type: 'time_up', sessionId: s.id, tenantId: tenant.id, tenantSlug: tenant.slug,
    version: row.schedule_version,
  }));
  assert.equal(timeUpRes.sent, true); pass('time_up sent');
  const timeUpPayload = await sentBody((p) => p.session_id === s.id && p.type === 'time_up');
  assert.ok(!/الوقت الإضافي حتى الآن|[Oo]vertime so far/.test(timeUpPayload.body));
  pass('time_up body makes no running-total claim');

  // ---- 3. welcome, anchored to a CUSTOMER (no session) ---------------------
  console.log('\nWelcome on registration (customer-anchored, no session exists):');
  const [newCust] = await db('customers').insert({
    tenant_id: tenant.id,
    full_name: 'أم تجريبية',
    phone: `05999${String(Date.now()).slice(-5)}`,
    customer_code: `T-${String(Date.now()).slice(-5)}`,
    qr_token: token(),
    consent: true,
    lang: null, // no preference -> centre default
  }).returning('*');
  created.customers.push(newCust.id);

  const welcomeRes = await processSessionJob(job({
    type: 'welcome', customerId: newCust.id, tenantId: tenant.id, tenantSlug: tenant.slug,
  }));
  assert.equal(welcomeRes.sent, true); pass('welcome sent');

  const wNotif = await db('notifications').where({ customer_id: newCust.id, type: 'welcome' }).first();
  assert.ok(wNotif); pass('welcome notification row created');
  assert.equal(wNotif.status, 'sent'); pass("welcome status = 'sent'");
  assert.equal(wNotif.session_id, null); pass('welcome row has no session_id (schema allows it)');

  const wPayload = await sentBody((p) => p.customer_id === newCust.id);
  assert.ok(wPayload.body.includes(newCust.customer_code));
  pass('welcome body carries her customer code');
  assert.equal(wPayload.lang, settings.default_lang);
  pass(`welcome used the centre default language (${settings.default_lang})`);

  // Replay: BullMQ can hand the same job back after a crash mid-ack.
  const replay = await processSessionJob(job({
    type: 'welcome', customerId: newCust.id, tenantId: tenant.id, tenantSlug: tenant.slug,
  }));
  assert.equal(replay.skipped, 'already-sent');
  pass('a replayed welcome job sends nothing twice');

  // ---- 4. language follows the guardian ------------------------------------
  console.log('\nMessage language follows the guardian, not a hardcoded default:');
  const [enCust] = await db('customers').insert({
    tenant_id: tenant.id,
    full_name: 'Sarah Test',
    phone: `05888${String(Date.now()).slice(-5)}`,
    customer_code: `T-${String(Date.now() + 1).slice(-5)}`,
    qr_token: token(),
    consent: true,
    lang: 'en',
  }).returning('*');
  created.customers.push(enCust.id);

  await processSessionJob(job({
    type: 'welcome', customerId: enCust.id, tenantId: tenant.id, tenantSlug: tenant.slug,
  }));
  const enPayload = await sentBody((p) => p.customer_id === enCust.id);
  assert.equal(enPayload.lang, 'en'); pass("customers.lang='en' resolves to the English template");
  assert.ok(enPayload.body.includes('Welcome') || /[A-Za-z]{5,}/.test(enPayload.body));
  pass('English body actually rendered (Arabic template was NOT used)');

  // ---- 5. booking_confirmed, anchored to a BOOKING -------------------------
  console.log('\nParty/workshop confirmation (booking-anchored):');
  const starts = new Date(Date.now() + 400 * 24 * 3600_000); // far future: no slot clash
  const [booking] = await db('bookings').insert({
    tenant_id: tenant.id,
    type: 'party',
    reference: `PT-${String(Date.now()).slice(-4)}`,
    public_token: token(),
    customer_id: cust.id,
    guardian_name: cust.full_name,
    phone: cust.phone,
    starts_at: starts,
    ends_at: new Date(starts.getTime() + 120 * 60_000),
    children_count: 12,
    amount: 920,
    status: 'confirmed',
  }).returning('*');
  created.bookings.push(booking.id);

  const bRes = await processSessionJob(job({
    type: 'booking_confirmed', bookingId: booking.id, tenantId: tenant.id, tenantSlug: tenant.slug,
  }));
  assert.equal(bRes.sent, true); pass('booking_confirmed sent');

  const bNotif = await db('notifications').where({ booking_id: booking.id, type: 'booking_confirmed' }).first();
  assert.ok(bNotif && bNotif.status === 'sent'); pass('booking notification row recorded as sent');
  assert.equal(bNotif.session_id, null); pass('booking row has no session_id');

  const bPayload = await sentBody((p) => p.booking_id === booking.id);
  assert.ok(bPayload.body.includes(booking.reference)); pass('confirmation body carries the booking reference');
  assert.ok(bPayload.body.includes('12')); pass('confirmation body carries the children count');

  // A booking that is not confirmed must never announce itself.
  await db('bookings').where({ id: booking.id }).update({ status: 'pending' });
  await db('notifications').where({ booking_id: booking.id }).del();
  const pendingRes = await processSessionJob(job({
    type: 'booking_confirmed', bookingId: booking.id, tenantId: tenant.id, tenantSlug: tenant.slug,
  }));
  assert.equal(pendingRes.skipped, 'status-pending');
  pass('a pending booking is skipped, not announced');

  // ---- 6. a blank template is skipped, never sent as an empty message ------
  console.log('\nA template the centre never filled in is skipped, not sent blank:');
  const original = JSON.parse(JSON.stringify(settings.wa_templates));
  await updateSettings(tenant.id, {
    wa_templates: { ...original, welcome: { ar: '', en: '' } },
  });
  const [blankCust] = await db('customers').insert({
    tenant_id: tenant.id,
    full_name: 'بدون قالب',
    phone: `05777${String(Date.now()).slice(-5)}`,
    customer_code: `T-${String(Date.now() + 2).slice(-5)}`,
    qr_token: token(),
    consent: true,
  }).returning('*');
  created.customers.push(blankCust.id);
  const blankRes = await processSessionJob(job({
    type: 'welcome', customerId: blankCust.id, tenantId: tenant.id, tenantSlug: tenant.slug,
  }));
  assert.equal(blankRes.skipped, 'no-welcome-template');
  pass('empty welcome template -> skipped (no blank WhatsApp)');
  await updateSettings(tenant.id, { wa_templates: original });

  // ---- cleanup -------------------------------------------------------------
  for (const id of created.sessions) {
    // eslint-disable-next-line no-await-in-loop
    await removeJobs(id, row.schedule_version);
  }
  await db('notifications').whereIn('session_id', created.sessions)
    .orWhereIn('customer_id', created.customers)
    .orWhereIn('booking_id', created.bookings)
    .del();
  await db('sessions').whereIn('id', created.sessions).del();
  await db('bookings').whereIn('id', created.bookings).del();
  await db('customers').whereIn('id', created.customers).del();

  console.log(`\n✅ NOTIFY PROOF PASSED — ${ok} assertions.\n`);
  await sub.quit();
  await sessionQueue.close();
  await db.destroy();
  process.exit(0);
}

main().catch((err) => { console.error('\n❌ NOTIFY PROOF FAILED:', err); process.exit(1); });
