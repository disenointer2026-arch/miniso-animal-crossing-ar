/* Objeto de la estacion 2 (cabello) que no viene en el modelo de la fabrica: el bote de descarte.
   (La maquina es la del modelo.) Modelo PLACEHOLDER procedural. Unidades en metros, +Z mira al usuario. */
import {
  BoxGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';

export const BIN = { radius: 0.05, height: 0.1 };

const matte = (color, extra = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });

function part(name, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
}

/** Bote de descarte: cilindro abierto con aro rojo. userData.opening = punto de la boca. */
export function createBin() {
  const group = new Group();
  group.name = 'HairBin';
  group.add(
    part(
      'Wall',
      new CylinderGeometry(BIN.radius, BIN.radius * 0.8, BIN.height, 20, 1, true),
      matte(0x8fb4e3, { side: DoubleSide }),
      0,
      BIN.height / 2,
      0,
    ),
  );
  group.add(part('Floor', new CylinderGeometry(BIN.radius * 0.8, BIN.radius * 0.8, 0.006, 20), matte(0x6b8fc0), 0, 0.003, 0));
  const rim = part('Rim', new TorusGeometry(BIN.radius, 0.005, 8, 24), matte(0xe60012), 0, BIN.height, 0);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);
  const opening = new Group();
  opening.name = 'Opening';
  opening.position.set(0, BIN.height, 0);
  group.add(opening);
  group.userData.opening = opening;
  return group;
}
