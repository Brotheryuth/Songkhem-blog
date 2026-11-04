// A small 3D scene for the home page: a phone held over a printed Khmer page, driven by scroll.
// The phone and the app on its screen are built from code (phone-model.ts, app-screen.ts); the hand is a model.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { createHand } from './hand-rig';
import { APP_FONTS, APP_FONTS_CSS, UW, createAppScreen, type AppState, type AppText } from './app-screen';
import { createPhoneModel, roundedShape } from './phone-model';

// The hand is an MPFB 2 / MakeHuman model (CC0), posed and skinned for this site: /models/hand/license.txt
const handModelUrl = '/models/hand/hand.glb';
const handGlossUrl = '/models/hand/hand_gloss.webp';
const handAoUrl = '/models/hand/hand_ao.webp';
// A real photo studio's light (Poly Haven, CC0): /models/light/license.txt
const studioLightUrl = '/models/light/studio.hdr';

/** The app's own words for its screens, in the page's language. */
export type SceneText = AppText;

/** Screen regions (CSS pixels inside the canvas) the subject should fill at each stage. */
export type Frame = {
  W: number;
  H: number;
  hero: { x: number; y: number; w: number; h: number };
  main: { x: number; y: number; w: number; h: number };
};

const TITLE_WORDS = ['រឿង', 'ព្រេង', '៖', 'ធនញ្ជ័យ'];
const BODY_WORDS = [
  'កាលពី', 'ព្រេង', 'នាយ', 'មាន', 'កុមារ', 'ម្នាក់', 'ឈ្មោះធនញ្ជ័យ', 'ជា', 'ក្មេង', 'ឆ្លាតវៃ', 'និង', 'មាន',
  'ប្រាជ្ញាលើស', 'ក្មេង', 'ដទៃ', '។', 'ធនញ្ជ័យ', 'តែងតែយក', 'ចំណេះ', 'ដឹង', 'និង', 'ប្រាជ្ញា', 'ស្មារតី', 'របស់',
  'ខ្លួនមកដោះ', 'ស្រាយ', 'បញ្ហា', 'លំបាកៗ', 'ក្នុង', 'ភូមិ', 'និងជួយ', 'ដល់', 'ប្រជាជន', 'ស្លូត', 'ត្រង់', '។',
];
const WORDS = [...TITLE_WORDS, ...BODY_WORDS];
const KHMER = '"Kantumruy Pro", "Noto Sans Khmer", sans-serif';

// Phone size in centimetres.
// The hand was posed in Blender round a phone exactly this size, so these must not change.
const PW = 7.4;
const PH = 15.4;
const PD = 0.85;
const CORNER = 1.0;
// Screen: thin, even bezels. The app is laid out in dp across it (411 dp wide, like the phone it was tested on).
const SW = 6.9;
const SH = 14.96;
const UH = Math.round((UW * SH) / SW);
const DP = SW / UW; // centimetres per dp
// Where the Blender grip put the thumb's tap (phone space, cm): the old drawn shutter's centre.
const GRIP_SHUTTER_Y = -4.14;

const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;

function planarUVs(geometry: THREE.BufferGeometry, w: number, h: number) {
  const pos = geometry.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) + w / 2) / w;
    uv[i * 2 + 1] = (pos.getY(i) + h / 2) / h;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geometry;
}

function wrapWords(ctx: CanvasRenderingContext2D, words: string[], maxWidth: number, joiner: string) {
  const lines: string[][] = [];
  let line: string[] = [];
  for (const word of words) {
    const test = [...line, word].join(joiner);
    if (line.length && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = [word];
    } else line.push(word);
  }
  if (line.length) lines.push(line);
  return lines;
}

