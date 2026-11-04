# Bakes the hand's gloss map from the masks bake_skin.py left on hand_detail.blend (same "detail" UVs):
#   R = clear coat (nails), G = roughness, B = how thin the skin is (fingers, tips, the web) for a warm glow.
# Run: blender -b out/hand_detail.blend --python bake_gloss.py -- <outdir>
import bpy, sys, os

out = sys.argv[sys.argv.index('--') + 1]
rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
body = next(o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig)
me = body.data
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 1

mat = bpy.data.materials.new("Gloss"); mat.use_nodes = True
me.materials.clear(); me.materials.append(mat)
nt = mat.node_tree; N, Lk = nt.nodes, nt.links
for nd in list(N): N.remove(nd)
outn = N.new("ShaderNodeOutputMaterial")

def node(t, **kw):
    n = N.new(t)
    for k, v in kw.items(): setattr(n, k, v)
    return n
def math_(op, a, b=None, clamp=False):
    m = node("ShaderNodeMath", operation=op); m.use_clamp = clamp
    for sock, val in zip(m.inputs, (a, b)):
        if val is None: continue
        if isinstance(val, (int, float)): sock.default_value = val
        else: Lk.new(val, sock)
    return m.outputs[0]
def attr(name, out_="Fac"):
    return node("ShaderNodeAttribute", attribute_name=name).outputs[out_]
def sep(name):
    s = node("ShaderNodeSeparateColor"); Lk.new(attr(name, "Color"), s.inputs[0]); return s.outputs

K, T, PALM = sep("masks")[0], sep("masks")[1], sep("masks")[2]
CREASE = attr("masks", "Alpha")
HAIRY, FLEX = sep("masks2")[0], sep("masks2")[1]
NAIL = attr("nail")
JD = attr("jd")
tc = node("ShaderNodeTexCoord")
nz = node("ShaderNodeTexNoise"); nz.inputs["Scale"].default_value = 180; nz.inputs["Detail"].default_value = 3
Lk.new(tc.outputs["Object"], nz.inputs["Vector"])

# Roughness: skin 0.56; a little oilier on the fingertip pads and over the stretched knuckles; the palm
# and its creases more matte; slight blotchy variation; nails smooth.
r = math_('ADD', 0.56, math_('MULTIPLY', T, -0.12))
r = math_('ADD', r, math_('MULTIPLY', K, -0.06))
r = math_('ADD', r, math_('MULTIPLY', PALM, 0.05))
r = math_('ADD', r, math_('MULTIPLY', math_('MAXIMUM', CREASE, FLEX), 0.14))
r = math_('ADD', r, math_('MULTIPLY', HAIRY, 0.04))
r = math_('ADD', r, math_('MULTIPLY', math_('SUBTRACT', nz.outputs[0], 0.5), 0.12))
r = math_('ADD', math_('MULTIPLY', r, math_('SUBTRACT', 1.0, NAIL)), math_('MULTIPLY', NAIL, 0.22), clamp=True)
# Thin skin: fingers (close to a joint), stronger at the tips
fingers = math_('SUBTRACT', 1.0, math_('DIVIDE', JD, 0.022), clamp=True)
thin = math_('MAXIMUM', math_('MULTIPLY', fingers, 0.7), T)
thin = math_('MULTIPLY', thin, math_('SUBTRACT', 1.0, math_('MULTIPLY', NAIL, 0.6)), clamp=True)

comb = node("ShaderNodeCombineColor")
Lk.new(NAIL, comb.inputs[0]); Lk.new(r, comb.inputs[1]); Lk.new(thin, comb.inputs[2])
emit = node("ShaderNodeEmission"); Lk.new(comb.outputs[0], emit.inputs[0])
Lk.new(emit.outputs[0], outn.inputs[0])

img = bpy.data.images.new("hand_gloss", 2048, 2048, alpha=False, float_buffer=False)
img.colorspace_settings.name = 'Non-Color'
tn = node("ShaderNodeTexImage", image=img); N.active = tn; tn.select = True
me.uv_layers.active = me.uv_layers["detail"]
bpy.ops.object.select_all(action='DESELECT'); body.select_set(True); bpy.context.view_layer.objects.active = body
rig.data.pose_position = 'REST'
scene.render.bake.margin = 8
bpy.ops.object.bake(type='EMIT')
img.filepath_raw = os.path.join(out, "hand_gloss.png"); img.file_format = 'PNG'; img.save()
print("BAKED gloss")
