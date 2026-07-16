/**
 * Proof: the public registration page's layout.
 *
 * Guards the things a parent actually sees, at the widths they see them:
 *   - the welcome band is full-bleed (edge to edge), not a boxed column
 *   - the form uses the width instead of the old 440px phone column
 *   - the cards tuck INTO the band and paint above it (a positioned hero will
 *     happily bury their top edge — that regression shipped once)
 *   - it collapses to one column on a phone, with nothing scrolling sideways
 *
 * Needs the stack up. Run: node scripts/register-layout-proof.mjs
 */
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const APP = process.env.APP_BASE || 'http://localhost:8899';
const PORT = 9346;
const outDir = process.argv[2] || path.dirname(fileURLToPath(import.meta.url));

let ok = 0;
let bad = 0;
const pass = (m) => { ok += 1; console.log(`  ✓ ${m}`); };
const fail = (m) => { bad += 1; console.error(`  ✗ ${m}`); };
const check = (c, m, got) => (c ? pass(m) : fail(`${m}  — ${got}`));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${path.join(outDir, '_reglayout')}`,
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
const evalJs = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.value;

await send('Page.enable');
await send('Runtime.enable');

const measure = () => evalJs(`(() => {
  const r = (s) => { const el = document.querySelector(s); return el ? el.getBoundingClientRect() : null; };
  const hero = r('.hero');
  const cols = r('.cols');
  const pane = r('.pane');
  const iw = window.innerWidth;
  // Who paints inside the overlap? The card must, or its top edge is buried.
  let seamPaints = null;
  if (hero && pane) {
    const y = Math.round(hero.bottom - 8);
    const x = Math.round(pane.left + 40);
    const el = document.elementFromPoint(x, y);
    seamPaints = el ? el.tagName + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/)[0] : '') : null;
  }
  return {
    iw,
    heroLeft: hero ? Math.round(hero.left) : null,
    heroRight: hero ? Math.round(hero.right) : null,
    heroBottom: hero ? Math.round(hero.bottom) : null,
    colsTop: cols ? Math.round(cols.top) : null,
    colsWidth: cols ? Math.round(cols.width) : null,
    paneCount: document.querySelectorAll('.pane').length,
    // one column vs two: compare the two panes' top offsets
    stacked: (() => {
      const p = [...document.querySelectorAll('.pane')];
      if (p.length < 2) return null;
      return Math.abs(p[0].getBoundingClientRect().top - p[1].getBoundingClientRect().top) > 20;
    })(),
    scrollWidth: document.documentElement.scrollWidth,
    seamPaints,
  };
})()`);

for (const width of [1920, 1440, 1024]) {
  await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: `${APP}/register` });
  await sleep(2000);
  const m = await measure();
  console.log(`\n— ${width}px`);

  check(m.heroLeft === 0 && m.heroRight === width,
    'the welcome band spans the full width', `left=${m.heroLeft} right=${m.heroRight} vw=${width}`);

  // The original complaint: a 440px column on a big screen. Demand real use of it.
  check(m.colsWidth > 900,
    `the form uses the width (${m.colsWidth}px of ${width}px), not a phone column`, `cols=${m.colsWidth}`);

  check(m.colsTop < m.heroBottom,
    `the cards tuck into the band (${m.heroBottom - m.colsTop}px overlap)`, `colsTop=${m.colsTop} heroBottom=${m.heroBottom}`);

  // The regression this file exists for.
  check(m.seamPaints && m.seamPaints.startsWith('SECTION'),
    `the card paints above the band, not buried under it (${m.seamPaints})`, `seam=${m.seamPaints}`);

  check(m.stacked === false, 'guardian and children sit side by side', `stacked=${m.stacked}`);
  check(m.scrollWidth <= width + 1, 'nothing scrolls sideways', `scrollWidth=${m.scrollWidth}`);
}

console.log('\n— 390px (a parent’s phone)');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.navigate', { url: `${APP}/register` });
await sleep(2000);
{
  const m = await measure();
  check(m.stacked === true, 'it collapses to a single column', `stacked=${m.stacked}`);
  check(m.scrollWidth <= m.iw + 1, 'nothing scrolls sideways', `scrollWidth=${m.scrollWidth} vw=${m.iw}`);
  check(m.seamPaints && m.seamPaints.startsWith('SECTION'),
    `the card still paints above the band (${m.seamPaints})`, `seam=${m.seamPaints}`);
}

console.log(`\n${bad === 0 ? '✓' : '✗'} register-layout: ${ok} passed, ${bad} failed\n`);
ws.close();
chrome.kill();
process.exit(bad === 0 ? 0 : 1);
