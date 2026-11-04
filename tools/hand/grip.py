# Poses the MPFB right hand round a box the size of the site's phone and renders it.
# Run: blender -b human.blend --python grip.py -- <outdir> <tag> <params.json>
import bpy, bmesh, sys, os, json, math
from mathutils import Vector, Matrix, Quaternion

args = sys.argv[sys.argv.index('--') + 1:]
out, tag = args[0], args[1]
P = json.load(open(args[2], encoding='utf-8-sig'))
CM = 0.01
PS = P.get("phone_scale", 1.0)  # < 1 = the hand is bigger compared with the phone
PW, PH, PD = 7.4 * CM * PS, 15.4 * CM * PS, 0.85 * CM * PS
SHUTTER = Vector((0, -4.14 * CM * PS, PD / 2))  # bottom centre of the screen, phone space

scene = bpy.context.scene
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig)
B, pb, W = rig.data.bones, rig.pose.bones, rig.matrix_world

def head(n): return W @ B[n].head_local
def tail(n): return W @ B[n].tail_local
def phead(n): return W @ pb[n].head
def ptail(n): return W @ pb[n].tail

if P.get("skin"):
    from bl_ext.user_default.mpfb.services.humanservice import HumanService
    from bl_ext.user_default.mpfb.services.locationservice import LocationService
    HumanService.set_character_skin(os.path.join(LocationService.get_user_data("skins"), P["skin"], P["skin"] + ".mhmat"), body,
                                    skin_type=P.get("skin_type", "ENHANCED_SSS"))
if P.get("tint"):
    # Multiply the skin texture by a tint, the same thing the site can do on its material.
    for m in body.data.materials:
        if not m or not m.use_nodes: continue
        nt = m.node_tree
        bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        link = bsdf and next((l for l in nt.links if l.to_socket == bsdf.inputs["Base Color"]), None)
        if not link: continue
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = 'RGBA'; mix.blend_type = 'MULTIPLY'
        mix.inputs["Factor"].default_value = 1.0
        mix.inputs[7].default_value = (*P["tint"], 1)
        nt.links.new(link.from_socket, mix.inputs[6]); nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        print("TINT", m.name)

# ---- keep only the arm ----
ARM = {"lowerarm_r", "hand_r", "upperarm_r", "lowerarm_twist_01_r", "upperarm_twist_01_r"} | \
      {f"{f}_{k}_r" for f in ["thumb", "index", "middle", "ring", "pinky"] for k in ["01", "02", "03"]}
gi = {g.index: g.name for g in body.vertex_groups}
bpy.context.view_layer.objects.active = body
bm = bmesh.new(); bm.from_mesh(body.data)
deform = bm.verts.layers.deform.active
kill = []
for v in bm.verts:
    w = {gi[i]: x for i, x in v[deform].items()} if deform else {}
    arm = sum(x for n, x in w.items() if n in ARM)
    if arm < 0.5 or w.get("body", 0) <= 0: kill.append(v)  # also drop MPFB's clothes-fitting helpers
bmesh.ops.delete(bm, geom=kill, context='VERTS')
bm.to_mesh(body.data); bm.free()
for m in list(body.modifiers):
    if m.type == 'MASK': body.modifiers.remove(m)
sub = body.modifiers.new("smooth", 'SUBSURF'); sub.levels = 1; sub.render_levels = P.get("preview_subsurf", 1)
# subsurf must come after the armature
bpy.context.view_layer.objects.active = body
while body.modifiers[-1].name != "smooth":
    bpy.ops.object.modifier_move_down(modifier="smooth")
# Bone-only searches don't need the skin deformed on every step: keep it switched off until checked.
body.hide_viewport = True

# ---- hand frame (rest) ----
across = (head("pinky_01_r") - head("index_01_r")).normalized()
along = (head("middle_01_r") - head("hand_r")).normalized()
back = across.cross(along).normalized()
along = back.cross(across).normalized()

# ---- phone placement: screen faces away from the palm, top towards the index finger ----
pz = -back                      # screen normal
py = -across                    # up the phone
py = (py - pz * py.dot(pz)).normalized()
if P.get("roll"):               # turn the phone in its own plane (degrees)
    py = Quaternion(pz, math.radians(P["roll"])) @ py
px = py.cross(pz).normalized()
if P.get("tilt"):               # turn the phone about its long side (degrees)
    tq = Quaternion(py, math.radians(P["tilt"]))
    px, pz = tq @ px, tq @ pz
