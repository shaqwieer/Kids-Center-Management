/**
 * Proof: the router navigation guards.
 *
 * Drives a real browser through the full guard matrix:
 *   - signed out  -> every protected page bounces to /login, keeping the target
 *   - signed out  -> public pages stay open
 *   - signed in   -> reaching /login bounces to the dashboard, session preserved
 *   - handover    -> the Log out button clears the session and the next person signs in
 *   - staff       -> manager-only pages bounce to the dashboard
 *   - round trip  -> ?redirect= returns you to where you were headed
 *   - hostile     -> ?redirect= cannot send you off-site
 *
 * Needs the stack up. Run: node scripts/nav-guard-proof.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = process.env.APP_BASE || 'http://localhost:8899';
const API = process.env.API_BASE || 'http://localhost:4077';
const PORT = 9341;
const outDir = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));

let ok = 0;
let bad = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };
const fail = (m) => { bad += 1; console.error(`  ✗ ${m}`); };
const check = (cond, m, got) => (cond ? pass(m) : fail(`${m}  — got: ${got}`));

const login = async (email, password) => {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return r.json();
};

const manager = await login('manager@farfasha.sa', 'manager123');
const staff = await login('staff@farfasha.sa', 'staff123');

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(outDir, '_guard')}`,
  'about:blank',
], { stdio: 'ignore' });

let target;
for (let i = 0; i < 40; i += 1) {
  try {
    const l = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
    target = l.find((t) => t.type === 'page');
    if (target) break;
  } catch { /* wait */ }
  await sleep(250);
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => { ws.onopen = r; });
let id = 0;
const waiters = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  const w = waiters.get(m.id);
  if (w) { waiters.delete(m.id); w(m.result); }
};
const send = (m, p = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method: m, params: p }));
  return new Promise((r) => waiters.set(i, r));
};
const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });

/** Navigate and report where the router actually left us. */
const go = async (route) => {
  await send('Page.navigate', { url: `${APP}${route}` });
  await sleep(1700);
  return evalJs(`location.pathname + location.search`);
};
const setSession = async (who) => {
  await send('Page.navigate', { url: `${APP}/register` }); // public page on the origin
  await sleep(1200);
  await evalJs(`
    localStorage.clear();
    localStorage.setItem('farfasha_token', ${JSON.stringify(who.token)});
    localStorage.setItem('farfasha_user', ${JSON.stringify(JSON.stringify(who.user))});
    localStorage.setItem('farfasha_tenant', ${JSON.stringify(JSON.stringify(who.tenant))});
    localStorage.setItem('farfasha_lang', 'en'); 'ok'`);
};
const clearSession = async () => {
  await send('Page.navigate', { url: `${APP}/register` });
  await sleep(1200);
  await evalJs(`localStorage.clear(); localStorage.setItem('farfasha_lang','en'); 'ok'`);
};
const tokenPresent = () => evalJs(`!!localStorage.getItem('farfasha_token')`);

/** Read the ?redirect= the guard actually stored. */
const redirectOf = (at) => new URL(APP + at).searchParams.get('redirect');

console.log('\n— signed out: protected pages must bounce to /login and remember the target');
await clearSession();
for (const route of ['/', '/team', '/settings', '/finance', '/customers', '/start']) {
  const at = await go(route);
  check(at.startsWith('/login') && redirectOf(at) === route,
    `${route.padEnd(11)} -> /login?redirect=${route}`, at);
}

console.log('\n— signed out: public pages stay open');
for (const route of ['/register']) {
  const at = await go(route);
  check(at === route, `${route.padEnd(11)} stays open`, at);
}
{
  const at = await go('/nonsense-page');
  check(at.startsWith('/login'), 'unknown route -> catch-all -> /login', at);
}

console.log('\n— signed in as manager: protected pages open');
await setSession(manager);
for (const route of ['/', '/team', '/settings', '/finance']) {
  const at = await go(route);
  check(at === route, `${route.padEnd(11)} opens`, at);
}

console.log('\n— signed in: reaching /login bounces to the dashboard, session kept');
await setSession(manager);
{
  const at = await go('/login');
  const stillHasToken = await tokenPresent();
  check(at === '/', 'authenticated /login redirects to the dashboard', at);
  check(stillHasToken === true, 'authenticated /login keeps the stored session (still signed in)', `token present=${stillHasToken}`);
}

