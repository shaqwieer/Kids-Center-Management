/**
 * Responsive guard: assert no page scrolls horizontally at any target width.
 * Uses Emulation.setDeviceMetricsOverride — Chrome's real window clamps at
 * ~500px, so --window-size cannot test phone widths (it only crops).
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = 'http://localhost:8899';
const API = 'http://localhost:4077';
const PORT = 9337;
const outDir = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));

const r = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'manager@farfasha.sa', password: 'manager123' }),
});
const { token, user, tenant } = await r.json();

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(outDir, '_of')}`,
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
await new Promise((res) => { ws.onopen = res; });
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
  return new Promise((res) => waiters.set(i, res));
};

await send('Page.enable');
await send('Runtime.enable');

// Plant a manager session so the authed routes render.
await send('Page.navigate', { url: `${APP}/login` });
await sleep(1500);
await send('Runtime.evaluate', {
  expression: `
    localStorage.setItem('farfasha_token', ${JSON.stringify(token)});
    localStorage.setItem('farfasha_user', ${JSON.stringify(JSON.stringify(user))});
    localStorage.setItem('farfasha_tenant', ${JSON.stringify(JSON.stringify(tenant))});
    localStorage.setItem('farfasha_lang', 'ar'); 'ok'`,
});

const ROUTES = ['/register', '/', '/team', '/customers', '/settings', '/finance', '/start'];
const WIDTHS = [390, 768, 1024, 1440];
let bad = 0;

for (const width of WIDTHS) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height: 900, deviceScaleFactor: 1, mobile: width < 700,
  });
  for (const route of ROUTES) {
    await send('Page.navigate', { url: `${APP}${route}` });
    await sleep(1700);
    const res = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const sw = document.documentElement.scrollWidth, iw = window.innerWidth;
        let worst = null;
        if (sw > iw + 1) {
          for (const el of document.querySelectorAll('*')) {
            const b = el.getBoundingClientRect();
            if (b.right > iw + 1 && b.width > 0) {
              const cls = typeof el.className === 'string' && el.className.trim()
                ? '.' + el.className.trim().split(/\\s+/).join('.') : '';
              worst = el.tagName + cls + ' (right=' + Math.round(b.right) + ')';
              break;
            }
          }
        }
        return { sw, iw, worst };
      })()`,
    });
    const v = res.result.value;
    const over = v.sw > v.iw + 1;
    if (over) bad += 1;
    console.log(`  ${over ? 'FAIL' : ' ok '} ${route.padEnd(11)} @${String(width).padStart(4)}px  scrollWidth=${v.sw} viewport=${v.iw}${over ? `  OVERFLOW via ${v.worst}` : ''}`);
  }
}

console.log(bad === 0 ? '\nNo horizontal overflow at any tested width.\n' : `\n${bad} overflowing combinations.\n`);
ws.close();
chrome.kill();
process.exit(bad === 0 ? 0 : 1);
