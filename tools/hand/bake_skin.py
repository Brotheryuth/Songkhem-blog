# Turns human.blend into a detailed hand: keeps the hand and lower forearm, smooths the mesh one level,
# gives it its own UV layout, and bakes a 2048 colour map (with knuckle/fingertip/palm colour, darker folds)
# and a normal map (pores, skin furrows, knuckle wrinkles, palm lines, finger creases). Saves hand_detail.blend
# for grip.py.
# Run: blender -b human.blend --python bake_skin.py -- <outdir>
import bpy, bmesh, sys, os, math
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1]
scene = bpy.context.scene
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig)
B, W = rig.data.bones, rig.matrix_world
def head(n): return W @ B[n].head_local
def tail(n): return W @ B[n].tail_local

# ---- 1. bake the body shape into the mesh, keep the hand + 12 cm of forearm ----
bpy.context.view_layer.objects.active = body
body.select_set(True)
if body.data.shape_keys:
    body.shape_key_add(name="mix", from_mix=True)
    keys = body.data.shape_keys.key_blocks
    mix = keys["mix"]
    for v, k in zip(body.data.vertices, mix.data): v.co = k.co.copy()
    for kb in list(keys)[::-1]: body.shape_key_remove(kb)
for m in list(body.modifiers):
    if m.type != 'ARMATURE': body.modifiers.remove(m)
for o in list(bpy.data.objects):
    if o.type == 'MESH' and o != body: bpy.data.objects.remove(o, do_unlink=True)
print('UVSTEP after shapekeys', [u.name for u in body.data.uv_layers])

FINGERS = ["thumb", "index", "middle", "ring", "pinky"]
HAND = {"hand_r", "lowerarm_r", "lowerarm_twist_01_r"} | {f"{f}_{k}_r" for f in FINGERS for k in ["01", "02", "03"]}
wrist, elbow = head("hand_r"), head("lowerarm_r")
fa = (elbow - wrist).normalized()
gi = {g.index: g.name for g in body.vertex_groups}
bm = bmesh.new(); bm.from_mesh(body.data)
deform = bm.verts.layers.deform.active
kill = []
for v in bm.verts:
    w = {gi[i]: x for i, x in v[deform].items()}
    if sum(x for n, x in w.items() if n in HAND) < 0.5 or w.get("body", 0) <= 0 or (body.matrix_world @ v.co - wrist).dot(fa) > 0.12:
        kill.append(v)
bmesh.ops.delete(bm, geom=kill, context='VERTS')
bm.to_mesh(body.data); bm.free()
print('UVSTEP after cut', [u.name for u in body.data.uv_layers])

# ---- 2. one level of smoothing, applied (weights are interpolated) ----
sub = body.modifiers.new("sub", 'SUBSURF'); sub.levels = 1
bpy.ops.object.modifier_move_to_index(modifier="sub", index=0)
bpy.ops.object.modifier_apply(modifier="sub")
me = body.data
print('UVSTEP after subsurf', [u.name for u in me.uv_layers])
print("MESH verts", len(me.vertices), "tris", sum(len(p.vertices) - 2 for p in me.polygons))

# ---- 3. its own UV layout ----
old_uv = me.uv_layers[0].name
new_uv = me.uv_layers.new(name="detail")
me.uv_layers.active = new_uv
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')

# ---- 4. masks from the skeleton: knuckles, fingertips, palm, folds, and distance to the nearest joint ----
across = (head("pinky_01_r") - head("index_01_r")).normalized()
along = (head("middle_01_r") - head("hand_r")).normalized()
back = across.cross(along).normalized()
segs = []  # (name, head, tail, nail-side axis)
for f in FINGERS:
    for k in ["01", "02", "03"]:
        n = f"{f}_{k}_r"
        if f == "thumb" and k == "01": continue
        m3 = W.to_3x3() @ B[n].matrix_local.to_3x3()
        z = m3.col[2].normalized(); x = m3.col[0].normalized()
        segs.append((n, head(n), tail(n), -z, x, z))   # pad is +Z (measured), so the nail/back side is -Z
