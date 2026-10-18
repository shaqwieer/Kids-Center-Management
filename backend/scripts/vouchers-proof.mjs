/**
 * Proof: gift vouchers (/api/vouchers + redemption through POST /api/sessions).
 *
 * Drives the real API against the running stack: who may issue, every way a
 * voucher can be looked up, single-use under a race (two tablets scanning the
 * same voucher at once), cancelled vouchers refused, and the money — a sold
 * voucher is income on its sale day while the visit it pays for adds no base
 * revenue (late fees still count), and cancelling one removes its sale.
 *
 * Starts real sessions, so run it only against a LOCAL stack (WhatsApp off).
 *   node scripts/vouchers-proof.mjs
 *   API_BASE=http://localhost:4077 node scripts/vouchers-proof.mjs
 */
import assert from 'node:assert/strict';

const BASE = process.env.API_BASE || 'http://localhost:4077';
let ok = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };

async function api(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

const login = async (email, password) => (await api('/api/auth/login', { method: 'POST', body: { email, password } })).data.token;
const revenueOf = (fin, key) => fin.revenueBreakdown.find((r) => r.key === key)?.amount ?? 0;

async function main() {
  const m = await login(process.env.MANAGER_EMAIL || 'manager@farfasha.sa', process.env.MANAGER_PASSWORD || 'manager123');
  const s = await login(process.env.STAFF_EMAIL || 'staff@farfasha.sa', process.env.STAFF_PASSWORD || 'staff123');
  assert.ok(m && s, 'both seed accounts sign in');

  const settings = (await api('/api/settings', { token: m })).data.settings;
  const dur = settings.durations[0];
  const price = Number(dur.price);

  // ---- who may issue ---------------------------------------------------------
  assert.equal((await api('/api/vouchers', { method: 'POST', token: s, body: { duration_minutes: dur.min } })).status, 403);
  assert.equal((await api('/api/vouchers', { token: s })).status, 403);
  pass('reception cannot issue or list vouchers -> 403');

  assert.equal((await api('/api/vouchers', { method: 'POST', token: m, body: { duration_minutes: 7 } })).status, 400);
  pass('a duration that is not on the price list -> 400');

  assert.equal((await api('/api/vouchers', {
    method: 'POST', token: m, body: { duration_minutes: dur.min, expires_on: '2000-01-01' },
  })).status, 400);
  pass('an expiry date in the past -> 400');

  const fin0 = (await api('/api/finance/summary?period=today', { token: m })).data.finance;

  const SOLD = 77;
  const made = await api('/api/vouchers', {
    method: 'POST', token: m,
    body: { duration_minutes: dur.min, sold_price: SOLD, quantity: 3, recipient_name: 'Proof Kid', buyer_name: 'Proof Buyer' },
  });
  assert.equal(made.status, 201);
  assert.equal(made.data.vouchers.length, 3);
  const [v1, v2, v3] = made.data.vouchers;
  assert.match(v1.code, /^GV-[23456789A-HJKMNP-Z]{6}$/);
  assert.equal(new Set(made.data.vouchers.map((v) => v.code)).size, 3);
  assert.equal(v1.state, 'active');
  assert.equal(v1.value, price);
  pass(`manager issues 3 at once — unique codes like ${v1.code}, worth ${price}`);

  // ---- lookup: code any-case/no-dash, bare token, scanned URL, public card ---
  const variants = [v1.code, v1.code.toLowerCase(), v1.code.replace('-', ''), ` ${v1.code} `, v1.token, v1.url];
  for (const code of variants) {
    // eslint-disable-next-line no-await-in-loop
    const r = await api(`/api/vouchers/lookup?code=${encodeURIComponent(code)}`, { token: s });
    assert.equal(r.status, 200, code);
    assert.equal(r.data.voucher.id, v1.id);
  }
  pass('reception finds it by code (any case, no dash, padded), bare token and scanned URL');

  assert.equal((await api('/api/vouchers/lookup?code=GV-ZZZZZZ', { token: s })).status, 404);
  assert.equal((await api('/api/vouchers/lookup?code=hello', { token: s })).status, 404);
  pass('unknown / garbage codes -> 404');

  const pub = await api(`/api/public/voucher/${v1.token}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.data.voucher.code, v1.code);
  assert.equal(pub.data.voucher.sold_price, undefined, 'public card must not expose the sale price');
  assert.equal(pub.data.voucher.buyer_name, undefined, 'public card must not expose the buyer');
  pass('public gift card works without a token and hides price/buyer');

  // ---- redemption ------------------------------------------------------------
  const customers = (await api('/api/customers', { token: s })).data.customers;
  const full = [];
  for (const c of customers) {
    // eslint-disable-next-line no-await-in-loop
    const one = (await api(`/api/customers/${c.id}`, { token: s })).data.customer;
    if ((one.children || []).length >= 2) { full.push(one); break; }
  }
  assert.ok(full.length, 'need a seeded customer with two children');
  const cust = full[0];
  const [kidA, kidB] = cust.children;

  const startBody = (code, childIds, voucherChild) => ({
    customer_id: cust.id, child_ids: childIds, duration_minutes: dur.min,
    voucher_code: code, voucher_child_id: voucherChild,
  });

  // Two tablets scan the same voucher at the same moment.
  const race = await Promise.all([
    api('/api/sessions', { method: 'POST', token: s, body: startBody(v1.code, [kidA.id]) }),
    api('/api/sessions', { method: 'POST', token: s, body: startBody(v1.url, [kidB.id]) }),
  ]);
  const statuses = race.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409], `race gave ${statuses}`);
  const winner = race.find((r) => r.status === 201).data.sessions[0];
  const loser = race.find((r) => r.status === 409);
  assert.equal(loser.data.error.details.code, 'voucher_redeemed');
  assert.equal(winner.voucher_id, v1.id);
  assert.equal(winner.discount, price);
  pass('same voucher scanned twice at once -> exactly one 201, the other 409 voucher_redeemed');

  const after = (await api(`/api/vouchers/lookup?code=${v1.code}`, { token: s })).data.voucher;
  assert.equal(after.state, 'redeemed');
  assert.equal(after.redeemed_session_id, winner.id);
  pass('voucher is now redeemed and linked to the session');

  // The losing request must not have left a session behind.
  const active = (await api('/api/sessions', { token: s })).data.sessions;
  const strays = active.filter((x) => x.customer_id === cust.id && x.voucher_id === v1.id);
  assert.equal(strays.length, 1);
  pass('the refused start created no session (transaction rolled back)');

  // Two children, voucher on the second one only.
  const two = await api('/api/sessions', { method: 'POST', token: s, body: startBody(v2.code, [kidA.id, kidB.id], kidB.id) });
  assert.equal(two.status, 201);
  const byKid = Object.fromEntries(two.data.sessions.map((x) => [x.child_id, x]));
  assert.equal(byKid[kidB.id].discount, price);
  assert.equal(byKid[kidA.id].discount, 0);
  assert.equal(byKid[kidA.id].voucher_id, null);
  pass('with two children the voucher pays only the chosen child');

  const wrongKid = await api('/api/sessions', {
    method: 'POST', token: s, body: startBody(v3.code, [kidA.id], '00000000-0000-4000-8000-000000000000'),
  });
  assert.equal(wrongKid.status, 400);
  assert.equal((await api(`/api/vouchers/lookup?code=${v3.code}`, { token: s })).data.voucher.state, 'active');
  pass('voucher child outside the selection -> 400, and the voucher is NOT burnt');

  // ---- cancel ----------------------------------------------------------------
  assert.equal((await api(`/api/vouchers/${v3.id}/void`, { method: 'POST', token: s })).status, 403);
  const voided = await api(`/api/vouchers/${v3.id}/void`, { method: 'POST', token: m });
  assert.equal(voided.status, 200);
  assert.equal(voided.data.voucher.state, 'void');
  const useVoid = await api('/api/sessions', { method: 'POST', token: s, body: startBody(v3.code, [kidA.id]) });
  assert.equal(useVoid.status, 409);
  assert.equal(useVoid.data.error.details.code, 'voucher_void');
  assert.equal((await api(`/api/vouchers/${v1.id}/void`, { method: 'POST', token: m })).status, 409);
  pass('only a manager cancels; a cancelled voucher is refused; a used one cannot be cancelled');

  // ---- money -----------------------------------------------------------------
  const ended = await api(`/api/sessions/${winner.id}/end`, { method: 'POST', token: s });
  assert.equal(ended.status, 200);
  for (const x of two.data.sessions) {
    // eslint-disable-next-line no-await-in-loop
    await api(`/api/sessions/${x.id}/end`, { method: 'POST', token: s });
  }
  const fin1 = (await api('/api/finance/summary?period=today', { token: m })).data.finance;

  // 3 sold at 77, one cancelled -> 2 * 77 of voucher income.
  assert.equal(revenueOf(fin1, 'r_vouchers') - revenueOf(fin0, 'r_vouchers'), 2 * SOLD);
  // 3 visits ended, 2 voucher-paid -> only kidA's paid visit adds base revenue.
  assert.equal(revenueOf(fin1, 'r_sessions') - revenueOf(fin0, 'r_sessions'), price);
  assert.equal(fin1.kpis.sessions - fin0.kpis.sessions, 3);
  pass(`finance: +${2 * SOLD} voucher sales, +${price} play (voucher visits add 0), cancelled sale excluded`);

  const list = (await api('/api/vouchers', { token: m })).data.vouchers;
  const mine = list.filter((v) => [v1.id, v2.id, v3.id].includes(v.id));
  assert.deepEqual(mine.map((v) => v.state).sort(), ['redeemed', 'redeemed', 'void']);
  assert.ok(mine.find((v) => v.id === v1.id).redeemed_child_name);
  pass('manager list shows states and who used each voucher');

  console.log(`\n${ok} checks passed.`);
}

main().catch((err) => {
  console.error('\n✗ FAILED:', err.message);
  process.exit(1);
});