function paperTexture() {
  const c = document.createElement('canvas');
  c.width = 1260;
  c.height = 1680;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#FBF8EF';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#1B1B1B';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 70px ${KHMER}`;
  ctx.textAlign = 'center';
  ctx.fillText('រឿងព្រេង៖ ធនញ្ជ័យ', c.width / 2, 210);
  ctx.textAlign = 'left';
  ctx.font = `400 54px ${KHMER}`;
  const lines = wrapWords(ctx, BODY_WORDS, c.width - 220, '');
  lines.forEach((line, i) => ctx.fillText(line.join(''), 110, 360 + i * 112));
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(200, 160, 40, 256, 256, 420);
  g.addColorStop(0, '#9A7351');
  g.addColorStop(0.6, '#6E4C31');
  g.addColorStop(1, '#4A321F');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 3) {
    ctx.fillStyle = `rgba(40, 24, 12, ${0.05 + 0.12 * Math.abs(Math.sin(x * 0.37) * Math.sin(x * 0.051))})`;
    ctx.fillRect(x, 0, 2, 512);
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export async function createPhoneScene(canvas: HTMLCanvasElement, initialText: SceneText) {
  // The app's fonts (Roboto and Noto Sans Khmer as Android draws them, Suwannaphum for documents), only for
  // the phone screen, so the rest of the page doesn't wait for them.
  if (!document.querySelector(`link[href="${APP_FONTS_CSS}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = APP_FONTS_CSS;
    document.head.appendChild(link);
    await new Promise((resolve) => {
      link.onload = resolve;
      link.onerror = resolve;
      setTimeout(resolve, 4000);
    });
  }
  await Promise.race([
    // Sample text in both scripts, so the Khmer and Latin parts of each font (separate files) both load
    Promise.all([`400 20px ${KHMER}`, `700 20px ${KHMER}`, ...APP_FONTS].map((f) => document.fonts.load(f, 'កខគ Aa1'))),
    new Promise((resolve) => setTimeout(resolve, 4000)),
  ]).catch(() => undefined);

  let text = initialText;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap; // softened by the light's shadow.radius
  // Shadows are worked out once per frame and shared by both cameras.
  renderer.shadowMap.autoUpdate = false;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-18, 60, 26);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 120;
  sun.shadow.radius = 6;
  sun.shadow.bias = -0.0005;
  sun.layers.enable(1);
  scene.add(sun);
  const fill = new THREE.HemisphereLight(0xffffff, 0xd9d2c5, 0.6);
  fill.layers.enable(1);
  scene.add(fill);

  // Ground: invisible except for the shadows it catches, so the page sits on the site background.
  const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.18 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // The desk only the phone's own camera sees.
  const desk = new THREE.Mesh(
    new THREE.PlaneGeometry(160, 160),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.8 })
  );
  desk.rotation.x = -Math.PI / 2;
  desk.position.y = -0.02;
  desk.receiveShadow = true;
  desk.layers.set(1);
  scene.add(desk);

  // The printed page.
  const paperMaterial = new THREE.MeshStandardMaterial({ map: paperTexture(), roughness: 0.95, transparent: true });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(21, 28), paperMaterial);
  paper.rotation.x = -Math.PI / 2;
  paper.receiveShadow = true;
  scene.add(paper);
  // The phone's camera always sees the page in its final place, even before it slides into the main view.
  const paperSeen = new THREE.Mesh(paper.geometry, new THREE.MeshStandardMaterial({ map: paperMaterial.map, roughness: 0.95 }));
  paperSeen.rotation.set(-Math.PI / 2, 0, THREE.MathUtils.degToRad(-5));
  paperSeen.position.set(0.2, 0.01, 0.5);
  paperSeen.receiveShadow = true;
  paperSeen.layers.set(1);
  scene.add(paperSeen);

  // ---------- Phone ----------
  const phone = new THREE.Group();
  scene.add(phone);
  const phoneModel = createPhoneModel({ PW, PH, PD, SW, SH, corner: CORNER });
  phone.add(phoneModel.group);
  phoneModel.setEnvironment(scene.environment!);

  // Screen: the real app is drawn on a canvas; the camera view shows through a hole in it.
  let uiScale = 2;
  const app = createAppScreen(UH, uiScale);
  await Promise.race([app.logoReady, new Promise((resolve) => setTimeout(resolve, 3000))]);
  const VF = app.viewfinder;
  const uiTexture = new THREE.CanvasTexture(app.canvas);
  uiTexture.colorSpace = THREE.SRGBColorSpace;
  uiTexture.anisotropy = 8;
  const screenGeometry = planarUVs(new THREE.ShapeGeometry(roundedShape(SW, SH, CORNER - 0.25), 24), SW, SH);
  const screen = new THREE.Mesh(
    screenGeometry,
    new THREE.MeshBasicMaterial({ map: uiTexture, transparent: true, toneMapped: false })
  );
  screen.position.z = PD / 2 + 0.012;
  // Drawn after the camera picture under it (both are see-through, so order them by hand)
  screen.renderOrder = 1;
  phone.add(screen);

  const target = new THREE.WebGLRenderTarget(512, Math.round((512 * VF.h) / VF.w));
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const viewfinderMaterial = new THREE.MeshBasicMaterial({ map: target.texture, toneMapped: false, transparent: true });
  const viewfinder = new THREE.Mesh(new THREE.PlaneGeometry(VF.w * DP, VF.h * DP), viewfinderMaterial);
  viewfinder.position.set((VF.x + VF.w / 2 - UW / 2) * DP, (UH / 2 - VF.y - VF.h / 2) * DP, PD / 2 + 0.008);
  phone.add(viewfinder);
  // Where the app's shutter is on the glass; the hand is slid along the phone so the thumb lands on it.
  const shutterY = (UH / 2 - (VF.y + VF.h - 14 - 32)) * DP;

  const phoneCamera = new THREE.PerspectiveCamera(90, VF.w / VF.h, 0.1, 200);
  phoneCamera.position.set(0, 0, -PD / 2 - 0.2);
  phoneCamera.layers.set(1);
  phone.add(phoneCamera);

  // ---------- Hand: holds the phone in a fixed grip; only the thumb moves ----------
  // `hand` moves with the phone; in its own space the phone sits exactly where it does in the phone's.
  // The grip was posed in Blender round a phone this size (no skin inside it), so nothing is bent here.
  const hand = new THREE.Group();
  phone.add(hand);
  let setThumb: (tap: number, tuck: number) => void = () => undefined;
  let handTextures: THREE.Texture[] = [];
  // When it leaves, the hand slides down off the phone, then away along its forearm.
  const handAway = new THREE.Vector3(0.5, -0.85, 0).normalize();
  let handTop = 4;

  // A layer just over the screen that only catches shadows, so the thumb shades the glass.
  const screenShade = new THREE.Mesh(screenGeometry, new THREE.ShadowMaterial({ opacity: 0.22 }));
  screenShade.position.z = PD / 2 + 0.02;
  screenShade.receiveShadow = true;
  screenShade.renderOrder = 2;
  phone.add(screenShade);

  try {
    const texture = (url: string) => new THREE.TextureLoader().loadAsync(url).catch(() => undefined);
    const [gltf, gloss, ao, studio] = await Promise.all([
      new GLTFLoader().loadAsync(handModelUrl),
      // The extras below make the hand and phone look more real; the scene still works without them
      texture(handGlossUrl),
      texture(handAoUrl),
      new HDRLoader().loadAsync(studioLightUrl).catch(() => undefined),
    ]);
    let light: THREE.Texture | undefined;
    if (studio) {
      studio.mapping = THREE.EquirectangularReflectionMapping;
      light = pmrem.fromEquirectangular(studio).texture;
      studio.dispose();
      phoneModel.setStudioLight(light);
    }
    const rig = createHand(gltf, hand, { gloss, ao, light });
    // The wrist turns a little (about 30 degrees) so the forearm comes from the bottom right, like your own arm.
    rig.pointForearm(new THREE.Vector3(0.49, -0.86, -0.11));
    rig.addSleeve(new THREE.MeshStandardMaterial({ color: 0x1e2b4a, roughness: 0.85 }));
    handAway.copy(rig.forearmDirection()).setZ(0).normalize();
    // How far up the phone the hand reaches (its highest finger joint, plus the rest of that finger)
    phone.updateMatrixWorld(true);
    handTop = Math.max(
      ...['thumb', 'index', 'middle', 'ring', 'pinky'].map((f) => {
        const bone = gltf.scene.getObjectByName(`${f}_03_r`);
        return bone ? phone.worldToLocal(bone.getWorldPosition(new THREE.Vector3())).y : -Infinity;
      })
    ) + 3;
    setThumb = rig.setThumb;
    handTextures = rig.textures;
  } catch (error) {
    // Without the hand model the scene still works; the phone simply floats.
    console.warn('Hand model not shown:', error);
  }

  // ---------- Camera that films the whole scene ----------
  const camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(15));
  // Skin gets filmic tone mapping (AgX, as in the Blender renders) so its shading and colour hold up in
  // bright light; everything else keeps its exact current look by opting out.
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  scene.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) if (!m.userData.hand) m.toneMapped = false;
  });
  // Prepare the hand's shaders and upload its textures now, so its first appearance doesn't stall a frame.
  handTextures.forEach((t) => renderer.initTexture(t));
  renderer.compile(scene, camera);

  const baseFaceUp = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const eulerQ = (x: number, y: number, z: number) =>
    new THREE.Quaternion().setFromEuler(new THREE.Euler(THREE.MathUtils.degToRad(x), THREE.MathUtils.degToRad(y), THREE.MathUtils.degToRad(z), 'YXZ'));

  type Shot = { target: THREE.Vector3; polar: number; azimuth: number; dist: number; fx: number; fy: number };
  let shots: { hero: Shot; over: Shot; zoom: Shot } | null = null;
  let frame: Frame | null = null;

  const HERO_POLAR = 64;
  const heroPhoneQ = eulerQ(0, -24, 0).multiply(eulerQ(HERO_POLAR * 0.9, 0, 6)).multiply(baseFaceUp);
  const overPhoneQ = eulerQ(0, -6, 0).multiply(baseFaceUp);
  const zoomPhoneQ = baseFaceUp.clone();
  const heroPos = new THREE.Vector3(0, 16, 6);
  const LOW = 8.5;
  const HIGH = 23;

  const fitHeight = (size: number, px: number, H: number) => size / (2 * tanHalf * (px / H));
  const fitWidth = (size: number, px: number, W: number, H: number) => size / (2 * tanHalf * (W / H) * (px / W));

  const resize = (next: Frame) => {
    frame = next;
    const { W, H, hero, main } = next;
    renderer.setSize(W, H, false);
    // Screen texture: as many pixels as the screen covers when it fills the view at the end
    const screenPx = Math.min(main.h * 0.97, main.w * 0.97 * (SH / SW)) * renderer.getPixelRatio();
    const scale = clamp(screenPx / UH, 1, 3);
    if (Math.abs(scale - uiScale) / uiScale > 0.05) {
      uiScale = scale;
      app.setScale(scale);
      uiTexture.dispose();
      lastKey = '';
    }
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    shots = {
      hero: {
        target: heroPos.clone(),
        polar: HERO_POLAR,
        azimuth: -6,
        dist: Math.max(fitHeight(PH, hero.h * 0.86, H), fitWidth(PW * 1.25, hero.w * 0.8, W, H)),
        fx: hero.x + hero.w / 2,
        fy: hero.y + hero.h / 2,
      },
      over: {
        target: new THREE.Vector3(0, 6, 0.5),
        polar: 34,
        azimuth: -10,
        dist: Math.max(fitHeight(27, main.h, H), fitWidth(19, main.w, W, H)),
        fx: main.x + main.w / 2,
        fy: main.y + main.h / 2,
      },
      zoom: {
        target: new THREE.Vector3(0, HIGH + PD / 2, 0),
        polar: 0.01,
        azimuth: 0,
        dist: Math.max(fitHeight(SH, main.h * 0.97, H), fitWidth(SW, main.w * 0.97, W, H)),
        fx: main.x + main.w / 2,
        fy: main.y + main.h / 2,
      },
    };
  };

  const mixShot = (a: Shot, b: Shot, t: number): Shot => ({
    target: a.target.clone().lerp(b.target, t),
    polar: mix(a.polar, b.polar, t),
    azimuth: mix(a.azimuth, b.azimuth, t),
    dist: mix(a.dist, b.dist, t),
    fx: mix(a.fx, b.fx, t),
    fy: mix(a.fy, b.fy, t),
  });

  const upA = new THREE.Vector3(0, 1, 0);
  const upB = new THREE.Vector3(0, 0, -1);
  const applyShot = (s: Shot) => {
    const polar = THREE.MathUtils.degToRad(s.polar);
    const az = THREE.MathUtils.degToRad(s.azimuth);
    camera.position.set(
      s.target.x + s.dist * Math.sin(polar) * Math.sin(az),
      s.target.y + s.dist * Math.cos(polar),
      s.target.z + s.dist * Math.sin(polar) * Math.cos(az)
    );
    camera.up.copy(upA).lerp(upB, 1 - ease(clamp(s.polar / 30))).normalize();
    camera.lookAt(s.target);
    const { W, H } = frame!;
    camera.setViewOffset(W, H, W / 2 - s.fx, H / 2 - s.fy, W, H);
  };

  // ---------- Drawing the app on the phone screen ----------
  let lastKey = '';
  // Page corners in the page's own flat plane.
  const corners = [new THREE.Vector3(-10.5, 14, 0), new THREE.Vector3(10.5, 14, 0), new THREE.Vector3(10.5, -14, 0), new THREE.Vector3(-10.5, -14, 0)];
  const paragraphs = [TITLE_WORDS, BODY_WORDS];

  const drawUI = (s: AppState) => {
    // Only redraw (and re-upload) the screen when something on it visibly changes.
    const key = JSON.stringify([
      s.reader.toFixed(2), s.guide, s.outline?.map((q) => [q.x.toFixed(3), q.y.toFixed(3)]), s.tap.toFixed(2),
      s.flash.toFixed(1), s.scan.toFixed(2), s.scanProgress.toFixed(2), s.word, s.read.toFixed(3), text.camera, text.found,
    ]);
    if (key === lastKey) return;
    lastKey = key;
    app.draw(s, text, paragraphs);
    uiTexture.needsUpdate = true;
  };

  // ---------- One frame for a scroll position p in [0, 1] ----------
  const ndc = new THREE.Vector3();
  let lastReady = false;
  let lastInside = 0;
  let lastGuide: AppState['guide'] = 'search';
  let lastOutline: AppState['outline'] = null;
  const render = (p: number) => {
    if (!shots || !frame) return;

    const toPage = ease(seg(p, 0.03, 0.18));
    const lift = ease(seg(p, 0.2, 0.31));
    const zoom = ease(seg(p, 0.52, 0.7));
    const hover = clamp(toPage - zoom);

    // Camera: follows the phone up as it is lifted, so it never leaves the frame.
    const over = { ...shots.over, target: shots.over.target.clone().setY(mix(shots.over.target.y, 14, lift)) };
    const shot = mixShot(mixShot(shots.hero, over, toPage), shots.zoom, zoom);
    applyShot(shot);

    // Phone
    const height = mix(LOW, HIGH, lift);
    const overPos = new THREE.Vector3(0, height, 0.5);
    const zoomPos = new THREE.Vector3(0, HIGH, 0);
    phone.position.copy(heroPos).lerp(overPos, toPage).lerp(zoomPos, zoom);
    phone.quaternion.copy(heroPhoneQ).slerp(overPhoneQ, toPage).slerp(zoomPhoneQ, zoom);
    // The hand steadies once the app says the whole page is in view.
    const settle = 1 - seg(p, 0.29, 0.33) * 0.85;
    const sway = Math.sin(p * 44) * hover * settle;
    phone.position.x += sway * 0.35;
    phone.position.z += Math.cos(p * 31) * hover * settle * 0.3;
    phone.rotateZ(sway * 0.025);
    phone.rotateX(Math.cos(p * 29) * hover * settle * 0.02);
    // Gentle turn while the hero is on screen
    phone.rotateY((1 - toPage) * Math.sin(p * 30) * 0.03);

    // Page slides in under the phone, then fades as we zoom in.
    const pageIn = ease(seg(p, 0.04, 0.18));
    paper.position.set(0.2, 0.01, mix(48, 0.5, pageIn));
    paper.rotation.z = THREE.MathUtils.degToRad(-5);
    paper.visible = pageIn > 0;
    paperMaterial.opacity = 1 - ease(seg(p, 0.6, 0.68));
    // Shadows only once the phone is over the page; in the opening view it floats like a picture.
    groundMaterial.opacity = 0.18 * toPage * (1 - ease(seg(p, 0.58, 0.68)));

    // Hand comes up with the phone and leaves after the photo.
    const handIn = ease(seg(p, 0.08, 0.2));
    const handOut = ease(seg(p, 0.44, 0.54));
    // Leaving: the hand slides straight down the phone and off its bottom edge, keeping its grip shape
    // (fingers glide down the left edge, the thumb above the glass, the palm down the back; the phone
    // only narrows towards its bottom corners, so nothing can pass through it), then carries on away
    // along the forearm. Arriving is the reverse. The thumb stays in its relaxed hover curve throughout.
    const leave = Math.max(1 - handIn, handOut);
    const shift = shutterY - GRIP_SHUTTER_Y;
    const slide = handTop + shift + PH / 2 + 1;
    hand.position.copy(handAway).multiplyScalar(30 * ease(clamp((leave - 0.5) / 0.5)));
    hand.position.y += shift - slide * ease(clamp(leave / 0.55));
    hand.visible = handIn > 0 && handOut < 1;
    screenShade.visible = hand.visible;

    // Thumb: small, natural motion only. `tap` curls the joints down onto the shutter; `thumbLift` eases
    // it a little towards its resting pose (at most a fifth of the way, so it never splays out).
    const tap = ease(seg(p, 0.36, 0.385)) * (1 - ease(seg(p, 0.395, 0.415)));
    const thumbLift =
      0.2 * ease(clamp(leave / 0.25)) + // relaxed while the hand slides on and off the phone
      0.035 * (0.5 - 0.5 * Math.cos(p * 120)) * seg(p, 0.2, 0.24) * (1 - seg(p, 0.31, 0.335)) + // idle, while holding
      0.12 * ease(seg(p, 0.335, 0.35)) * (1 - ease(seg(p, 0.35, 0.36))) + // a small wind-up before the press
      0.1 * ease(seg(p, 0.415, 0.425)) * (1 - ease(seg(p, 0.425, 0.445))); // and a little rebound after it
    setThumb(tap, tap > 0 ? 0 : thumbLift);

    scene.updateMatrixWorld();
    renderer.shadowMap.needsUpdate = true;

    // The phone's own camera: does the whole page fit? Frozen once the photo is taken. Like the app, it
    // asks to point at the page when none is seen, to lift higher when the page doesn't fit, and outlines
    // the page in red once all four corners are in view.
    let ready = lastReady;
    if (p < 0.39) {
      let inside = 0;
      const points: { x: number; y: number }[] = [];
      for (const corner of corners) {
        ndc.copy(corner).applyMatrix4(paperSeen.matrixWorld).project(phoneCamera);
        if (Math.abs(ndc.x) < 0.99 && Math.abs(ndc.y) < 0.99 && ndc.z < 1) inside++;
        points.push({ x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2 });
      }
      ndc.set(0, 0, 0).applyMatrix4(paperSeen.matrixWorld).project(phoneCamera);
      const seen = inside > 0 || (Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 && ndc.z < 1);
      ready = inside === 4;
      lastReady = ready;
      lastInside = inside;
      lastGuide = ready ? 'found' : seen && pageIn > 0.5 ? 'further' : 'search';
      lastOutline = ready ? points : null;
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x4a321f, 1);
      renderer.render(scene, phoneCamera);
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
    }

    const reader = ease(seg(p, 0.55, 0.6));
    viewfinderMaterial.opacity = clamp(1 - reader * 2);
    viewfinder.visible = reader < 0.5;
    const read = seg(p, 0.7, 0.95);
    const word = read > 0 ? Math.min(Math.floor(read * WORDS.length), WORDS.length - 1) : -1;
    // The glass reflects the room, less so once the screen fills the view and must read clearly.
    phoneModel.setGlare(0.1 * (1 - ease(seg(p, 0.5, 0.6))));
    drawUI({
      reader,
      guide: lastGuide,
      outline: lastOutline,
      tap,
      flash: seg(p, 0.385, 0.39) * (1 - seg(p, 0.395, 0.41)),
      scan: seg(p, 0.41, 0.43) * (1 - seg(p, 0.55, 0.58)),
      scanProgress: seg(p, 0.42, 0.53),
      word,
      // The player moves word by word, so the screen only changes when the highlight does.
      read: read >= 1 ? 1 : (word + 1) / WORDS.length,
    });

    renderer.render(scene, camera);
    return { ready, inside: lastInside };
  };

  // Prepare all shaders up front, so the first scroll does not stutter.
  renderer.compile(scene, camera);
  // Dev server only: lets the check scripts look at the phone from any side.
  if (import.meta.env.DEV) Object.assign(window, { __phoneScene: { scene, camera, renderer, phone } });

  return {
    resize,
    render,
    setText(next: SceneText) {
      text = next;
      lastKey = '';
    },
    dispose() {
      renderer.dispose();
      target.dispose();
      pmrem.dispose();
    },
  };
}