console.log('\n— an expired session counts as signed out');
{
  // A well-formed JWT whose exp is in the past. The signature is irrelevant:
  // the client only reads exp, and the server rejects it regardless.
  const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const dead = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub: manager.user.id, role: 'manager', name: 'x', email: manager.user.email,
    exp: Math.floor(Date.now() / 1000) - 60,
  })}.nosignature`;

  await send('Page.navigate', { url: `${APP}/register` });
  await sleep(1200);
  await evalJs(`
    localStorage.clear();
    localStorage.setItem('farfasha_token', ${JSON.stringify(dead)});
    localStorage.setItem('farfasha_user', ${JSON.stringify(JSON.stringify(manager.user))});
    localStorage.setItem('farfasha_lang', 'en'); 'ok'`);

  const at = await go('/team');
  check(at.startsWith('/login'), 'an expired token does not open a protected page', at);
  const purged = await tokenPresent();
  check(purged === false, 'the expired token is purged from storage', `token present=${purged}`);
}

console.log('\n— signed in as staff: manager-only pages bounce');
await setSession(staff);
{
  const at = await go('/team');
  check(at === '/', '/team        -> / (staff bounced)', at);
}
{
  const at = await go('/settings');
  check(at === '/settings', '/settings    opens for staff (read-only)', at);
}

console.log('\n— round trip: ?redirect= returns you to where you were headed');
await clearSession();
{
  const at = await go('/team');
  if (!at.startsWith('/login')) fail(`expected /login, got ${at}`);
  const fillJs = (sel, val) => `(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, ${JSON.stringify(val)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`;
  await evalJs(fillJs('#lg-email', 'manager@farfasha.sa'));
  await evalJs(fillJs('#lg-pw', 'manager123'));
  await sleep(300);
  await evalJs(`document.querySelector('.submit').click(); 'ok'`);
  await sleep(2500);
  const landed = await evalJs(`location.pathname`);
  check(landed === '/team', 'signing in returns you to /team, not the dashboard', landed);
}

console.log('\n— handover: the Log out button ends the session so the next person can sign in');
await setSession(staff);
{
  await go('/'); // land on a page that shows the header (and its Log out button)
  await evalJs(`document.querySelector('.logout').click(); 'ok'`);
  await sleep(2000);
  const loggedOutAt = await evalJs(`location.pathname`);
  const clearedToken = await tokenPresent();
  check(loggedOutAt === '/login', 'Log out lands on the sign-in page', loggedOutAt);
  check(clearedToken === false, 'Log out clears the stored session', `token present=${clearedToken}`);

  const fillJs = (sel, val) => `(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, ${JSON.stringify(val)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`;
  await evalJs(fillJs('#lg-email', 'manager@farfasha.sa'));
  await evalJs(fillJs('#lg-pw', 'manager123'));
  await sleep(300);
  await evalJs(`document.querySelector('.submit').click(); 'ok'`);
  await sleep(2500);
  const landed = await evalJs(`location.pathname`);
  const who = await evalJs(`JSON.parse(localStorage.getItem('farfasha_user') || '{}').email || ''`);
  check(landed === '/' && who === 'manager@farfasha.sa',
    'the next person signs in cleanly and the session is theirs', `${landed} as ${who}`);
}

console.log('\n— hostile: ?redirect= must not send you off-site');
await clearSession();
{
  await send('Page.navigate', { url: `${APP}/login?redirect=//example.com/pwned` });
  await sleep(1500);
  const fillJs = (sel, val) => `(() => {
    const el = document.querySelector(${JSON.stringify(sel)});
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    s.call(el, ${JSON.stringify(val)});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`;
  await evalJs(fillJs('#lg-email', 'manager@farfasha.sa'));
  await evalJs(fillJs('#lg-pw', 'manager123'));
  await sleep(300);
  await evalJs(`document.querySelector('.submit').click(); 'ok'`);
  await sleep(2500);
  const origin = await evalJs(`location.origin`);
  const href = await evalJs(`location.href`);
  check(origin === APP, 'an external ?redirect= cannot navigate off the app origin', href);
}

console.log(`\n${bad === 0 ? '✓' : '✗'} nav-guard: ${ok} passed, ${bad} failed\n`);
ws.close();
chrome.kill();
process.exit(bad === 0 ? 0 : 1);
