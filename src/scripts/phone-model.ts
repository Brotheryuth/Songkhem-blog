// The phone itself, built from code: a modern Android phone with a metal frame, frosted glass back,
// a three-lens camera island, punch-hole selfie camera, side keys, antenna bands, USB-C port and
// speaker grille. Sizes in centimetres; the screen faces +z, the top is +y.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export function roundedShape(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

type Size = { PW: number; PH: number; PD: number; SW: number; SH: number; corner: number };

export function createPhoneModel({ PW, PH, PD, SW, SH, corner }: Size) {
  const group = new THREE.Group();
  const shadowy = (m: THREE.Mesh) => {
    m.castShadow = true;
    return m;
  };

  // ---------- Materials ----------
  const frameMat = new THREE.MeshPhysicalMaterial({ color: 0x24314f, metalness: 1, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const backMat = new THREE.MeshPhysicalMaterial({ color: 0x1a2850, metalness: 0.1, roughness: 0.42, clearcoat: 0.9, clearcoatRoughness: 0.35 });
  const islandMat = new THREE.MeshPhysicalMaterial({ color: 0x15213f, metalness: 0.15, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 });
  const blackGlass = new THREE.MeshPhysicalMaterial({ color: 0x030407, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 });
  const ringMat = new THREE.MeshPhysicalMaterial({ color: 0x9aa3b5, metalness: 1, roughness: 0.22 });
  const darkRing = new THREE.MeshStandardMaterial({ color: 0x0c0d12, metalness: 0.6, roughness: 0.5 });
  // Coated lens glass: near black with a faint blue-violet coating, plus a tiny window-like glint
  const lensCoat = new THREE.MeshPhysicalMaterial({
    color: 0x070a16, metalness: 0.3, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.02,
    iridescence: 0.45, iridescenceIOR: 1.35, iridescenceThicknessRange: [380, 460],
  });
  const glintMat = new THREE.MeshBasicMaterial({ color: 0xc9d4ff, transparent: true, opacity: 0.55 });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x050608 });
  const bandMat = new THREE.MeshStandardMaterial({ color: 0x1a2030, metalness: 0.2, roughness: 0.85 });

  // ---------- Body: metal frame with rounded edges ----------
  const bevel = 0.16;
  const bodyGeometry = new THREE.ExtrudeGeometry(roundedShape(PW - bevel * 2, PH - bevel * 2, corner - bevel), {
    depth: PD - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 24,
  });
  bodyGeometry.translate(0, 0, -(PD - bevel * 2) / 2);
  const body = shadowy(new THREE.Mesh(bodyGeometry, frameMat));
  // The fingers and palm cast their shadows on the frame and glass where they hold it
  body.receiveShadow = true;
  group.add(body);

  // Frosted glass back, sitting in the frame
  const back = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(PW - 0.18, PH - 0.18, corner - 0.09), 24), backMat);
  back.rotation.y = Math.PI;
  back.position.z = -PD / 2 - 0.004;
  back.receiveShadow = true;
  group.add(back);

  // Front glass: black, edge to edge, over the frame's front face
  const front = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(PW - 0.16, PH - 0.16, corner - 0.08), 24), blackGlass);
  front.position.z = PD / 2 + 0.003;
  front.receiveShadow = true;
  group.add(front);

  // ---------- Front details ----------
  const screenTop = SH / 2;
  // Earpiece: a thin slot between glass and frame at the very top
  const ear = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.035), new THREE.MeshBasicMaterial({ color: 0x2b2f3a }));
  ear.position.set(0, PH / 2 - 0.1, PD / 2 + 0.006);
  group.add(ear);
  // Punch-hole selfie camera, centred in the status bar
  const punch = new THREE.Group();
  punch.position.set(0, screenTop - 0.4, PD / 2 + 0.016);
  const punchHole = new THREE.Mesh(new THREE.CircleGeometry(0.15, 40), holeMat);
  const punchRing = new THREE.Mesh(new THREE.RingGeometry(0.075, 0.105, 40), darkRing);
  punchRing.position.z = 0.001;
  const punchLens = new THREE.Mesh(new THREE.CircleGeometry(0.07, 32), lensCoat);
  punchLens.position.z = 0.002;
  const punchGlint = new THREE.Mesh(new THREE.CircleGeometry(0.014, 12), glintMat);
  punchGlint.position.set(-0.025, 0.028, 0.003);
  punch.add(punchHole, punchRing, punchLens, punchGlint);
  group.add(punch);

  // ---------- Side keys (right side): volume rocker and power ----------
  const key = (len: number, y: number) => {
    const k = shadowy(new THREE.Mesh(new RoundedBoxGeometry(0.12, len, 0.3, 3, 0.05), frameMat));
    k.position.set(PW / 2 + 0.02, y, 0);
    group.add(k);
  };
  key(2.3, 3.7);
  key(1.15, 1.45);

  // ---------- Antenna bands across the frame ----------
  const bandAcross = (w: number, h: number, d: number, x: number, y: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bandMat);
    b.position.set(x, y, 0);
    group.add(b);
  };
  const bandY = PH / 2 - corner - 0.35;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) bandAcross(0.02, 0.07, PD - 0.3, sx * (PW / 2 + 0.001), sy * bandY);
  for (const sy of [-1, 1]) bandAcross(0.07, 0.02, PD - 0.3, -PW / 2 + corner + 0.9, sy * (PH / 2 + 0.001));

  // ---------- Bottom edge: USB-C, speaker grille, microphone ----------
  const bottom = -PH / 2 - 0.002;
  const usb = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(0.88, 0.3, 0.15), 16), holeMat);
  usb.rotation.x = Math.PI / 2;
  usb.position.set(0, bottom, 0);
  group.add(usb);
  const usbTongue = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.06), new THREE.MeshBasicMaterial({ color: 0x23262e }));
  usbTongue.rotation.x = Math.PI / 2;
  usbTongue.position.set(0, bottom - 0.001, 0);
  group.add(usbTongue);
  const hole = new THREE.CircleGeometry(0.045, 16);
  for (let i = 0; i < 6; i++) {
    const h = new THREE.Mesh(hole, holeMat);
    h.rotation.x = Math.PI / 2;
    h.position.set(1.0 + i * 0.17, bottom, 0);
    group.add(h);
  }
  const mic = new THREE.Mesh(hole, holeMat);
  mic.rotation.x = Math.PI / 2;
  mic.position.set(-1.1, bottom, 0);
  group.add(mic);
  // Top edge: second microphone
  const mic2 = new THREE.Mesh(hole, holeMat);
  mic2.rotation.x = -Math.PI / 2;
  mic2.position.set(1.2, PH / 2 + 0.002, 0);
  group.add(mic2);
  // Left side: SIM tray seam and its eject hole
  const tray = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(1.5, 0.22, 0.11), 12), new THREE.MeshBasicMaterial({ color: 0x141a2a }));
  tray.rotation.y = -Math.PI / 2;
  tray.rotation.z = Math.PI / 2;
  tray.position.set(-PW / 2 - 0.002, -4.6, 0);
  const trayInner = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(1.46, 0.18, 0.09), 12), frameMat);
  trayInner.position.z = 0.0005;
  tray.add(trayInner);
  group.add(tray);

  // ---------- Back: camera island with three lenses, flash and a microphone ----------
  const island = new THREE.Group();
  // Kept clear of the index fingertip, which rests on the back below it
  island.position.set(-PW / 2 + 1.55, PH / 2 - 1.95, -PD / 2);
  island.rotation.y = Math.PI;
  group.add(island);
  const islandGeom = new THREE.ExtrudeGeometry(roundedShape(2.2, 3.15, 0.72), {
    depth: 0.04, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4, curveSegments: 24,
  });
  const islandMesh = shadowy(new THREE.Mesh(islandGeom, islandMat));
  islandMesh.position.z = 0.05;
  island.add(islandMesh);
  const lens = (y: number, r: number) => {
    const g = new THREE.Group();
    g.position.set(-0.05, y, 0.14);
    // Raised metal ring, its dark inner wall, the black cover glass and the coated lens inside
    const ring = shadowy(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.09, r + 0.11, 0.12, 48, 1, true), ringMat));
    ring.rotation.x = Math.PI / 2;
    ring.position.z = 0.06;
    const lip = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.09, 48), ringMat);
    lip.position.z = 0.12;
    const wall = new THREE.Mesh(new THREE.RingGeometry(r * 0.62, r, 48), darkRing);
    wall.position.z = 0.115;
    const cover = new THREE.Mesh(new THREE.CircleGeometry(r, 48), blackGlass);
    cover.position.z = 0.112;
    const element = new THREE.Mesh(new THREE.CircleGeometry(r * 0.6, 48), lensCoat);
    element.position.z = 0.116;
    const aperture = new THREE.Mesh(new THREE.RingGeometry(r * 0.22, r * 0.3, 32), darkRing);
    aperture.position.z = 0.117;
    const glint = new THREE.Mesh(new THREE.CircleGeometry(r * 0.09, 16), glintMat);
    glint.position.set(r * 0.3, r * 0.32, 0.118);
    g.add(ring, lip, wall, cover, element, aperture, glint);
    island.add(g);
  };
  lens(0.95, 0.37);
  lens(0, 0.37);
  lens(-0.93, 0.29);
  // LED flash and microphone beside the lenses
  const flash = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), new THREE.MeshPhysicalMaterial({ color: 0xf1e9d2, roughness: 0.35, clearcoat: 1 }));
  flash.position.set(0.66, 1.0, 0.141);
  const flashRing = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.18, 32), ringMat);
  flashRing.position.set(0.66, 1.0, 0.141);
  const islandMic = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), holeMat);
  islandMic.position.set(0.66, 0.4, 0.141);
  island.add(flash, flashRing, islandMic);

  // ---------- Screen glass: a faint reflection of the room, added over the screen ----------
  // Unlit on purpose: a lit material would also catch the sun's shine and wash out the screen.
  const glare = new THREE.MeshBasicMaterial({
    color: 0x000000, combine: THREE.AddOperation, reflectivity: 0.1, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(roundedShape(SW + 0.12, SH + 0.12, corner - 0.2), 24), glare);
  glass.position.z = PD / 2 + 0.026;
  glass.renderOrder = 3;
  group.add(glass);

  return {
    group,
    /** How strongly the glass reflects the room (lower it when the screen must read clearly) */
    setGlare(v: number) {
      glare.reflectivity = v;
      glass.visible = v > 0.002;
    },
    /** The room the glass reflects (the scene's environment map) */
    setEnvironment(env: THREE.Texture) {
      glare.envMap = env;
      glare.needsUpdate = true;
    },
    /** A real studio's light for the metal, glass and lenses (prefiltered environment map) */
    setStudioLight(env: THREE.Texture) {
      for (const m of [frameMat, backMat, islandMat, blackGlass, ringMat, lensCoat]) {
        m.envMap = env;
        m.needsUpdate = true;
      }
    },
  };
}
