/**
 * Proof: the registration QR poster.
 *
 * Checks the Settings section renders a QR of the *registration* URL, then
 * exercises the real print path (Page.printToPDF == what the print dialog does)
 * and asserts the printed sheet is the poster alone — no app chrome, no form.
 *
 * Needs the stack up. Run: node scripts/poster-proof.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = process.env.APP_BASE || 'http://localhost:8899';
const API = process.env.API_BASE || 'http://localhost:4077';
const PORT = 9343;
const outDir = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));

let ok = 0;
let bad = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };
const fail = (m) => { bad += 1; console.error(`  ✗ ${m}`); };
const check = (c, m, got) => (c ? pass(m) : fail(`${m}  — ${got}`));

const r = await fetch(`${API}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'manager@farfasha.sa', password: 'manager123' }),
});
const { token, user, tenant } = await r.json();

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${path.join(outDir, '_poster')}`,
  '--window-size=1280,900', 'about:blank',
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
const evalJs = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: `${APP}/login` });
await sleep(1500);
await evalJs(`
  localStorage.setItem('farfasha_token', ${JSON.stringify(token)});
  localStorage.setItem('farfasha_user', ${JSON.stringify(JSON.stringify(user))});
  localStorage.setItem('farfasha_tenant', ${JSON.stringify(JSON.stringify(tenant))});
  localStorage.setItem('farfasha_lang', 'ar'); 'ok'`);

await send('Page.navigate', { url: `${APP}/settings` });
await sleep(2600);

// --- the section exists and points at /register
const url = await evalJs(`document.querySelector('.qr-url')?.textContent?.trim() || ''`);
check(url.endsWith('/register'), `the poster links to the registration form: ${url}`, url);

const qrSrc = await evalJs(`document.querySelector('.qr-box img')?.src || ''`);
check(qrSrc.startsWith('data:image/png'), 'a QR image is rendered for that link', qrSrc.slice(0, 24));

// The rendered QR must encode the URL it displays — a poster carrying a stale
// code is worse than no poster. Byte-comparing PNGs is no good (the browser
// encodes via canvas, Node via pngjs), so actually decode what is on screen:
// inject jsQR and read the pixels the printer would put on paper.
await send('Runtime.evaluate', {
  expression: readFileSync(path.join(outDir, '..', 'node_modules', 'jsqr', 'dist', 'jsQR.js'), 'utf8'),
});
const decoded = await (await send('Runtime.evaluate', {
  awaitPromise: true,
  returnByValue: true,
  expression: `(async () => {
    const img = document.querySelector('.qr-box img');
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height);
    const res = window.jsQR(d.data, c.width, c.height);
    return res ? res.data : 'DECODE_FAILED';
  })()`,
})).result?.value;
check(decoded === url, `the QR really decodes to that link: ${decoded}`, `decoded="${decoded}" shown="${url}"`);

// --- print for real: this is exactly what the Print poster button triggers
const pdf = await send('Page.printToPDF', {
  printBackground: true, preferCSSPageSize: true, paperWidth: 8.27, paperHeight: 11.69,
});
mkdirSync(path.join(outDir, 'shots'), { recursive: true });
const pdfBuf = Buffer.from(pdf.data, 'base64');
writeFileSync(path.join(outDir, 'shots', 'registration-poster.pdf'), pdfBuf);
check(pdfBuf.length > 4000, `the poster prints to a PDF (${(pdfBuf.length / 1024).toFixed(0)} KB)`, `${pdfBuf.length} bytes`);

// --- and the printed sheet is the poster, not the settings page
const printed = await evalJs(`(() => {
  const seen = [];
  for (const sel of ['.poster', '.wrap', '.save-bar', '.hdr']) {
    const el = document.querySelector(sel);
    seen.push(sel + '=' + (el ? getComputedStyle(el).display : 'absent'));
  }
  return seen.join(' ');
})()`);
console.log(`  · on screen: ${printed}`);

await send('Emulation.setEmulatedMedia', { media: 'print' });
await sleep(400);
const inPrint = await evalJs(`(() => {
  const d = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'absent'; };
  return { poster: d('.poster'), form: d('.wrap'), saveBar: d('.save-bar'), header: d('.hdr') };
})()`);
check(inPrint.poster !== 'none' && inPrint.poster !== 'absent', `when printing, the poster is shown (${inPrint.poster})`, JSON.stringify(inPrint));
check(inPrint.form === 'none', 'when printing, the settings form is hidden', JSON.stringify(inPrint));
check(inPrint.saveBar === 'none', 'when printing, the save bar is hidden', JSON.stringify(inPrint));
check(inPrint.header === 'none' || inPrint.header === 'absent', 'when printing, the app header is hidden', JSON.stringify(inPrint));

const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
writeFileSync(path.join(outDir, 'shots', 'poster-print-preview.png'), Buffer.from(shot.data, 'base64'));

console.log(`\n${bad === 0 ? '✓' : '✗'} poster: ${ok} passed, ${bad} failed\n`);
ws.close();
chrome.kill();
process.exit(bad === 0 ? 0 : 1);
