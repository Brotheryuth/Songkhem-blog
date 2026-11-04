// A sheet of frames across the whole scroll at the user's window size (1900 x 950). Needs the dev server and playwright-core.
// node frames-sheet.mjs <from> <to> <count> <out.png>
import { chromium } from 'playwright-core';
import fs from 'node:fs';
const dir = new URL('./', import.meta.url).pathname.replace(/^\//, '');
const [from, to, count] = [Number(process.argv[2] ?? 0.04), Number(process.argv[3] ?? 0.6), Number(process.argv[4] ?? 30)];
const out = process.argv[5] ?? `${dir}frames-sheet.png`;
const stops = Array.from({ length: count }, (_, i) => +(from + ((to - from) * i) / (count - 1)).toFixed(4));
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1900, height: 950 }, reducedMotion: 'no-preference' });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('[data-story]')?.classList.contains('is-live'), null, { timeout: 30000 });
const shots = [];
for (const p of stops) {
  await page.evaluate((p) => {
    const root = document.querySelector('[data-story]');
    const stage = root.querySelector('[data-stage]');
    const header = document.querySelector('.site-header').offsetHeight;
    window.scrollTo({ top: root.getBoundingClientRect().top + scrollY - header + (root.offsetHeight - stage.offsetHeight) * p, behavior: 'instant' });
  }, p);
  await page.waitForFunction((p) => Math.abs(Number(document.querySelector('[data-story]').dataset.progress) - p) < 0.002, p, { timeout: 20000 });
  await page.waitForTimeout(250);
  const buf = await page.screenshot({ clip: { x: 900, y: 70, width: 1000, height: 880 } });
  shots.push({ p, src: `data:image/png;base64,${buf.toString('base64')}` });
}
const cols = 6;
const html = `<body style="margin:0;background:#fff;font:14px Segoe UI,sans-serif"><div style="display:grid;grid-template-columns:repeat(${cols},300px);gap:4px">${shots
  .map((s) => `<div style="position:relative"><img src="${s.src}" style="width:300px;height:264px;display:block"><span style="position:absolute;left:4px;top:2px;background:#fff8;padding:0 4px">${s.p}</span></div>`)
  .join('')}</div></body>`;
const sheet = await browser.newPage({ viewport: { width: cols * 304, height: Math.ceil(shots.length / cols) * 268 } });
await sheet.setContent(html);
await sheet.screenshot({ path: out, fullPage: true });
console.log('saved', out, 'errors:', errors.length ? errors.join(' | ') : 'none');
await browser.close();
