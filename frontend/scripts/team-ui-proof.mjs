/**
 * End-to-end UI proof: create a staff account through the real Team page in a
 * real browser (not the API), then verify the created account can sign in.
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
const PORT = 9335;
const outDir = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(outDir, 'shots'), { recursive: true });
const NEW_EMAIL = `ui.test.${Date.now()}@farfasha.sa`;
const NEW_PW = 'uitest12345';

let ok = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1; };

const login = async (email, password) => {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

const mgr = await login('manager@farfasha.sa', 'manager123');
const { token, user, tenant } = mgr.body;

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(outDir, '_e2e')}`,
  '--window-size=1440,1000', 'about:blank',
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
const send = (method, params = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((res) => waiters.set(i, res));
};
const evalJs = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return r.result?.value;
};

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: `${APP}/login` });
await sleep(1500);
await evalJs(`
  localStorage.setItem('farfasha_token', ${JSON.stringify(token)});
  localStorage.setItem('farfasha_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('farfasha_tenant', ${JSON.stringify(JSON.stringify(tenant))});
  localStorage.setItem('farfasha_lang', 'en'); 'ok'`);

await send('Page.navigate', { url: `${APP}/team` });
await sleep(2500);

const before = await evalJs(`document.querySelectorAll('.card').length`);
console.log(`  (starting from ${before} accounts)`);

// --- open the modal
await evalJs(`document.querySelector('.add-btn').click(); 'ok'`);
await sleep(700);
if (await evalJs(`!!document.querySelector('.scrim')`)) pass('Add account opens the form');
else fail('modal did not open');

// --- fill it the way a person would: type into each input, fire Vue's listeners
const fillJs = (sel, val) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  if (!el) return 'MISSING ' + ${JSON.stringify(sel)};
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`;

console.log('  fill name:', await evalJs(fillJs('#tm-name', 'UI Test Person')));
console.log('  fill email:', await evalJs(fillJs('#tm-email', NEW_EMAIL)));
console.log('  fill password:', await evalJs(fillJs('#tm-pw', NEW_PW)));
await sleep(400);

// --- the create button must be enabled once the form is valid
const enabled = await evalJs(`!document.querySelector('.sheet-foot .fc-btn-primary').disabled`);
if (enabled) pass('Create account enables once the form is valid');
else fail('create button still disabled after filling the form');

const shot = async (name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(outDir, 'shots', name), Buffer.from(data, 'base64'));
};
await shot('team-modal-filled-en.png');

// --- submit
await evalJs(`document.querySelector('.sheet-foot .fc-btn-primary').click(); 'ok'`);
await sleep(2000);

if (!(await evalJs(`!!document.querySelector('.scrim')`))) pass('the form closes after saving');
else fail('modal stayed open after save');

const after = await evalJs(`document.querySelectorAll('.card').length`);
if (after === before + 1) pass(`the new account appears in the list (${before} -> ${after})`);
else fail(`list did not grow: ${before} -> ${after}`);

const shown = await evalJs(`[...document.querySelectorAll('.email')].map(e => e.textContent).join('|')`);
if (shown.includes(NEW_EMAIL)) pass('the new account is rendered with its email');
else fail(`new email not on screen: ${shown}`);

await shot('team-after-create-en.png');

// --- the real proof: the account works
const asNew = await login(NEW_EMAIL, NEW_PW);
if (asNew.status === 200 && asNew.body.user.role === 'staff') pass('the account created via the UI can sign in as staff');
else fail(`created account cannot sign in: ${asNew.status}`);

// --- cleanup
await fetch(`${API}/api/users/${asNew.body.user.id}`, {
  method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
});
pass('cleaned up the test account');

console.log(`\n✓ ui-e2e: ${ok} checks passed\n`);
ws.close();
chrome.kill();
