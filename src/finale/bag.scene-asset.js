/* Bolsa MINISO del cierre (public/models/bolsa/bolsa.glb, de Bolsa_miniso.blend): roja, con el logo hacia +Z y los
   asas arriba. El origen esta en el centro de la base. Las medidas estan en unidades del modelo; la bolsa se crea
   ya escalada con la escala de la fabrica, asi que el grupo devuelto mide lo que mide en el mundo (1 = tal cual). */
import { AssetManager, Group } from '@iwsdk/core';
import { modelScale } from '../core/layout.js';

/** Medidas de la bolsa (unidades del modelo): alto de la boca (sin las asas) y grosor del fondo. */
export const BAG = { width: 4.583, depth: 2.987, height: 5.102, rim: 3.9, floor: 0.25 };

export function createBag(layoutValue) {
  const group = new Group();
  group.name = 'Bag';
  const gltf = AssetManager.getGLTF('bolsa');
  if (!gltf) {
    console.warn('[bolsa] Falta el modelo "bolsa" en src/assets.js');
    return group;
  }
  const s = modelScale(layoutValue);
  const model = gltf.scene.clone(true);
  model.scale.setScalar(s);
  group.add(model);
  group.userData.rim = BAG.rim * s; // altura de la boca en metros
  group.userData.floor = BAG.floor * s; // donde pisa el personaje dentro de la bolsa
  return group;
}
