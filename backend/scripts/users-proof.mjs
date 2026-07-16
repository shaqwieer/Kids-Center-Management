/**
 * Proof: staff-account management (/api/users).
 *
 * Drives the real API over HTTP against the running stack and asserts both the
 * happy path (a manager creates/edits/removes accounts, the new account can
 * actually sign in) and the guards that keep the center from locking itself out.
 *
 * Requires the stack to be up. Run: node scripts/users-proof.mjs
 *   API_BASE=http://localhost:4077 node scripts/users-proof.mjs
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

const login = (email, password) => api('/api/auth/login', { method: 'POST', body: { email, password } });

async function main() {
  // ---- roles are manager/staff -------------------------------------------
  const mgr = await login('manager@farfasha.sa', 'manager123');
  assert.equal(mgr.status, 200);
  assert.equal(mgr.data.user.role, 'manager');
  pass('manager signs in, role = manager');
  const mToken = mgr.data.token;

  const stf = await login('staff@farfasha.sa', 'staff123');
  assert.equal(stf.data.user.role, 'staff');
  pass('staff signs in, role = staff');
  const sToken = stf.data.token;

  // ---- access control ------------------------------------------------------
  assert.equal((await api('/api/users')).status, 401);
  pass('GET /users without a token -> 401');

  assert.equal((await api('/api/users', { token: sToken })).status, 403);
  pass('staff cannot list accounts -> 403');

  assert.equal((await api('/api/users', {
    method: 'POST', token: sToken, body: { name: 'Sneaky', email: 'sneak@f.sa', password: 'secret123', role: 'manager' },
  })).status, 403);
  pass('staff cannot create a manager -> 403');

  // ---- list ----------------------------------------------------------------
  const list = await api('/api/users', { token: mToken });
  assert.equal(list.status, 200);
  assert.ok(list.data.users.length >= 2);
  assert.ok(!('password_hash' in list.data.users[0]));
  pass(`manager lists ${list.data.users.length} accounts, no password_hash leaked`);

  // ---- validation ----------------------------------------------------------
  assert.equal((await api('/api/users', {
    method: 'POST', token: mToken, body: { name: 'X', email: 'not-an-email', password: '123', role: 'staff' },
  })).status, 400);
  pass('create rejects bad email + short password -> 400');

  assert.equal((await api('/api/users', {
    method: 'POST', token: mToken, body: { name: 'Dup', email: 'staff@farfasha.sa', password: 'secret123', role: 'staff' },
  })).status, 409);
  pass('create rejects duplicate email -> 409');

  // ---- create + the new account really works -------------------------------
  const email = `reem.${Date.now()}@farfasha.sa`;
  const created = await api('/api/users', {
    method: 'POST', token: mToken, body: { name: 'ريم العتيبي', email, password: 'reem12345', role: 'staff' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.user.role, 'staff');
  const newId = created.data.user.id;
  pass('manager creates a staff account -> 201');

  const asNew = await login(email, 'reem12345');
  assert.equal(asNew.status, 200);
  assert.equal(asNew.data.user.name, 'ريم العتيبي');
  pass('the created account can sign in (password hashed correctly)');

  // ---- update --------------------------------------------------------------
  const promoted = await api(`/api/users/${newId}`, {
    method: 'PUT', token: mToken, body: { role: 'manager', name: 'ريم العتيبي' },
  });
  assert.equal(promoted.data.user.role, 'manager');
  pass('manager promotes staff -> manager');

  await api(`/api/users/${newId}`, { method: 'PUT', token: mToken, body: { password: 'newpass123' } });
  assert.equal((await login(email, 'newpass123')).status, 200);
  assert.equal((await login(email, 'reem12345')).status, 401);
  pass('password reset takes effect; the old password stops working');

  // ---- lockout guards ------------------------------------------------------
  const self = await api(`/api/users/${mgr.data.user.id}`, { method: 'DELETE', token: mToken });
  assert.equal(self.status, 409);
  pass('a manager cannot delete their own signed-in account -> 409');

  // Demote our spare manager back to staff, leaving exactly one manager.
  await api(`/api/users/${newId}`, { method: 'PUT', token: mToken, body: { role: 'staff' } });

  const demoteLast = await api(`/api/users/${mgr.data.user.id}`, {
    method: 'PUT', token: mToken, body: { role: 'staff' },
  });
  assert.equal(demoteLast.status, 409);
  assert.equal(demoteLast.data.error?.details?.code ?? demoteLast.data.details?.code, 'last_manager');
  pass('the last manager cannot demote themselves -> 409 last_manager');

  // ---- delete --------------------------------------------------------------
  const del = await api(`/api/users/${newId}`, { method: 'DELETE', token: mToken });
  assert.equal(del.status, 200);
  assert.equal((await login(email, 'newpass123')).status, 401);
  pass('manager deletes the account; it can no longer sign in');

  console.log(`\n✓ users-proof: ${ok} assertions passed\n`);
}

main().catch((e) => { console.error('\n✗ users-proof FAILED\n', e); process.exit(1); });