joints = [head(f"{f}_{k}_r") for f in FINGERS for k in ["02", "03"]] + [head(f"{f}_01_r") for f in FINGERS if f != "thumb"]
tips = [tail(f"{f}_03_r") for f in FINGERS]
ss = lambda e0, e1, x: max(0.0, min(1.0, (x - e0) / (e1 - e0))) ** 2 * (3 - 2 * max(0.0, min(1.0, (x - e0) / (e1 - e0))))
# Flexion creases on the palm side of each finger, as (distance along the finger from its base, half the
# gap between the two lines of a double crease, strength). Fingers start at the knuckle (MCP); the thumb
# chain starts at its MCP too (thumb_01 is the metacarpal).
SL = {f"{f}_{k}_r": (tail(f"{f}_{k}_r") - head(f"{f}_{k}_r")).length for f in FINGERS for k in ["01", "02", "03"]}
CHAIN_OFF, CREASES = {}, {}
for f in FINGERS:
    o = 0.0
    for k in (["02", "03"] if f == "thumb" else ["01", "02", "03"]):
        CHAIN_OFF[f"{f}_{k}_r"] = o; o += SL[f"{f}_{k}_r"]
    if f == "thumb":
        CREASES[f] = [(0.0, 0.0011, 0.9), (SL["thumb_02_r"], 0.0005, 1.0)]
    else:
        L1, L2 = SL[f"{f}_01_r"], SL[f"{f}_02_r"]
        CREASES[f] = [(0.45 * L1, 0.0009 if f in ("middle", "ring") else 0.0, 0.8),   # where finger meets palm
                      (L1, 0.0008, 1.0),                                              # middle joint: double
                      (L1 + L2, 0.00045, 0.8)]                                       # last joint
I01 = head("index_01_r")
me.color_attributes.new("masks", 'FLOAT_COLOR', 'POINT')
me.attributes.new("jd", 'FLOAT', 'POINT')
me.attributes.new("dorsal", 'FLOAT', 'POINT')
me.color_attributes.new("masks2", 'FLOAT_COLOR', 'POINT')   # hair, flexion line, fingerprint, vein area
me.attributes.new("hc", 'FLOAT_VECTOR', 'POINT')            # position in hand axes (across, along, back)
me.attributes.new("fp", 'FLOAT_VECTOR', 'POINT')            # fingertip pad coordinates (u, v, -)
me.attributes.new("pc", 'FLOAT_VECTOR', 'POINT')            # palm plane: across from the index knuckle, along from the wrist
me.attributes.new("fcr", 'FLOAT_VECTOR', 'POINT')           # nearest finger crease: signed distance, half gap, strength
mask_vals, jd_vals, dors_vals, m2_vals, hc_vals, fp_vals, pc_vals, fc_vals = [], [], [], [], [], [], [], []
mw, mn = body.matrix_world, body.matrix_world.to_3x3()
for v in me.vertices:
    p = mw @ v.co; nrm = (mn @ v.normal).normalized()
    best = None
    for n, h, t, dz, bx, bz in segs:
        L = (t - h).length; d = (t - h) / L
        s = max(0.0, min(L, (p - h).dot(d)))
        dist = (p - (h + d * s)).length
        if best is None or dist < best[0]: best = (dist, s, L, dz, n, h, d, bx, bz)
    dist, s, L, dz, bname, bh, bd, bx, bz = best
    on_finger = dist < 0.014
    dorsal = ss(0.0, 0.5, nrm.dot(dz)) if on_finger else ss(0.0, 0.5, nrm.dot(back))
    palmar = ss(0.1, 0.6, -nrm.dot(dz)) if on_finger else ss(0.1, 0.6, -nrm.dot(back))
    dj = min((p - j).length for j in joints)
    dt = min((p - t).length for t in tips)
    knuckle = dorsal * math.exp(-(dj / 0.010) ** 2)
    tip = math.exp(-(dt / 0.013) ** 2)
    crease = palmar * math.exp(-(dj / 0.005) ** 2)
    mask_vals += [knuckle, tip, palmar, crease]
    jdv = min(s, L - s) if on_finger else 1.0
    jd_vals.append(jdv)
    dors_vals.append(dorsal)
    # hair: back of hand and forearm, thinner on the first finger segment, none further out
    seg_k = bname[-4:-2] if on_finger else ""
    hair_amt = 1.0 if not on_finger else (0.45 if seg_k == "01" else 0.0)
    to_wrist = (p - wrist).dot(fa)                       # > 0 up the forearm
    hairy = dorsal * hair_amt * (0.7 + 0.3 * ss(-0.02, 0.06, to_wrist))
    # flexion creases: thin lines across the palm side of each finger joint
    flex = palmar * math.exp(-(jdv / 0.0011) ** 2) if on_finger else 0.0
    # fingerprint: pad of the last segment of each finger
    fpm = 0.0; u = vv = 0.0
    if on_finger and seg_k == "03" and s > 0.25 * L:
        c = bh + bd * (0.55 * L) + bz * 0.006           # middle of the pad
        u, vv = (p - c).dot(bx), (p - c).dot(bd)
        fpm = palmar * math.exp(-((u / 0.007) ** 2 + (vv / 0.009) ** 2))
    vein_area = dorsal * (0.0 if on_finger else 1.0) * ss(-0.03, 0.0, (p - head("middle_01_r")).dot(-along))
    m2_vals += [hairy, flex, fpm, vein_area]
    hc_vals += [p.dot(across), p.dot(along), p.dot(back)]
    fp_vals += [u, vv, 0.0]
    pc_vals += [(p - I01).dot(across), (p - wrist).dot(along), 0.0]
    # Distance along the whole finger (continuous across its joints, so it interpolates cleanly over a
    # crease), measured to the nearest crease. Fades out off the finger and on the back.
    fin = bname.split("_")[0]
    t = CHAIN_OFF.get(bname, 0.0) + (p - bh).dot(bd)
    cr = min(CREASES[fin], key=lambda c: abs(t - c[0]))
    fc_vals += [t - cr[0], cr[1], palmar * ss(0.017, 0.011, dist) * cr[2] * (bname in CHAIN_OFF)]
