/**
 * Proof: the STAFF role is gated in the UI, not just in the API.
 * Drives a real browser signed in as staff@farfasha.sa.
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = 'http://localhost:8899';
const API = 'http://localhost:4077';
const PORT = 9339;
const outDir = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(outDir, 'shots'), { recursive: true });

let ok = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1; };

const login = async (email, password) => {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return r.json();
};

const { token, user, tenant } = await login('staff@farfasha.sa', 'staff123');
if (user.role !== 'staff') { fail(`expected staff, got ${user.role}`); process.exit(1); }
console.log(`signed in as ${user.email} (${user.role})`);

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(outDir, '_staff')}`,
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
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: `${APP}/login` });
await sleep(1500);
await evalJs(`
  localStorage.setItem('farfasha_token', ${JSON.stringify(token)});
  localStorage.setItem('farfasha_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('farfasha_tenant', ${JSON.stringify(JSON.stringify(tenant))});
  localStorage.setItem('farfasha_lang', 'en'); 'ok'`);

// --- 1) the Team nav item must not exist for staff
await send('Page.navigate', { url: `${APP}/` });
await sleep(2300);
const navLabels = await evalJs(`[...document.querySelectorAll('.nav-btn')].map(b => b.textContent.trim()).join('|')`);
if (!/team/i.test(navLabels)) pass(`staff nav hides Team (sees: ${navLabels})`);
else fail(`staff can see the Team nav item: ${navLabels}`);

// --- 2) navigating straight to /team must bounce back to the dashboard
await send('Page.navigate', { url: `${APP}/team` });
await sleep(2300);
const landed = await evalJs(`location.pathname`);
const hasTeamRoot = await evalJs(`!!document.querySelector('.team-root')`);
if (landed === '/' && !hasTeamRoot) pass('staff opening /team directly is redirected to the dashboard');
else fail(`staff reached /team (path=${landed}, teamRoot=${hasTeamRoot})`);

// --- 3) settings must be read-only, with the reason shown
await send('Page.navigate', { url: `${APP}/settings` });
await sleep(2300);
const saveDisabled = await evalJs(`!!document.querySelector('.save-btn')?.disabled`);
const note = await evalJs(`document.querySelector('.save-note')?.textContent?.trim() || ''`);
if (saveDisabled) pass('staff cannot save settings (button disabled)');
else fail('staff save button is enabled');
if (/only managers/i.test(note)) pass(`staff is told why: "${note}"`);
else fail(`no manager-only note shown (got: "${note}")`);

const { data } = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(path.join(outDir, 'shots', 'settings-staff-en.png'), Buffer.from(data, 'base64'));

// --- 4) and the API refuses even if the UI were bypassed
const direct = await fetch(`${API}/api/users`, { headers: { Authorization: `Bearer ${token}` } });
if (direct.status === 403) pass('the API still refuses staff on /api/users (403) — UI gate is not the only guard');
else fail(`API returned ${direct.status} for staff`);

console.log(`\n✓ staff-gate: ${ok} checks passed\n`);
ws.close();
chrome.kill();
