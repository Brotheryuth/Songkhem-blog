// The hand that holds the phone: an MPFB 2 / MakeHuman hand (CC0, see /models/hand/license.txt), posed in
// Blender round a phone the size of this one. The grip never changes; only the thumb moves. The model
// carries its three thumb poses (away, hover, press) as the clip "grip", and a node "PhoneAnchor" that
// marks where the phone sits in the hand.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ELBOW = 'lowerarm_r';
const WRIST = 'hand_r';

const v = () => new THREE.Vector3();
const q = () => new THREE.Quaternion();

/**
 * Skin: the baked colour and detail maps, with a soft sheen like light in skin. With the gloss map
 * (baked from the same masks: R = nails, G = roughness, B = thin skin) the nails get a clear glossy coat,
 * fingertips and knuckles shine a little more than the matte creases, and thin skin (fingers, tips)
 * glows warm where light passes through it, strongest at the edges.
 */
export type HandMaps = {
  /** R = nails, G = roughness, B = thin skin (baked from the skin masks) */
  gloss?: THREE.Texture;
  /** Ambient occlusion baked in the grip pose, with the phone there: creases, between fingers, contact */
  ao?: THREE.Texture;
  /** A real studio's light (prefiltered), for the skin's reflections and soft fill */
  light?: THREE.Texture;
};

// Skin's own direct lighting, on top of three.js's physical model:
// - light carries a little past the shadow line, reddened (skin scatters red light furthest),
// - thin skin (fingers, tips, the web) glows when lit from behind,
// - a second, sharper shine from the skin's oily surface over the soft one.
const SKIN_LIGHT = /* glsl */ `
float skinThin = 0.0;
void RE_Direct_Skin( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
  RE_Direct_Physical( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
  float NdL = dot( geometryNormal, directLight.direction );
  float wrapped = saturate( ( NdL + 0.5 ) / 1.5 ) - saturate( NdL );
  reflectedLight.directDiffuse += directLight.color * material.diffuseColor * vec3( 0.42, 0.17, 0.1 ) * wrapped * ( 0.5 + 0.5 * skinThin );
  float behind = pow( saturate( dot( geometryViewDir, -directLight.direction ) ), 3.0 );
  reflectedLight.directDiffuse += directLight.color * material.diffuseColor * vec3( 1.0, 0.3, 0.16 ) * behind * skinThin * 0.55;
  vec3 halfway = normalize( directLight.direction + geometryViewDir );
  float oily = pow( saturate( dot( geometryNormal, halfway ) ), 80.0 ) * saturate( NdL );
  reflectedLight.directSpecular += directLight.color * oily * 0.06 * ( 1.0 - material.roughness );
}
#undef RE_Direct
#define RE_Direct RE_Direct_Skin
`;