# Fetch by name only now: adding an attribute invalidates earlier handles.
me.attributes["pc"].data.foreach_set("vector", pc_vals)
me.attributes["fcr"].data.foreach_set("vector", fc_vals)
me.attributes["masks2"].data.foreach_set("color", m2_vals)
me.attributes["hc"].data.foreach_set("vector", hc_vals)
me.attributes["fp"].data.foreach_set("vector", fp_vals)
me.attributes["masks"].data.foreach_set("color", mask_vals)
me.attributes["jd"].data.foreach_set("value", jd_vals)
me.attributes["dorsal"].data.foreach_set("value", dors_vals)

# ---- 5. bake materials ----
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 32
scene.render.bake.margin = 8
from bl_ext.user_default.mpfb.services.locationservice import LocationService
src_img = bpy.data.images.load(os.path.join(LocationService.get_user_data("skins"), "young_asian_male", "young_lightskinned_male_diffuse3.png"))
print("SOURCE texture", src_img.name, tuple(src_img.size))
nail_slots = {i for i, m in enumerate(me.materials) if m and "nail" in m.name.lower()}
me.attributes.new("nail", 'FLOAT', 'FACE')
me.attributes["nail"].data.foreach_set("value", [1.0 if p.material_index in nail_slots else 0.0 for p in me.polygons])
print("NAIL faces", sum(1 for p in me.polygons if p.material_index in nail_slots))
mat = bpy.data.materials.new("HandSkin"); mat.use_nodes = True
me.materials.clear(); me.materials.append(mat)
nt = mat.node_tree; N, Lk = nt.nodes, nt.links
for nd in list(N): N.remove(nd)
outn = N.new("ShaderNodeOutputMaterial")
def node(t, **kw):
    n = N.new(t)
    for k, v in kw.items(): setattr(n, k, v)
    return n
def mix(a, b, fac, blend='MIX'):
    m = node("ShaderNodeMix", data_type='RGBA', blend_type=blend)
    if isinstance(fac, float): m.inputs[0].default_value = fac
    else: Lk.new(fac, m.inputs[0])
    for sock, val in ((m.inputs[6], a), (m.inputs[7], b)):
        if isinstance(val, tuple): sock.default_value = (*val, 1)
        else: Lk.new(val, sock)
    return m.outputs[2]
def math_(op, a, b=None):
    m = node("ShaderNodeMath", operation=op)
    for sock, val in zip(m.inputs, (a, b)):
        if val is None: continue
        if isinstance(val, (int, float)): sock.default_value = val
        else: Lk.new(val, sock)
    return m.outputs[0]

