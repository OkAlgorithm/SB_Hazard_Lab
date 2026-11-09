"""Original engine-lathe training prop. Run: blender -b -t 2 --python tools/build-lathe.py"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/workshop'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
M = {}
for name, colour, metal, rough, alpha in [
    ('painted-metal', (.37,.43,.28), .08,.62,1),
    ('cast-dark', (.15,.19,.16), .38,.65,1),
    ('machined-steel', (.48,.51,.48), .82,.28,1),
    ('rubber', (.035,.04,.034), .0,.84,1),
    ('glass', (.63,.74,.70), .0,.14,.19),
    ('brass', (.44,.32,.14), .65,.45,1),
    ('nameplate', (.065,.075,.06), .25,.4,1),
    ('lettering', (.78,.77,.66), .1,.6,1),
]:
    mat=bpy.data.materials.new(name); mat.diffuse_color=(*colour,alpha); mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*colour,1)
    bsdf.inputs['Metallic'].default_value=metal; bsdf.inputs['Roughness'].default_value=rough
    bsdf.inputs['Alpha'].default_value=alpha
    if alpha<1: mat.surface_render_method='DITHERED'
    M[name]=mat

def finish(obj,name,mat,bevel=0):
    obj.name=name; obj.data.materials.append(M[mat])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        b=obj.modifiers.new('Cast edge radii','BEVEL'); b.width=bevel; b.segments=2
        bpy.context.view_layer.objects.active=obj; bpy.ops.object.modifier_apply(modifier=b.name)
    for poly in obj.data.polygons: poly.use_smooth=True
    n=obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); n.keep_sharp=True; n.weight=30
    bpy.context.view_layer.objects.active=obj; bpy.ops.object.modifier_apply(modifier=n.name)
    return obj

def box(name,pos,size,mat='painted-metal',bevel=.016):
    bpy.ops.mesh.primitive_cube_add(size=1,location=pos)
    obj=bpy.context.object; obj.dimensions=size
    return finish(obj,name,mat,bevel)

def cyl(name,pos,radius,depth,mat='machined-steel',axis='Z',verts=20):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=depth,location=pos)
    obj=bpy.context.object
    if axis=='X': obj.rotation_euler.y=math.pi/2
    if axis=='Y': obj.rotation_euler.x=math.pi/2
    return finish(obj,name,mat,.004 if radius>.025 else 0)

def rod(name,a,b,radius=.014,mat='machined-steel',verts=10):
    a,b=Vector(a),Vector(b); d=b-a
    obj=cyl(name,(a+b)/2,radius,d.length,mat,verts=verts)
    obj.rotation_euler=d.to_track_quat('Z','Y').to_euler()
    return obj

def wheel(name,pos,r=.16,axis='Y'):
    bpy.ops.mesh.primitive_torus_add(major_segments=24,minor_segments=8,location=pos,major_radius=r,minor_radius=.013)
    obj=bpy.context.object
    obj.rotation_euler.x=math.pi/2 if axis=='Y' else 0
    if axis=='X': obj.rotation_euler.y=math.pi/2
    finish(obj,name+'-rim','machined-steel')
    x,y,z=pos
    cyl(name+'-hub',pos,.046,.08,axis=axis)
    for i in range(3):
        a=i*math.tau/3
        end=(x+math.cos(a)*r,y,z+math.sin(a)*r) if axis=='Y' else (x,y+math.cos(a)*r,z+math.sin(a)*r)
        rod(name+'-spoke',pos,end,.011)
    if axis=='Y':
        cyl(name+'-crank',(x+r*.78,y-.075,z-.05),.022,.13,'rubber','Y',12)
    else:
        cyl(name+'-crank',(x+.075,y+r*.78,z-.05),.022,.13,'rubber','X',12)

# Distinct pedestal castings and chip tray, with open centre under the bed.
box('floor-skid',(0,0,.06),(3.72,1.28,.12),'cast-dark',.025)
for x,w in [(-1.16,.93),(1.24,.68)]:
    box('pedestal',(x,0,.48),(w,1.04,.85),bevel=.055)
    box('pedestal-toe',(x,-.01,.14),(w+.1,1.13,.15),'cast-dark',.025)
    box('service-door',(x,-.533,.52),(w-.12,.028,.57),bevel=.018)
    cyl('door-latch',(x+.17,-.563,.58),.025,.024,'rubber','Y',12)
    for dx in [-w*.34,w*.34]:
        cyl('anchor-bolt',(x+dx,-.42,.226),.035,.018,'machined-steel','Z',8)
box('chip-tray',(0,0,.94),(3.6,1.23,.115),'cast-dark',.025)
for y in [-.6,.6]: box('tray-lip',(0,y,1.01),(3.52,.055,.13),'cast-dark',.008)
box('lathe-bed',(0,.02,1.085),(3.45,.72,.19),bevel=.018)
for y in [-.235,.235]: box('ground-bed-way',(0,y,1.205),(3.4,.115,.065),'machined-steel',.007)
for z,r in [(.995,.035),(.88,.024)]: cyl('feed-shaft',(0,-.49,z),r,3.3,'machined-steel','X',20)
for x in [-1.58,1.57]:
    box('shaft-bearing',(x,-.48,.96),(.105,.17,.3),bevel=.014)
    for z in [.88,.995]: cyl('bearing-collar',(x,-.49,z),.054,.13,'cast-dark','X')

# Headstock, gearbox face, selector levers and three-jaw chuck.
box('headstock',(-1.2,.02,1.52),(.87,.98,.83),bevel=.055)
box('headstock-top',(-1.2,.03,1.96),(.76,.84,.055),'cast-dark',.02)
box('selector-face',(-1.2,-.491,1.53),(.76,.024,.58),bevel=.012)
for x,z in [(-1.42,1.68),(-1.18,1.68),(-1.4,1.39),(-1.08,1.38)]:
    cyl('selector-ring',(x,-.517,z),.063,.035,'machined-steel','Y')
    rod('selector-lever',(x,-.54,z),(x+.07,-.62,z+.1),.014)
    cyl('selector-grip',(x+.07,-.63,z+.105),.026,.05,'rubber','Y',12)
for x in [-1.46,-1.36,-1.26,-1.16,-1.06]: box('cooling-slit',(x,.518,1.56),(.035,.008,.18),'cast-dark',0)
cyl('spindle-collar',(-.73,.02,1.61),.24,.16,'cast-dark','X',32)
cyl('three-jaw-chuck',(-.575,.02,1.61),.22,.23,'machined-steel','X',32)
cyl('chuck-face',(-.45,.02,1.61),.195,.022,'machined-steel','X',32)
cyl('spindle-centre',(-.435,.02,1.61),.065,.04,'cast-dark','X',20)
for i in range(3):
    a=i*math.tau/3
    jaw=box('chuck-jaw',(-.425,.02+math.cos(a)*.115,1.61+math.sin(a)*.115),(.075,.10,.13),'machined-steel',.005)
    jaw.rotation_euler.x=a

# Apron, cross slide, compound and toolpost.
box('saddle',(.25,.015,1.28),(.85,.86,.13),bevel=.018)
box('apron',(.25,-.53,1.065),(.86,.21,.38),bevel=.03)
box('apron-panel',(.25,-.647,1.07),(.7,.015,.25),'cast-dark',.012)
box('cross-slide',(.25,.005,1.375),(.52,.91,.1),'machined-steel',.01)
box('compound-slide',(.28,.10,1.455),(.44,.43,.07),'machined-steel',.008).rotation_euler.z=.16
box('tool-post',(.29,.09,1.565),(.22,.23,.15),'cast-dark',.008)
rod('tool-handle',(.29,.09,1.68),(.52,.09,1.68),.018)
for x in [.22,.36]:
    for y in [.02,.16]: cyl('toolpost-bolt',(x,y,1.656),.018,.045,'machined-steel','Z',8)
wheel('carriage-feed',(.03,-.81,1.09),.16)
wheel('cross-feed',(.62,-.66,1.36),.105)
rod('feed-selector',(.55,-.67,1.03),(.64,-.79,1.13),.013)
cyl('selector-knob',(.64,-.81,1.13),.025,.045,'rubber','Y')

# Tailstock and quill.
box('tailstock-base',(1.20,.02,1.275),(.67,.65,.14),bevel=.018)
box('tailstock-body',(1.25,.04,1.49),(.57,.5,.37),bevel=.06)
cyl('tailstock-quill',(.90,.04,1.59),.077,.32,'machined-steel','X',24)
cyl('tailstock-centre',(.70,.04,1.59),.038,.14,'machined-steel','X',16)
wheel('tailstock-feed',(1.64,.04,1.59),.13,'X')
rod('quill-lock',(1.22,.02,1.73),(1.35,.04,1.85),.016)
cyl('quill-lock-grip',(1.37,.04,1.86),.025,.12,'rubber','X',12)

# Closed viewing guard. Thin panes and metal frame, rather than a solid enclosure.
for x in [-.82,.07]: box('guard-upright',(x,-.56,1.66),(.035,.045,.65),'cast-dark',.005)
for z in [1.34,1.98]: box('guard-crossbar',(-.375,-.56,z),(.94,.045,.035),'cast-dark',.005)
box('guard-glass',(-.375,-.559,1.66),(.855,.014,.59),'glass',.001)
box('guard-top',(-.375,-.14,2.00),(.94,.84,.025),'glass',.001)
rod('guard-handle',(-.05,-.61,1.61),(-.05,-.61,1.81),.017,'rubber')

# Small fixtures and nameplate.
box('model-plate',(-1.2,-.53,1.855),(.42,.018,.13),'nameplate',.005)
bpy.ops.object.text_add(location=(-1.385,-.545,1.814),rotation=(math.pi/2,0,0))
text=bpy.context.object; text.data.body='1К62'; text.data.size=.104; text.data.extrude=.0006
font=Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
if font.exists(): text.data.font=bpy.data.fonts.load(str(font))
text.data.materials.append(M['lettering']); bpy.ops.object.convert(target='MESH'); text.name='model-lettering'
for x in [-1.54,-.86]:
    for z in [1.29,1.79]: cyl('faceplate-screw',(x,-.521,z),.013,.012,'machined-steel','Y',8)
for x in [-.24,.75]:
    for z in [.96,1.17]: cyl('apron-screw',(x,-.665,z),.014,.018,'machined-steel','Y',8)
# Short lamp with a supported cable and enclosed shade.
rod('task-lamp-post',(-1.38,.35,1.97),(-1.38,.35,2.27),.02,'cast-dark')
rod('task-lamp-arm',(-1.38,.35,2.27),(-.95,.18,2.27),.019,'cast-dark')
cyl('lamp-shade',(-.95,.18,2.20),.115,.12,'cast-dark','Z',24)
cyl('lamp-diffuser',(-.95,.18,2.135),.09,.008,'lettering','Z',24)

# Join by material to keep draw calls low. UVs use approximately one metre per tile.
for mat_name in M:
    objects=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.materials and o.data.materials[0].name==mat_name]
    if not objects: continue
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects: obj.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]; bpy.ops.object.join()
    obj=bpy.context.object; obj.name=mat_name
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    uv=obj.data.uv_layers.active or obj.data.uv_layers.new(name='UVMap')
    for poly in obj.data.polygons:
        axis=max(range(3),key=lambda a:abs(poly.normal[a]))
        axes=[a for a in range(3) if a!=axis]
        for li in poly.loop_indices:
            co=obj.data.vertices[obj.data.loops[li].vertex_index].co
            uv.data[li].uv=(co[axes[0]],co[axes[1]])

bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(OUT/'lathe-1k62.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_materials='EXPORT')
triangles=0
for o in bpy.context.scene.objects:
    if o.type=='MESH': o.data.calc_loop_triangles(); triangles+=len(o.data.loop_triangles)
(OUT/'lathe-model.json').write_text(json.dumps({'triangles':triangles,'materials':list(M),'source':'tools/build-lathe.py','units':'metres','long_axis':'X','operator_side':'-Y'},indent=2)+'\n')
print('LATHE_TRIANGLES',triangles,flush=True)

# Internal modelling preview, not part of the application.
box('review-floor',(0,0,-.08),(12,12,.08),'lettering',0)
bpy.ops.object.camera_add(location=(4.5,-6.5,3.1)); camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.03))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'; camera.data.ortho_scale=4.9
scene=bpy.context.scene; scene.camera=camera; scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'; scene.display.shading.studiolight_rotate_z=.7
scene.display.shading.show_shadows=True; scene.display.shading.show_cavity=True
scene.display.shading.cavity_type='BOTH'; scene.display.shading.color_type='MATERIAL'
scene.render.resolution_x=960; scene.render.resolution_y=640; scene.render.resolution_percentage=100
scene.render.filepath=str(ROOT / 'lathe-review.png')
bpy.ops.render.render(write_still=True)