R = Matrix((px, py, pz)).transposed()
if "web" in P:
    # The phone's right edge (back corner) rests in the web between thumb and index finger.
    web = (head("thumb_02_r") + head("index_01_r")) / 2
    off = P["web"]  # [along the phone (cm), out from the palm (cm), along the hand (cm)]
    web = web - back * off[1] * CM + along * off[2] * CM
    origin = web - R @ Vector((PW / 2, off[0] * CM, -PD / 2))
else:
    k = Vector(P["knuckle"]) * CM   # middle knuckle in phone space
    origin = head("middle_01_r") - R @ k
phone_M = Matrix.Translation(origin) @ R.to_4x4()
phone_inv = phone_M.inverted()
bpy.ops.mesh.primitive_cube_add(size=1)
phone = bpy.context.active_object; phone.name = "Phone"
phone.scale = (PW, PH, PD); phone.matrix_world = phone_M @ Matrix.Diagonal((PW, PH, PD, 1))
bev = phone.modifiers.new("bevel", 'BEVEL'); bev.width = 0.008; bev.segments = 6
mat = bpy.data.materials.new("phone"); mat.diffuse_color = (0.08, 0.1, 0.2, 1); mat.use_nodes = True
mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.05, 0.07, 0.16, 1)
phone.data.materials.append(mat)
# screen
bpy.ops.mesh.primitive_plane_add(size=1)
screen = bpy.context.active_object
screen.matrix_world = phone_M @ Matrix.Translation((0, 0, PD / 2 + 0.0002)) @ Matrix.Diagonal((6.7 * CM, 14.7 * CM, 1, 1))
smat = bpy.data.materials.new("screen"); smat.use_nodes = True
smat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.9, 0.92, 0.96, 1)
screen.data.materials.append(smat)
bpy.ops.mesh.primitive_cylinder_add(radius=0.67 * CM, depth=0.0004)
dot = bpy.context.active_object; dot.matrix_world = phone_M @ Matrix.Translation(SHUTTER + Vector((0, 0, 0.0004)))
dmat = bpy.data.materials.new("dot"); dmat.use_nodes = True
dmat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.2, 0.35, 0.85, 1)
dot.data.materials.append(dmat)

def inside(p_world, r):
    p = phone_inv @ p_world
    q = Vector((abs(p.x) - PW / 2, abs(p.y) - PH / 2, abs(p.z) - PD / 2))
    outside = Vector((max(q.x, 0), max(q.y, 0), max(q.z, 0))).length
    return outside + min(max(q.x, q.y, q.z), 0) < r

# ---- fingers: close each joint until the finger touches the phone ----
SPREAD = {f"{f}_01_r": math.radians(a) for f, a in P.get("spread", {}).items()}
def set_rot(name, axis_world, angle):
    rest = (W.to_3x3() @ B[name].matrix_local.to_3x3()).to_quaternion()
    p = pb[name]; p.rotation_mode = 'QUATERNION'
    q = Quaternion(rest.inverted() @ axis_world, angle)
    if name in SPREAD:  # sideways at the knuckle, about the back-of-hand axis (+ = towards the index finger)
        q = Quaternion(rest.inverted() @ back, SPREAD[name]) @ q
    p.rotation_quaternion = q