function skinMaterial(source: THREE.MeshStandardMaterial, { gloss, ao, light }: HandMaps) {
  const material = new THREE.MeshPhysicalMaterial({
    map: source.map,
    color: new THREE.Color(1.0, 0.9, 0.82), // a little warmer and deeper than the bare texture
    normalMap: source.normalMap,
    // Strong enough for the palm lines and creases to read under the soft studio light
    normalScale: new THREE.Vector2(2, 2),
    roughness: 0.55,
    metalness: 0,
    // Less flat light from the room around it, so the hand keeps its shading and colour.
    envMapIntensity: 0.35,
    sheen: 0.12,
    sheenColor: new THREE.Color(0xd08060),
    sheenRoughness: 0.6,
  });
  if (light) {
    material.envMap = light;
    material.envMapIntensity = 1.15;
  }
  if (ao) {
    material.aoMap = ao;
    material.aoMapIntensity = 1;
  }
  if (gloss) {
    material.roughness = 1;
    material.roughnessMap = gloss;
    material.clearcoat = 1;
    material.clearcoatMap = gloss;
    material.clearcoatRoughness = 0.12;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.glossMap = { value: gloss };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <lights_physical_pars_fragment>', `#include <lights_physical_pars_fragment>\n${SKIN_LIGHT}`)
        .replace('void main() {', 'uniform sampler2D glossMap;\nvoid main() {')
        // Nails: the pink of the nail bed under the plate (the baked nail colour is very pale)
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec3 glossTexel = texture2D( glossMap, vMapUv ).rgb;
          skinThin = glossTexel.b;
          diffuseColor.rgb *= mix( vec3( 1.0 ), vec3( 0.97, 0.80, 0.76 ), glossTexel.r * 0.85 );`
        )
        .replace(
          '#include <opaque_fragment>',
          `{
            float facing = saturate( dot( normal, normalize( vViewPosition ) ) );
            float rim = pow( 1.0 - facing, 2.0 );
            // Thin skin at the silhouette: a faint warm edge (the main glow comes from the lighting above)
            outgoingLight += diffuseColor.rgb * vec3( 1.0, 0.36, 0.24 ) * glossTexel.b * 0.16 * rim;
            // Nail plate: a glassy sheen towards its edges, from any angle
            outgoingLight += vec3( 0.9, 0.92, 1.0 ) * glossTexel.r * ( 0.03 + 0.22 * rim );
          }
          #include <opaque_fragment>`
        );
    };
    material.customProgramCacheKey = () => 'hand-skin-v2';
  }
  material.userData.hand = true; // tone-mapped like the Blender renders; the rest of the scene is not
  return material;
}

/**
 * Sets the hand up in `parent`'s space, which must be the phone's own space (centimetres, screen facing +z).
 * Returns functions that move the thumb and point the forearm.
 */
