import { chromium } from 'playwright-core';

// Headed Chrome uses this computer's real graphics card, unlike the software renderer in headless runs.
const browser = await chromium.launch({ channel: 'chrome', headless: false });
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, reducedMotion: 'no-preference' });
  if (process.argv[2] === 'nohand') await page.route('**/hand.glb', (r) => r.abort());
  await page.goto('http://localhost:4321/', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-story]').classList.contains('is-live'), null, { timeout: 20000 });
  const r = await page.evaluate(async () => {
    const root = document.querySelector('[data-story]');
    const stage = root.querySelector('[data-stage]');
    const header = document.querySelector('.site-header').offsetHeight;
    const start = root.getBoundingClientRect().top + scrollY - header;
    const distance = root.offsetHeight - stage.offsetHeight;
    const gpu = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
    })();
    // Scroll through the whole scene over about 4 seconds and record frame gaps.
    const gaps = []; const slow = [];
    let last = performance.now();
    const steps = 240;
    for (let i = 0; i <= steps; i++) {
      window.scrollTo(0, start + (distance * i) / steps);
      await new Promise((res) => requestAnimationFrame(res));
      const now = performance.now();
      gaps.push(now - last); if (now - last > 150) slow.push([+(i / steps).toFixed(3), Math.round(now - last)]);
      last = now;
    }
    gaps.sort((a, b) => a - b);
    return { gpu, median: gaps[Math.floor(gaps.length / 2)].toFixed(1), p95: gaps[Math.floor(gaps.length * 0.95)].toFixed(1), worst: gaps.at(-1).toFixed(1), slow };
  });
  console.log(`${w}x${h}`, JSON.stringify(r));
  await page.close();
}
await browser.close();