R_F = P.get("finger_radius", 0.85) * CM
limits = [math.radians(a) for a in P.get("limits", [85, 105, 75])]
spread = P.get("spread", {})
finger_pose = {}
for f in ["index", "middle", "ring", "pinky"]:
    names = [f"{f}_{j}_r" for j in ["01", "02", "03"]]
    d0 = (tail(names[0]) - head(names[0])).normalized()
    axis = -across - d0 * (-across).dot(d0); axis.normalize()
    # Joint angles at rest (the model's fingers are a little curled): measured against the palm for the knuckle.
    dirs = [along] + [(tail(n) - head(n)).normalized() for n in names]
    rest = [math.atan2(dirs[j].cross(dirs[j + 1]).dot(axis), dirs[j].dot(dirs[j + 1])) for j in range(3)]
    print("REST", f, [round(math.degrees(r), 1) for r in rest])
    # From here on, angles are real joint angles: 0 = straight.
    open_ = [math.radians(a) - r for a, r in zip(P.get("open", [0, 5, 5]), rest)]
    bends = list(open_)
    for j in range(3): set_rot(names[j], axis, bends[j])
    def touches(segs=(0, 1, 2)):
        bpy.context.view_layer.update()
        pts = [phead(n) for n in names] + [ptail(names[2])]
        return any(inside(pts[s].lerp(pts[s + 1], j / 6), R_F) for s in segs for j in range(0, 7))
    def search(pose, segs=(0, 1, 2), top=math.radians(130)):
        lo, hi = 0.0, top
        for _ in range(16):
            mid = (lo + hi) / 2
            pose(mid)
            if touches(segs): hi = mid
            else: lo = mid
        pose(lo)
        return lo
    if P.get("tip"):
        # Curl so the fingertip ends just past the phone's left edge (only the tip shows from the front).
        # Two numbers per finger: knuckle bend, and curl of the outer two joints. Pick the pair that puts
        # the tip closest to the target without the finger touching the phone.
        tip_p = P.get("tip_by", {}).get(f, P["tip"])
        tx = -PW / 2 - tip_p[0] * CM
        tz = tip_p[1] * CM
        r2 = P.get("wrap_ratio", [1.0, 0.8])
        def pose2(m, t, names=names, axis=axis, open_=open_, rest=rest, bends=bends, r2=r2):
            bends[0] = open_[0] + m
            for j, r in zip((1, 2), r2):
                bends[j] = open_[j] + min(t * r, limits[j] - rest[j] - open_[j])
            for j in range(3): set_rot(names[j], axis, bends[j])
        best_ = None
        for m in [math.radians(a) for a in range(0, int(math.degrees(limits[0] - rest[0] - open_[0])) + 1, 3)]:
            for t in [math.radians(a) for a in range(0, 131, 4)]:
                pose2(m, t)
                if touches(): continue
                tip = phone_inv @ ptail(names[2])
                err = abs(tip.x - tx) + 0.6 * abs(tip.z - tz)
                if best_ is None or err < best_[0]: best_ = (err, m, t)
        _, m, t = best_
        pose2(m, t)
        def pose_at(t, m=m, pose2=pose2): pose2(m, t)
        lo = t
        print("FINGER", f, "tip error cm", round(best_[0] / CM, 2))
    elif P.get("wrap"):
        # Like a real hand round an edge: the knuckle swings the finger onto the phone's edge,
        # then the two outer joints curl round it.
        def mcp_at(t, names=names, axis=axis, open_=open_, bends=bends):
            bends[0] = open_[0] + t
            for j in range(3): set_rot(names[j], axis, bends[j])
        mcp = max(search(mcp_at, top=limits[0] - rest[0] - open_[0]) - math.radians(P.get("mcp_back", 4)), 0)
        mcp_at(mcp)
        r2 = P.get("wrap_ratio", [1.0, 0.8])
        def pose_at(t, names=names, axis=axis, open_=open_, rest=rest, bends=bends, mcp=mcp, r2=r2):
            bends[0] = open_[0] + mcp
            for j, r in zip((1, 2), r2):
                bends[j] = open_[j] + min(t * r, limits[j] - rest[j] - open_[j])
            for j in range(3): set_rot(names[j], axis, bends[j])
        lo = search(pose_at, segs=(1, 2))
    else:
        # Real fingers curl all three joints together (the middle joint most), so search one curl amount.
        ratio = P.get("ratio", [0.6, 1.0, 0.7])
        def pose_at(t, names=names, axis=axis, open_=open_, rest=rest, bends=bends, ratio=ratio):
            for j in range(3):
                bends[j] = open_[j] + min(t * ratio[j], limits[j] - rest[j] - open_[j])
                set_rot(names[j], axis, bends[j])
        lo = search(pose_at)
    finger_pose[f] = (pose_at, lo)
    bpy.context.view_layer.update()
    tip = phone_inv @ ptail(names[2])
    print("TIP", f, "in phone cm", tuple(round(c / CM, 1) for c in tip), "(left edge x =", -PW / 2 / CM, ")")
    print("FINGER", f, "joint angles", [round(math.degrees(b + r), 1) for b, r in zip(bends, rest)])

# ---- thumb: IK onto the shutter ----
target = bpy.data.objects.new("thumb_target", None); scene.collection.objects.link(target)
press = P.get("thumb_gap", 0.6) * CM
target.location = phone_M @ (SHUTTER + Vector((0, 0, press)))
ik = pb["thumb_03_r"].constraints.new('IK'); ik.target = target; ik.chain_count = P.get("thumb_chain", 3)
for n, s in P.get("thumb_stiff", {}).items(): setattr(pb[n], "ik_stiffness_x", s); setattr(pb[n], "ik_stiffness_y", s); setattr(pb[n], "ik_stiffness_z", s)
bpy.context.view_layer.update()
mats = {n: pb[n].matrix.copy() for n in ["thumb_01_r", "thumb_02_r", "thumb_03_r"]}
pb["thumb_03_r"].constraints.remove(ik)
for n in ["thumb_01_r", "thumb_02_r", "thumb_03_r"]:
    pb[n].matrix = mats[n]; bpy.context.view_layer.update()
