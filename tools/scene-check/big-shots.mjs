// Full-window shots at the user's own window size (1900 x 950): node big-shots.mjs 0.2,0.385
import { chromium } from 'playwright-core';
const dir = new URL('./', import.meta.url).pathname.replace(/^\//, '');
const stops = (process.argv[2] ?? '0.2').split(',').map(Number);
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1900, height: 950 }, reducedMotion: 'no-preference' });
const tag = process.argv[4] ?? '';
if (process.argv[3]) await page.addInitScript((s) => { window.__handSize = s; }, Number(process.argv[3]));
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto((process.env.BASE ?? 'http://localhost:4321/') + (process.env.PAGE ?? ''), { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('[data-story]')?.classList.contains('is-live'), null, { timeout: 30000 });
for (const p of stops) {
  await page.evaluate((p) => {
    const root = document.querySelector('[data-story]');
    const stage = root.querySelector('[data-stage]');
    const header = document.querySelector('.site-header').offsetHeight;
    window.scrollTo({ top: root.getBoundingClientRect().top + scrollY - header + (root.offsetHeight - stage.offsetHeight) * p, behavior: 'instant' });
  }, p);
  await page.waitForFunction((p) => Math.abs(Number(document.querySelector('[data-story]').dataset.progress) - p) < 0.002, p, { timeout: 20000 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${dir}big${tag}-${String(p).replace('.', '_')}.png`, clip: { x: 900, y: 70, width: 1000, height: 880 } });
  console.log('saved', p);
}
await browser.close();
