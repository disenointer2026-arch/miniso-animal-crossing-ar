/* Los botones, las cajas y otras piezas del modelo de la fabrica son nodos del glb (root.userData.parts.nodes).
   Este modulo calcula su caja en coordenadas de la fabrica y convierte un nodo en un BOTON PULSABLE: encima del nodo
   se pone una zona de toque invisible (dedo o rayo + pellizco) y el propio nodo del modelo se hunde al pulsarlo.
   El elegido se marca con la insignia de la guia (circulo rojo con chulo blanco). */
import {
  Box3,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  Matrix4,
  PokeInteractable,
  RayInteractable,
  Vector3,
} from '@iwsdk/core';
import { FactoryPart, UiItem } from '../components.js';
import { standPoint } from '../core/layout.js';
import { layout } from '../state.js';
import { drawCheck, canvasPlane } from '../ui/world-ui.js';

const inverse = new Matrix4();
const matrix = new Matrix4();
const partBox = new Box3();

/** Caja del nodo en coordenadas locales de `root` (la fabrica), en metros. */
export function localBox(root, node, out = new Box3()) {
  root.updateWorldMatrix(true, false);
  node.updateWorldMatrix(true, true);
  inverse.copy(root.matrixWorld).invert();
  out.makeEmpty();
  node.traverse((object) => {
    if (!object.isMesh) return;
    if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
    matrix.multiplyMatrices(inverse, object.matrixWorld);
    out.union(partBox.copy(object.geometry.boundingBox).applyMatrix4(matrix));
  });
  return out;
}

const hitMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
let hitGeometry = null;

/**
 * Convierte el nodo `name` del modelo en un boton.
 *   slot      slot de la banda de la estacion: el boton mira al punto de pie de ese slot
 *   radius    radio (m) de la zona de toque; por omision, el del propio nodo
 *   depth     cuanto se hunde al pulsar (m)
 *   onPress   que hacer al pulsarlo
 * Devuelve { entity, mesh, node, setShown(bool), setSelected(bool) } o null si el nodo no existe.
 */
export function addModelButton(world, factoryEntity, name, { slot, radius = 0, depth = 0.008, reach = 0.012, onPress }) {
  const root = factoryEntity.object3D;
  const node = root.userData.parts?.nodes?.[name];
  if (!node) {
    console.warn(`[modelo] No hay un nodo "${name}" en la fabrica`);
    return null;
  }
  const box = localBox(root, node);
  const center = box.getCenter(new Vector3());
  const size = box.getSize(new Vector3());
  const stand = standPoint(layout.peek(), slot);
  const direction = new Vector3(stand.x - center.x, 0, stand.z - center.z).normalize(); // hacia el usuario
  const r = radius || Math.max(size.x, size.z, size.y) * 0.5 * 1.1;

  hitGeometry ??= new CylinderGeometry(1, 1, 1, 20).rotateX(Math.PI / 2); // eje Z
  const mesh = new Mesh(hitGeometry, hitMaterial);
  mesh.name = `Button/${name}`;
  mesh.userData.baseScale = 1;
  mesh.userData.noScale = true;
  mesh.userData.shown = true;
  mesh.scale.set(r, r, 0.03);
  mesh.position.copy(center).addScaledVector(direction, reach + 0.015);
  mesh.rotation.y = Math.atan2(direction.x, direction.z);

  // El nodo se hunde en su propio eje: la fabrica no tiene giro propio dentro del modelo, solo escala
  const model = root.userData.parts.model;
  const modelScale = model.scale.x;
  mesh.userData.node = node;
  mesh.userData.nodeBase = node.position.clone();
  mesh.userData.pressDir = direction.clone().multiplyScalar(-1 / modelScale);
  mesh.userData.pressDepth = depth;
  mesh.userData.pressK = 0;
  mesh.userData.onPress = onPress;
  mesh.userData.silent = false;
  mesh.userData.direct = true; // con manos tambien se pulsa por contacto directo del indice (ver UiSystem), sin depender del SDK

  // Insignia de "elegido": circulo rojo con chulo, en la esquina de arriba a la derecha del boton
  const badge = canvasPlane(0.04, 0.04, 1400, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawCheck(ctx, w / 2, h / 2, w * 0.45);
  });
  badge.mesh.position.set(r * 0.7, r * 0.7, 0.02);
  badge.mesh.renderOrder = 14;
  badge.mesh.visible = false;
  mesh.add(badge.mesh);

  const entity = world.createTransformEntity(mesh, { parent: factoryEntity });
  entity.addComponent(FactoryPart);
  entity.addComponent(UiItem);
  entity.addComponent(RayInteractable);
  entity.addComponent(PokeInteractable);
  return {
    entity,
    mesh,
    node,
    center,
    direction,
    setShown(shown) {
      mesh.userData.shown = shown;
      mesh.visible = shown;
      mesh.scale.set(shown ? r : 0.0001, shown ? r : 0.0001, shown ? 0.03 : 0.0001);
    },
    setSelected(selected) {
      badge.mesh.visible = selected;
    },
  };
}