print("THUMB tip to target cm", round((ptail("thumb_03_r") - target.location).length / CM, 2))
for n in ["thumb_01_r", "thumb_02_r", "thumb_03_r"]:
    print("THUMB", n, [round(math.degrees(a), 1) for a in pb[n].rotation_quaternion.to_euler()])

def skin_inside(tol=0.0):
    """Count skin points (after posing and smoothing) inside the phone, by the bone that moves them most."""
    sub.show_viewport = False  # compare against the unsmoothed mesh so point i is vertex i
    body.hide_viewport = False
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg); me = ev.to_mesh()
    src = body.data
    counts, deepest = {}, {}
    for i, v in enumerate(me.vertices):
        p = phone_inv @ (ev.matrix_world @ v.co)
        q = Vector((abs(p.x) - PW / 2, abs(p.y) - PH / 2, abs(p.z) - PD / 2))
        if max(q.x, q.y, q.z) < -tol:
            # subsurf adds points; map back to the nearest original vertex group via index when possible
            gs = [g for g in src.vertices[i].groups if body.vertex_groups[g.group].name in ARM]
            gname = body.vertex_groups[max(gs, key=lambda g: g.weight).group].name if gs else "?"
            counts[gname] = counts.get(gname, 0) + 1
            deepest[gname] = max(deepest.get(gname, 0), -max(q.x, q.y, q.z) / CM)
    ev.to_mesh_clear()
    sub.show_viewport = True
    body.hide_viewport = True
    return counts, deepest

c, d = skin_inside()
print("INSIDE before", {k: (c[k], round(d[k], 2)) for k in c} or "none")

# ---- no skin inside the phone: measured on the real skin, not the bones ----
# Thumb: lift the IK target off the screen until the pad just rests on it.
def thumb_ik(point):
    target.location = point
    for n in ["thumb_01_r", "thumb_02_r", "thumb_03_r"]:
        pb[n].matrix_basis = Matrix.Identity(4)
    ik = pb["thumb_03_r"].constraints.new('IK'); ik.target = target; ik.chain_count = 3
    bpy.context.view_layer.update()
    mats = {n: pb[n].matrix.copy() for n in ["thumb_01_r", "thumb_02_r", "thumb_03_r"]}
    pb["thumb_03_r"].constraints.remove(ik)
    for n in ["thumb_01_r", "thumb_02_r", "thumb_03_r"]:
        pb[n].matrix = mats[n]; bpy.context.view_layer.update()
THUMB = {"thumb_01_r", "thumb_02_r", "thumb_03_r"}
for n in ["thumb_01_r", "thumb_02_r", "thumb_03_r"]:
    print("THUMBPOS", n, "head in phone cm", tuple(round(c / CM, 2) for c in phone_inv @ phead(n)))
print("THUMBPOS rest head of thumb_02 cm", tuple(round(c / CM, 2) for c in phone_inv @ head("thumb_02_r")))
def thumb_in():
    c, _ = skin_inside(); return sum(v for k, v in c.items() if k in THUMB)
# The thumb's base swings up over the phone's edge (set here), then IK curls the last two joints onto the
# shutter. Try a grid of swings; keep the gentlest one where no thumb skin is inside and the pad rests on it.
def set_thumb_base(a, b):
    rest = (W.to_3x3() @ B["thumb_01_r"].matrix_local.to_3x3()).to_quaternion()
    qw = Quaternion(py, math.radians(a)) @ Quaternion(pz, math.radians(b))
    p = pb["thumb_01_r"]; p.rotation_mode = 'QUATERNION'
    p.rotation_quaternion = rest.inverted() @ qw @ rest
def thumb_ik2(point):
    target.location = point
    for n in ["thumb_02_r", "thumb_03_r"]:
        pb[n].matrix_basis = Matrix.Identity(4)
    ik = pb["thumb_03_r"].constraints.new('IK'); ik.target = target; ik.chain_count = 2
    bpy.context.view_layer.update()
    mats = {n: pb[n].matrix.copy() for n in ["thumb_02_r", "thumb_03_r"]}
    pb["thumb_03_r"].constraints.remove(ik)
    for n in ["thumb_02_r", "thumb_03_r"]:
        pb[n].matrix = mats[n]; bpy.context.view_layer.update()
    return (ptail("thumb_03_r") - point).length
