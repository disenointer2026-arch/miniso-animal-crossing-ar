"""Convierte docs/fuentes/FABRICA.blend a public/models/fabrica/fabrica.glb.
El .blend no trae materiales: aqui se asigna un color por pieza (segun su nombre o su coleccion)
y se exporta con +Y arriba, conservando los nombres de los objetos.
Uso (con Blender >= 4):  blender -b docs/fuentes/FABRICA.blend --python tools/blender/export_fabrica.py -- public/models/fabrica/fabrica.glb
"""
import sys, bpy
bpy.ops.wm.open_mainfile(filepath=sys.argv[-2])
out = sys.argv[-1]

def rgb(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    # los colores de glTF son lineales: se convierte desde sRGB
    return tuple((v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1,)

PALETTE = {
    'belt': '#d9d4c8', 'start': '#e8675c', 'color': '#f6d365', 'hair': '#8cc37a', 'face': '#f08aa8',
    'clothes': '#8fb4e3', 'charms': '#f5a25d', 'leg': '#7fb36e', 'box': '#e6bf8e', 'screen': '#5b6b7a',
    'door': '#6f9bd1', 'dark': '#4a4540', 'gold': '#f2c14e',
}
BY_NAME = [  # (prefijo del nombre, color); el primero que coincide gana
    ('recorrido', 'belt'), ('miniso', 'start'), ('soporte', 'leg'), ('reja', 'leg'), ('pantalla', 'screen'),
    ('puerta', 'door'), ('closet', 'clothes'), ('Caja', 'box'), ('Cube', 'charms'), ('tijeras', 'gold'),
    ('boton', 'gold'), ('ojo', 'dark'), ('libro', 'start'), ('tuberias', 'leg'), ('dispensador', 'color'),
]
BY_COLLECTION = {'CINTA': 'belt', 'INICIO': 'start', 'ESTACIÓN COLOR': 'color', 'ESTACIÓN PELO': 'hair',
                 'ESTACIÓN OJOS-BOCA': 'face', 'ESTACIÓN ROPA': 'clothes', 'Collection 8': 'charms'}
mats = {}
def material(key):
    if key not in mats:
        m = bpy.data.materials.new(key); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = rgb(PALETTE[key]); b.inputs['Roughness'].default_value = 0.6; b.inputs['Metallic'].default_value = 0
        mats[key] = m
    return mats[key]

for c in bpy.data.collections:
    for o in c.objects:
        if o.type != 'MESH': continue
        key = next((k for p, k in BY_NAME if o.name.startswith(p)), BY_COLLECTION.get(c.name, 'belt'))
        o.data.materials.clear(); o.data.materials.append(material(key))
        o['coleccion'] = c.name
for o in list(bpy.data.objects):
    if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.data.objects:
    if o.type == 'MESH': o.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True,
                          export_apply=True, export_materials='EXPORT', export_cameras=False, export_lights=False,
                          export_extras=False, export_normals=True)
print('exportado', out)
