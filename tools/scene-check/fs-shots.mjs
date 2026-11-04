// Features 3D stage at given progress points: node fs-shots.mjs 0.15,0.5,0.85 [tag] [theme] [WxH]
import { chromium } from 'playwright-core';
const dir = new URL('./', import.meta.url).pathname.replace(/^\//, '');
const stops = (process.argv[2] ?? '0.15,0.5,0.85').split(',').map(Number);
const tag = process.argv[3] ?? 'fs';
const theme = process.argv[4] ?? 'light';
const [w, h] = (process.argv[5] ?? '1440x900').split('x').map(Number);
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: w, height: h }, reducedMotion: 'no-preference' });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || m.text().startsWith('features:')) errors.push(m.text()); });
await p.addInitScript((t) => localStorage.setItem('songkhem-theme', t), theme);
await p.goto(`http://localhost:4321/${process.env.PAGE ?? ''}`, { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.querySelector('[data-story]')?.classList.contains('is-live'), null, { timeout: 40000 }).catch(() => console.log('hero not live'));
await p.evaluate(() => document.querySelector('#features').scrollIntoView());
await p.waitForFunction(() => document.querySelector('[data-features]')?.classList.contains('is-live'), null, { timeout: 40000 }).catch(() => console.log('NOT LIVE'));
for (const s of stops) {
  await p.evaluate((s) => {
    const track = document.querySelector('[data-fs-track]');
    const stage = document.querySelector('[data-fs-stage]');
    const header = document.querySelector('.site-header').offsetHeight;
    const top = track.getBoundingClientRect().top + scrollY - header;
    scrollTo(0, top + (track.offsetHeight - stage.offsetHeight) * s);
  }, s);
  await p.waitForTimeout(1500);
  // scroll again in case the page height changed meanwhile, then let it animate
  await p.evaluate((s) => {
    const track = document.querySelector('[data-fs-track]');
    const stage = document.querySelector('[data-fs-stage]');
    const header = document.querySelector('.site-header').offsetHeight;
    scrollTo(0, track.getBoundingClientRect().top + scrollY - header + (track.offsetHeight - stage.offsetHeight) * s);
  }, s);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${dir}${tag}-${String(s).replace('.', '_')}.png` });
  console.log('saved', s, await p.evaluate(() => document.querySelector('[data-features]').dataset.progress));
}
console.log('errors:', errors.length ? errors.join('\n') : 'none');
await b.close();
