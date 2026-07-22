/**
 * growth-proof — end-to-end proof of the booking / review / self-extend /
 * allergy / roles / reporting features against a RUNNING stack.
 *
 *   API_BASE=http://localhost:4077/api node scripts/growth-proof.mjs
 *
 * Two tokens (a session's `guest_token`, a review's `token`) are deliberately
 * never returned by any staff endpoint, so the proof reads them straight from
 * Postgres. Override how it gets a psql shell with PSQL_CMD if you are not
 * running the standard docker-compose stack.
 *
 * Re-runnable: it registers a random phone each run and cleans up its session.
 */
const API = process.env.API_BASE || 'http://localhost:4077/api';
const PSQL = process.env.PSQL_CMD || 'docker exec farfasha-postgres psql -U farfasha -d farfasha';
let pass = 0; let fail = 0;

const j = async (path, opts = {}) => {
  const res = await fetch(API + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  });
  let body = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('json')) body = await res.json();
  else body = { _bytes: (await res.arrayBuffer()).byteLength, _ct: ct };
  return { status: res.status, body, headers: res.headers };
};

function check(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name} ${extra}`); }
}

// ---- auth -------------------------------------------------------------
const mgr = await j('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'manager@farfasha.sa', password: 'manager123' }),
});
check('manager login', mgr.status === 200, JSON.stringify(mgr.body));
const MT = { Authorization: `Bearer ${mgr.body.token}` };

const stf = await j('/auth/login', {
  method: 'POST',
  body: JSON.stringify({ email: 'staff@farfasha.sa', password: 'staff123' }),
});
check('reception login', stf.status === 200);
const ST = { Authorization: `Bearer ${stf.body.token}` };

// ---- role boundaries --------------------------------------------------
console.log('\n[roles] reception must be locked out of the money side');
check('reception  ✗ finance', (await j('/finance/summary', { headers: ST })).status === 403);
check('reception  ✗ expenses', (await j('/expenses', { headers: ST })).status === 403);
check('reception  ✗ analytics', (await j('/analytics/insights', { headers: ST })).status === 403);
check('reception  ✗ excel export', (await j('/reports/export?type=full', { headers: ST })).status === 403);
check('reception  ✗ create customer', (await j('/customers', {
  method: 'POST', headers: ST, body: JSON.stringify({ full_name: 'X Y', phone: '0500000999', children: [] }),
})).status === 403);
check('reception  ✗ create booking', (await j('/bookings', {
  method: 'POST', headers: ST, body: JSON.stringify({ type: 'party', guardian_name: 'A B', phone: '0500000998', date: '2026-09-01', slot: '12:00', children_count: 10 }),
})).status === 403);
console.log('[roles] ...but can still run the floor');
check('reception  ✓ sessions', (await j('/sessions', { headers: ST })).status === 200);
check('reception  ✓ customers (read)', (await j('/customers', { headers: ST })).status === 200);
check('reception  ✓ bookings (read)', (await j('/bookings', { headers: ST })).status === 200);

// ---- settings ---------------------------------------------------------
console.log('\n[settings] new config round-trips');
const s0 = await j('/settings', { headers: MT });
check('settings has booking_config', !!s0.body.settings.booking_config?.party);
check('settings has review knobs', s0.body.settings.review_delay_minutes != null);
const put = await j('/settings', {
  method: 'PUT', headers: MT,
  body: JSON.stringify({ terms_url: 'https://example.com/terms', guardian_extend_minutes: 60 }),
});
check('PUT settings terms_url', put.status === 200 && put.body.settings.terms_url === 'https://example.com/terms',
  JSON.stringify(put.body).slice(0, 200));
check('public /center exposes terms', (await j('/public/center')).body.center.terms_url === 'https://example.com/terms');

// ---- public registration with allergy + birthdate ----------------------
console.log('\n[register] allergy + birthdate persist');
const phone = `05${Math.floor(10000000 + Math.random() * 89999999)}`;
const reg = await j('/public/register', {
  method: 'POST',
  body: JSON.stringify({
    full_name: 'أم تجريبية', phone, consent: true,
    children: [{ name: 'طفل الحساسية', birthdate: '2020-05-14', gender: 'f', has_allergy: true, allergy_note: 'حساسية من المكسرات' }],
  }),
});
check('public register 201', reg.status === 201, JSON.stringify(reg.body).slice(0, 200));
const custId = reg.body.customer.id;
const det = await j(`/customers/${custId}`, { headers: MT });
const kid = det.body.customer.children[0];
check('allergy flag stored', kid.has_allergy === true);
check('allergy note stored', kid.allergy_note === 'حساسية من المكسرات', JSON.stringify(kid));
// A DATE must survive the round trip unshifted. Riyadh is UTC+3, so a driver
// that hands back a JS Date returns the PREVIOUS day here — that is a real bug
// this assertion exists to catch, not a formatting nit.
check('birthdate stored unshifted', String(kid.birthdate).startsWith('2020-05-14'), String(kid.birthdate));
const expectedAge = (() => {
  const bd = new Date('2020-05-14');
  const now = new Date();
  let y = now.getUTCFullYear() - bd.getUTCFullYear();
  if (now.getUTCMonth() < bd.getUTCMonth()
    || (now.getUTCMonth() === bd.getUTCMonth() && now.getUTCDate() < bd.getUTCDate())) y -= 1;
  return y;
})();
check('age derived from birthdate', kid.age === expectedAge, `age=${kid.age} expected=${expectedAge}`);

// ---- session -> guest extend -> review --------------------------------
console.log('\n[session] guest token, self-extend, review link');
const started = await j('/sessions', {
  method: 'POST', headers: ST,
  body: JSON.stringify({ customer_id: custId, child_ids: [kid.id], duration_minutes: 60 }),
});
check('reception can start a session', started.status === 201, JSON.stringify(started.body).slice(0, 200));
const sess = started.body.sessions[0];
check('session exposes allergy to staff', sess.child.has_allergy === true);

const row = await j(`/sessions/${sess.id}`, { headers: MT });
check('session detail ok', row.status === 200);

// The guest token is intentionally absent from the staff DTO, so read it from
// the database rather than widening the API surface just to test it.
const { execSync } = await import('node:child_process');
const sql = (q) => execSync(`${PSQL} -tAc "${q}"`).toString().trim();
const token = sql(`select guest_token from sessions where id='${sess.id}'`);
check('guest_token minted on start', token.length > 10, token);

const gx = await j(`/public/session/${token}`);
check('public extend page loads', gx.status === 200 && gx.body.session.child_name === 'طفل الحساسية');
check('extend price quoted', typeof gx.body.session.extend_price === 'number');
const before = new Date(gx.body.session.ends_at).getTime();

const ext = await j(`/public/session/${token}/extend`, { method: 'POST' });
check('guardian self-extend works', ext.status === 200, JSON.stringify(ext.body).slice(0, 200));
const after = new Date(ext.body.session.ends_at).getTime();
check('ends_at pushed by 60 min', Math.round((after - before) / 60000) === 60, `${(after - before) / 60000}`);
check('guardian minutes tallied', ext.body.session.guardian_added_minutes === 60);

const ended = await j(`/sessions/${sess.id}/end`, { method: 'POST', headers: ST });
check('reception can end a session', ended.status === 200);

const rvToken = sql(`select token from reviews where session_id='${sess.id}'`);
check('review minted on checkout', rvToken.length > 10, rvToken);
const rv = await j(`/public/review/${rvToken}`);
check('review page loads', rv.status === 200 && rv.body.review.child_name === 'طفل الحساسية');
const rvPost = await j(`/public/review/${rvToken}`, {
  method: 'POST', body: JSON.stringify({ rating: 5, comment: 'مكان ممتاز' }),
});
check('review submits', rvPost.status === 200, JSON.stringify(rvPost.body));
check('review is single-use', (await j(`/public/review/${rvToken}`, {
  method: 'POST', body: JSON.stringify({ rating: 1 }),
})).status === 400);

// ---- bookings + the double-booking guarantee --------------------------
console.log('\n[bookings] slot locking');
const day = new Date(Date.now() + 9 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
const avail = await j(`/public/booking/availability?type=party&date=${day}`);
check('availability lists slots', avail.status === 200 && avail.body.slots.length > 0);
const freeSlot = avail.body.slots.find((s) => s.available);
check('a slot is free', !!freeSlot);

const mk = (n) => j('/public/booking', {
  method: 'POST',
  body: JSON.stringify({
    type: 'party', guardian_name: `حجز ${n}`, phone: `05100000${n}${n}`,
    date: day, slot: freeSlot.slot, children_count: 12, theme: 'princess', food: 'light', consent: true,
  }),
});
// Fire two bookings for the same slot AT THE SAME TIME — exactly one must win.
const [b1, b2] = await Promise.all([mk(1), mk(2)]);
const codes = [b1.status, b2.status].sort();
check('concurrent same-slot: one 201, one 409', codes[0] === 201 && codes[1] === 409, JSON.stringify(codes));
const winner = b1.status === 201 ? b1 : b2;
check('price computed server-side', winner.body.booking.amount === 500 + 12 * 35 + 12 * 15,
  String(winner.body.booking.amount));
check('booking starts pending', winner.body.booking.status === 'pending');

const after2 = await j(`/public/booking/availability?type=party&date=${day}`);
check('slot now shows as taken', after2.body.slots.find((s) => s.slot === freeSlot.slot).available === false);

check('public booking lookup by token', (await j(`/public/booking/${winner.body.booking.public_token}`)).status === 200);
check('manager confirms booking', (await j(`/bookings/${winner.body.booking.id}`, {
  method: 'PUT', headers: MT, body: JSON.stringify({ status: 'confirmed', payment_status: 'paid' }),
})).status === 200);

// cancelling frees the slot again
await j(`/bookings/${winner.body.booking.id}`, {
  method: 'PUT', headers: MT, body: JSON.stringify({ status: 'cancelled' }),
});
const after3 = await j(`/public/booking/availability?type=party&date=${day}`);
check('cancelling frees the slot', after3.body.slots.find((s) => s.slot === freeSlot.slot).available === true);

// ---- analytics + finance + excel --------------------------------------
console.log('\n[reporting]');
const ins = await j('/analytics/insights?period=month', { headers: MT });
check('insights ok', ins.status === 200);
check('busiest day present', ins.body.busiest_day && typeof ins.body.busiest_day.count === 'number');
check('income sources = 3', ins.body.income_sources.length === 3,
  JSON.stringify(ins.body.income_sources));
check('reviews summary ok', (await j('/reviews/summary', { headers: MT })).status === 200);

const fin = await j('/finance/summary?period=month', { headers: MT });
check('finance ok', fin.status === 200);
check('finance breaks out parties+workshops',
  fin.body.finance.revenueBreakdown.some((r) => r.key === 'r_parties')
  && fin.body.finance.revenueBreakdown.some((r) => r.key === 'r_workshops'));

for (const type of ['full', 'sessions', 'customers', 'bookings', 'expenses', 'reviews']) {
  const xl = await j(`/reports/export?type=${type}&period=month&lang=ar`, { headers: MT });
  check(`excel export: ${type}`,
    xl.status === 200 && xl.body._bytes > 3000 && xl.body._ct.includes('spreadsheetml'),
    `${xl.status} ${xl.body._bytes}b`);
}

console.log(`\n${'='.repeat(46)}\n  ${pass} passed, ${fail} failed\n${'='.repeat(46)}`);
process.exit(fail ? 1 : 0);
