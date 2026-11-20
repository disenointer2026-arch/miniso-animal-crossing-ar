/* Objetos de la estacion 1 (color de piel) que no vienen en el modelo de la fabrica: la lata de
   aerosol y su bandeja (los dispensadores son los del modelo). Unidades en metros, +Z mira al usuario. */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
} from '@iwsdk/core';

/** Medidas de la lata (origen en su centro). */
export const CAN = { radius: 0.034, height: 0.13 };
/** Punta del aerosol, en coordenadas de la lata. */
export const CAN_NOZZLE = [0, CAN.height / 2 + 0.03, 0.03];
/** Valvula (boton de arriba): se activa pulsandola con la punta del dedo indice. */
export const CAN_VALVE = [0, CAN.height / 2 + 0.034, 0];

const metal = new MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.35, metalness: 0.2 });
const dark = new MeshStandardMaterial({ color: 0x4a4540, roughness: 0.6 });
const red = new MeshStandardMaterial({ color: 0xe60012, roughness: 0.5 });
const cream = new MeshStandardMaterial({ color: 0xfff6e6, roughness: 0.6 });
const leaf = new MeshStandardMaterial({ color: 0x8cc37a, roughness: 0.6 });
const yellow = new MeshStandardMaterial({ color: 0xf6d365, roughness: 0.6 });

const bodyGeometry = new CylinderGeometry(CAN.radius, CAN.radius, CAN.height, 24);
const bandGeometry = new CylinderGeometry(CAN.radius + 0.0008, CAN.radius + 0.0008, 0.045, 24);
const capGeometry = new CylinderGeometry(CAN.radius * 0.85, CAN.radius, 0.016, 24);
const nozzleBase = new CylinderGeometry(0.013, 0.015, 0.018, 20);
const nozzleTip = new BoxGeometry(0.009, 0.009, 0.026);

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
  // La valvula (boton rojo con la boquilla) se hunde al pulsarla; el sistema la mueve por userData
  const valve = new Group();
  valve.name = 'Valve';
  valve.position.set(0, CAN.height / 2 + 0.016, 0);
  valve.add(part('ValveButton', nozzleBase, red, 0, 0.011, 0));
  valve.add(part('NozzleTip', nozzleTip, red, 0, 0.014, 0.018));
  can.add(valve);
  can.userData.valve = valve;
  can.userData.valveRest = valve.position.y;
  return can;
}

/** Bandeja donde caen las latas, junto a los dispensadores del modelo: un plato crema con borde
    amarillo. Origen: centro de la base. */
export function createTray() {
  const group = new Group();
  group.name = 'SkinTray';
  group.add(part('Plate', new CylinderGeometry(0.055, 0.055, 0.008, 28), cream, 0, 0.004, 0));
  group.add(part('Rim', new CylinderGeometry(0.058, 0.058, 0.004, 28), yellow, 0, 0.002, 0));
  return group;
}
