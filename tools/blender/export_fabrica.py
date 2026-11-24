"""Convierte docs/fuentes/fabrica/FABRICA.blend a public/models/fabrica/fabrica.glb (texturas incluidas).

Que hace (la fabrica del equipo, version con texturas):
  - Quita la coleccion REFERENCIAS (muñeco, camisas y lata de ejemplo) y guarda sus medidas en un .json: sirven
    para calibrar el tamaño del muñeco, la posicion de la ropa en el armario y el sitio de la lata.
  - Separa "botones colores" en 12 objetos btn_piel_1 .. btn_piel_12 (uno por material) con el origen en su centro.
  - Cada caja (caja_1 .. caja_6) lleva dos formas: la BASE es la caja CERRADA (solapas dobladas hacia adentro) y el
    morph target "abierta" es la caja como la modelo el equipo; en el visor se anima con morphTargetInfluences.
  - Baja la metalicidad (sin mapa de entorno, un metal puro se ve negro en el visor).
  - La ventana del dispensador central usa Capsula #2.png (el .blend apuntaba a un archivo que no vino en el zip).
  - Nombres sin espacios ni puntos (three.js los cambia al cargar): "Boton camisa" -> btn_camisa, etc.
Uso (Python con el modulo bpy >= 4, en modo aislado para que no lo tape un inspect.py local):
  python -I tools/blender/export_fabrica.py -- docs/fuentes/fabrica/FABRICA.blend public/models/fabrica/fabrica.glb docs/fuentes/fabrica/medidas.json
"""
import json
import math
import re
import struct
import sys

import bpy
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[-3:]
blend, out_glb, out_info = args
bpy.ops.wm.open_mainfile(filepath=blend)


def world_box(o):
    pts = [o.matrix_world @ Vector(c) for c in o.bound_box]
    return [[round(min(p[i] for p in pts), 3) for i in range(3)], [round(max(p[i] for p in pts), 3) for i in range(3)]]


# ---------- 1. Referencias: se guardan sus medidas y se quitan ----------
info = {}
ref = bpy.data.collections.get('REFERENCIAS')
if ref:
    for o in ref.objects:
        if o.name == 'Llavero referencia':
            info['muneco'] = {'caja': world_box(o), 'ubicacion': [round(v, 3) for v in o.location]}
        elif o.name.startswith('Camisa'):
            info.setdefault('camisas', []).append(
                {'nombre': o.name, 'caja': world_box(o), 'centro': [round(v, 3) for v in o.matrix_world.translation]})
        elif o.name == 'Lata aerosol':
            info['lata'] = {'caja': world_box(o), 'ubicacion': [round(v, 3) for v in o.location],
                            'giro_z_grados': round(math.degrees(o.rotation_euler.z) % 360, 1)}
    for o in list(ref.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    bpy.data.collections.remove(ref)

# ---------- 2. Materiales ----------
for m in bpy.data.materials:
    if not m.node_tree:
        continue
    bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if bsdf:
        bsdf.inputs['Metallic'].default_value = min(bsdf.inputs['Metallic'].default_value, 0.18)
    if m.name == 'ventana lata':  # textura que no vino en el zip: es la capsula 2
        for n in m.node_tree.nodes:
            if n.type == 'TEX_IMAGE' and n.image:
                n.image.filepath = '//Capsula #2.png'
                n.image.reload()

# ---------- 3. Botones de piel: un objeto por material ----------
bt = bpy.data.objects['botones colores']
bpy.ops.object.select_all(action='DESELECT')
bt.select_set(True)
bpy.context.view_layer.objects.active = bt
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='MATERIAL')
bpy.ops.object.mode_set(mode='OBJECT')
for o in [x for x in bpy.data.objects if x.name.startswith('botones colores')]:
    mat = o.data.materials[0].name  # "Piel 7"
    o.name = 'btn_' + re.sub(r'\s+', '_', mat.lower())
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

# ---------- 4. Cajas: base cerrada + morph "abierta" ----------
# Indices de los 32 vertices de cada caja (todas comparten la misma malla):
#   solapa -> (borde exterior de abajo, borde exterior de arriba, direccion hacia adentro, altura extra al cerrar)
FLAPS = {
    '+y': ([16, 17], [28, 29], (0, -1), 0.062),
    '-y': ([18, 19], [30, 31], (0, 1), 0.062),
    '-x': ([12, 13], [24, 25], (1, 0), 0.0),
    '+x': ([14, 15], [26, 27], (-1, 0), 0.0),
}
HINGE_UNDER = [8, 9, 10, 11]   # borde superior de las paredes (abajo de la solapa)
HINGE_TOP = [20, 21, 22, 23]   # borde superior de las paredes (cara de arriba de la solapa)


