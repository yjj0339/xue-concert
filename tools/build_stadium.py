# -*- coding: utf-8 -*-
# 万兽之王 · 鸟巢场馆建模脚本（Blender 5.2 headless）
# 坐标：米，Z 向上，+X 指向主舞台。导出 GLB（Draco）。
# Frozen geometry contract —— JS 侧按对象名查找：
#   HULL_LATTICE / ROOF_RIM / STAND_LOWER / STAND_MIDDLE / STAND_UPPER / FIELD
#   STAGE_DECK / STAGE_RUNWAY / LED_WALL / TOWER_EAGLE|LION|ELEPHANT|WHALE
#   TRUSSES / PLAZA
import bpy, bmesh, math, json, os
from math import sin, cos, pi

GLB = 'E:/ZCODE/xue-Concert/model.glb'

# ---------- 清场 ----------
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete()
for blk in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
    for x in list(blk): blk.remove(x)

SC = bpy.context.scene

def srgb(r, g, b):  # 0-255 sRGB -> linear
    def f(c):
        c = c / 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (f(r), f(g), f(b))

PALETTE = {
    'MAT_STEEL':  (0x18, 0x1b, 0x21),
    'MAT_STAND':  (0x2a, 0x26, 0x2e),
    'MAT_FIELD':  (0x10, 0x12, 0x18),
    'MAT_PLAZA':  (0x15, 0x15, 0x17),
    'MAT_STAGE':  (0x1c, 0x1f, 0x26),
    'MAT_TOWER':  (0x33, 0x29, 0x1d),
    'MAT_BAND':   (0x8a, 0x5a, 0x24),
    'MAT_RIM':    (0x7a, 0x40, 0x18),
    'MAT_LED':    (0x07, 0x07, 0x0b),
    'MAT_TRUSS':  (0x21, 0x24, 0x2b),
}
MATS = {}
def get_mat(name):
    if name in MATS: return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    col = srgb(*PALETTE[name])
    bsdf.inputs['Base Color'].default_value = (col[0], col[1], col[2], 1.0)
    bsdf.inputs['Roughness'].default_value = 0.9
    if name in ('MAT_TRUSS', 'MAT_STEEL'):
        try: bsdf.inputs['Metallic'].default_value = 0.55
        except Exception: pass
    MATS[name] = m
    return m

CURVES = []

def add_tube(name, pts, r, mat_name):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = r
    cu.bevel_resolution = 3
    spl = cu.splines.new('POLY')
    spl.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        spl.points[i].co = (p[0], p[1], p[2], 1.0)
    ob = bpy.data.objects.new(name, cu)
    ob.data.materials.append(get_mat(mat_name))
    SC.collection.objects.link(ob)
    CURVES.append(ob)
    return ob

def finish_mesh(name, shade_smooth=True):
    for ob in CURVES:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = CURVES[0]
    bpy.ops.object.convert(target='MESH')
    objs = list(CURVES)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    if shade_smooth:
        bpy.ops.object.shade_smooth()
    CURVES.clear()
    me = joined.data
    return {'name': name, 'verts': len(me.vertices), 'tris': len(me.polygons),
            'bbox': [list(joined.bound_box[0]), list(joined.bound_box[6])]}

# ---------- 几何常量（与 JS 侧一致） ----------
A_OUT, B_OUT = 162.0, 136.0
A_IN,  B_IN  = 98.0,  72.0
A_GND, B_GND = 176.0, 148.0
def h_out(t): return 55.0 + 11.0 * cos(2.0 * t)
def h_in(t):  return 40.0 + 6.0 * cos(2.0 * t)

def ell(a, b, t):
    return (a * cos(t), b * sin(t))

def mix(x, y, k): return x + (y - x) * k

