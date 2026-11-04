# Close-up renders of hand_detail.blend in its rest pose: back of the hand, a fingertip pad, knuckles.
# Run: blender -b hand_detail.blend --python detail_check.py -- <outdir>
import bpy, sys, os
from mathutils import Vector
out = sys.argv[sys.argv.index('--') + 1]
scene = bpy.context.scene
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
B, W = rig.data.bones, rig.matrix_world
def head(n): return W @ B[n].head_local
def tail(n): return W @ B[n].tail_local
across = (head("pinky_01_r") - head("index_01_r")).normalized()
along = (head("middle_01_r") - head("hand_r")).normalized()
back = across.cross(along).normalized()
scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'; scene.cycles.samples = 64; scene.cycles.use_denoising = True
scene.render.resolution_x = 700; scene.render.resolution_y = 560
scene.view_settings.view_transform = 'AgX'
try: scene.view_settings.look = 'AgX - Medium High Contrast'
except TypeError: pass
world = scene.world or bpy.data.worlds.new("w"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.52, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.25
cd = bpy.data.cameras.new("cam"); cd.lens = 100; cd.clip_start = 0.005
cam = bpy.data.objects.new("cam", cd); scene.collection.objects.link(cam); scene.camera = cam
lights = []
def shot(name, center, view_dir, dist, key_dir, key=25):
    for l in lights: bpy.data.objects.remove(l, do_unlink=True)
    lights.clear()
    for nm, d, e, sz in (("key", key_dir, key, 0.08), ("fill", -view_dir + across * 0.3, 3, 0.4)):
        ld = bpy.data.lights.new(nm, 'AREA'); ld.energy = e; ld.size = sz
        lo = bpy.data.objects.new(nm, ld); scene.collection.objects.link(lo)
        lo.location = center + Vector(d).normalized() * 0.4
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler(); lights.append(lo)
    cam.location = center + view_dir.normalized() * dist
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = os.path.join(out, f"detail_{name}.png")
    bpy.ops.render.render(write_still=True)
hb = (head("hand_r") * 0.45 + head("middle_01_r") * 0.55)
shot("back", hb, back + along * 0.15, 0.22, back * 0.6 + across * 0.8 - along * 0.3)          # grazing light shows veins
tipc = tail("index_03_r") - (tail("index_03_r") - head("index_03_r")) * 0.45
shot("pad", tipc, -back + across * 0.1, 0.07, -back * 0.5 + along * 0.9)                    # fingerprint
kn = head("middle_02_r")
shot("knuckle", kn, back + across * 0.1, 0.09, back * 0.4 + along * 0.9)                    # knuckle wrinkles
pc = head("hand_r") * 0.55 + head("middle_01_r") * 0.45
shot("palm", pc, -back - along * 0.1, 0.24, -back * 0.35 + along * 0.8 + across * 0.3, key=9)      # palm lines
shot("fingers", head("middle_02_r"), -back, 0.12, -back * 0.4 + along * 0.9, key=12)                # finger creases
print("DONE")
