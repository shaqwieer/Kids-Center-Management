/**
 * Proof: the camera QR scanner really reads a customer's card.
 *
 * There is no webcam on CI (or on this box), so we hand Chrome a *fake* one:
 * a Y4M video whose every frame is the QR of a real customer's card URL.
 * Chrome plays it into getUserMedia, the scanner decodes it for real, looks the
 * customer up over the API, and the wizard should land on that exact customer.
 *
 * The Y4M is generated here from the QR bitmap (no image/ffmpeg dependency):
 * Y4M is raw I420 — a luma plane we paint ourselves, plus neutral chroma.
 *
 * Needs the stack up. Run: node scripts/qr-scan-proof.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = process.env.APP_BASE || 'http://localhost:8899';
const API = process.env.API_BASE || 'http://localhost:4077';
const PORT = 9342;
const outDir = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));

let ok = 0;
let bad = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };
const fail = (m) => { bad += 1; console.error(`  ✗ ${m}`); };

/** Paint the QR into a Y4M (I420) clip Chrome can play as a webcam. */
function writeY4m(text, file, { w = 640, h = 480, frames = 60, scale = 12 } = {}) {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const side = n * scale;
  const ox = Math.floor((w - side) / 2);
  const oy = Math.floor((h - side) / 2);

  // Luma: white page, black modules. Chroma: neutral (128) = greyscale.
  const Y = Buffer.alloc(w * h, 255);
  for (let my = 0; my < n; my += 1) {
    for (let mx = 0; mx < n; mx += 1) {
      if (!qr.modules.data[my * n + mx]) continue; // 0 = light module
      for (let py = 0; py < scale; py += 1) {
        const row = (oy + my * scale + py) * w + ox + mx * scale;
        Y.fill(0, row, row + scale);
      }
    }
  }
  const U = Buffer.alloc((w / 2) * (h / 2), 128);
  const V = Buffer.alloc((w / 2) * (h / 2), 128);

  const parts = [Buffer.from(`YUV4MPEG2 W${w} H${h} F25:1 Ip A1:1 C420mpeg2\n`)];
  for (let i = 0; i < frames; i += 1) parts.push(Buffer.from('FRAME\n'), Y, U, V);
  writeFileSync(file, Buffer.concat(parts));
  return file;
}

const login = async (email, password) => {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return r.json();
};

const { token, user, tenant } = await login('manager@farfasha.sa', 'manager123');

// A real customer, and the exact URL her printed card carries.
const list = await (await fetch(`${API}/api/customers`, { headers: { Authorization: `Bearer ${token}` } })).json();
const first = (list.customers || list)[0];
const detail = await (await fetch(`${API}/api/customers/${first.id}`, { headers: { Authorization: `Bearer ${token}` } })).json();
const target = detail.customer;
console.log(`\ncard belongs to: ${target.full_name}`);
console.log(`card url:        ${target.card_url}`);

mkdirSync(outDir, { recursive: true });
const y4m = path.join(outDir, '_qr-card.y4m');
writeY4m(target.card_url, y4m);
console.log(`fake camera:     ${path.basename(y4m)} (QR of that card, 640x480)\n`);

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(outDir, '_qrscan')}`,
  '--use-fake-device-for-media-stream',
  '--use-fake-ui-for-media-stream',            // auto-grant the camera prompt
  `--use-file-for-fake-video-capture=${y4m}`,  // ...and feed it our QR
  '--window-size=1280,900',
  'about:blank',
], { stdio: 'ignore' });

let target_;
for (let i = 0; i < 40; i += 1) {
  try {
    const l = await (await fetch(`http://localhost:${PORT}/json/list`)).json();
    target_ = l.find((t) => t.type === 'page');
    if (target_) break;
  } catch { /* wait */ }
  await sleep(250);
}
const ws = new WebSocket(target_.webSocketDebuggerUrl);
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
const evalAsync = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: `${APP}/login` });
await sleep(1500);
await evalJs(`
  localStorage.setItem('farfasha_token', ${JSON.stringify(token)});
  localStorage.setItem('farfasha_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('farfasha_tenant', ${JSON.stringify(JSON.stringify(tenant))});
  localStorage.setItem('farfasha_lang', 'en'); 'ok'`);

await send('Page.navigate', { url: `${APP}/start` });
await sleep(2500);

// The button must be a real scan action now, not the old "simulate" stub.
const label = await evalJs(`document.querySelector('.scan-btn')?.textContent?.trim() || ''`);
check(!/simulat/i.test(label) && label.length > 0, `scan button reads "${label}" (not a simulation)`, label);