# ---------- 屋顶编织结构 ----------
N_WEAVE = 26
DELTA = 0.92
for k in range(N_WEAVE):
    th = k * 2.0 * pi / N_WEAVE
    for sign in (1, -1):
        pts = []
        gx, gy = ell(A_GND, B_GND, th)
        pts.append((gx, gy, -1.5))
        ox, oy = ell(mix(A_GND, A_OUT, .45), mix(B_GND, B_OUT, .45), th)
        pts.append((ox, oy, mix(-1.5, h_out(th), .35)))
        SAMP = 14
        for i in range(SAMP + 1):
            u = i / SAMP
            tt = th + sign * DELTA * u
            a = mix(A_OUT, A_IN, u); b = mix(B_OUT, B_IN, u)
            x, y = ell(a, b, tt)
            h = mix(h_out(tt), h_in(tt), u)
            if u > .92: h -= (u - .92) * 22.0
            pts.append((x, y, h))
        add_tube('weave', pts, 0.55, 'MAT_STEEL')

for ring in range(1, 6):
    u = ring / 6.0
    a = mix(A_OUT, A_IN, u); b = mix(B_OUT, B_IN, u)
    pts = []
    SAMP = 130
    for i in range(SAMP + 1):
        t = i / SAMP * 2.0 * pi
        x, y = ell(a, b, t)
        pts.append((x, y, mix(h_out(t), h_in(t), u)))
    add_tube('ring', pts, 0.42, 'MAT_STEEL')

for k in range(24):
    t = k * 2.0 * pi / 24 + 0.10
    gx, gy = ell(A_GND, B_GND, t)
    ox, oy = ell(A_OUT, B_OUT, t)
    add_tube('column', [(gx, gy, -2.0), ((gx+ox)/2, (gy+oy)/2, h_out(t)*.5), (ox, oy, h_out(t))], 1.05, 'MAT_STEEL')

lattice_info = finish_mesh('HULL_LATTICE')

# ---------- 屋顶内缘光环 ----------
pts = []
for i in range(120 + 1):
    t = i / 120 * 2.0 * pi
    x, y = ell(A_IN, B_IN, t)
    pts.append((x, y, h_in(t) + 0.6))
add_tube('ROOF_RIM', pts, 0.85, 'MAT_RIM')
rim_info = finish_mesh('ROOF_RIM')

# ---------- 看台（三层） ----------
def build_stand(name, ai, bi, hi, ao, bo, ho, rows, segs):
    prof = [(0.0, hi - 1.8), (0.0, hi)]
    for j in range(rows):
        u1 = (j + 0.55) / rows; u2 = (j + 1) / rows
        h0 = mix(hi, ho, j / rows); h2 = mix(hi, ho, (j + 1) / rows)
        prof.append((u1, h0))
        prof.append((u2, h2))
    prof.append((1.0, ho + 2.2))
    prof.append((1.06, ho - 6.0))
    bm = bmesh.new()
    grid = []
    for (u, h) in prof:
        a = mix(ai, ao, u); b = mix(bi, bo, u)
        ringv = []
        for s in range(segs):
            t = s / segs * 2.0 * pi
            x, y = ell(a, b, t)
            ringv.append(bm.verts.new((x, y, h)))
        grid.append(ringv)
    for p in range(len(grid) - 1):
        for s in range(segs):
            s2 = (s + 1) % segs
            try:
                bm.faces.new((grid[p][s], grid[p][s2], grid[p+1][s2], grid[p+1][s]))
            except ValueError:
                pass
    bm.normal_update()
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(get_mat('MAT_STAND'))
    SC.collection.objects.link(ob)
    return {'name': name, 'verts': len(me.vertices), 'tris': len(me.polygons)}

stand_info = [
    build_stand('STAND_LOWER',  104, 78,  1.6, 126, 100, 14.0, 11, 110),
    build_stand('STAND_MIDDLE', 128, 102, 15.6, 146, 120, 28.0, 11, 110),
    build_stand('STAND_UPPER',  148, 122, 29.6, 162, 136, 42.0, 11, 110),
]

