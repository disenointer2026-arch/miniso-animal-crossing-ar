/* Objetos de la estacion 2 (cabello): maquina de fabricacion y bote de descarte.
   Modelos PLACEHOLDER procedurales. Unidades en metros, +Z mira al usuario.
   Partes animables en userData.parts: body (se sacude al fabricar) y lamp. */
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

/** Maquina: cuerpo rosa con cupula, lampara y una bandeja de salida hacia +Z. */
export function createHairMachine() {
  const group = new Group();
  group.name = 'HairMachine';
  const body = new Group();
  body.name = 'Body';
  body.add(part('Shell', new BoxGeometry(0.11, 0.16, 0.07), matte(0xf89fad), 0, 0.08, 0));
  body.add(part('Dome', new SphereGeometry(0.05, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), matte(0xfff6e6), 0, 0.16, 0));
  body.add(part('Window', new BoxGeometry(0.07, 0.05, 0.006), matte(0x4a4540), 0, 0.09, 0.036));
  body.add(part('Pipe', new CylinderGeometry(0.008, 0.008, 0.05, 10), matte(0xf6d365), 0.045, 0.21, 0));
  group.add(body);
  const lamp = part('Lamp', new SphereGeometry(0.012, 12, 8), matte(0xd9d2c3), 0, 0.12, 0.037);
  group.add(lamp);
  group.add(part('Tray', new BoxGeometry(0.1, 0.01, 0.06), matte(0x8cc37a), 0, 0.005, 0.065));
  group.userData.parts = { body, lamp };
  return group;
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
