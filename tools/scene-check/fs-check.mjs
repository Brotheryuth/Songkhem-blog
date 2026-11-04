// Features 3D stage: live only where it should be, the plain layout everywhere else, no errors.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
let failed = 0;
const cases = [
  { name: 'desktop light', vp: [1440, 900], expect: true },
  { name: 'desktop dark', vp: [1920, 1080], theme: 'dark', expect: true },
  { name: 'km desktop', vp: [1280, 720], page: 'km', expect: true },
  { name: 'contrast theme', vp: [1440, 900], theme: 'contrast', expect: false },
  { name: 'reduced motion', vp: [1440, 900], reduced: true, expect: false },
  { name: 'tablet portrait', vp: [768, 1024], expect: false },
  { name: 'phone', vp: [390, 844], expect: false },
  { name: 'small laptop', vp: [1024, 768], expect: true },
];
for (const c of cases) {
  const p = await b.newPage({ viewport: { width: c.vp[0], height: c.vp[1] }, reducedMotion: c.reduced ? 'reduce' : 'no-preference' });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
  if (c.theme) await p.addInitScript((t) => localStorage.setItem('songkhem-theme', t), c.theme);
  await p.goto(`http://localhost:4321/${c.page ?? ''}`, { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelector('#features').scrollIntoView());
  await p.waitForTimeout(c.expect ? 9000 : 5000);
  const r = await p.evaluate(() => {
    const s = document.querySelector('[data-features]');
    const rows = [...document.querySelectorAll('[data-fs-row]')];
    const imgs = [...document.querySelectorAll('.feature-visual img')].filter((i) => i.getBoundingClientRect().height > 50).length;
    const shown = rows.filter((r) => getComputedStyle(r).visibility === 'visible').length;
    return { live: s.classList.contains('is-live'), imgs, shown, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  const ok = r.live === c.expect && (c.expect ? r.shown === 1 : r.imgs === 3 && r.shown === 3) && r.overflow <= 0 && !errors.length;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name}: live ${r.live}, rows shown ${r.shown}, images ${r.imgs}, overflow ${r.overflow}${errors.length ? ', errors: ' + errors.join(' | ') : ''}`);
  await p.close();
}
// Theme switch to high contrast while live turns the plain layout back on
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  await p.evaluate(() => document.querySelector('#features').scrollIntoView());
  await p.waitForFunction(() => document.querySelector('[data-features]').classList.contains('is-live'), null, { timeout: 30000 });
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'contrast'));
  await p.waitForTimeout(500);
  const flat = await p.evaluate(() => !document.querySelector('[data-features]').classList.contains('is-live'));
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await p.waitForTimeout(500);
  const back = await p.evaluate(() => document.querySelector('[data-features]').classList.contains('is-live'));
  if (!flat || !back) failed++;
  console.log(`${flat && back ? 'ok  ' : 'FAIL'} theme switch: contrast -> plain ${flat}, back -> live ${back}`);
  await p.close();
}
console.log(failed ? `${failed} FAILED` : 'All features checks passed');
await b.close();