# ---------- 场地内芯 ----------
def ellipse_disc(name, a, b, z, mat_name):
    bm = bmesh.new()
    verts = [bm.verts.new((0, 0, z))]
    SEG = 96
    for s in range(SEG):
        x, y = ell(a, b, s / SEG * 2 * pi)
        verts.append(bm.verts.new((x, y, z)))
    for s in range(SEG):
        try: bm.faces.new((verts[0], verts[1 + s], verts[1 + (s + 1) % SEG]))
        except ValueError: pass
    bm.normal_update()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.data.materials.append(get_mat(mat_name))
    SC.collection.objects.link(ob)
    return ob

ellipse_disc('FIELD', 100, 74, 0.15, 'MAT_FIELD')

bm = bmesh.new()
SEG = 128
inner = [bm.verts.new((174*cos(t/SEG*2*pi), 150*sin(t/SEG*2*pi), 0.0)) for t in range(SEG)]
outer = [bm.verts.new((430*cos(t/SEG*2*pi), 400*sin(t/SEG*2*pi), 0.0)) for t in range(SEG)]
for s in range(SEG):
    s2 = (s + 1) % SEG
    try: bm.faces.new((inner[s], inner[s2], outer[s2], outer[s]))
    except ValueError: pass
bm.normal_update()
me = bpy.data.meshes.new('PLAZA_RING'); bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('PLAZA_RING', me); ob.data.materials.append(get_mat('MAT_PLAZA'))
SC.collection.objects.link(ob)
ellipse_disc('PLAZA_IN', 174, 150, 0.0, 'MAT_PLAZA')

# ---------- 主舞台 ----------
def box(name, x0, x1, y0, y1, z0, z1, mat_name):
    bm = bmesh.new()
    vs = []
    for v in [(x0,y0,z0),(x1,y0,z0),(x1,y1,z0),(x0,y1,z0),(x0,y0,z1),(x1,y0,z1),(x1,y1,z1),(x0,y1,z1)]:
        vs.append(bm.verts.new(v))
    bm.faces.new((vs[3],vs[2],vs[1],vs[0]))
    bm.faces.new((vs[4],vs[5],vs[6],vs[7]))
    bm.faces.new((vs[0],vs[1],vs[5],vs[4]))
    bm.faces.new((vs[1],vs[2],vs[6],vs[5]))
    bm.faces.new((vs[2],vs[3],vs[7],vs[6]))
    bm.faces.new((vs[3],vs[0],vs[4],vs[7]))
    bm.normal_update()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); ob.data.materials.append(get_mat(mat_name))
    SC.collection.objects.link(ob)
    return ob

box('STAGE_DECK', 50, 88, -26, 26, 0, 2.0, 'MAT_STAGE')
box('STAGE_RUNWAY', 12, 50, -5, 5, 0, 2.0, 'MAT_STAGE')
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=24, radius1=5.0, radius2=5.0, depth=2.0)
me = bpy.data.meshes.new('RUN_END'); bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('RUN_END', me)
ob.rotation_euler = (pi/2, 0, 0)
ob.location = (12, 0, 1.0)
ob.data.materials.append(get_mat('MAT_STAGE'))
SC.collection.objects.link(ob)
bpy.context.view_layer.objects.active = ob
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

# ---------- 主 LED 墙（曲面，带 UV） ----------
bm = bmesh.new()
uvl = bm.loops.layers.uv.new('uv')
NX, NZ = 24, 12
def wall_x(y):
    return 91.0 - 3.2 * (1.0 - (y / 38.0) ** 2)
grid = []
gridUV = {}
for iy in range(NZ + 1):
    z = 1.4 + (40.0 - 1.4) * iy / NZ
    row = []
    for ix in range(NX + 1):
        y = -38.0 + 76.0 * ix / NX
        v = bm.verts.new((wall_x(y), y, z))
        row.append(v)
        gridUV[id(v)] = (ix / NX, iy / NZ)
    grid.append(row)
for iy in range(NZ):
    for ix in range(NX):
        try:
            f = bm.faces.new((grid[iy][ix], grid[iy][ix+1], grid[iy+1][ix+1], grid[iy+1][ix]))
            f.normal_flip()
            for loop in f.loops:
                loop[uvl].uv = gridUV[id(loop.vert)]
        except ValueError: pass
