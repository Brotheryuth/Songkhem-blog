// The features section's 3D stage: the same phone as the hero, running the real app, floating over a glossy
// floor. Scrolling turns it to each feature in turn, and each one has its own small scene round it:
//   1. Scanner: a Khmer page on the floor, the phone's view of it, a scan light and corner marks.
//   2. Reader: the words being read float out of the screen, lit yellow as they are spoken; sound rings.
//   3. Upload: photos and PDFs circle the phone and drop into the app one at a time.
// It animates on its own while on screen (time) and moves between features with scroll (progress).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { UW, createAppScreen, loadAppFonts, type AppState, type AppText } from './app-screen';
import { createPhoneModel, roundedShape } from './phone-model';
import { BODY_WORDS, KHMER, TITLE_WORDS, WORDS } from './scene-words';

export type FeatureText = AppText;
export type FeatureTheme = 'light' | 'dark';
/** Where the subject goes (CSS pixels inside the canvas): its centre and its height. */
export type FeatureLayout = { W: number; H: number; cx: number; cy: number; size: number };

const studioLightUrl = '/models/light/studio.hdr';

// The phone, in centimetres (the same phone as the hero's)
const PW = 7.4;
const PH = 15.4;
const PD = 0.85;
const CORNER = 1.0;
const SW = 6.9;
const SH = 14.96;
const UH = Math.round((UW * SH) / SW);
const DP = SW / UW;

const BLUE = 0x4466f6;
const YELLOW = 0xfef08a;

const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b);
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const rad = THREE.MathUtils.degToRad;

function canvasTexture(c: HTMLCanvasElement) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

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

/** A small printed page (A5) with the folk tale on it. */
function pageTexture() {
  const c = document.createElement('canvas');
  c.width = 888;
  c.height = 1260;
  const x = c.getContext('2d')!;
  x.fillStyle = '#FBF8EF';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#1B1B1B';
  x.font = `700 52px ${KHMER}`;
  x.textAlign = 'center';
  x.fillText(TITLE_WORDS.join(''), c.width / 2, 150);
  x.textAlign = 'left';
  x.font = `400 38px ${KHMER}`;
  let line = '';
  let y = 260;
  for (const w of BODY_WORDS) {
    if (line && x.measureText(line + w).width > c.width - 150) {
      x.fillText(line, 75, y);
      line = '';
      y += 84;
    }
    line += w;
  }
  x.fillText(line, 75, y);
  return canvasTexture(c);
}

/** The table the phone's own camera sees round the page. */
function tableTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(110, 90, 20, 128, 128, 210);
  g.addColorStop(0, '#9A7351');
  g.addColorStop(1, '#5A3D27');
  x.fillStyle = g;
  x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {
    x.fillStyle = `rgba(40, 24, 12, ${0.05 + 0.1 * Math.abs(Math.sin(i * 0.37) * Math.sin(i * 0.051))})`;
    x.fillRect(i, 0, 1, 256);
  }
  return canvasTexture(c);
}

/** One floating word: white glyphs (tinted by the material), sized to the word. */
function wordTexture(word: string) {
  const c = document.createElement('canvas');
  const x = c.getContext('2d')!;
  const font = '400 72px "Suwannaphum", "Noto Sans Khmer", serif';
  x.font = font;
  c.width = Math.ceil(x.measureText(word).width + 36);
  c.height = 120;
  x.font = font;
  x.fillStyle = '#FFFFFF';
  x.textBaseline = 'middle';
  x.fillText(word, 18, 62);
  return { texture: canvasTexture(c), aspect: c.width / c.height };
}

