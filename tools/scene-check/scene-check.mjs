import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const out = new URL('./shots-3d/', import.meta.url).pathname.replace(/^\//, '');
mkdirSync(out, { recursive: true });
const base = 'http://localhost:4321';
const problems = [];
const fail = (m) => { problems.push(m); console.log('FAIL', m); };
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const scrollTo = (page, p) =>
  page.evaluate((p) => {
    const root = document.querySelector('[data-story]');
    const stage = root.querySelector('[data-stage]');
    const header = document.querySelector('.site-header').offsetHeight;
    window.scrollTo({ top: root.getBoundingClientRect().top + scrollY - header + (root.offsetHeight - stage.offsetHeight) * p, behavior: 'instant' });
  }, p);

// 1. Every size and language: scene runs, pins, captions advance, nothing overflows, no errors.
for (const path of ['/', '/km']) {
  for (const [w, h, mobile] of [[1440, 900, false], [1280, 720, false], [1920, 1080, false], [1024, 768, false], [768, 1024, true], [390, 844, true], [360, 740, true]]) {
    const label = `${path} ${w}x${h}`;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR_(INTERNET|NETWORK|CONNECTION)/.test(m.text())) errors.push(m.text()); });
    await page.goto(base + path, { waitUntil: 'load' });
    const live = await page.waitForFunction(() => document.querySelector('[data-story]').classList.contains('is-live'), null, { timeout: 20000 }).then(() => true, () => false);
    if (!live) { fail(`${label} 3D scene did not start`); await ctx.close(); continue; }

    const seen = new Set();
    let pinned = true;
    for (const p of [0, 0.1, 0.25, 0.38, 0.5, 0.65, 0.8, 0.97]) {
      await scrollTo(page, p);
      await page.waitForFunction((p) => Math.abs(Number(document.querySelector('[data-story]').dataset.progress) - p) < 0.004, p, { timeout: 15000 }).catch(() => fail(`${label} scene did not catch up to ${p}`));
      const s = await page.evaluate(() => {
        const root = document.querySelector('[data-story]');
        const stage = root.querySelector('[data-stage]').getBoundingClientRect();
        const header = document.querySelector('.site-header').offsetHeight;
        return {
          top: Math.round(stage.top) === header,
          caption: [...root.querySelectorAll('[data-caption]')].findIndex((c) => c.classList.contains('is-current')),
          copyHidden: getComputedStyle(root.querySelector('[data-copy]')).visibility === 'hidden',
        };
      });
      if (!s.top) pinned = false;
      if (p >= 0.25) seen.add(s.caption);
      if (p >= 0.25 && !s.copyHidden) fail(`${label} intro text still showing at ${p}`);
    }
    if (!pinned) fail(`${label} stage not pinned`);
    if (seen.size !== 3) fail(`${label} captions seen ${[...seen]}`);

    // Leaving the scene: Features follows straight after.
    await page.locator('#features').evaluate((e) => e.scrollIntoView({ behavior: 'instant' }));
    await page.waitForTimeout(300);
    const featuresTop = await page.locator('#features').evaluate((e) => Math.round(e.getBoundingClientRect().top));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    if (overflow > 0) fail(`${label} overflows by ${overflow}px`);
    if (errors.length) fail(`${label} errors: ${errors.join(' | ')}`);
    console.log(`${label}: ok, features top ${featuresTop}, overflow ${overflow}`);
    await ctx.close();
  }
}

// 2. Language button redraws the phone screen labels.
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('[data-story]').classList.contains('is-live'));
  await scrollTo(page, 0.24);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}lang-en.png` });
  await page.locator('#lang-toggle').click();
  await page.waitForTimeout(500);
  const labels = await page.locator('[data-screen-text] [data-name="further"]').textContent();
  await page.screenshot({ path: `${out}lang-km.png` });
  console.log('screen label after toggle:', labels);
  if (!/[ក-៿]/.test(labels)) fail('screen labels did not switch to Khmer');
  await ctx.close();
}

// 3. Fallbacks: less motion, no JavaScript, no WebGL.
for (const [name, opts, init] of [
  ['reduced', { reducedMotion: 'reduce' }],
  ['nojs', { javaScriptEnabled: false }],
  ['nowebgl', { reducedMotion: 'no-preference' }, () => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return /webgl/.test(type) ? null : orig.call(this, type, ...rest);
    };
  }],
]) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage();
  if (init) await page.addInitScript(init);
  const threeLoaded = [];
  page.on('request', (r) => { if (r.url().includes('phone-scene')) threeLoaded.push(r.url()); });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const root = document.querySelector('[data-story]');
    return {
      live: root.classList.contains('is-live'),
      phones: [...root.querySelectorAll('.story-scene .phone')].filter((p) => p.getBoundingClientRect().width > 50).length,
      height: root.offsetHeight,
    };
  });
  console.log(name, JSON.stringify(r), '3D code downloaded:', threeLoaded.length > 0);
  if (r.live || r.phones !== 2) fail(`${name} fallback wrong ${JSON.stringify(r)}`);
  if (name !== 'nowebgl' && threeLoaded.length) fail(`${name} downloaded the 3D code`);
  await page.screenshot({ path: `${out}fallback-${name}.png` });
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `\n${problems.length} PROBLEM(S)` : '\nAll checks passed');