HEIGHTS = [h * CM for h in P.get("thumb_heights", [0.5, 0.7, 0.9, 1.1, 1.4])]
best = None
for a in P.get("thumb_a", [-30, -20, -10, 0, 10, 20, 30]):
    for b in P.get("thumb_b", [-20, -10, 0, 10, 20]):
        set_thumb_base(a, b)
        for h in HEIGHTS:
            err = thumb_ik2(phone_M @ (SHUTTER + Vector((0, 0, h))))
            n_in = thumb_in()
            if P.get("debug"): print("TRY", a, b, round(h / CM, 1), "err cm", round(err / CM, 2), "inside", n_in)
            if err > 0.3 * CM: continue
            if n_in == 0:
                score = h / CM + 0.01 * (abs(a) + abs(b))
                if best is None or score < best[0]: best = (score, a, b, h)
                break
print("THUMB best (score, swing a, swing b, height)", best)
if best:
    _, a, b, h = best
    set_thumb_base(a, b); thumb_ik2(phone_M @ (SHUTTER + Vector((0, 0, h))))
    thumb_press = h
    THUMB_SWING = (a, b)
print("THUMB press height cm", round(thumb_press / CM, 2) if best else None)

if P.get("thumb_natural"):
    # A real thumb: the base joint swings and rolls; the two outer joints only hinge (about their local X,
    # which bends towards the pad, local Z). The pad must face the screen (so the nail faces the viewer),
    # rest on the shutter, with no skin inside the phone. Gentle angles are preferred.
    X = Vector((1, 0, 0))
    rest01 = (W.to_3x3() @ B["thumb_01_r"].matrix_local.to_3x3()).to_quaternion()
    axis01 = (tail("thumb_01_r") - head("thumb_01_r")).normalized()
    def thumb_pose(a, b, tw, f, g):
        qw = Quaternion(py, math.radians(a)) @ Quaternion(pz, math.radians(b)) @ Quaternion(axis01, math.radians(tw))
        p = pb["thumb_01_r"]; p.rotation_mode = 'QUATERNION'; p.rotation_quaternion = rest01.inverted() @ qw @ rest01
        for n, ang in (("thumb_02_r", f), ("thumb_03_r", g)):
            p = pb[n]; p.rotation_mode = 'QUATERNION'; p.rotation_quaternion = Quaternion(X, math.radians(ang))
        bpy.context.view_layer.update()
    shutter_w = phone_M @ SHUTTER
    HOOK = P.get("thumb_hook")  # tap with the tip: top joint well bent, knuckle arched up
    def contact():
        m = W.to_3x3() @ pb["thumb_03_r"].matrix.to_3x3()
        y, z = m.col[1].normalized(), m.col[2].normalized()
        if HOOK:
            c = ptail("thumb_03_r") - y * 0.25 * CM + z * 0.45 * CM  # the very tip of the pad
            m2 = W.to_3x3() @ pb["thumb_02_r"].matrix.to_3x3()
            z2 = m2.col[2].normalized()
            # facing: the middle segment keeps its nail up; tip must also point down into the screen
            return c, z2 if y.dot(-pz) >= HOOK.get("tip_down", 0.4) else -z2
        c = ptail("thumb_03_r") - y * 0.6 * CM + z * P.get("pad_depth", 0.75) * CM
        return c, z
    cands = []
    G = P.get("thumb_grid", {})
    rng = lambda k, d: range(*G.get(k, d))
    diag = {}
    for a in rng("a", (-40, 61, 10)):
        for b in rng("b", (-40, 61, 10)):
            for tw in rng("tw", (-60, 61, 15)):
                for f in rng("f", (0, 41, 10)):
                    for g in rng("g", (0, 46, 15)):
                        thumb_pose(a, b, tw, f, g)
                        c, z = contact()
                        facing = z.dot(-pz)
                        e = (c - shutter_w).length / CM
                        for th in (0.8, 0.6, 0.4, 0.0, -1):
                            if facing >= th and e < diag.get(th, (99,))[0]: diag[th] = (round(e, 2), a, b, tw, f, g, round(facing, 2))
                        if facing < P.get("min_facing", 0.8): continue
                        err = (c - shutter_w).length
                        if err > 1.0 * CM: continue
                        ip_pref = HOOK.get("ip", 65) if HOOK else 20
                        score = err / CM * 3 + (abs(a) + abs(b) + abs(tw)) / 60 + abs(g - ip_pref) / 20 + abs(f - 15) / 40
                        cands.append((score, a, b, tw, f, g, err, facing))
    cands.sort()
    for th, v in sorted(diag.items(), reverse=True):
        print("THUMB diag facing >=", th, "best (err cm, a, b, twist, mcp, ip, facing)", v)
    print("THUMB natural candidates", len(cands))
    chosen = None
    for cand in cands[:P.get("thumb_checks", 200)]:
        thumb_pose(*cand[1:6])
        if thumb_in() == 0:
            chosen = cand; break
    print("THUMB top candidates", [tuple(round(x, 2) if isinstance(x, float) else x for x in c) for c in cands[:5]])
    print("THUMB natural chosen (score, a, b, twist, mcp, ip, err m, facing)", chosen)
    if chosen:
        thumb_pose(*chosen[1:6])
        THUMB_NATURAL = chosen
