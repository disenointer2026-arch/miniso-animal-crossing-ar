/* La tarjeta Amiibo como objeto 3D: una carta de pie, de 5:7, con el dibujo en la cara
   frontal. El lienzo se redibuja cuando cambia el nombre, el cumpleanos o el fondo. */
import {
  CanvasTexture,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';
import { CARD_H, CARD_W, drawCard } from './card-renderer.js';

export const CARD_SIZE = { width: 0.3, height: 0.42 };

export function createCardView() {
  // El lienzo inicial ya tiene el tamano final: WebGL no admite cambiar el tamano de una textura
  const blank = document.createElement('canvas');
  blank.width = CARD_W;
  blank.height = CARD_H;
  const texture = new CanvasTexture(blank);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  // Plano con transparencia: las esquinas redondeadas de la tarjeta quedan vacias (antes se veian negras)
  const front = new MeshBasicMaterial({
    map: texture,
    toneMapped: false,
    transparent: true,
    alphaTest: 0.06,
    side: DoubleSide,
  });
  const mesh = new Mesh(new PlaneGeometry(CARD_SIZE.width, CARD_SIZE.height), front);
  mesh.name = 'CardView';
  mesh.userData.texture = texture;
  let token = 0;
  /** Redibuja con { portrait, name, birthday, theme, avatar }. */
  mesh.userData.redraw = async (options) => {
    const mine = ++token;
    const canvas = await drawCard(options);
    if (mine !== token) return;
    texture.image = canvas;
    texture.needsUpdate = true;
  };
  mesh.userData.size = { width: CARD_W, height: CARD_H };
  return mesh;
}