/** A file card for the upload scene: a type badge and a preview (a photo, or lines of a document). */
function fileCard(kind: 'JPG' | 'PNG' | 'PDF' | 'WEBP') {
  const c = document.createElement('canvas');
  c.width = 360;
  c.height = 460;
  const x = c.getContext('2d')!;
  x.fillStyle = '#FFFFFF';
  x.beginPath();
  x.roundRect(4, 4, 352, 452, 30);
  x.fill();
  x.strokeStyle = '#E2E8F0';
  x.lineWidth = 4;
  x.stroke();
  const tint = { JPG: '#4466F6', PNG: '#0E9F6E', PDF: '#E02424', WEBP: '#7E3AF2' }[kind];
  // Preview
  x.save();
  x.beginPath();
  x.roundRect(28, 28, 304, 300, 18);
  x.clip();
  if (kind === 'JPG' || kind === 'PNG') {
    const sky = x.createLinearGradient(0, 28, 0, 328);
    sky.addColorStop(0, kind === 'JPG' ? '#BFDBFE' : '#FDE68A');
    sky.addColorStop(1, kind === 'JPG' ? '#EFF6FF' : '#FEF3C7');
    x.fillStyle = sky;
    x.fillRect(28, 28, 304, 300);
    x.fillStyle = kind === 'JPG' ? '#FBBF24' : '#F97316';
    x.beginPath();
    x.arc(250, 100, 30, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = kind === 'JPG' ? '#3B82F6' : '#10B981';
    x.beginPath();
    x.moveTo(28, 328);
    x.lineTo(130, 170);
    x.lineTo(200, 260);
    x.lineTo(250, 210);
    x.lineTo(332, 328);
    x.fill();
  } else {
    x.fillStyle = '#F8FAFC';
    x.fillRect(28, 28, 304, 300);
    x.fillStyle = '#0F172A';
    x.font = `700 34px ${KHMER}`;
    x.fillText(kind === 'PDF' ? 'សេចក្តីជូនដំណឹង' : 'ព័ត៌មានគ្លីនិក', 48, 84);
    x.fillStyle = '#CBD5E1';
    for (let i = 0; i < 6; i++) x.fillRect(48, 120 + i * 32, i === 5 ? 140 : 264 - (i % 2) * 30, 12);
  }
  x.restore();
  // Badge
  x.fillStyle = tint;
  x.beginPath();
  x.roundRect(28, 356, 120, 64, 32);
  x.fill();
  x.fillStyle = '#FFFFFF';
  x.font = '700 32px "Roboto", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(kind, 88, 389);
  x.fillStyle = '#CBD5E1';
  x.fillRect(172, 372, 150, 12);
  x.fillRect(172, 396, 100, 12);
  return canvasTexture(c);
}

/** A soft round shadow for under the phone. */
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

/** A band of light for the scan sweep (bright in the middle, fading both ways). */
function sweepTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 128;
  const x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(c);
}

