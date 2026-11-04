// Close-ups of the phone from several sides (dev server hook). node phone-views.mjs <p> <tag>
import { chromium } from 'playwright-core';
const dir = new URL('./', import.meta.url).pathname.replace(/^\//, '');
const p = Number(process.argv[2] ?? 0.3);
const tag = process.argv[3] ?? '';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, reducedMotion: 'no-preference' });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.querySelector('[data-story]')?.classList.contains('is-live') && window.__phoneScene, null, { timeout: 30000 });
await page.evaluate((p) => {
  const root = document.querySelector('[data-story]');
  const stage = root.querySelector('[data-stage]');
  const header = document.querySelector('.site-header').offsetHeight;
  window.scrollTo({ top: root.getBoundingClientRect().top + scrollY - header + (root.offsetHeight - stage.offsetHeight) * p, behavior: 'instant' });
}, p);
await page.waitForFunction((p) => Math.abs(Number(document.querySelector('[data-story]').dataset.progress) - p) < 0.002, p, { timeout: 20000 });
await page.waitForTimeout(400);
// [name, direction in phone space (from phone to camera), distance cm, look-at offset in phone space, up]
const views = process.env.VIEWS === 'hand' ? [
  ['thumb', [0.25, -0.35, 1], 13, [0.8, -4.2, 0.8]],
  ['fingers', [-1, -0.1, 0.6], 14, [-3.9, -1.5, 0]],
  ['island', [0.15, 0.1, -1], 9, [-2.1, 5.3, -0.5]],
] : [
  ['front', [0, -0.15, 1], 26, [0, 0, 0]],
  ['back', [0.25, 0.1, -1], 24, [0, 0, 0]],
  ['island', [0.15, 0.1, -1], 9, [-2.1, 5.3, -0.5]],
  ['bottom', [0.1, -1, 0.35], 11, [0, -7.7, 0]],
  ['right', [1, 0, 0.35], 20, [3.7, 1.5, 0]],
  ['top', [0, 0.6, 1], 9, [0, 6.8, 0.4]],
];
for (const [name, d, dist, at] of views) {
  await page.evaluate(({ d, dist, at }) => {
    const { scene, camera, renderer, phone } = window.__phoneScene;
    const T = phone.matrixWorld;
    const V = (a) => ({ x: a[0], y: a[1], z: a[2] });
    const target = phone.localToWorld(Object.assign(phone.position.clone().set(0, 0, 0), V(at)));
    const dir = phone.position.clone().set(...d).normalize().transformDirection(T);
    camera.clearViewOffset();
    camera.aspect = 1200 / 900;
    camera.fov = 30;
    camera.near = 0.1;
    camera.updateProjectionMatrix();
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.up.set(0, 1, 0).transformDirection(T);
    camera.lookAt(target);
    renderer.setSize(1200, 900, false);
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
  }, { d, dist, at });
  await page.locator('[data-canvas]').screenshot({ path: `${dir}pv${tag}-${name}.png` });
  console.log('saved', name);
}
await browser.close();