const decoder = await evalAsync(`(async () => {
  if (!('BarcodeDetector' in window)) return 'jsQR (no native detector)';
  try {
    const f = await window.BarcodeDetector.getSupportedFormats();
    return f.includes('qr_code') ? 'native BarcodeDetector' : 'jsQR (native lacks qr_code)';
  } catch { return 'jsQR (native threw)'; }
})()`);
console.log(`  · decoder in use: ${decoder}`);

// Watch for the feed rather than polling for it: against a fake camera the
// decode can land in ~200ms and unmount the video between two polls, which
// would look like "the camera never opened" when it plainly did.
await evalJs(`
  window.__sawVideo = false;
  window.__videoLive = false;
  const mo = new MutationObserver(() => {
    const v = document.querySelector('video');
    if (!v) return;
    window.__sawVideo = true;
    // a real MediaStream attached is the part that proves the camera opened
    if (v.srcObject && v.srcObject.getVideoTracks && v.srcObject.getVideoTracks().length) {
      window.__videoLive = true;
    }
  });
  mo.observe(document.body, { childList: true, subtree: true, attributes: true });
  'ok'
`);

await evalJs(`document.querySelector('.scan-btn').click(); 'ok'`);
await sleep(1500);

const sawVideo = await evalJs(`window.__sawVideo === true`);
const videoLive = await evalJs(`window.__videoLive === true`);
check(sawVideo && videoLive, 'the camera opens with a live MediaStream attached to the feed',
  `sawVideo=${sawVideo} liveStream=${videoLive}`);

// Give the scanner up to ~12s to read a frame and resolve the customer.
let matched = '';
for (let i = 0; i < 40; i += 1) {
  matched = await evalJs(`document.querySelector('.cust-name')?.textContent?.trim() || ''`);
  if (matched) break;
  await sleep(300);
}

check(matched === target.full_name,
  `scanning the card selected the right customer: ${matched || '(nobody)'}`,
  `expected ${target.full_name}, got "${matched}"`);

if (matched) {
  const kids = await evalJs(`[...document.querySelectorAll('.cust-children .child-chip, .cust-children *')].length > 0`);
  check(kids, 'her registered children are listed, ready to pick', `children rendered=${kids}`);
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  mkdirSync(path.join(outDir, 'shots'), { recursive: true });
  writeFileSync(path.join(outDir, 'shots', 'qr-scan-matched.png'), Buffer.from(shot.data, 'base64'));
}

// ---------------------------------------------------------------------------
// A reception Android tablet takes the *native* BarcodeDetector path, which the
// run above never touches (headless Chrome has none). Fake a native detector
// that claims qr_code support and then throws on every frame — the scanner must
// notice, abandon it, and still read the card via jsQR rather than spinning.
// ---------------------------------------------------------------------------
console.log('\n— a broken native BarcodeDetector must fall back, not hang');
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `
    window.__nativeCalls = 0;
    window.BarcodeDetector = class {
      static async getSupportedFormats() { return ['qr_code']; }
      constructor() {}
      async detect() { window.__nativeCalls += 1; throw new Error('simulated flaky native detector'); }
    };
  `,
});
await send('Page.navigate', { url: `${APP}/start` });
await sleep(2500);

const sawNative = await evalAsync(`(async () => {
  const f = await window.BarcodeDetector.getSupportedFormats();
  return f.includes('qr_code');
})()`);
check(sawNative, 'the page now advertises a native qr_code detector', `advertised=${sawNative}`);

await evalJs(`document.querySelector('.scan-btn').click(); 'ok'`);

let matched2 = '';
for (let i = 0; i < 50; i += 1) {
  matched2 = await evalJs(`document.querySelector('.cust-name')?.textContent?.trim() || ''`);
  if (matched2) break;
  await sleep(300);
}
const nativeCalls = await evalJs(`window.__nativeCalls || 0`);
check(nativeCalls > 0, `the broken native detector was tried (${nativeCalls} throwing calls)`, `calls=${nativeCalls}`);
check(matched2 === target.full_name,
  `it fell back to jsQR and still read the card: ${matched2 || '(nobody)'}`,
  `expected ${target.full_name}, got "${matched2}"`);

function check(cond, m, got) { return cond ? pass(m) : fail(`${m}  — ${got}`); }

console.log(`\n${bad === 0 ? '✓' : '✗'} qr-scan: ${ok} passed, ${bad} failed\n`);
ws.close();
chrome.kill();
try { rmSync(y4m); } catch { /* best effort */ }
process.exit(bad === 0 ? 0 : 1);