export function createHand(gltf: GLTF, parent: THREE.Object3D, maps: HandMaps = {}) {
  const model = gltf.scene;
  for (const tex of [maps.gloss, maps.ao]) {
    if (!tex) continue;
    tex.flipY = false; // same UV layout as the model's own textures (glTF convention)
    tex.colorSpace = THREE.NoColorSpace;
    tex.needsUpdate = true;
  }
  model.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (mesh.isSkinnedMesh) {
      mesh.material = skinMaterial(mesh.material as THREE.MeshStandardMaterial, maps);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
    }
  });

  // Put the phone anchor on the phone: phone space (cm) = scale(100) x Rx(90) x inverse(anchor) x model space (m).
  // The anchor was an empty in Blender (Z up); glTF turns everything to Y up, so its inverse gives phone
  // coordinates turned a quarter turn about X. Rx(90) turns them back.
  model.updateMatrixWorld(true);
  const anchor = model.getObjectByName('PhoneAnchor');
  if (!anchor) throw new Error('Hand model has no PhoneAnchor');
  const holder = new THREE.Group();
  holder.add(model);
  new THREE.Matrix4()
    .makeScale(100, 100, 100)
    .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2))
    .multiply(anchor.matrixWorld.clone().invert())
    .decompose(holder.position, holder.quaternion, holder.scale);
  parent.add(holder);
  parent.updateMatrixWorld(true);

  const bone = (name: string) => {
    const found = model.getObjectByName(name);
    if (!found) throw new Error(`Hand model is missing bone ${name}`);
    return found;
  };
  const joint = (name: string) => bone(name).getWorldPosition(v());

  // ---------- Thumb: one clip, sampled at a chosen time ----------
  const clip = gltf.animations.find((a) => a.name === 'grip') ?? gltf.animations[0];
  const mixer = new THREE.AnimationMixer(model);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.play();
  action.paused = true;
  const thumbTrack = clip.tracks.find((t) => t.name.startsWith('thumb_03_r') && t.name.endsWith('.quaternion'));
  const [tAway, tHover, tPress] = thumbTrack ? Array.from(thumbTrack.times) : [0, 0, 0];
  let lastTime = -1;
  /** tap: 0 = hovering over the shutter, 1 = pressing it. tuck: 0..1 swings the thumb off the screen. */
  const setThumb = (tap: number, tuck: number) => {
    const time = tuck > 0 ? tHover + (tAway - tHover) * tuck : tHover + (tPress - tHover) * tap;
    const t = Math.round(time * 2400) / 2400;
    if (t === lastTime) return;
    lastTime = t;
    action.time = t;
    mixer.update(0);
  };
  setThumb(0, 0);

  /** Bend the wrist so the forearm points along `dir` (in `parent`'s space), keeping the hand where it is. */
  const pointForearm = (dirInParent: THREE.Vector3) => {
    parent.updateMatrixWorld(true);
    const dir = dirInParent.clone().transformDirection(parent.matrixWorld);
    const forearm = bone(ELBOW);
    const hand = bone(WRIST);
    const wrist = joint(WRIST);
    const turn = q().setFromUnitVectors(joint(ELBOW).sub(wrist).normalize(), dir.normalize());
    const handWorld = hand.matrixWorld.clone();
    const pivot = new THREE.Matrix4().makeTranslation(wrist.x, wrist.y, wrist.z)
      .multiply(new THREE.Matrix4().makeRotationFromQuaternion(turn))
      .multiply(new THREE.Matrix4().makeTranslation(-wrist.x, -wrist.y, -wrist.z));
    const forearmWorld = pivot.multiply(forearm.matrixWorld);
    new THREE.Matrix4().copy(forearm.parent!.matrixWorld).invert().multiply(forearmWorld)
      .decompose(forearm.position, forearm.quaternion, forearm.scale);
    forearm.updateMatrixWorld(true);
    // The hand's own parent may be a twist bone under the forearm: undo the swing there.
    new THREE.Matrix4().copy(hand.parent!.matrixWorld).invert().multiply(handWorld)
      .decompose(hand.position, hand.quaternion, hand.scale);
    hand.updateMatrixWorld(true);
  };

  /** A sleeve (and cuff) over the cut end of the forearm, carried by the forearm bone. */
  const addSleeve = (material: THREE.MeshStandardMaterial) => {
    const elbow = joint(ELBOW);
    const wrist = joint(WRIST);
    const up = elbow.clone().sub(wrist);
    const forearm = up.length();
    up.normalize();
    const radius = joint('index_01_r').distanceTo(joint('pinky_01_r')) * 0.62;
    const start = Math.min(forearm * 0.22, 5.5); // a short bit of wrist shows; the model is cut 12 cm up
    const length = forearm * 2.6;
    material.userData.hand = true;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.05, radius * 1.2, length, 48), material);
    sleeve.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), up);
    sleeve.position.copy(wrist).addScaledVector(up, start + length / 2);
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    const cuffMaterial = material.clone();
    cuffMaterial.color.multiplyScalar(0.82);
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.08, radius * 0.11, 16, 48), cuffMaterial);
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), up);
    cuff.position.copy(wrist).addScaledVector(up, start + radius * 0.08);
    cuff.castShadow = true;
    // Built in world space; attach keeps them where they are while handing them to the bone.
    const scene = holder.parent!;
    scene.add(sleeve, cuff);
    bone(ELBOW).attach(sleeve);
    bone(ELBOW).attach(cuff);
  };

  /** The forearm's direction in `parent`'s space (wrist to elbow). */
  const forearmDirection = () => {
    parent.updateMatrixWorld(true);
    const inv = parent.matrixWorld.clone().invert();
    return joint(ELBOW).applyMatrix4(inv).sub(joint(WRIST).applyMatrix4(inv)).normalize();
  };

  /** The skin textures, so they can be uploaded before the hand first appears. */
  const textures: THREE.Texture[] = [];
  model.traverse((o) => {
    const mat = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
    if (mat?.map) textures.push(mat.map);
    if (mat?.normalMap) textures.push(mat.normalMap);
    if (mat?.roughnessMap && !textures.includes(mat.roughnessMap)) textures.push(mat.roughnessMap);
    if (mat?.aoMap && !textures.includes(mat.aoMap)) textures.push(mat.aoMap);
  });

  return { setThumb, pointForearm, addSleeve, forearmDirection, textures };
}
