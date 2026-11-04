# The hand in the home page's 3D scene

These scripts produce `public/models/hand/hand.glb` (the hand holding the phone, with its thumb poses) and
`public/models/hand/hand_gloss.webp` (nail, shine and thin-skin map). The model is MPFB 2 / MakeHuman,
CC0, so no credit is needed (see `public/models/hand/license.txt`).

## What you need

- **Blender 4.2.** The scripts were run with the portable 4.2.9 build.
- **MPFB 2 (v2.0.18).** Install it as a Blender extension.
- **The MakeHuman CC0 system assets** (`makehuman_system_assets_cc0`), unpacked into MPFB's data folder.

**Long paths:** Blender's glTF export fails when a path is longer than 260 characters on Windows. Work from
a short path, or map one, for example `subst X: <this folder>`. Undo it afterwards with `subst X: /D`.

## Steps

Run each step from this folder. Outputs go to `out/`, which git ignores.

```sh
# 1. A human with the game rig and an Asian skin
blender -b --python make_human.py -- out

# 2. Keep the hand and 12 cm of forearm, give it its own UVs, and bake the colour and normal maps
#    (veins, hair, fingerprints, nails, palm lines, double finger creases, skin furrows). The lines are
#    baked to out/hand_grooves.exr first, which the colour and normal bakes read. Writes out/hand_detail.blend.
blender -b out/human.blend --python bake_skin.py -- out

# 3. Bake the gloss map: R = nails, G = roughness, B = thin skin
blender -b out/hand_detail.blend --python bake_gloss.py -- out

# 3b. Bake ambient occlusion in the site's grip, with the phone there (creases, between the fingers,
#     where skin meets the phone). Stops after the bake; writes out/hand_ao.png
blender -b out/hand_detail.blend --python grip.py -- out ao bake-ao.json

# 4a. Preview the grip as renders (grip.json is the approved grip)
blender -b out/hand_detail.blend --python grip.py -- out preview grip.json

# 4b. Export for the site: the same grip plus the "grip" clip (away, hover, press) and a PhoneAnchor
blender -b out/hand_detail.blend --python grip.py -- out exp export.json
```

Then compress the export into the site. Keep `--prune false`, or the PhoneAnchor node is dropped and the
site can't place the hand:

```sh
npx @gltf-transform/cli@4.5.1 optimize out/hand-export.glb ../../public/models/hand/hand.glb \
  --compress false --simplify false --prune false --flatten false --join false --instance false \
  --palette false --texture-compress webp --texture-size 2048
```

Turn `out/hand_gloss.png` and `out/hand_ao.png` into `public/models/hand/hand_gloss.webp` and
`hand_ao.webp`, at 1024 x 1024.

## Studio light

`public/models/light/studio.hdr` is Poly Haven's "Studio Small 09" (CC0), shrunk for the web:

```sh
node shrink-hdr.mjs studio_small_09_1k.hdr ../../public/models/light/studio.hdr 256
```

## How the grip is found (grip.py)

- **Phone:** a box the size of the site's phone (7.4 x 15.4 x 0.85 cm). Its right edge sits in the web
  between the thumb and index finger.
- **Fingers:** each one curls until its tip is just past the left edge (`tip`, `tip_by`, `spread`).
- **Collisions:** the code backs a finger off if any skin would be inside the phone. This is checked on
  the deformed mesh, not the bones.
- **Thumb:** the base swings and rolls, and the two outer joints only hinge. The pad faces the screen,
  and the hooked top joint taps the shutter with its tip (`thumb_hook`).
- **Shutter:** the grip aims at the point the site calls `GRIP_SHUTTER_Y` (-4.14 cm). The site slides
  the hand to wherever the app's real shutter is.
- **Clip:** the export writes three thumb keyframes: away, hover and press. It checks that every
  in-between pose stays clear of the phone. The site only ever moves a fifth of the way towards
  "away".

## Other files

- `detail_check.py`: close-up renders of `hand_detail.blend` in its rest pose.
- `glbinfo.cjs`: prints a GLB's animation times and thumb nodes.

The browser checks are in `../scene-check`. They need the dev server and `npm i --no-save playwright-core`.
