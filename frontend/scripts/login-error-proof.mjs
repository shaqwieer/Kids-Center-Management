/** A failed sign-in must speak the reader's language, not the server's. */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = 'http://localhost:8899';
const PORT = 9340;
const outDir = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(outDir, 'shots'), { recursive: true });

let ok = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };
const fail = (m) => { console.error(`  ✗ ${m}`); process.exitCode = 1; };

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(outDir, '_lerr')}`,
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

const fill = (sel, val) => `(() => {
  const el = document.querySelector(${JSON.stringify(sel)});
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  s.call(el, ${JSON.stringify(val)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`;

for (const lang of ['ar', 'en']) {
  await send('Page.navigate', { url: `${APP}/login` });
  await sleep(1200);
  await evalJs(`localStorage.setItem('farfasha_lang', ${JSON.stringify(lang)}); 'ok'`);
  await send('Page.navigate', { url: `${APP}/login` });
  await sleep(1800);

  await evalJs(fill('#lg-email', 'manager@farfasha.sa'));
  await evalJs(fill('#lg-pw', 'definitely-wrong'));
  await sleep(300);
  await evalJs(`document.querySelector('.submit').click(); 'ok'`);
  await sleep(1800);

  const msg = await evalJs(`document.querySelector('.err')?.textContent?.trim() || ''`);
  const hasArabic = /[؀-ۿ]/.test(msg);
  if (!msg) { fail(`${lang}: no error shown for a wrong password`); continue; }
  if (lang === 'ar' && hasArabic) pass(`ar: wrong password shows Arabic — "${msg}"`);
  else if (lang === 'ar') fail(`ar: error leaked non-Arabic text — "${msg}"`);
  if (lang === 'en' && !hasArabic) pass(`en: wrong password shows English — "${msg}"`);
  else if (lang === 'en') fail(`en: unexpected text — "${msg}"`);

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(outDir, 'shots', `login-error-${lang}.png`), Buffer.from(data, 'base64'));
}

console.log(`\n✓ login-err: ${ok} checks passed\n`);
ws.close();
chrome.kill();
