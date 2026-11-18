/* Caja de regalo (modelo PLACEHOLDER procedural): base roja con cinta amarilla y tapa con
   mono que se abre girando sobre su borde de atras. Origen en el centro de la base; +Z al
   frente. userData.parts.lid: giro en X (0 = cerrada, negativo = abierta). */
import { BoxGeometry, ConeGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from '@iwsdk/core';

export const GIFT = { width: 0.2, height: 0.14, lidHeight: 0.04, openAngle: -1.75 };

const matte = (color) => new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 });

function part(name, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
}

export function createGiftBox() {
  const red = matte(0xe60012);
  const gold = matte(0xf6d365);
  const w = GIFT.width;
  const group = new Group();
  group.name = 'GiftBox';
  group.add(part('Base', new BoxGeometry(w, GIFT.height, w), red, 0, GIFT.height / 2, 0));
  group.add(part('RibbonA', new BoxGeometry(0.04, GIFT.height + 0.001, w + 0.002), gold, 0, GIFT.height / 2, 0));
  group.add(part('RibbonB', new BoxGeometry(w + 0.002, GIFT.height + 0.001, 0.04), gold, 0, GIFT.height / 2, 0));

  // La tapa gira sobre su borde de atras: sus hijos se colocan hacia +Z desde la bisagra
  const lid = new Group();
  lid.name = 'Lid';
  lid.position.set(0, GIFT.height, -w / 2);
  const lw = w + 0.012;
  lid.add(part('LidTop', new BoxGeometry(lw, GIFT.lidHeight, lw), red, 0, GIFT.lidHeight / 2, w / 2));
  lid.add(part('LidRibbonA', new BoxGeometry(0.04, GIFT.lidHeight + 0.001, lw + 0.002), gold, 0, GIFT.lidHeight / 2, w / 2));
  lid.add(part('LidRibbonB', new BoxGeometry(lw + 0.002, GIFT.lidHeight + 0.001, 0.04), gold, 0, GIFT.lidHeight / 2, w / 2));
  for (const side of [-1, 1]) {
    const loop = part('Bow', new ConeGeometry(0.03, 0.06, 12), gold, side * 0.04, GIFT.lidHeight + 0.025, w / 2);
    loop.rotation.z = -side * (Math.PI / 2 - 0.2);
    lid.add(loop);
  }
  lid.add(part('Knot', new SphereGeometry(0.018, 12, 8), gold, 0, GIFT.lidHeight + 0.02, w / 2));
  group.add(lid);
  group.userData.parts = { lid };
  return group;
}