bm.normal_update()
me = bpy.data.meshes.new('LED_WALL'); bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new('LED_WALL', me); ob.data.materials.append(get_mat('MAT_LED'))
SC.collection.objects.link(ob)
led_info = {'name': 'LED_WALL', 'verts': len(me.vertices), 'tris': len(me.polygons)}

# ---------- 桁架 ----------
def truss(name, cx, hmax):
    pts = []
    for i in range(17):
        y = -34 + 68 * i / 16
        z = 15.0 + (hmax - 15.0) * (1 - (y / 34.0) ** 2)
        pts.append((cx, y, z))
    add_tube(name, pts, 0.55, 'MAT_TRUSS')
truss('TRUSS_A', 58, 21)
truss('TRUSS_B', 70, 27)
truss('TRUSS_C', 82, 33)
truss_info = finish_mesh('TRUSSES')

# ---------- 四兽塔 ----------
def cyl_mesh(name, x, y, z0, z1, r0, r1, mat_name, seg=20):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r0, radius2=r1, depth=(z1 - z0))
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.rotation_euler = (pi/2, 0, 0)
    ob.location = (x, y, (z0+z1)/2)
    ob.data.materials.append(get_mat(mat_name))
    SC.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob

def sphere_mesh(name, x, y, z, r, mat_name, sx=1, sy=1, sz=1, seg=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg//2+2, radius=r)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.scale = (sx, sy, sz); ob.location = (x, y, z)
    ob.data.materials.append(get_mat(mat_name))
    SC.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob

def torus_mesh(name, x, y, z, R, r, mat_name, axis='Z'):
    bm = bmesh.new()
    SEG, RSS = 24, 8
    rings_all = []
    for i in range(SEG):
        a = i / SEG * 2 * pi
        cx, cy = cos(a) * R, sin(a) * R
        ring = []
        for j in range(RSS):
            b = j / RSS * 2 * pi
            rr = r * (0.72 + 0.28 * cos(b))
            ring.append(bm.verts.new((cx + cos(a) * rr, cy + sin(a) * rr, sin(b) * r)))
        ring.append(ring[0])
        rings_all.append(ring)
    for i in range(SEG):
        nxt = rings_all[(i + 1) % SEG]
        cur = rings_all[i]
        for j in range(RSS):
            try: bm.faces.new((cur[j], cur[j+1], nxt[j+1], nxt[j]))
            except ValueError: pass
    bm.normal_update()
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    ob.location = (x, y, z)
    if axis == 'X': ob.rotation_euler = (0, pi/2, 0)
    ob.data.materials.append(get_mat(mat_name))
    SC.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return ob

TOWERS = [('EAGLE', 10, -34), ('LION', 10, 34), ('ELEPHANT', 42, -34), ('WHALE', 42, 34)]
for tname, tx, ty in TOWERS:
    cyl_mesh(f'TOWER_{tname}', tx, ty, 0, 3.0, 2.7, 2.7, 'MAT_TOWER')
    cyl_mesh(f'TOWER_{tname}', tx, ty, 3.0, 19.0, 2.05, 1.45, 'MAT_TOWER')
    cyl_mesh(f'TOWER_{tname}', tx, ty, 19.0, 20.2, 2.25, 2.05, 'MAT_TOWER')
    for bz in (7.0, 13.0, 18.6):
        torus_mesh(f'TOWER_{tname}_BAND', tx, ty, bz, 2.15, 0.24, 'MAT_BAND')
    if tname == 'EAGLE':
        sphere_mesh(f'TOWER_{tname}_HEAD', tx-1.1, ty, 21.6, 1.25, 'MAT_TOWER')
        for s in (-1, 1):
            add_tube(f'TOWER_{tname}_WING', [
                (tx+0.6, ty + s*1.4, 22.0),
                (tx+1.6, ty + s*4.6, 23.2),
                (tx+2.0, ty + s*7.8, 22.4),
                (tx+1.2, ty + s*6.2, 20.9),
                (tx+0.4, ty + s*3.2, 20.6),
            ], 0.85, 'MAT_TOWER')
        add_tube(f'TOWER_{tname}_BEAK', [(tx-1.9, ty, 21.8), (tx-3.1, ty, 21.5)], 0.45, 'MAT_TOWER')
    elif tname == 'LION':
        torus_mesh(f'TOWER_{tname}_MANE', tx-0.9, ty, 21.9, 1.85, 0.6, 'MAT_BAND', axis='X')
        sphere_mesh(f'TOWER_{tname}_HEAD', tx-1.9, ty, 21.9, 1.3, 'MAT_TOWER')
        for s in (-1, 1):
            cyl_mesh(f'TOWER_{tname}_EAR', tx-1.6, ty + s*0.9, 23.0, 23.9, 0.22, 0.05, 'MAT_TOWER', seg=8)
    elif tname == 'ELEPHANT':
        sphere_mesh(f'TOWER_{tname}_HEAD', tx-1.1, ty, 21.8, 1.65, 'MAT_TOWER')
        for s in (-1, 1):
            sphere_mesh(f'TOWER_{tname}_EAR', tx-0.2, ty + s*1.85, 22.0, 1.0, 'MAT_TOWER', sx=0.25, sy=1.25, sz=1.05)
        add_tube(f'TOWER_{tname}_TRUNK', [
            (tx-2.5, ty, 21.6), (tx-3.2, ty, 20.6), (tx-3.6, ty, 19.6),
            (tx-3.5, ty, 18.7), (tx-3.0, ty, 18.2),
        ], 0.55, 'MAT_TOWER')
    else:
        cyl_mesh(f'TOWER_{tname}_BODY', tx, ty, 20.2, 25.4, 1.55, 1.05, 'MAT_TOWER')
        sphere_mesh(f'TOWER_{tname}_HEAD', tx, ty, 20.3, 1.55, 'MAT_TOWER', sz=0.8)
        for s in (-1, 1):
            sphere_mesh(f'TOWER_{tname}_FLUKE', tx+0.3, ty + s*1.9, 25.6, 0.95, 'MAT_TOWER', sx=0.3, sy=1.5, sz=0.5)

tower_join_info = []
for tname, tx, ty in TOWERS:
    prefix = f'TOWER_{tname}'
    obs = [o for o in SC.collection.objects if o.name.startswith(prefix)]
    curve_obs = [o for o in obs if o.type == 'CURVE']
    if curve_obs:
        bpy.ops.object.select_all(action='DESELECT')
        for o in curve_obs: o.select_set(True)
        bpy.context.view_layer.objects.active = curve_obs[0]
        bpy.ops.object.convert(target='MESH')
    obs = [o for o in SC.collection.objects if o.name.startswith(prefix)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs: o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    bpy.ops.object.join()
    j = bpy.context.view_layer.objects.active
    j.name = prefix
    j.select_set(False)
    tower_join_info.append({'name': j.name, 'verts': len(j.data.vertices), 'tris': len(j.data.polygons)})

# ---------- 导出 ----------
bpy.ops.object.select_all(action='DESELECT')
report = {'lattice': lattice_info, 'rim': rim_info, 'stands': stand_info, 'led': led_info,
          'towers': tower_join_info, 'objects': [o.name for o in SC.collection.objects]}
ok = True
try:
    bpy.ops.export_scene.gltf(
        filepath=GLB, export_format='GLB',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_apply=True, use_selection=False, export_yup=True)
except Exception as e:
    ok = False
    report['draco_error'] = str(e)
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB',
                              export_apply=True, use_selection=False, export_yup=True)
report['export_ok'] = ok
report['glb_size'] = os.path.getsize(GLB)
print('BUILD_REPORT ' + json.dumps(report, ensure_ascii=False))
print('BUILD_DONE ok=' + str(ok) + ' size=' + str(report['glb_size']))