uvo = node("ShaderNodeUVMap", uv_map=old_uv)
tex = node("ShaderNodeTexImage", image=src_img); Lk.new(uvo.outputs[0], tex.inputs[0])
attr = node("ShaderNodeAttribute", attribute_name="masks")
sep = node("ShaderNodeSeparateColor"); Lk.new(attr.outputs[0], sep.inputs[0])
K, T, Pm = sep.outputs[0], sep.outputs[1], sep.outputs[2]
cre = node("ShaderNodeAttribute", attribute_name="masks").outputs[3]  # alpha = folds
col = mix(tex.outputs[0], (0.93, 0.74, 0.60), 1.0, 'MULTIPLY')        # warmer, a touch deeper
col = mix(col, (0.66, 0.40, 0.33), math_('MULTIPLY', K, 0.55))        # redder, darker knuckles
col = mix(col, (0.86, 0.52, 0.47), math_('MULTIPLY', T, 0.40))        # pink fingertips
col = mix(col, (0.98, 0.80, 0.72), math_('MULTIPLY', Pm, 0.30))       # lighter, pinker palm
col = mix(col, (0.50, 0.30, 0.26), math_('MULTIPLY', cre, 0.25))      # darker palm folds (the crease lines add the rest)
# pores / blotches: small colour variation
tc = node("ShaderNodeTexCoord")
nz = node("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 260; nz.inputs["Detail"].default_value = 4
Lk.new(tc.outputs["Object"], nz.inputs["Vector"])
col = mix(col, (0.62, 0.40, 0.34), math_('MULTIPLY', math_('SUBTRACT', nz.outputs[0], 0.45), 0.35))

# ---- fine details: veins, hair, freckles, flexion creases, fingerprints ----
sep2 = node("ShaderNodeSeparateColor"); Lk.new(node("ShaderNodeAttribute", attribute_name="masks2").outputs["Color"], sep2.inputs[0])
HAIRY, FLEX, FPM = sep2.outputs[0], sep2.outputs[1], sep2.outputs[2]
VEINA = node("ShaderNodeAttribute", attribute_name="masks2").outputs["Alpha"]
DORS = node("ShaderNodeAttribute", attribute_name="dorsal").outputs["Fac"]
hc = node("ShaderNodeAttribute", attribute_name="hc").outputs["Vector"]
def mapping(vec, scale):
    m = node("ShaderNodeMapping", vector_type='POINT'); m.inputs["Scale"].default_value = scale
    Lk.new(vec, m.inputs["Vector"]); return m.outputs[0]
def voronoi(vec, scale, feature='F1'):
    v = node("ShaderNodeTexVoronoi", feature=feature); v.inputs["Scale"].default_value = scale
    Lk.new(vec, v.inputs["Vector"]); return v
def noise(vec, scale, detail=2):
    n = node("ShaderNodeTexNoise"); n.inputs["Scale"].default_value = scale; n.inputs["Detail"].default_value = detail
    Lk.new(vec, n.inputs["Vector"]); return n
# veins: wandering branching lines along the back of the hand, raised and faintly blue
vcoord = mapping(hc, (1.0, 0.35, 1.0))
warp = node("ShaderNodeVectorMath", operation='MULTIPLY_ADD')
Lk.new(noise(vcoord, 30, 3).outputs["Color"], warp.inputs[0]); warp.inputs[1].default_value = (0.012, 0.012, 0.012); Lk.new(vcoord, warp.inputs[2])
vor = voronoi(warp.outputs[0], 38, 'DISTANCE_TO_EDGE')
vr = node("ShaderNodeMapRange", interpolation_type='SMOOTHERSTEP'); vr.inputs[1].default_value = 0.0; vr.inputs[2].default_value = 0.11
vr.inputs[3].default_value = 1.0; vr.inputs[4].default_value = 0.0; Lk.new(vor.outputs["Distance"], vr.inputs[0])
patch = node("ShaderNodeMapRange"); patch.inputs[1].default_value = 0.42; patch.inputs[2].default_value = 0.6
Lk.new(noise(hc, 14, 1).outputs[0], patch.inputs[0])
VEIN = math_('MULTIPLY', math_('MULTIPLY', vr.outputs[0], patch.outputs[0]), VEINA)
# hair: fine short strokes lying along the arm, sparse
hv = voronoi(mapping(hc, (1.0, 0.22, 1.0)), 650)
hsep = node("ShaderNodeSeparateColor"); Lk.new(hv.outputs["Color"], hsep.inputs[0])
HAIR = math_('MULTIPLY', math_('MULTIPLY', math_('LESS_THAN', hv.outputs["Distance"], 0.13), math_('GREATER_THAN', hsep.outputs[0], 0.55)), HAIRY)
# freckles: a few tiny darker spots on the back
fv = voronoi(hc, 220)
fsep = node("ShaderNodeSeparateColor"); Lk.new(fv.outputs["Color"], fsep.inputs[0])
FRECK = math_('MULTIPLY', math_('MULTIPLY', math_('LESS_THAN', fv.outputs["Distance"], 0.11), math_('GREATER_THAN', fsep.outputs[1], 0.93)), DORS)
# fingerprints: ridge loops on each fingertip pad
fpv = node("ShaderNodeSeparateXYZ"); Lk.new(node("ShaderNodeAttribute", attribute_name="fp").outputs["Vector"], fpv.inputs[0])
rr = math_('SQRT', math_('ADD', math_('POWER', fpv.outputs[0], 2.0), math_('POWER', math_('MULTIPLY', fpv.outputs[1], 1.35), 2.0)))
ridge_in = math_('ADD', math_('MULTIPLY', rr, 2 * math.pi / 0.00048), math_('MULTIPLY', noise(hc, 900, 2).outputs[0], 4.0))
FP = math_('MULTIPLY', math_('SINE', ridge_in), FPM)

# palm lines: the three main creases, the wrist bracelets and a few minor lines, drawn in the palm plane.
# Points are (u, v): u = 0 at the index knuckle, 1 at the little-finger knuckle; v = 0 at the wrist, 1 at the
# middle knuckle. Ends that run off the edge of the hand sit outside it (|u| > 1.2), where the palm mask
# fades them; ends inside the palm taper off.
Wd = (head("pinky_01_r") - I01).dot(across)
Ln = (head("middle_01_r") - wrist).dot(along)
PALM_LINES = [  # points, width (m), strength
    ([(1.35, 0.76), (1.1, 0.775), (0.9, 0.80), (0.7, 0.83), (0.52, 0.87), (0.38, 0.92), (0.28, 0.98)], 0.00080, 1.0),   # heart
    ([(-0.35, 0.78), (-0.1, 0.765), (0.1, 0.73), (0.32, 0.675), (0.55, 0.62), (0.72, 0.58), (0.86, 0.56)], 0.00072, 0.95),  # head
    ([(-0.35, 0.78), (-0.1, 0.745), (0.06, 0.66), (0.18, 0.54), (0.26, 0.40), (0.31, 0.26), (0.34, 0.12), (0.36, 0.01), (0.38, -0.04)], 0.00080, 1.0),  # life
    ([(-0.45, 0.0), (0.0, 0.015), (0.5, 0.02), (1.0, 0.0), (1.45, -0.02)], 0.00055, 0.75),                               # wrist
    ([(-0.45, -0.085), (0.5, -0.07), (1.45, -0.10)], 0.00045, 0.55),                                                     # wrist, lower
    ([(0.52, 0.06), (0.50, 0.33), (0.47, 0.58)], 0.00038, 0.4),                                                         # fate
    ([(1.35, 0.50), (1.08, 0.515), (0.93, 0.535)], 0.00038, 0.4),                                                       # little-finger side
    ([(1.35, 0.38), (1.1, 0.39)], 0.00034, 0.3),
    ([(-0.05, 0.50), (0.1, 0.38)], 0.00032, 0.3),                                                                        # thumb mound
    ([(-0.1, 0.38), (0.12, 0.25)], 0.00032, 0.28),
    ([(-0.15, 0.28), (0.1, 0.16)], 0.00030, 0.22),
    ([(-0.3, 0.46), (-0.12, 0.40), (0.05, 0.30)], 0.00034, 0.35),                                                        # more on the thumb mound,
    ([(-0.32, 0.30), (-0.1, 0.22), (0.08, 0.10)], 0.00034, 0.32),                                                        # where it folds as the
    ([(-0.28, 0.60), (-0.05, 0.56), (0.12, 0.47)], 0.00032, 0.3),                                                        # thumb grips
    ([(-0.35, 0.15), (-0.15, 0.08), (0.05, 0.05)], 0.00030, 0.25),
    ([(1.35, 0.28), (1.12, 0.29), (0.98, 0.31)], 0.00032, 0.28),                                                         # outer palm
    ([(1.35, 0.62), (1.15, 0.63), (1.0, 0.66)], 0.00030, 0.25),
]
def vmath(op, a, b=None, scale=None):
    m = node("ShaderNodeVectorMath", operation=op)
    for sock, val in zip(m.inputs[:2], (a, b)):
        if val is None: continue
        if isinstance(val, (tuple, Vector)): sock.default_value = tuple(val)[:3]
        else: Lk.new(val, sock)
    if scale is not None:
        if isinstance(scale, (int, float)): m.inputs["Scale"].default_value = scale
        else: Lk.new(scale, m.inputs["Scale"])
    return m
pc_attr = node("ShaderNodeAttribute", attribute_name="pc").outputs["Vector"]
wob = noise(hc, 70, 3)   # lines wander a little
wob_v = vmath('MULTIPLY', vmath('SUBTRACT', wob.outputs["Color"], (0.5, 0.5, 0.5)).outputs[0], (0.0028, 0.0028, 0.0))
PC = vmath('ADD', pc_attr, wob_v.outputs[0]).outputs[0]
depth_n = noise(hc, 120, 2).outputs[0]   # and get deeper and shallower along their length
depth_mod = math_('MAXIMUM', math_('ADD', math_('MULTIPLY', depth_n, 1.1), -0.15), 0.25)
def seg_dist(P, a, b):
    ba = b - a
    pa = vmath('SUBTRACT', P, a).outputs[0]
    h = node("ShaderNodeMath", operation='MULTIPLY', use_clamp=True)
    Lk.new(vmath('DOT_PRODUCT', pa, ba).outputs["Value"], h.inputs[0]); h.inputs[1].default_value = 1.0 / ba.length_squared
    proj = vmath('SCALE', ba, scale=h.outputs[0]).outputs[0]
    return vmath('DISTANCE', pa, proj).outputs["Value"]
PALM = None
for pts, width, strength in PALM_LINES:
    P3 = [Vector((u * Wd, v * Ln, 0.0)) for u, v in pts]
    d = None
    for a, b in zip(P3, P3[1:]):
        sd = seg_dist(PC, a, b)
        d = sd if d is None else math_('MINIMUM', d, sd)
    prof = math_('EXPONENT', math_('MULTIPLY', math_('POWER', math_('DIVIDE', d, width), 2.0), -1.0))
    taper = math_('MINIMUM', vmath('DISTANCE', PC, P3[0]).outputs["Value"], vmath('DISTANCE', PC, P3[-1]).outputs["Value"])
    taper = math_('MINIMUM', math_('DIVIDE', taper, 0.009), 1.0)
    line = math_('MULTIPLY', math_('MULTIPLY', prof, taper), strength)
    PALM = line if PALM is None else math_('MAXIMUM', PALM, line)
PALM = math_('MULTIPLY', math_('MULTIPLY', PALM, depth_mod), Pm)

# finger flexion creases (replace the old single hairline): a double line at the middle joint, a single or
# close pair at the others, broken up along their length
fcr = node("ShaderNodeSeparateXYZ"); Lk.new(node("ShaderNodeAttribute", attribute_name="fcr").outputs["Vector"], fcr.inputs[0])
fx = math_('DIVIDE', math_('SUBTRACT', math_('ABSOLUTE', fcr.outputs[0]), fcr.outputs[1]), 0.00042)
FLEX = math_('MULTIPLY', math_('EXPONENT', math_('MULTIPLY', math_('POWER', fx, 2.0), -1.0)), fcr.outputs[2])
FLEX = math_('MULTIPLY', FLEX, math_('MINIMUM', math_('ADD', math_('MULTIPLY', noise(hc, 400, 2).outputs[0], 1.4), -0.1), 1.0))

# skin furrows: the fine criss-cross grooves of real skin, two families of wavy lines crossing at an angle
# (in the hand's own axes, so they cross on the back and the palm). Coarser and deeper on the palm.
def furrow_lines(period, angle):
    m = node("ShaderNodeMapping", vector_type='POINT'); m.inputs["Rotation"].default_value = (0.0, 0.0, angle)
    Lk.new(hc, m.inputs["Vector"])
    wv = node("ShaderNodeTexWave", wave_type='BANDS', bands_direction='X', wave_profile='SIN')
    wv.inputs["Scale"].default_value = 2 * math.pi / (20 * period)
    wv.inputs["Distortion"].default_value = 9.0; wv.inputs["Detail"].default_value = 3.0; wv.inputs["Detail Scale"].default_value = 1.3
    Lk.new(m.outputs[0], wv.inputs["Vector"])
    # each family comes and goes in patches, so no regular grid forms
    patch = noise(m.outputs[0], 1.0 / (period * 9), 1).outputs[0]
    patch = math_('MAXIMUM', math_('ADD', math_('MULTIPLY', patch, 2.6), -0.9), 0.0)
    return math_('MULTIPLY', math_('POWER', wv.outputs["Fac"], 10.0), math_('MINIMUM', patch, 1.0))
def furrows(period):
    return math_('MAXIMUM', math_('MAXIMUM', furrow_lines(period, 0.55), furrow_lines(period * 1.2, -0.75)),
                 furrow_lines(period * 0.9, 1.75))
fur_break = math_('MAXIMUM', math_('ADD', math_('MULTIPLY', noise(hc, 90, 2).outputs[0], 1.6), -0.35), 0.0)
NET = math_('MULTIPLY', math_('MULTIPLY', furrows(0.0024), Pm), fur_break)
FUR = math_('MULTIPLY', furrows(0.0011), fur_break)

# These lines are too many nodes to evaluate with everything else (Cycles runs out of shader stack), so
# bake them to a map of their own first (R = palm lines, G = finger creases, B = palm furrows) and read
# that map in the colour and normal bakes.
grv = node("ShaderNodeCombineColor")
Lk.new(PALM, grv.inputs[0]); Lk.new(FLEX, grv.inputs[1]); Lk.new(NET, grv.inputs[2])
emit_g = node("ShaderNodeEmission"); Lk.new(grv.outputs[0], emit_g.inputs[0]); Lk.new(emit_g.outputs[0], outn.inputs[0])
grv_img = bpy.data.images.new("hand_grooves", 2048, 2048, alpha=False, float_buffer=True)
grv_img.colorspace_settings.name = 'Non-Color'
grv_node = node("ShaderNodeTexImage", image=grv_img); N.active = grv_node; grv_node.select = True
me.uv_layers.active = me.uv_layers["detail"]
for uv in me.uv_layers: uv.active_render = (uv.name == "detail")
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
rig.data.pose_position = 'REST'
bpy.ops.object.bake(type='EMIT')
grv_img.filepath_raw = os.path.join(out, "hand_grooves.exr"); grv_img.file_format = 'OPEN_EXR'; grv_img.save()
print("BAKED grooves")
for l in list(Lk):
    if l.to_node == outn: Lk.remove(l)
grv_read = node("ShaderNodeTexImage", image=grv_img, interpolation='Cubic')
Lk.new(node("ShaderNodeUVMap", uv_map="detail").outputs[0], grv_read.inputs[0])
grv_sep = node("ShaderNodeSeparateColor"); Lk.new(grv_read.outputs[0], grv_sep.inputs[0])
PALM, FLEX, NET = grv_sep.outputs[0], grv_sep.outputs[1], grv_sep.outputs[2]

col = mix(col, (0.52, 0.31, 0.27), math_('MULTIPLY', PALM, 0.75))
col = mix(col, (0.60, 0.40, 0.35), math_('MULTIPLY', NET, 0.16))
col = mix(col, (0.62, 0.42, 0.36), math_('MULTIPLY', FUR, 0.05))
col = mix(col, (0.48, 0.50, 0.62), math_('MULTIPLY', VEIN, 0.18))
col = mix(col, (0.20, 0.15, 0.12), math_('MULTIPLY', HAIR, 0.5))
col = mix(col, (0.55, 0.36, 0.30), math_('MULTIPLY', FRECK, 0.4))
col = mix(col, (0.45, 0.27, 0.23), math_('MULTIPLY', FLEX, 0.7))
col = mix(col, (0.70, 0.50, 0.45), math_('MULTIPLY', math_('MAXIMUM', math_('MULTIPLY', FP, -1.0), 0.0), 0.06))
# ambient occlusion: darker between fingers and in folds
ao = node("ShaderNodeAmbientOcclusion", samples=24); ao.inputs["Distance"].default_value = 0.012
aof = math_('POWER', ao.outputs["AO"], 1.6)
col = mix(col, mix(col, (0.0, 0.0, 0.0), 1.0, 'MULTIPLY'), math_('SUBTRACT', 1.0, aof))
# nails last, clean (no pores, no darkening): pale pink, lighter towards the free edge
nailf = node("ShaderNodeAttribute", attribute_name="nail").outputs["Fac"]
nailc = mix((0.93, 0.74, 0.70), (0.98, 0.91, 0.87), math_('MULTIPLY', T, 0.8))
col = mix(col, nailc, math_('MULTIPLY', nailf, 0.9))
emit = node("ShaderNodeEmission"); Lk.new(col, emit.inputs[0])
Lk.new(emit.outputs[0], outn.inputs[0])

# target images
def target(name):
    img = bpy.data.images.new(name, 2048, 2048, alpha=False, float_buffer=False)
    n = node("ShaderNodeTexImage", image=img); N.active = n; n.select = True
    return img, n
col_img, col_node = target("hand_color")
me.uv_layers.active = me.uv_layers["detail"]
for uv in me.uv_layers: uv.active_render = (uv.name == "detail")
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
# bake in rest pose
rig.data.pose_position = 'REST'
bpy.ops.object.bake(type='EMIT')
col_img.filepath_raw = os.path.join(out, "hand_color.png"); col_img.file_format = 'PNG'; col_img.save()
print("BAKED colour")

# normal detail: pores everywhere, fine wrinkle lines across the back of each finger joint
for l in list(Lk):
    if l.to_node == outn: Lk.remove(l)
bsdf = node("ShaderNodeBsdfPrincipled")
jd = node("ShaderNodeAttribute", attribute_name="jd").outputs["Fac"]
dor = node("ShaderNodeAttribute", attribute_name="dorsal").outputs["Fac"]
band = math_('SINE', math_('MULTIPLY', jd, 2 * math.pi / 0.0017))
near = math_('SUBTRACT', 1.0, math_('MINIMUM', math_('DIVIDE', jd, 0.0075), 1.0))
wrinkle = math_('MULTIPLY', math_('MULTIPLY', band, near), dor)
# break up the lines so they don't look like a ladder: uneven depth and length
brk = node("ShaderNodeTexNoise"); brk.inputs["Scale"].default_value = 160; brk.inputs["Detail"].default_value = 2
Lk.new(tc.outputs["Object"], brk.inputs["Vector"])
wrinkle = math_('MULTIPLY', wrinkle, math_('MAXIMUM', math_('SUBTRACT', math_('MULTIPLY', brk.outputs[0], 2.2), 0.7), 0.0))
pore = node("ShaderNodeTexVoronoi"); pore.inputs["Scale"].default_value = 1400
Lk.new(tc.outputs["Object"], pore.inputs["Vector"])
fine = node("ShaderNodeTexNoise"); fine.inputs["Scale"].default_value = 700; fine.inputs["Detail"].default_value = 6
Lk.new(tc.outputs["Object"], fine.inputs["Vector"])
# The bump runs at full strength so the creases cut in deep; the fine relief (pores, wrinkles, veins, hair,
# fingerprints) is halved to stay as it was at the old half strength.
skin_h = math_('ADD', math_('MULTIPLY', wrinkle, 0.15), math_('ADD', math_('MULTIPLY', pore.outputs["Distance"], 0.07), math_('MULTIPLY', fine.outputs[0], 0.05)))
details_h = math_('ADD', math_('ADD', math_('MULTIPLY', VEIN, 0.11), math_('MULTIPLY', HAIR, 0.075)), math_('MULTIPLY', FP, 0.1))
skin_h = math_('ADD', skin_h, details_h)
grooves = math_('ADD', math_('ADD', math_('MULTIPLY', PALM, 2.4), math_('MULTIPLY', FLEX, 1.4)),
                math_('ADD', math_('MULTIPLY', NET, 0.3), math_('MULTIPLY', FUR, 0.14)))
skin_h = math_('SUBTRACT', skin_h, grooves)
nailb = node("ShaderNodeAttribute", attribute_name="nail").outputs["Fac"]
height = math_('MULTIPLY', skin_h, math_('SUBTRACT', 1.0, nailb))   # nails stay smooth
bump = node("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.9; bump.inputs["Distance"].default_value = 0.0004
Lk.new(height, bump.inputs["Height"]); Lk.new(bump.outputs[0], bsdf.inputs["Normal"])
Lk.new(bsdf.outputs[0], outn.inputs[0])
nrm_img, nrm_node = target("hand_normal")
nrm_img.colorspace_settings.name = 'Non-Color'
scene.render.bake.normal_space = 'TANGENT'
bpy.ops.object.bake(type='NORMAL')
nrm_img.filepath_raw = os.path.join(out, "hand_normal.png"); nrm_img.file_format = 'PNG'; nrm_img.save()
print("BAKED normal")
rig.data.pose_position = 'POSE'

# ---- 6. final material: the baked maps on the new UVs ----
for nd in list(N): N.remove(nd)
outn = N.new("ShaderNodeOutputMaterial")
bsdf = N.new("ShaderNodeBsdfPrincipled")
bsdf.inputs["Roughness"].default_value = 0.52
bsdf.inputs["Subsurface Weight"].default_value = 0.12
bsdf.inputs["Subsurface Radius"].default_value = (1.0, 0.35, 0.2)
bsdf.inputs["Subsurface Scale"].default_value = 0.004
bsdf.inputs["Specular IOR Level"].default_value = 0.45
uvd = N.new("ShaderNodeUVMap"); uvd.uv_map = "detail"
ct = N.new("ShaderNodeTexImage"); ct.image = col_img; Lk.new(uvd.outputs[0], ct.inputs[0]); Lk.new(ct.outputs[0], bsdf.inputs["Base Color"])
nt_ = N.new("ShaderNodeTexImage"); nt_.image = nrm_img; Lk.new(uvd.outputs[0], nt_.inputs[0])
nm = N.new("ShaderNodeNormalMap"); nm.uv_map = "detail"; Lk.new(nt_.outputs[0], nm.inputs["Color"]); Lk.new(nm.outputs[0], bsdf.inputs["Normal"])
Lk.new(bsdf.outputs[0], outn.inputs[0])
# only the new UVs remain, so a glTF export uses them
me.uv_layers.remove(me.uv_layers[old_uv])
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "hand_detail.blend"))
print("DONE")

