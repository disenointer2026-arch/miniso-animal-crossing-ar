/* Bolsa MINISO del cierre (public/models/bolsa/bolsa.glb, de Bolsa_miniso.blend): roja, con el logo hacia +Z y los
   asas arriba. El origen esta en el centro de la base. Las medidas estan en unidades del modelo; la bolsa se crea
   ya escalada con la escala de la fabrica, asi que el grupo devuelto mide lo que mide en el mundo (1 = tal cual). */
import { AssetManager, Box3, Group, Vector3 } from '@iwsdk/core';
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
  // Hacia donde mira el frente (el logo): del centro de la bolsa al centro de la malla del logo, en el plano horizontal. Se mide en vez
  // de suponerse, asi la bolsa se orienta bien aunque el modelo cambie de eje. userData.frontYaw = giro en Y del frente respecto a +Z.
  group.updateMatrixWorld(true);
  const whole = new Box3().setFromObject(model).getCenter(new Vector3());
  const logo = new Box3();
  model.traverse((o) => {
    if (o.isMesh && (o.name.toLowerCase().includes('logo') || [].concat(o.material).some((m) => m?.name === 'bolsa_logo'))) logo.expandByObject(o);
  });
  group.userData.frontYaw = 0;
  if (!logo.isEmpty()) {
    const c = logo.getCenter(new Vector3());
    if (Math.hypot(c.x - whole.x, c.z - whole.z) > 1e-4) group.userData.frontYaw = Math.atan2(c.x - whole.x, c.z - whole.z);
  }
  group.userData.rim = BAG.rim * s; // altura de la boca en metros
  group.userData.floor = BAG.floor * s; // donde pisa el personaje dentro de la bolsa
  return group;
}
