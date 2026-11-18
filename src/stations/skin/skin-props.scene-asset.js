/* Objetos de la estacion 1 (color de piel): dispensador y lata de aerosol.
   Modelos PLACEHOLDER procedurales. Unidades en metros, +Z mira al usuario. */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from '@iwsdk/core';

/** Medidas de la lata (origen en su centro). */
export const CAN = { radius: 0.028, height: 0.11 };
/** Punta del aerosol, en coordenadas de la lata. */
export const CAN_NOZZLE = [0, CAN.height / 2 + 0.025, 0.024];

const metal = new MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.35, metalness: 0.2 });
const dark = new MeshStandardMaterial({ color: 0x4a4540, roughness: 0.6 });
const red = new MeshStandardMaterial({ color: 0xe60012, roughness: 0.5 });
const cream = new MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.6 });
const leaf = new MeshStandardMaterial({ color: 0x8cc37a, roughness: 0.6 });
const yellow = new MeshStandardMaterial({ color: 0xf6d365, roughness: 0.6 });

const bodyGeometry = new CylinderGeometry(CAN.radius, CAN.radius, CAN.height, 24);
const bandGeometry = new CylinderGeometry(CAN.radius + 0.0008, CAN.radius + 0.0008, 0.045, 24);
const capGeometry = new CylinderGeometry(CAN.radius * 0.85, CAN.radius, 0.016, 24);
const nozzleBase = new CylinderGeometry(0.009, 0.009, 0.014, 12);
const nozzleTip = new BoxGeometry(0.008, 0.008, 0.022);

function part(name, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
}

/** Lata del tono elegido: franja de color, tapa oscura y boquilla roja hacia +Z. */
export function createSprayCan(hex) {
  const can = new Group();
  can.name = 'SprayCan';
  can.add(part('Body', bodyGeometry, metal));
  can.add(
    part('Band', bandGeometry, new MeshStandardMaterial({ color: hex, roughness: 0.5 }), 0, -0.004, 0),
  );
  can.add(part('Cap', capGeometry, dark, 0, CAN.height / 2 + 0.008, 0));
  can.add(part('NozzleBase', nozzleBase, red, 0, CAN.height / 2 + 0.022, 0));
  can.add(part('NozzleTip', nozzleTip, red, 0, CAN.height / 2 + 0.025, 0.014));
  return can;
}

/** Dispensador: tolva verde, cuerpo crema y una rampa amarilla por la que caen las latas.
    Origen: centro de la base. La rampa mira a +Z. */
export function createDispenser() {
  const group = new Group();
  group.name = 'SkinDispenser';
  group.add(part('Body', new BoxGeometry(0.11, 0.2, 0.07), cream, 0, 0.1, 0));
  group.add(part('Hopper', new BoxGeometry(0.12, 0.03, 0.08), leaf, 0, 0.215, 0));
  group.add(part('Ramp', new BoxGeometry(0.07, 0.012, 0.05), yellow, 0, 0.012, 0.055));
  group.add(part('Slot', new BoxGeometry(0.08, 0.05, 0.006), dark, 0, 0.1, 0.036));
  for (let i = 0; i < 3; i++) {
    group.add(part(`Can${i}`, new CylinderGeometry(0.012, 0.012, 0.04, 12), red, (i - 1) * 0.03, 0.16, 0.037));
  }
  return group;
}
