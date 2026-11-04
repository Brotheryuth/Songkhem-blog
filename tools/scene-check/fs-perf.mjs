// Features stage frame times on the real graphics card (headed Chrome): scrolling through, and idle in each feature.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'chrome', headless: false });
for (const [w, h] of [[1440, 900], [1920, 1080]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'no-preference' });
  await page.goto('http://localhost:4321/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-story]').classList.contains('is-live'), null, { timeout: 30000 });
  await page.evaluate(() => document.querySelector('#features').scrollIntoView());
  await page.waitForFunction(() => document.querySelector('[data-features]').classList.contains('is-live'), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(async () => {
    const track = document.querySelector('[data-fs-track]');
    const stage = document.querySelector('[data-fs-stage]');
    const header = document.querySelector('.site-header').offsetHeight;
    const start = track.getBoundingClientRect().top + scrollY - header;
    const distance = track.offsetHeight - stage.offsetHeight;
    const frames = async (n) => { const g = []; let last = performance.now(); for (let i = 0; i < n; i++) { await new Promise((r) => requestAnimationFrame(r)); const t = performance.now(); g.push(t - last); last = t; } g.sort((a, b) => a - b); return { median: +g[g.length >> 1].toFixed(1), p95: +g[Math.floor(g.length * 0.95)].toFixed(1), worst: +g.at(-1).toFixed(1) }; };
    const out = {};
    const g = []; let last = performance.now();
    for (let i = 0; i <= 180; i++) { scrollTo(0, start + (distance * i) / 180); await new Promise((r) => requestAnimationFrame(r)); const t = performance.now(); g.push(t - last); last = t; }
    g.sort((a, b) => a - b);
    out.scroll = { median: +g[g.length >> 1].toFixed(1), p95: +g[Math.floor(g.length * 0.95)].toFixed(1), worst: +g.at(-1).toFixed(1) };
    for (const [name, p] of [['scanner', 0.15], ['reader', 0.5], ['upload', 0.85]]) { scrollTo(0, start + distance * p); await new Promise((r) => setTimeout(r, 400)); out[name] = await frames(120); }
    return out;
  });
  console.log(`${w}x${h}`, JSON.stringify(r));
  await page.close();
}
await browser.close();
