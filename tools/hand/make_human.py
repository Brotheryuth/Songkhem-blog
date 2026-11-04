# Creates an MPFB human with the game rig and an Asian skin, saves it, and renders the right hand
# open and curled to judge how the knuckles bend.
# Run: blender -b --factory-startup? no (needs the extension) -> blender -b --python make_human.py -- <outdir>
import bpy, sys, os, math
from mathutils import Vector

out = sys.argv[sys.argv.index('--') + 1]
os.makedirs(out, exist_ok=True)

from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

macro = {"gender": 0.75, "age": 0.5, "muscle": 0.5, "weight": 0.45, "proportions": 0.6, "height": 0.5,
         "cupsize": 0.5, "firmness": 0.5, "race": {"asian": 0.9, "caucasian": 0.05, "african": 0.05}}
body = HumanService.create_human(macro_detail_dict=macro, feet_on_ground=True, scale=0.1)
rig = HumanService.add_builtin_rig(body, "game_engine", import_weights=True)
skin = os.path.join(LocationService.get_user_data("skins"), "young_asian_male", "young_asian_male.mhmat")
HumanService.set_character_skin(skin, body, skin_type="ENHANCED_SSS")
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, "human.blend"))

# ---- report the hand bones ----
rig = rig or next(o for o in bpy.data.objects if o.type == 'ARMATURE')
pb = rig.pose.bones
for n in ["lowerarm_r", "hand_r", "thumb_01_r", "index_01_r", "middle_01_r", "middle_03_r", "pinky_01_r"]:
    b = rig.data.bones[n]
    print("BONE", n, tuple(round(c, 4) for c in rig.matrix_world @ b.head_local), tuple(round(c, 4) for c in rig.matrix_world @ b.tail_local))
print("VERTS", len(body.data.vertices), "FACES", len(body.data.polygons))

# ---- render setup ----
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 48
scene.cycles.use_denoising = True
scene.render.resolution_x = 900
scene.render.resolution_y = 700
scene.render.film_transparent = False
world = bpy.data.worlds.new("w") if not scene.world else scene.world
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.93, 0.95, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6

def light(name, loc, energy, size=0.4):
    d = bpy.data.lights.new(name, 'AREA'); d.energy = energy; d.size = size
    o = bpy.data.objects.new(name, d); scene.collection.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    return o

hand_bone = rig.data.bones["hand_r"]
center = rig.matrix_world @ ((hand_bone.head_local + rig.data.bones["middle_02_r"].head_local) / 2)

def look(cam, target):
    cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()

cam_data = bpy.data.cameras.new("cam"); cam_data.lens = 85
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
for l in [("key", center + Vector((0.3, -0.6, 0.6)), 60), ("fill", center + Vector((-0.6, -0.3, 0.2)), 20), ("rim", center + Vector((0.2, 0.6, 0.4)), 30)]:
    light(*l)

def curl(amount, thumb=0.0):
    for f in ["index", "middle", "ring", "pinky"]:
        for k, w in zip(["01", "02", "03"], [1.0, 1.3, 0.9]):
            p = pb[f"{f}_{k}_r"]; p.rotation_mode = 'XYZ'; p.rotation_euler = (0, 0, 0)
    for k in ["01", "02", "03"]:
        p = pb[f"thumb_{k}_r"]; p.rotation_mode = 'XYZ'; p.rotation_euler = (0, 0, 0)
    return

def shot(name, offset):
    cam.location = center + Vector(offset)
    look(cam, center)
    scene.render.filepath = os.path.join(out, name)
    bpy.ops.render.render(write_still=True)

shot("rest_back.png", (0.0, 0.05, 0.42))    # from above (back of hand in T-pose faces up?)
shot("rest_palm.png", (0.0, 0.05, -0.42))   # from below
shot("rest_side.png", (0.0, -0.42, 0.02))   # from the front of the body
print("DONE")
