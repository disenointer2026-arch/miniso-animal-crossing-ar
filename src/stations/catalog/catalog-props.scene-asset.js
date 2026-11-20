/* El sticker de las estaciones: papel crema con el dibujo encima (el libro y las cajas estan en
   catalog-objects.js; el armario y el estante son del modelo). Unidades en metros. */
import {
  AssetManager,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';

function part(name, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
}

const STICKER = { size: 0.05, paper: 0.058 };
const paperGeometry = new PlaneGeometry(STICKER.paper, STICKER.paper).rotateX(-Math.PI / 2);
const faceGeometry = new PlaneGeometry(STICKER.size, STICKER.size).rotateX(-Math.PI / 2);
const paperMaterial = new MeshBasicMaterial({ color: 0xfff6e6, side: DoubleSide });

/** Sticker plano: papel crema con el dibujo encima. Su origen esta en el centro. */
export function createSticker(textureKey) {
  const group = new Group();
  group.name = 'Sticker';
  group.add(part('Paper', paperGeometry, paperMaterial));
  const texture = AssetManager.getTexture(textureKey);
  if (texture) texture.colorSpace = SRGBColorSpace;
  const face = part(
    'Picture',
    faceGeometry,
    new MeshBasicMaterial({ map: texture ?? null, transparent: true, alphaTest: 0.05, side: DoubleSide }),
    0,
    0.0008,
    0,
  );
  group.add(face);
  return group;
}