# Fingers: open each one a little at a time until none of its skin is inside.
for f, (pose_at, t) in finger_pose.items():
    groups = {f"{f}_{j}_r" for j in ["01", "02", "03"]}
    while t > 0:
        c, _ = skin_inside()
        if not any(k in groups for k in c): break
        t -= math.radians(1.5); pose_at(t)
    print("FINGER", f, "backed off to", round(math.degrees(t), 1))
c, d = skin_inside()
print("INSIDE after", {k: (c[k], round(d[k], 2)) for k in c} or "none")
print("FOREARM direction in phone space", tuple(round(c_, 2) for c_ in (phone_inv.to_3x3() @ (phead("lowerarm_r") - phead("hand_r"))).normalized()))

if P.get("export"):
    # ---- export for the site: three thumb poses as a clip (away, hover, press) + where the phone sits ----
    src = body.data
    dom = []
    for v in src.vertices:
        gs = [g for g in v.groups if body.vertex_groups[g.group].name in ARM]
        dom.append(body.vertex_groups[max(gs, key=lambda g: g.weight).group].name if gs else "?")
    def skin_phone_space():
        sub.show_viewport = False; body.hide_viewport = False
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get(); ev = body.evaluated_get(dg); me_ = ev.to_mesh()
        pts = [phone_inv @ (ev.matrix_world @ v.co) for v in me_.vertices]
        ev.to_mesh_clear(); sub.show_viewport = True; body.hide_viewport = True
        return pts
    M = 0.1 * CM
    def over_phone(p):  # would hit the phone if the hand slid straight back (away from the screen)
        return abs(p.x) < PW / 2 + M and abs(p.y) < PH / 2 + M and p.z > -PD / 2 - M
    def blocked(pts):
        thumb = sum(1 for i, p in enumerate(pts) if dom[i] in THUMB and over_phone(p))
        other = sum(1 for i, p in enumerate(pts) if dom[i] not in THUMB and over_phone(p))
        return thumb, other
    _, a0, b0, tw0, f0, g0 = THUMB_NATURAL[:6]
    press_pose = (a0, b0, tw0, f0, g0)
    thumb_pose(*press_pose)
    fa_dir = (phone_inv.to_3x3() @ (phead("lowerarm_r") - phead("hand_r"))).normalized()
    print("EXPORT forearm direction in phone space", tuple(round(c, 2) for c in fa_dir))
    print("EXPORT press: skin over the phone (thumb, rest of hand)", blocked(skin_phone_space()))
    # hover: the top two joints relax so the tip lifts about a centimetre off the shutter
    def tip_height():
        c, _ = contact(); return (phone_inv @ c).z - PD / 2
    # The user approved the hooked press: keep the top joint arched while hovering and lift from the base.
    hover_pose, best_h = None, None
    for da in (0, -5, -10, -15, 5, 10):
        for df in (0, 5, 10, 15, 20):
            for dg_ in (0, 5, 10, 15):
                pose_ = (a0 + da, b0, tw0, f0 - df, g0 - dg_)
                thumb_pose(*pose_)
                h = tip_height() / CM
                score = abs(h - 0.9) + (abs(da) + df + 3 * dg_) / 100
                if 0.6 <= h <= 1.4 and (best_h is None or score < best_h) and thumb_in() == 0:
                    hover_pose, best_h = pose_, score
    for df in ():
        for dg_ in ():
            pose_ = (a0, b0, tw0, f0 - df, g0 - dg_)
            thumb_pose(*pose_)
            h = tip_height() / CM
            score = abs(h - 1.1) + (df + dg_) / 200
            if 0.7 <= h <= 1.8 and (best_h is None or score < best_h):
                hover_pose, best_h = pose_, score
    thumb_pose(*hover_pose)
    print("EXPORT hover pose", hover_pose, "tip height cm", round(tip_height() / CM, 2), "inside", thumb_in())
    if P.get("bake_ao"):
        # Ambient occlusion in the site's grip (thumb hovering), with the phone there: creases, between the
        # fingers, and where skin meets the phone. Baked into the hand's own UVs, then stop (no export).
        B_ = P["bake_ao"]
        thumb_pose(*hover_pose)
        body.hide_viewport = False; body.hide_render = False
        sub.show_viewport = False; sub.show_render = False
        scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = B_.get("samples", 96)
        world = scene.world or bpy.data.worlds.new("w"); scene.world = world
        world.light_settings.distance = B_.get("distance", 0.02)
        img = bpy.data.images.new("hand_ao", 2048, 2048, alpha=False, float_buffer=False)
        img.colorspace_settings.name = 'Non-Color'
        for m in body.data.materials:
            tn = m.node_tree.nodes.new("ShaderNodeTexImage"); tn.image = img
            m.node_tree.nodes.active = tn; tn.select = True
        body.data.uv_layers.active = body.data.uv_layers["detail"]
        bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
        scene.render.bake.margin = 16
        bpy.ops.object.bake(type='AO')
        img.filepath_raw = B_["path"]; img.file_format = 'PNG'; img.save()
        print("EXPORT baked AO", B_["path"])
        sys.exit(0)
    # away: thumb swung off the screen so the hand can slide straight back without touching the phone
    def bone_clear():
        pts = []
        for n in ["thumb_02_r", "thumb_03_r"]:
            h, t = phone_inv @ phead(n), phone_inv @ ptail(n)
            pts += [h.lerp(t, k / 4) for k in range(5)]
        r = 1.0 * CM
        return not any(abs(p.x) < PW / 2 + r and abs(p.y) < PH / 2 + r and p.z > -PD / 2 - r for p in pts)
    cands_a = []
    ha, hb, htw, hf, hg = hover_pose
    for a in range(ha - 60, ha + 61, 15):
        for b in range(hb - 100, hb + 21, 10):
            for tw in range(htw - 30, htw + 61, 15):
                for f in P.get("away_f", (0, 10, 20)):
                    for g in P.get("away_g", (0, 15, 30)):
                        thumb_pose(a, b, tw, f, g)
                        if bone_clear():
                            d = abs(a - ha) + abs(b - hb) + abs(tw - htw) + abs(f - hf) + abs(g - hg)
                            # a resting thumb is gently curled; a straight one reads as a stiff "L"
                            d += P.get("away_curl", 0) * (max(0, 30 - f) + max(0, 45 - g))
                            # lie low beside the right edge, not stick up at the viewer like a thumbs-up
                            tip = phone_inv @ ptail("thumb_03_r")
                            up = max(0.0, (tip.z - PD / 2) / CM - 1.2)
                            d += 25 * up
                            # and rest against the phone's right side rather than stand out from it
                            d += 20 * abs((tip.x - PW / 2) / CM - 0.9)
                            cands_a.append((d, (a, b, tw, f, g)))
    cands_a.sort()
    away_pose = None
    TB0 = ["thumb_01_r", "thumb_02_r", "thumb_03_r"]
    thumb_pose(*hover_pose); qh = [pb[n].rotation_quaternion.copy() for n in TB0]
    def path_clear(pose_):
        thumb_pose(*pose_); qa = [pb[n].rotation_quaternion.copy() for n in TB0]
        for t in (0.2, 0.4, 0.6, 0.8):
            for n, a_, b_ in zip(TB0, qa, qh): pb[n].rotation_quaternion = a_.slerp(b_, t)
            if thumb_in() > 0: return False
        return True
    for d, pose_ in cands_a[:120]:
        thumb_pose(*pose_)
        tb, ob = blocked(skin_phone_space())
        if tb == 0 and path_clear(pose_):
            away_pose = pose_; print("EXPORT away pose", pose_, "score", round(d, 1), "rest of hand over phone", ob); break
    print("EXPORT away candidates", len(cands_a), "chosen", away_pose)
    # the site blends between poses (per-bone slerp): check the in-between frames too
    TB = ["thumb_01_r", "thumb_02_r", "thumb_03_r"]
    def quats(pose_):
        thumb_pose(*pose_); return [pb[n].rotation_quaternion.copy() for n in TB]
    for name_, p0, p1 in (("away->hover", away_pose, hover_pose), ("hover->press", hover_pose, press_pose)):
        q0, q1 = quats(p0), quats(p1)
        worst = []
        for k in range(1, 10):
            t = k / 10
            for n, a_, b_ in zip(TB, q0, q1): pb[n].rotation_quaternion = a_.slerp(b_, t)
            worst.append(thumb_in())
        print("EXPORT blend check", name_, "thumb skin inside at 10%..90%:", worst)
    # keyframes: 1 = away, 2 = hover, 3 = press
    for pbn in pb: pbn.rotation_mode = 'QUATERNION'
    for frame, pose_ in ((1, away_pose), (2, hover_pose), (3, press_pose)):
        thumb_pose(*pose_)
        for pbn in pb:
            pbn.keyframe_insert("rotation_quaternion", frame=frame)
            pbn.keyframe_insert("location", frame=frame)
    rig.animation_data.action.name = "grip"
    scene.frame_start, scene.frame_end = 1, 3
    thumb_pose(*hover_pose)
    anchor = bpy.data.objects.new("PhoneAnchor", None); scene.collection.objects.link(anchor)
    anchor.matrix_world = phone_M
    for o in list(bpy.data.objects):
        if o not in (body, rig, anchor): bpy.data.objects.remove(o, do_unlink=True)
    body.modifiers.remove(sub)
    # the bake helpers (masks, joint distances...) are not needed on the site
    for name in ["masks", "masks2", "jd", "dorsal", "hc", "fp", "nail"]:
        if name in body.data.attributes: body.data.attributes.remove(body.data.attributes[name])
    body.hide_viewport = False
    bpy.ops.object.select_all(action='DESELECT')
    for o in (body, rig, anchor): o.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(filepath=P["export"], export_format='GLB', use_selection=True, export_skins=True,
                              export_animations=True, export_frame_range=True, export_force_sampling=True,
                              export_yup=True, export_morph=False, export_apply=False)
    print("EXPORT written", P["export"])
    sys.exit(0)

