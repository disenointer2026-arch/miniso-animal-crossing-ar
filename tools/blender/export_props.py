"""Exporta la lata de aerosol y la bolsa MINISO a glb.

lata:  toma la "Lata aerosol" de la coleccion REFERENCIAS de FABRICA.blend. Ese mesh NO trae mapa UV (todas las UV
       valen 0), asi que aqui se genera uno: el cuerpo (etiqueta) se proyecta dentro de la mancha de color de las
       texturas Lata.PielN.UV.png y lo demas (aro de la base, hombro, tapa y boquilla) es de metal gris sin textura.
       Queda con el origen en el centro de la base, de pie, y la boquilla apuntando a +Z (hacia el usuario).
bolsa: la "Bolsa" de Bolsa_miniso.blend, con origen en el centro de la base y el logo hacia +Z.
Uso:  python -I tools/blender/export_props.py -- lata docs/fuentes/fabrica/FABRICA.blend docs/fuentes/lata/Lata.Piel1.UV.png public/models/lata/lata.glb
      python -I tools/blender/export_props.py -- bolsa docs/fuentes/bolsa/Bolsa_miniso.blend public/models/bolsa/bolsa.glb
"""
import math
import sys

import bpy
from mathutils import Matrix

args = sys.argv[sys.argv.index('--') + 1:]
what = args[0]


def material(name, color, rough, metal, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if image:
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(image)
        m.node_tree.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    return m


def only(obj):
    for o in list(bpy.data.objects):
        if o is not obj:
            bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def grounded(obj):
    """Aplica la escala y la rotacion y deja el origen en el centro de la base."""
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    me = obj.data
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    zs = [v.co.z for v in me.vertices]
    me.transform(Matrix.Translation((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs))))
    obj.location = (0, 0, 0)
    return max(zs) - min(zs)


def export(out):
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_materials='EXPORT', export_cameras=False,
                              export_lights=False, export_extras=False, export_normals=True)
    print('exportado', out)


if what == 'lata':
    blend, texture, out = args[1:4]
    bpy.ops.wm.open_mainfile(filepath=blend)
    o = bpy.data.objects['Lata aerosol']
    me = o.data
    # UV cilindricas en coordenadas locales (z hacia arriba, la boquilla mira a +x)
    uv = me.uv_layers[0]
    # Ojo: vaciar las ranuras de material reinicia los indices de las caras, asi que primero van los materiales
    me.materials.clear()
    me.materials.append(material('lata_etiqueta', (1, 1, 1), 0.45, 0.05, texture))
    me.materials.append(material('lata_metal', (0.497, 0.497, 0.497), 0.4, 0.15))
    for poly in me.polygons:
        zc = sum(me.vertices[i].co.z for i in poly.vertices) / len(poly.vertices)
        label = -0.65 < zc <= 2.85
        poly.material_index = 0 if label else 1
        for li in poly.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co
            angle = (math.atan2(v.y, v.x) + math.pi) / (2 * math.pi)
            uv.data[li].uv = (0.12 + 0.36 * angle, 0.12 + 0.40 * (v.z + 0.6) / 3.35)
    only(o)
    o.rotation_euler = (0, 0, math.radians(-90))  # la boquilla (+x) pasa a -y de Blender = +Z de glTF
    height = grounded(o)
    print('altura de la lata (unidades del modelo):', round(height, 3))
    export(out)
elif what == 'bolsa':
    blend, out = args[1:3]
    bpy.ops.wm.open_mainfile(filepath=blend)
    o = bpy.data.objects['Bolsa']
    me = o.data
    logo = [p for p in me.polygons if p.material_index == 0]
    zs = [me.vertices[i].co.z for p in logo for i in p.vertices]
    ys = [me.vertices[i].co.y for p in logo for i in p.vertices]
    print('caras del slot 0 (logo):', len(logo), 'z', round(min(zs), 2), round(max(zs), 2), 'y', round(min(ys), 2), round(max(ys), 2))
    # Se reemplazan las dos ranuras que ya tiene (el slot 0 es el logo): vaciarlas reiniciaria los indices de las caras
    me.materials[0] = material('bolsa_logo', (0.9, 0.9, 0.9), 0.5, 0)
    me.materials[1] = material('bolsa_roja', (0.847, 0.012, 0.018), 0.5, 0)
    only(o)
    o.rotation_euler = (0, 0, 0)  # el .blend la tiene inclinada 2,4 grados
    height = grounded(o)
    dims = o.dimensions
    print('bolsa: alto', round(height, 3), 'dimensiones', [round(d, 3) for d in dims])
    export(out)