// A wet, glossy floor: a soft reflection that fades out with distance, and a faint grid.
const FloorShader = {
  name: 'FeatureFloor',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uStrength: { value: 0.4 },
    uLine: { value: new THREE.Color() },
    uLineAlpha: { value: 0.1 },
    uTime: { value: 0 },
    uRadius: { value: 70 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vPos;
    void main() {
      vUv = textureMatrix * vec4( position, 1.0 );
      vPos = position.xy;
      gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform vec3 uLine;
    uniform float uLineAlpha;
    uniform float uTime;
    uniform float uRadius;
    varying vec4 vUv;
    varying vec2 vPos;
    void main() {
      vec2 uv = vUv.xy / vUv.w;
      // a slow ripple, as on a thin film of water
      uv += vec2( sin( vPos.y * 0.9 + uTime * 0.6 ), cos( vPos.x * 0.7 - uTime * 0.5 ) ) * 0.0012;
      float b = 0.004;
      vec4 r = texture2D( tDiffuse, uv ) * 0.36
        + texture2D( tDiffuse, uv + vec2( b, 0.0 ) ) * 0.16 + texture2D( tDiffuse, uv - vec2( b, 0.0 ) ) * 0.16
        + texture2D( tDiffuse, uv + vec2( 0.0, b ) ) * 0.16 + texture2D( tDiffuse, uv - vec2( 0.0, b ) ) * 0.16;
      vec3 rgb = r.rgb / max( r.a, 1e-4 );
      float fade = 1.0 - smoothstep( uRadius * 0.12, uRadius, length( vPos ) );
      vec2 cell = vPos / 5.0;
      vec2 g = abs( fract( cell - 0.5 ) - 0.5 ) / fwidth( cell );
      float line = ( 1.0 - min( min( g.x, g.y ), 1.0 ) ) * uLineAlpha * fade;
      float a = r.a * uStrength * fade;
      float outA = a + line * ( 1.0 - a );
      gl_FragColor = vec4( ( rgb * a + uLine * line * ( 1.0 - a ) ) / max( outA, 1e-4 ), outA );
      #include <colorspace_fragment>
    }`,
};

export async function createFeatureScene(canvas: HTMLCanvasElement, initialText: FeatureText, initialTheme: FeatureTheme) {
  await loadAppFonts([`400 20px ${KHMER}`, `700 20px ${KHMER}`]);
  let text = initialText;
  let theme = initialTheme;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;

  // A key light that drifts slowly round the phone, so its edges catch light as it turns
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.layers.enable(1);
  scene.add(key);
  const fill = new THREE.HemisphereLight(0xffffff, 0xd9d2c5, 0.6);
  fill.layers.enable(1);
  scene.add(fill);

  // ---------- Floor ----------
  const floor = new Reflector(new THREE.PlaneGeometry(200, 200), {
    shader: FloorShader,
    textureWidth: 512,
    textureHeight: 512,
    clipBias: 0.003,
    multisample: 0,
  });
  floor.rotation.x = -Math.PI / 2;
  const floorMaterial = floor.material as THREE.ShaderMaterial;
  floorMaterial.transparent = true;
  floorMaterial.depthWrite = false;
  scene.add(floor);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: blobTexture(), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  scene.add(shadow);

  // ---------- Phone ----------
  const phone = new THREE.Group();
  scene.add(phone);
  const phoneModel = createPhoneModel({ PW, PH, PD, SW, SH, corner: CORNER });
  phone.add(phoneModel.group);
  phoneModel.setEnvironment(scene.environment!);
  phoneModel.setGlare(0.06);

  let uiScale = 2;
  const app = createAppScreen(UH, uiScale);
  await Promise.race([app.logoReady, new Promise((resolve) => setTimeout(resolve, 3000))]);
  const VF = app.viewfinder;
  let uiTexture = canvasTexture(app.canvas);
  const screenMaterial = new THREE.MeshBasicMaterial({ map: uiTexture, transparent: true, toneMapped: false });
  const screen = new THREE.Mesh(planarUVs(new THREE.ShapeGeometry(roundedShape(SW, SH, CORNER - 0.25), 24), SW, SH), screenMaterial);
  screen.position.z = PD / 2 + 0.012;
  screen.renderOrder = 1;
  phone.add(screen);

  // The camera picture under the app's viewfinder: what the phone's back camera sees
  const target = new THREE.WebGLRenderTarget(512, Math.round((512 * VF.h) / VF.w));
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const viewfinder = new THREE.Mesh(
    new THREE.PlaneGeometry(VF.w * DP, VF.h * DP),
    new THREE.MeshBasicMaterial({ map: target.texture, toneMapped: false })
  );
  viewfinder.position.set((VF.x + VF.w / 2 - UW / 2) * DP, (UH / 2 - VF.y - VF.h / 2) * DP, PD / 2 + 0.008);
  phone.add(viewfinder);
  const phoneCamera = new THREE.PerspectiveCamera(92, VF.w / VF.h, 0.1, 200);
  phoneCamera.position.set(0, 0, -PD / 2 - 0.2); // looks out of the back (-z)
  phoneCamera.layers.set(1);
  phone.add(phoneCamera);

  // ---------- 1. Scanner: the page, the table round it (phone camera only), the scan light ----------
  const scanGroup = new THREE.Group();
  scene.add(scanGroup);
  const PAGE_W = 14.8;
  const PAGE_H = 21;
  const pageMaterial = new THREE.MeshStandardMaterial({ map: pageTexture(), roughness: 0.95, transparent: true });
  const page = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H), pageMaterial);
  page.rotation.x = -Math.PI / 2;
  page.position.y = 0.04;
  page.layers.enable(1);
  scanGroup.add(page);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map: tableTexture(), roughness: 0.85 }));
  table.rotation.x = -Math.PI / 2;
  table.layers.set(1);
  scanGroup.add(table);

  const blueLine = new THREE.LineBasicMaterial({ color: BLUE, transparent: true, depthWrite: false, toneMapped: false });
  const cone = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3)), blueLine);
  cone.frustumCulled = false;
  scanGroup.add(cone);
  const coneFaces = new THREE.Mesh(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3)),
    new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })
  );
  coneFaces.frustumCulled = false;
  scanGroup.add(coneFaces);
  const sweepMaterial = new THREE.MeshBasicMaterial({
    map: sweepTexture(), color: BLUE, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.NormalBlending,
  });
  const sweep = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W + 0.6, 2.4), sweepMaterial);
  sweep.rotation.x = -Math.PI / 2;
  scanGroup.add(sweep);
  // Corner marks: an L at each corner of the page
  const markMaterial = new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, toneMapped: false, depthWrite: false });
  const marks = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sz]) => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.28), markMaterial);
    a.position.set((-sx * 2.2) / 2 + sx * 0.14, 0, 0);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 2.2), markMaterial);
    b.position.set(0, (sz * -2.2) / 2 + sz * 0.14, 0);
    g.add(a, b);
    g.rotation.x = -Math.PI / 2;
    g.userData.corner = new THREE.Vector3((sx * PAGE_W) / 2, 0.06, (-sz * PAGE_H) / 2);
    scanGroup.add(g);
    return g;
  });

  // ---------- 2. Reader: words that float out of the screen, and sound rings ----------
  const readGroup = new THREE.Group();
  scene.add(readGroup);
  const wordCache = new Map<string, { texture: THREE.Texture; aspect: number }>();
  const wordTex = (w: string) => {
    let t = wordCache.get(w);
    if (!t) wordCache.set(w, (t = wordTexture(w)));
    return t;
  };
  type Flyer = { mesh: THREE.Mesh; plate: THREE.Mesh; born: number; from: THREE.Vector3; via: THREE.Vector3; to: THREE.Vector3 };
  const WORD_H = 1.25;
  const flyers: Flyer[] = Array.from({ length: 9 }, () => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false })
    );
    const plate = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ color: YELLOW, transparent: true, depthWrite: false, toneMapped: false })
    );
    plate.position.z = -0.01;
    plate.renderOrder = 3;
    mesh.renderOrder = 4;
    mesh.add(plate);
    mesh.visible = false;
    readGroup.add(mesh);
    return { mesh, plate, born: -99, from: new THREE.Vector3(), via: new THREE.Vector3(), to: new THREE.Vector3() };
  });
  let nextFlyer = 0;
  let lastSpoken = -1;
  // Sound: ripples spreading over the wet floor under the phone while it reads aloud
  const rings = Array.from({ length: 4 }, () => {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.97, 1, 128),
      new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, depthWrite: false, toneMapped: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.05;
    readGroup.add(m);
    return m;
  });

  // ---------- 3. Upload: file cards circling, dropping into the app one by one ----------
  const upGroup = new THREE.Group();
  scene.add(upGroup);
  const cards = (['JPG', 'PDF', 'PNG', 'WEBP'] as const).map((kind) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(4.0, (4.0 * 460) / 360),
      new THREE.MeshBasicMaterial({ map: fileCard(kind), transparent: true, side: THREE.DoubleSide, toneMapped: false })
    );
    upGroup.add(m);
    return m;
  });
  const landing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1, 96),
    new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, depthWrite: false, toneMapped: false })
  );
  landing.position.set(0, (UH / 2 - 270) * DP, PD / 2 + 0.06);
  landing.renderOrder = 5;
  phone.add(landing);
  const CARD_EVERY = 2.6;
  const CARD_FLIGHT = 1.15;

  // Things lying on the floor or drawn as light (scan cone, sweep, marks, ripples, shadow) stay out of the
  // reflection: mirrored, they read as stray shapes under the floor
  const unreflected: THREE.Object3D[] = [cone, coneFaces, sweep, ...marks, ...rings, shadow];
  const reflect = floor.onBeforeRender.bind(floor);
  floor.onBeforeRender = (...args: Parameters<typeof floor.onBeforeRender>) => {
    const shown = unreflected.map((o) => o.visible);
    unreflected.forEach((o) => (o.visible = false));
    reflect(...args);
    unreflected.forEach((o, i) => (o.visible = shown[i]));
  };

  // ---------- Look ----------
  scene.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) m.toneMapped = false;
  });
  const applyTheme = () => {
    const dark = theme === 'dark';
    const u = floorMaterial.uniforms;
    u.uStrength.value = dark ? 0.5 : 0.32;
    u.uLine.value.set(dark ? 0xffffff : 0x0f172a);
    u.uLineAlpha.value = dark ? 0.07 : 0.06;
    (shadow.material as THREE.MeshBasicMaterial).opacity = dark ? 0.9 : 0.55;
    blueLine.color.set(dark ? 0xa8c7fa : BLUE);
    sweepMaterial.color.set(dark ? 0xa8c7fa : BLUE);
    markMaterial.color.set(dark ? 0xa8c7fa : BLUE);
  };
  applyTheme();

  // Studio light for the phone's metal and glass (optional; the room light is used meanwhile)
  new HDRLoader()
    .loadAsync(studioLightUrl)
    .then((hdr) => {
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      phoneModel.setStudioLight(pmrem.fromEquirectangular(hdr).texture);
      hdr.dispose();
    })
    .catch(() => undefined);

  // ---------- Poses for each feature ----------
  const q = (x: number, y: number, z: number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(rad(x), rad(y), rad(z), 'YXZ'));
  const poses = [
    { pos: new THREE.Vector3(0, 15, 1), rot: q(-58, -8, 0) }, // looking down at the page, screen up to us
    { pos: new THREE.Vector3(0, 9.6, 0), rot: q(-6, -20, 2) }, // upright, turned a little to the left
    { pos: new THREE.Vector3(0, 9.6, 0), rot: q(-6, 20, -2) }, // upright, turned the other way
  ];
  // Put the page where the phone's camera looks in the scanner pose
  {
    phone.position.copy(poses[0].pos);
    phone.quaternion.copy(poses[0].rot);
    phone.updateMatrixWorld(true);
    const origin = phoneCamera.getWorldPosition(new THREE.Vector3());
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(phoneCamera.getWorldQuaternion(new THREE.Quaternion()));
    const hit = origin.clone().addScaledVector(dir, -origin.y / dir.y);
    // Slide the page along the view the least distance that puts all four corners inside the picture
    // with a little room, so the app outlines it (and says the photo is good) in this pose
    const ahead = new THREE.Vector3(dir.x, 0, dir.z).normalize();
    phoneCamera.updateMatrixWorld(true);
    phoneCamera.updateProjectionMatrix();
    let best = -Infinity;
    let bestAt = 0;
    for (let d = -10; d <= 10; d += 0.25) {
      let room = Infinity;
      for (const c of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const v = new THREE.Vector3(hit.x + ahead.x * d + (c[0] * PAGE_W) / 2, 0.04, hit.z + ahead.z * d + (c[1] * PAGE_H) / 2).project(phoneCamera);
        room = Math.min(room, 1 - Math.abs(v.x), 1 - Math.abs(v.y), v.z < 1 ? 1 : -1);
      }
      const fits = room >= 0.06;
      if ((fits && (best < 0.06 || Math.abs(d) < Math.abs(bestAt))) || (!fits && best < 0.06 && room > best)) {
        best = room;
        bestAt = d;
      }
    }
    scanGroup.position.set(hit.x + ahead.x * bestAt, 0, hit.z + ahead.z * bestAt);
    if (import.meta.env.DEV) console.debug('features: page room in the phone camera', best.toFixed(3), 'at', bestAt);
  }

  // ---------- Camera ----------
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 800);
  const lookAt = new THREE.Vector3(0, 9, -1);
  let layout: FeatureLayout | null = null;
  let dist = 80;
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  const SUBJECT = 28; // cm of scene height to fit in layout.size

  const resize = (next: FeatureLayout) => {
    layout = next;
    renderer.setSize(next.W, next.H, false);
    camera.aspect = next.W / next.H;
    camera.updateProjectionMatrix();
    dist = SUBJECT / (2 * Math.tan(rad(15)) * (next.size / next.H));
    const ratio = renderer.getPixelRatio();
    floor.getRenderTarget().setSize(Math.round(next.W * ratio * 0.5), Math.round(next.H * ratio * 0.5));
    // Screen texture: about as many pixels as the screen covers
    const screenPx = (next.size * (SH / SUBJECT)) * ratio;
    const scale = clamp(screenPx / UH, 1, 2.5);
    if (Math.abs(scale - uiScale) / uiScale > 0.05) {
      uiScale = scale;
      app.setScale(scale);
      uiTexture.dispose();
      uiTexture = canvasTexture(app.canvas);
      screenMaterial.map = uiTexture;
      lastKey = '';
    }
  };

  // ---------- The app on the screen ----------
  let lastKey = '';
  const paragraphs = [TITLE_WORDS, BODY_WORDS];
  const drawUI = (s: AppState) => {
    const k = JSON.stringify([s.screen, s.reader.toFixed(2), s.guide, s.outline?.map((o) => [o.x.toFixed(3), o.y.toFixed(3)]), s.word, s.read.toFixed(3), (s.press ?? 0).toFixed(2), text.camera, text.upTitle]);
    if (k === lastKey) return;
    lastKey = k;
    app.draw(s, text, paragraphs);
    uiTexture.needsUpdate = true;
  };

  // ---------- A frame ----------
  let progress = 0;
  const corners = [
    new THREE.Vector3(-PAGE_W / 2, 0.04, -PAGE_H / 2), new THREE.Vector3(PAGE_W / 2, 0.04, -PAGE_H / 2),
    new THREE.Vector3(PAGE_W / 2, 0.04, PAGE_H / 2), new THREE.Vector3(-PAGE_W / 2, 0.04, PAGE_H / 2),
  ];
  const tmp = new THREE.Vector3();
  const ndc = new THREE.Vector3();
  const lens = new THREE.Vector3();
  const camQ = new THREE.Quaternion();

  const render = (time: number) => {
    if (!layout) return;
    const p = progress;
    // How much of each feature is showing (they hand over in the gaps between)
    const t12 = ease(seg(p, 0.27, 0.4));
    const t23 = ease(seg(p, 0.6, 0.73));
    const w1 = 1 - t12;
    const w2 = t12 * (1 - t23);
    const w3 = t23;

    // Phone: between poses, with a slow float
    const pos = poses[0].pos.clone().lerp(poses[1].pos, t12).lerp(poses[2].pos, t23);
    const rot = poses[0].rot.clone().slerp(poses[1].rot, t12).slerp(poses[2].rot, t23);
    phone.position.copy(pos);
    phone.position.y += Math.sin(time * 0.9) * 0.25 * (1 - w1 * 0.7);
    phone.quaternion.copy(rot);
    phone.rotateY(Math.sin(time * 0.5) * 0.03);
    phone.rotateX(Math.cos(time * 0.4) * 0.015);

    // Camera: a little parallax with the pointer
    pointer.sx += (pointer.x - pointer.sx) * 0.06;
    pointer.sy += (pointer.y - pointer.sy) * 0.06;
    const az = rad(-4 + pointer.sx * 5);
    const el = rad(14 - pointer.sy * 3);
    camera.position.set(
      lookAt.x + dist * Math.cos(el) * Math.sin(az),
      lookAt.y + dist * Math.sin(el),
      lookAt.z + dist * Math.cos(el) * Math.cos(az)
    );
    camera.lookAt(lookAt);
    camera.setViewOffset(layout.W, layout.H, layout.W / 2 - layout.cx, layout.H / 2 - layout.cy, layout.W, layout.H);

    // Light drifts
    key.position.set(Math.cos(time * 0.15) * 30, 40, 22 + Math.sin(time * 0.15) * 14);
    floorMaterial.uniforms.uTime.value = time;

    // Soft shadow under the phone, smaller and darker as it comes down
    shadow.position.set(phone.position.x, 0.02, phone.position.z);
    const sh = phone.position.y;
    shadow.scale.set(12 + sh * 0.4, 8 + sh * 0.25, 1);

    scene.updateMatrixWorld();

    // ----- 1. Scanner -----
    // The page and the scan light clear away early in the handover, before the phone comes down
    const scanShown = 1 - ease(seg(t12, 0, 0.45));
    scanGroup.visible = scanShown > 0.002;
    pageMaterial.opacity = scanShown;
    scanGroup.position.y = -2 * (1 - scanShown);
    let outline: AppState['outline'] = null;
    let guide: AppState['guide'] = 'further';
    if (scanGroup.visible) {
      phoneCamera.getWorldPosition(lens);
      const pts: { x: number; y: number }[] = [];
      let inside = 0;
      const line = cone.geometry.attributes.position as THREE.BufferAttribute;
      const faces = coneFaces.geometry.attributes.position as THREE.BufferAttribute;
      corners.forEach((c, i) => {
        tmp.copy(c).applyMatrix4(scanGroup.matrixWorld);
        line.setXYZ(i * 2, lens.x, lens.y, lens.z);
        line.setXYZ(i * 2 + 1, tmp.x, tmp.y, tmp.z);
        ndc.copy(tmp).project(phoneCamera);
        if (Math.abs(ndc.x) < 0.99 && Math.abs(ndc.y) < 0.99 && ndc.z < 1) inside++;
        pts.push({ x: (ndc.x + 1) / 2, y: (1 - ndc.y) / 2 });
      });
      for (let i = 0; i < 4; i++) {
        const a = i * 2 + 1;
        const b = ((i + 1) % 4) * 2 + 1;
        faces.setXYZ(i * 3, lens.x, lens.y, lens.z);
        faces.setXYZ(i * 3 + 1, line.getX(a), line.getY(a), line.getZ(a));
        faces.setXYZ(i * 3 + 2, line.getX(b), line.getY(b), line.getZ(b));
      }
      line.needsUpdate = true;
      faces.needsUpdate = true;
      if (inside === 4) {
        outline = pts;
        guide = 'found';
      }
      // The scan light runs down the page and back
      const run = (Math.sin(time * 1.3) + 1) / 2;
      sweep.position.set(0, 0.08, mix(-PAGE_H / 2, PAGE_H / 2, run));
      sweepMaterial.opacity = 0.55 * scanShown;
      blueLine.opacity = (0.45 + 0.15 * Math.sin(time * 3)) * scanShown;
      (coneFaces.material as THREE.MeshBasicMaterial).opacity = 0.03 * scanShown;
      // Corner marks lock on: they sit out a little and close in, over and over
      const lock = ease(clamp(((time * 0.5) % 1) * 1.6));
      markMaterial.opacity = scanShown * (0.6 + 0.4 * lock);
      marks.forEach((m) => {
        const c = m.userData.corner as THREE.Vector3;
        m.position.set(c.x * (1.12 - 0.12 * lock), c.y, c.z * (1.1 - 0.1 * lock));
      });
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x4a321f, 1);
      renderer.render(scene, phoneCamera);
      renderer.setRenderTarget(null);
      renderer.setClearColor(0x000000, 0);
    }
    viewfinder.visible = w1 > 0.4;

    // ----- 2. Reader -----
    readGroup.visible = w2 > 0.002;
    const spoken = Math.floor(time * 2.2) % WORDS.length;
    if (w2 > 0.3 && spoken !== lastSpoken) {
      lastSpoken = spoken;
      const f = flyers[nextFlyer++ % flyers.length];
      const { texture, aspect } = wordTex(WORDS[spoken]);
      (f.mesh.material as THREE.MeshBasicMaterial).map = texture;
      (f.mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
      f.mesh.userData.aspect = aspect;
      f.mesh.scale.set(WORD_H * aspect, WORD_H, 1);
      f.plate.scale.set(1.06, 1.1, 1);
      f.born = time;
      // From the text on the screen, out to one side or the other and into the open space round the phone
      const side = spoken % 2 ? 1 : -1;
      phone.localToWorld(f.from.set(mix(-1.5, 1.5, Math.random()), 2.5 + Math.random() * 2, PD / 2 + 0.2));
      f.via.copy(f.from).add(tmp.set(side * (4.5 + Math.random() * 2), 1 + Math.random() * 2.5, 5));
      f.to.copy(f.from).add(tmp.set(side * (10 + Math.random() * 5), -2 + Math.random() * 7, 3 + Math.random() * 3));
    }
    camera.getWorldQuaternion(camQ);
    const textColor = theme === 'dark' ? 0xe5e7eb : 0x0f172a;
    flyers.forEach((f) => {
      const a = (time - f.born) / 3.8;
      f.mesh.visible = readGroup.visible && a >= 0 && a < 1;
      if (!f.mesh.visible) return;
      const e = ease(a);
      // Quadratic curve from the screen, via a point in front, out to the side
      f.mesh.position.set(0, 0, 0)
        .addScaledVector(f.from, (1 - e) * (1 - e))
        .addScaledVector(f.via, 2 * (1 - e) * e)
        .addScaledVector(f.to, e * e);
      f.mesh.quaternion.copy(camQ);
      const grow = mix(0.55, 1.15, ease(clamp(a * 1.6)));
      f.mesh.scale.y = WORD_H * grow;
      f.mesh.scale.x = WORD_H * grow * f.mesh.userData.aspect;
      const alpha = seg(a, 0, 0.06) * (1 - seg(a, 0.6, 1)) * w2;
      const lit = 1 - seg(a, 0.12, 0.4); // yellow while it is the word being read, then it settles
      const mat = f.mesh.material as THREE.MeshBasicMaterial;
      mat.color.set(textColor).lerp(new THREE.Color(0x0f172a), lit);
      mat.opacity = alpha;
      (f.plate.material as THREE.MeshBasicMaterial).opacity = alpha * lit;
    });
    rings.forEach((ring, i) => {
      const a = (time / 3.2 + i / rings.length) % 1;
      const r = mix(3, 17, a);
      ring.position.x = phone.position.x;
      ring.position.z = phone.position.z;
      ring.scale.set(r, r, 1);
      (ring.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * Math.min(a * 4, 1) / 2) * (1 - a) * 0.38 * w2;
    });

    // ----- 3. Upload -----
    upGroup.visible = w3 > 0.002;
    let press = 0;
    let land = 0;
    if (upGroup.visible) {
      const slot = Math.floor(time / CARD_EVERY);
      const into = time - slot * CARD_EVERY;
      const flying = slot % cards.length;
      const dropAt = phone.localToWorld(landing.position.clone());
      cards.forEach((card, i) => {
        const angle = time * 0.32 + (i / cards.length) * Math.PI * 2;
        const orbit = new THREE.Vector3(Math.cos(angle) * 14, 9.5 + Math.sin(angle * 2) * 1.4 + Math.sin(angle) * 2.4, Math.sin(angle) * 6.5 - 1);
        const mat = card.material as THREE.MeshBasicMaterial;
        let s = 1;
        let o = 1;
        if (i === flying) {
          const f = ease(clamp(into / CARD_FLIGHT));
          card.position.copy(orbit).lerp(dropAt, f);
          s = mix(1, 0.18, f);
          o = 1 - seg(into, CARD_FLIGHT * 0.85, CARD_FLIGHT);
          if (into > CARD_FLIGHT) {
            // back in its place on the ring, fading in
            card.position.copy(orbit);
            s = 1;
            o = seg(into, CARD_FLIGHT + 0.3, CARD_EVERY);
          }
        } else card.position.copy(orbit);
        card.quaternion.copy(camQ);
        card.rotateZ(Math.sin(angle * 1.3) * 0.12);
        card.scale.setScalar(s);
        mat.opacity = o * w3;
        // Cards behind the phone are drawn first
        card.renderOrder = card.position.z < phone.position.z ? 0 : 6;
      });
      const since = into - CARD_FLIGHT;
      press = since > 0 ? 1 - seg(since, 0.1, 0.45) : 0;
      land = since > 0 ? seg(since, 0, 0.7) : 0;
    }
    landing.visible = w3 > 0.002 && land > 0 && land < 1;
    landing.scale.setScalar(mix(0.6, 4, ease(land)));
    (landing.material as THREE.MeshBasicMaterial).opacity = (1 - land) * 0.8 * w3;

    // ----- The app: camera tab, then the reader, then the upload tab -----
    drawUI({
      screen: p < 0.5 ? 'camera' : 'upload',
      reader: ease(seg(t12, 0.2, 0.8)) * (1 - ease(seg(t23, 0.2, 0.8))),
      guide,
      outline,
      tap: 0,
      flash: 0,
      scan: 0,
      scanProgress: 0,
      word: w2 > 0.3 ? spoken : -1,
      read: (spoken + 1) / WORDS.length,
      press,
    });

    renderer.render(scene, camera);
  };

  // ---------- Running only while on screen ----------
  let raf = 0;
  let running = false;
  let elapsed = 0; // seconds of animation (paused while off screen)
  let last = 0;
  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    elapsed += Math.min((now - last) / 1000, 0.1);
    last = now;
    render(elapsed);
  };

  renderer.compile(scene, camera);

  return {
    resize,
    setProgress(p: number) {
      progress = p;
      if (!running) render(elapsed);
    },
    setPointer(x: number, y: number) {
      pointer.x = clamp(x, -1, 1);
      pointer.y = clamp(y, -1, 1);
    },
    setText(next: FeatureText) {
      text = next;
      lastKey = '';
    },
    setTheme(next: FeatureTheme) {
      theme = next;
      applyTheme();
    },
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(loop);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    dispose() {
      cancelAnimationFrame(raf);
      renderer.dispose();
      target.dispose();
      pmrem.dispose();
    },
  };
}