body.hide_viewport = False
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, f"grip_{tag}.blend"))

# ---- render ----
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 40; scene.cycles.use_denoising = True
scene.render.resolution_x = 640; scene.render.resolution_y = 560
world = scene.world or bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.93, 0.95, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = P.get("world", 0.7)
scene.view_settings.view_transform = 'AgX'
scene.view_settings.exposure = P.get("exposure", 0.0)
center = phone_M @ Vector((1.5 * CM, -2.5 * CM, 0))
def light(name, loc, energy, size=0.5):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.size = size
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (center - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
LT = P.get("lights", {})
kd = Vector(LT.get("key_dir", (-0.2, 0.3, 0.6)))  # in phone axes (x, y, z)
light("key", center + (px * kd.x + py * kd.y + pz * kd.z), LT.get("key", 60), LT.get("key_size", 0.5))
light("fill", center - pz * 0.5 + px * 0.4, LT.get("fill", 20))
light("rim", center + py * 0.6 - pz * 0.2, LT.get("rim", 20))
if P.get("look"):
    try: scene.view_settings.look = P["look"]
    except TypeError as e: print("LOOK not available", e)
cd = bpy.data.cameras.new("cam"); cd.lens = 70
cam = bpy.data.objects.new("cam", cd); scene.collection.objects.link(cam); scene.camera = cam
def shot(name, direction, dist=0.5, up=None):
    cam.location = center + Vector(direction).normalized() * dist
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(out, f"{tag}_{name}.png")
    bpy.ops.render.render(write_still=True)
views = {"front": pz + py * 0.35 + px * 0.1,      # roughly what the site sees: the screen
         "right": px + pz * 0.4,                  # thumb side
         "left": -px + pz * 0.3,                  # fingertips side
         "back": -pz + px * 0.2,                  # behind the phone
         "edge": -px - pz * 0.2 + py * 0.15}      # along the phone's left edge, to see the wrap
for v in P.get("views", ["front", "right", "left", "back"]):
    if v == "thumbside":
        # Side-on to the thumb, low along the screen, to see how its joints bend.
        c2 = (phead("thumb_02_r") + ptail("thumb_03_r")) / 2
        tdir = (ptail("thumb_03_r") - phead("thumb_02_r")).normalized()
        side = tdir.cross(pz).normalized()
        cam.location = c2 + (side * 1.0 + pz * 0.35).normalized() * 0.22
        cam.rotation_euler = (c2 - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(out, f"{tag}_thumbside.png")
        bpy.ops.render.render(write_still=True)
        continue
    if v == "thumbclose":
        # Close-up of the thumb from the screen side, centred where it meets the hand.
        c2 = (phead("thumb_02_r") + ptail("thumb_03_r")) / 2
        cam.location = c2 + (pz * 1.0 + px * 0.25 + py * 0.2).normalized() * 0.2
        cam.rotation_euler = (c2 - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = os.path.join(out, f"{tag}_thumbclose.png")
        bpy.ops.render.render(write_still=True)
        continue
    shot(v, views[v])
print("DONE", tag)
