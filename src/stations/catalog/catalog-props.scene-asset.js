/* Muebles y objetos de las estaciones 3 a 5. Modelos PLACEHOLDER procedurales.
   Unidades en metros, +Z mira al usuario. Cada mueble tiene su origen en el centro de su base. */
import {
  AssetManager,
  BoxGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from '@iwsdk/core';

const matte = (color) => new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 });

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

/** Libro de stickers abierto, plano sobre la placa, con una flecha a cada lado para pasar de pagina. */
export function createStickerBook() {
  const group = new Group();
  group.name = 'StickerBook';
  group.add(part('Cover', new BoxGeometry(0.27, 0.012, 0.17), matte(0xe60012), 0, 0.006, 0));
  group.add(part('Pages', new BoxGeometry(0.25, 0.008, 0.15), matte(0xfff6e6), 0, 0.016, 0));
  group.add(part('Spine', new BoxGeometry(0.006, 0.01, 0.15), matte(0xd9d2c3), 0, 0.02, 0));
  return group;
}

/** Flecha para pasar de pagina: base verde y un cono que apunta a la izquierda o a la derecha. */
export function createPageArrow(direction) {
  const group = new Group();
  group.name = direction < 0 ? 'PrevPage' : 'NextPage';
  group.add(part('Base', new BoxGeometry(0.04, 0.02, 0.05), matte(0x8cc37a), 0, 0.01, 0));
  const arrow = part('Arrow', new ConeGeometry(0.014, 0.03, 4), matte(0xfff6e6), 0, 0.03, 0);
  arrow.rotation.z = -direction * Math.PI / 2;
  group.add(arrow);
  return group;
}

/** Armario abierto: fondo, laterales y dos baldas donde se exhibe la ropa. */
export function createWardrobe() {
  const group = new Group();
  group.name = 'Wardrobe';
  const wood = matte(0xf0d9b5);
  group.add(part('Back', new BoxGeometry(0.42, 0.37, 0.01), matte(0x8fb4e3), 0, 0.185, -0.045));
  for (const side of [-1, 1]) {
    group.add(part('Side', new BoxGeometry(0.012, 0.37, 0.09), wood, side * 0.213, 0.185, 0));
  }
  group.add(part('Top', new BoxGeometry(0.438, 0.012, 0.09), wood, 0, 0.376, 0));
  for (const y of [0.0, 0.12, 0.24]) {
    group.add(part('Shelf', new BoxGeometry(0.42, 0.012, 0.09), wood, 0, y + 0.006, 0));
  }
  return group;
}

/** Caja de charms y accesorios: bandeja baja con borde. */
export function createCharmBox() {
  const group = new Group();
  group.name = 'CharmBox';
  const body = matte(0xf6d365);
  group.add(part('Floor', new BoxGeometry(0.42, 0.012, 0.17), body, 0, 0.006, 0));
  group.add(part('Back', new BoxGeometry(0.42, 0.04, 0.012), matte(0xf5a25d), 0, 0.02, -0.079));
  group.add(part('Front', new BoxGeometry(0.42, 0.03, 0.012), matte(0xf5a25d), 0, 0.015, 0.079));
  for (const side of [-1, 1]) {
    group.add(part('Side', new BoxGeometry(0.012, 0.04, 0.17), matte(0xf5a25d), side * 0.213, 0.02, 0));
  }
  return group;
}
