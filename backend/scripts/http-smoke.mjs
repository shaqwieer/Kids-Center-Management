/**
 * HTTP smoke test: boots the real server and drives the staff + public flows
 * over the wire (the exact transport the frontend uses).
 * Run: node scripts/http-smoke.mjs
 */
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const PORT = process.env.API_PORT || 4000;
const BASE = `http://localhost:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ok = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };

let logs = '';
const server = spawn('node', ['src/index.js'], { cwd: process.cwd(), env: process.env });
server.stdout.on('data', (d) => { logs += d; });
server.stderr.on('data', (d) => { logs += d; });

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function waitHealth() {
  for (let i = 0; i < 60; i += 1) {
    try { const r = await fetch(BASE + '/api/health'); if (r.ok) return; } catch { /* not up yet */ }
    await sleep(500);
  }
  throw new Error('server did not become healthy');
}

async function main() {
  await waitHealth();
  pass('server healthy at /api/health');

  // AUTH
  const bad = await api('/api/auth/login', { method: 'POST', body: { email: 'manager@farfasha.sa', password: 'wrong' } });
  assert.equal(bad.status, 401); pass('login rejects bad password (401)');
  const login = await api('/api/auth/login', { method: 'POST', body: { email: 'manager@farfasha.sa', password: 'manager123' } });
  assert.equal(login.status, 200); assert.ok(login.data.token); pass('manager login returns JWT');
  const token = login.data.token;
  assert.equal(login.data.user.role, 'manager'); pass('user role = manager');

  const noAuth = await api('/api/sessions');
  assert.equal(noAuth.status, 401); pass('protected route rejects missing token (401)');

  // SESSIONS list (seeded)
  const list = await api('/api/sessions', { token });
  assert.ok(Array.isArray(list.data.sessions) && list.data.sessions.length >= 5); pass(`GET /sessions -> ${list.data.sessions.length} live sessions`);

  // CUSTOMERS
  const custs = await api('/api/customers', { token });
  assert.ok(custs.data.customers.length >= 5); pass(`GET /customers -> ${custs.data.customers.length}`);
  const search = await api('/api/customers?search=' + encodeURIComponent('نورة'), { token });
  assert.ok(search.data.customers.length >= 1); pass('customer search by Arabic name works');
  const custId = search.data.customers[0].id;
  const detail = await api('/api/customers/' + custId, { token });
  assert.ok(detail.data.customer.children.length >= 1); pass('customer detail has children + visits');
  assert.ok(Array.isArray(detail.data.customer.visits)); pass('customer detail returns visit history');

  // LOOKUP by phone
  const phone = detail.data.customer.phone;
  const look = await api('/api/customers/lookup?phone=' + encodeURIComponent(phone), { token });
  assert.equal(look.data.customer.id, custId); pass('lookup by phone resolves the customer');
  const qr = detail.data.customer.qr_token;
  const lookQr = await api('/api/customers/lookup?qr=' + qr, { token });
  assert.equal(lookQr.data.customer.id, custId); pass('lookup by qr_token resolves the customer');

  // START -> ADD-TIME -> END
  const childId = detail.data.customer.children[0].id;
  const started = await api('/api/sessions', { method: 'POST', token, body: { customer_id: custId, child_ids: [childId], duration_minutes: 30 } });
  assert.equal(started.status, 201); const sess = started.data.sessions[0];
  assert.equal(sess.status, 'active'); pass('POST /sessions starts a session (active)');
  const added = await api(`/api/sessions/${sess.id}/add-time`, { method: 'POST', token, body: { minutes: 15 } });
  assert.ok(new Date(added.data.session.ends_at) > new Date(sess.ends_at)); pass('add-time extends ends_at');
  const ended = await api(`/api/sessions/${sess.id}/end`, { method: 'POST', token });
  assert.equal(ended.data.session.status, 'completed'); pass('end -> completed with late fields');
  assert.equal(typeof ended.data.session.late_fee, 'number'); pass('late_fee present (number)');

  // NOTIFICATIONS (debug)
  const notifs = await api('/api/notifications?session_id=' + sess.id, { token });
  assert.equal(notifs.status, 200); pass('GET /notifications returns for a session');

  // EXPENSES + FINANCE ACCOUNTING
  const expense = await api('/api/expenses', { method: 'POST', token, body: {
    title: 'Smoke test supplies', category: 'supplies', amount: 123.45, incurred_at: new Date().toISOString(), notes: 'temporary',
  } });
  assert.equal(expense.status, 201); pass('manager can create an expense');
  const fin = await api('/api/finance/summary?period=month', { token });
  assert.ok(fin.data.finance.kpis && typeof fin.data.finance.kpis.revenue === 'number'); pass('finance summary returns kpis');
  assert.ok(fin.data.finance.kpis.expenses >= 123.45); pass('finance includes real expenses');
  assert.ok(fin.data.finance.txns.some((t) => t.id === expense.data.expense.id)); pass('expense appears in accounting ledger');
  assert.equal(fin.data.finance.weekly.length, 7); pass('finance weekly has 7 bars');

  // SETTINGS
  const getSet = await api('/api/settings', { token });
  assert.ok(Array.isArray(getSet.data.settings.durations)); pass('GET /settings returns durations');
  const putSet = await api('/api/settings', { method: 'PUT', token, body: { late_fee_per_minute: 2 } });
  assert.equal(putSet.data.settings.late_fee_per_minute, 2); pass('manager PUT /settings updates late rate');
  await api('/api/settings', { method: 'PUT', token, body: { late_fee_per_minute: 1.5 } }); // restore

  // STAFF cannot update settings
  const staffLogin = await api('/api/auth/login', { method: 'POST', body: { email: 'staff@farfasha.sa', password: 'staff123' } });
  const staffPut = await api('/api/settings', { method: 'PUT', token: staffLogin.data.token, body: { tagline: 'x' } });
  assert.equal(staffPut.status, 403); pass('staff role forbidden from PUT /settings (403)');
  const staffExpense = await api('/api/expenses', { method: 'POST', token: staffLogin.data.token, body: {
    title: 'Forbidden expense', category: 'other', amount: 1, incurred_at: new Date().toISOString(),
  } });
  assert.equal(staffExpense.status, 403); pass('staff role forbidden from creating expenses (403)');
  const deletedExpense = await api(`/api/expenses/${expense.data.expense.id}`, { method: 'DELETE', token });
  assert.equal(deletedExpense.status, 204); pass('manager can delete an expense');

  // PUBLIC register + duplicate handling
  const reg = await api('/api/public/register', { method: 'POST', body: {
    full_name: 'أميرة الحربي', phone: '0500000001', consent: true, children: [{ name: 'سلمى', gender: 'f', age: 5 }],
  } });
  assert.equal(reg.status, 201); assert.ok(reg.data.customer.customer_code && reg.data.customer.qr_token); pass('public register creates customer + code + qr');
  const dup = await api('/api/public/register', { method: 'POST', body: {
    full_name: 'أميرة الحربي', phone: '0500000001', consent: true, children: [{ name: 'سلمى', gender: 'f', age: 5 }],
  } });
  assert.equal(dup.data.customer.already_registered, true); pass('duplicate phone -> already_registered (friendly)');
  const card = await api('/api/public/customers/' + reg.data.customer.qr_token);
  assert.equal(card.data.customer.customer_code, reg.data.customer.customer_code); pass('public card lookup by qr_token');
  const noConsent = await api('/api/public/register', { method: 'POST', body: {
    full_name: 'بدون موافقة', phone: '0500000002', consent: false, children: [{ name: 'خالد', gender: 'm', age: 6 }],
  } });
  assert.equal(noConsent.status, 400); pass('register without consent rejected (400)');

  console.log(`\n✅ HTTP SMOKE PASSED — ${ok} assertions.\n`);
  server.kill('SIGTERM');
  await sleep(500);
  process.exit(0);
}

main().catch((err) => {
  console.error('\n❌ HTTP SMOKE FAILED:', err.message);
  console.error('--- server logs (tail) ---\n' + logs.split('\n').slice(-25).join('\n'));
  server.kill('SIGKILL');
  process.exit(1);
});