def closed_positions(me):
    """Posicion de cada vertice con las solapas dobladas hacia adentro (el resto no se mueve)."""
    pos = {v.index: v.co.copy() for v in me.vertices}
    for key, (under, top, (dx, dy), raise_z) in FLAPS.items():
        side_axis = 1 if key[1] == 'y' else 0   # eje por el que la solapa sale de la pared
        along = 1 - side_axis                    # eje a lo largo de la bisagra
        for outers, hinges in ((under, HINGE_UNDER), (top, HINGE_TOP)):
            wall = [me.vertices[j] for j in hinges if (me.vertices[j].co[side_axis] > 0) == (key[0] == '+')]
            for i in outers:
                v = me.vertices[i].co
                h = min(wall, key=lambda c: abs(c.co[along] - v[along]))
                length = (v - h.co).length
                new = h.co.copy()
                new[0] += dx * length
                new[1] += dy * length
                new[along] = v[along]
                new[2] = h.co[2] + raise_z
                pos[i] = new
    return pos


for n in range(1, 7):
    o = bpy.data.objects[f'Caja {n}']
    o.data = o.data.copy()  # cada caja con su propia malla (las formas se guardan por malla)
    me = o.data
    assert len(me.vertices) >= 32 and 0.55 < me.vertices[16].co.z < 0.7, f'caja {n}: malla inesperada'
    closed = closed_positions(me)
    o.shape_key_add(name='Basis', from_mix=False)
    o.shape_key_add(name='abierta', from_mix=False)
    base = me.shape_keys.key_blocks['Basis']
    for i, co in closed.items():
        base.data[i].co = co
        me.vertices[i].co = co
    me.update()

# ---------- 5. Nombres ----------
RENAME = {
    'Boton camisa': 'btn_camisa', 'Boton pantalon': 'btn_pantalon', 'Boton zapatos': 'btn_zapatos',
    'Boton accesorios': 'btn_accesorios', 'libro.001': 'libro_ojos', 'ventana lata': 'ventana_lata',
}
for o in bpy.data.objects:
    new = RENAME.get(o.name)
    if not new:
        new = re.sub(r'\s+', '_', o.name)
        new = re.sub(r'[\[\]\.:/]', '', new)
        if re.match(r'^Caja_\d$', new):
            new = new.lower()
    o.name = new

for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA'):
        bpy.data.objects.remove(o, do_unlink=True)

# ---------- 6. Exportar ----------
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=out_glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
    export_materials='EXPORT', export_image_format='AUTO', export_cameras=False, export_lights=False,
    export_extras=False, export_normals=True, export_morph=True, export_morph_normal=True,
    export_animations=False, export_skins=False)


# ---------- 7. Las calcomanias (PNG con transparencia) se recortan, no se mezclan ----------
def patch_glb(path, decal_materials):
    data = open(path, 'rb').read()
    magic, version, total = struct.unpack('<4sII', data[:12])
    jlen, jtype = struct.unpack('<I4s', data[12:20])
    js = json.loads(data[20:20 + jlen])
    for m in js.get('materials', []):
        if m.get('name') in decal_materials:
            m['alphaMode'] = 'MASK'
            m['alphaCutoff'] = 0.45
    new = json.dumps(js, separators=(',', ':')).encode()
    new += b' ' * ((4 - len(new) % 4) % 4)
    rest = data[20 + jlen:]
    out = struct.pack('<4sII', magic, version, 12 + 8 + len(new) + len(rest)) + struct.pack('<I4s', len(new), jtype) + new + rest
    open(path, 'wb').write(out)
    return js


js = patch_glb(out_glb, {'Camisa B', 'Pantalon B', 'Zapatos B', 'Hoja B', 'Colores', 'Capsula 1', 'ventana lata',
                         'Logo animal crossing', 'Personaje stikcer', 'Ojos', 'Ojos 2', 'Ojos 3', 'Ojos 4',
                         'ICONOS CAJA', 'RECICLAR'})
info['nodos'] = sorted(n['name'] for n in js['nodes'] if 'mesh' in n)
json.dump(info, open(out_info, 'w'), indent=1, ensure_ascii=False)
print('exportado', out_glb, 'nodos', len(info['nodos']))
