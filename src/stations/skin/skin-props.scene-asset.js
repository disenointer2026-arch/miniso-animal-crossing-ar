/* Lata de aerosol de la estacion 1: el modelo del equipo (public/models/lata/lata.glb, 3,5 unidades de alto, origen en
   el centro de la base, boquilla hacia +Z). Su etiqueta lleva la textura del tono de piel (public/textures/lata/piel-N.png,
   copias ligeras de las Lata.PielN.UV.png de docs/fuentes/lata/); lo demas es metal gris.
   Las medidas estan en unidades del modelo: la lata se escala con la escala de la fabrica. */
import { AssetManager, Group, SRGBColorSpace } from '@iwsdk/core';

/** Alto de la lata y puntos clave (unidades del modelo, en el sistema de la lata sin escalar). */
export const CAN = { height: 3.504, radius: 0.727 };
/** Valvula (el boton de arriba): se activa pulsandola con la punta del dedo indice. */
export const CAN_VALVE = [0, 3.52, 0];
/** Punta de la boquilla (de donde sale la pintura). */
export const CAN_NOZZLE = [0, 3.4, 0.32];

const labelTextures = new Map();

/** Textura de la etiqueta del tono `index` (1 a 12). Las texturas de glTF no se voltean, por eso flipY = false. */
function labelTexture(index) {
  let texture = labelTextures.get(index);
  if (!texture) {
    const source = AssetManager.getTexture(`lata-piel-${index}`);
    if (!source) return null;
    texture = source.clone();
    texture.flipY = false;
    texture.colorSpace = SRGBColorSpace;
    texture.needsUpdate = true;
    labelTextures.set(index, texture);
  }
  return texture;
}

/** Lata del tono `index` (1 a 12) a la escala `scale` (metros por unidad del modelo). */
export function createSprayCan(index, scale) {
  const can = new Group();
  can.name = 'SprayCan';
  const gltf = AssetManager.getGLTF('lata');
  if (!gltf) {
    console.warn('[lata] Falta el modelo "lata" en src/assets.js');
    return can;
  }
  const model = gltf.scene.clone(true);
  model.name = 'SprayCanModel';
  const map = labelTexture(index);
  model.traverse((object) => {
    if (!object.isMesh) return;
    object.material = object.material.clone();
    if (object.material.name === 'lata_etiqueta' && map) {
      object.material.map = map;
      object.material.needsUpdate = true;
    }
  });
  can.add(model);
  can.scale.setScalar(scale);
  can.userData.model = model;
  return can;
}
