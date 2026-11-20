/* La fabrica: el modelo FABRICA.blend convertido a glTF (public/models/fabrica/fabrica.glb;
   fuente en docs/fuentes/FABRICA.blend). Se crea al terminar la calibracion, a la medida del
   usuario: la banda queda a la altura calibrada y el usuario en el centro (origen local).
   Partes con nombre en root.userData.parts.nodes (maquina, tijeras, dispensador, closet...). */
import {
  AssetManager,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  TorusGeometry,
} from '@iwsdk/core';
import { MODEL, modelPoint, modelScale } from '../core/layout.js';
import { HIDDEN_NODES } from './anchors.js';

export function createFactory(layout) {
  const root = new Group();
  root.name = 'Factory';
  const gltf = AssetManager.getGLTF('fabrica');
  if (!gltf) {
    console.warn('[fabrica] Falta el modelo "fabrica" en src/assets.js');
    return root;
  }
  const model = gltf.scene.clone(true);
  model.name = 'FabricaModelo';
  const s = modelScale(layout);
  // glTF: x = este, y = arriba, z = -norte. El usuario queda en el origen y la banda a su altura.
  model.scale.setScalar(s);
  model.position.set(-MODEL.user[0] * s, layout.height - MODEL.beltTop * s, MODEL.user[1] * s);
  const nodes = {};
  model.traverse((object) => {
    if (object.name) nodes[object.name] = object;
  });
  for (const name of HIDDEN_NODES) if (nodes[name]) nodes[name].visible = false;
  root.add(model);

  // Base de la caja de regalo, al final de la banda
  const gift = modelPoint(layout, MODEL.giftBox[0], MODEL.giftBox[1], MODEL.beltTop);
  const pad = new Group();
  pad.name = 'GiftPad';
  pad.position.set(gift.x, gift.y + 0.004, gift.z);
  pad.add(new Mesh(new CylinderGeometry(0.14, 0.14, 0.012, 32), new MeshStandardMaterial({ color: 0xf6d365, roughness: 0.6 })));
  const ring = new Mesh(new TorusGeometry(0.14, 0.007, 8, 32), new MeshStandardMaterial({ color: 0xe60012, roughness: 0.6 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.006;
  pad.add(ring);
  root.add(pad);

  root.userData.parts = { model, nodes };
  return root;
}
