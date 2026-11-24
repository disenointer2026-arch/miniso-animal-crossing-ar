/* El sticker de las estaciones: un adhesivo impreso (papel crema redondeado con el dibujo, sin recuadros de mas) que se apoya
   sobre las paginas del libro del modelo. Unidades en metros. */
import { AssetManager, CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SRGBColorSpace } from '@iwsdk/core';

export const STICKER = { paper: 0.058, picture: 0.044 };
const PX = 256;
const geometry = new PlaneGeometry(STICKER.paper, STICKER.paper).rotateX(-Math.PI / 2);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Sticker plano (normal +Y), con su origen en el centro: papel crema con borde fino y el dibujo con su proporcion. */
export function createSticker(textureKey) {
  const group = new Group();
  group.name = 'Sticker';
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = PX;
  const ctx = canvas.getContext('2d');
  roundRect(ctx, 6, 6, PX - 12, PX - 12, 52);
  ctx.fillStyle = '#FFF6E6';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#EBDDB8';
  ctx.stroke();
  const image = AssetManager.getTexture(textureKey)?.image;
  if (image?.width) {
    const box = (PX * STICKER.picture) / STICKER.paper;
    const scale = box / Math.max(image.width, image.height);
    const w = image.width * scale;
    const h = image.height * scale;
    ctx.drawImage(image, (PX - w) / 2, (PX - h) / 2, w, h);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new Mesh(
    geometry,
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      side: DoubleSide,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
  mesh.name = 'Paper';
  group.add(mesh);
  return group;
}
