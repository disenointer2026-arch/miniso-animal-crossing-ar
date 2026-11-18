/* Fabrica en anillo MINISO x Animal Crossing (modelo procedural PLACEHOLDER).
   Origen: centro del anillo (la cabeza del usuario) a nivel del piso.
   -Z es el frente, +X la derecha. Unidades en metros. Ver src/core/layout.js.

   Partes con nombre: Platform, Plinth, Belt, BeltRails, Portal, GiftPad,
   Station1..5 (placa, poste, letrero con N puntos y lampara).
   Animables, en root.userData.parts:
     beltMaterial -> su textura se desplaza mientras la banda avanza
     beltTile     -> metros por repeticion de la textura
     lights       -> lampara de cada estacion (5) */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
} from '@iwsdk/core';
import {
  ARC,
  BODY,
  DEFAULT_LAYOUT,
  SLOT,
  STATION_COUNT,
  slotAngle,
  slotPose,
} from '../core/layout.js';
import { arcStrip, beltTexture, sector } from './lib/arc-geometry.js';

const DEG = Math.PI / 180;
const BELT_TILE = 0.12;

const COLORS = {
  cream: 0xfff6e6,
  leafDark: 0x6ba35e,
  red: 0xe60012,
  yellow: 0xf6d365,
  lampOff: 0xd9d2c3,
};

/** Un color amable por estacion: piel, cabello, rostro, ropa y charms. */
export const STATION_COLORS = [0xf6d365, 0x8cc37a, 0xf89fad, 0x8fb4e3, 0xf5a25d];

/** Materiales compartidos por color (menos materiales que compilar y cambiar en cada fotograma).
    Con "extra" o para algo que se anima (lamparas, banda) se crea uno propio. */
const shared = new Map();
const matte = (color, extra) => {
  if (extra) return new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...extra });
  if (!shared.has(color)) shared.set(color, new MeshStandardMaterial({ color, roughness: 0.6, metalness: 0 }));
  return shared.get(color);
};

function mesh(name, geometry, material, x = 0, y = 0, z = 0) {
  const m = new Mesh(geometry, material);
  m.name = name;
  m.position.set(x, y, z);
  return m;
}

/** Grupo en el marco de un slot: +Z mira al usuario y +X es el avance. */
function slotGroup(layout, name, slot, radial = 0, up = 0) {
  const pose = slotPose(layout, slot, radial, up);
  const group = new Group();
  group.name = name;
  group.position.set(pose.x, pose.y, pose.z);
  group.rotation.y = pose.rotY;
  return group;
}

function addStation(root, layout, station, lights) {
  const slot = SLOT.firstStation + station;
  const theta = slotAngle(slot);
  const color = STATION_COLORS[station];
  const outer = layout.beltRadius + BODY.outer;

  // Placa de trabajo detras de la banda, del color de la estacion
  const plate = mesh(
    `Station${station + 1}/Plate`,
    sector(layout.beltRadius + BODY.beltHalf + 0.02, outer - 0.015, theta - 14 * DEG, theta + 14 * DEG, 0.006),
    matte(color),
    0,
    layout.height,
    0,
  );
  root.add(plate);

  // Poste y letrero (cara hacia el usuario) con tantos puntos como el numero
  const frame = slotGroup(layout, `Station${station + 1}/Sign`, slot, BODY.outer - 0.012, 0);
  frame.add(mesh('Post', new BoxGeometry(0.02, 0.1, 0.02), matte(COLORS.leafDark), 0, 0.05, 0));
  const board = mesh('Board', new BoxGeometry(0.22, 0.1, 0.012), matte(COLORS.cream), 0, 0.14, 0);
  frame.add(board);
  frame.add(mesh('Header', new BoxGeometry(0.22, 0.022, 0.014), matte(color), 0, 0.18, 0));
  const dot = new SphereGeometry(0.0105, 12, 8);
  const dotMaterial = matte(color);
  for (let d = 0; d <= station; d++) {
    const x = (d - station / 2) * 0.034;
    frame.add(mesh(`Dot${d + 1}`, dot, dotMaterial, x, 0.135, 0.008));
  }
  root.add(frame);

  // Lampara junto al letrero: la enciende el sistema de la banda
  const lamp = slotGroup(layout, `Station${station + 1}/Lamp`, slot, BODY.outer - 0.012, 0);
  const lampMesh = mesh('Bulb', new CylinderGeometry(0.014, 0.014, 0.01, 16), new MeshStandardMaterial({ color: COLORS.lampOff, roughness: 0.6 }), 0.14, 0.005, 0);
  lamp.add(lampMesh);
  root.add(lamp);
  lights.push(lampMesh);
}

export function createFactory(layout = DEFAULT_LAYOUT) {
  const root = new Group();
  root.name = 'Factory';
  const a0 = slotAngle(SLOT.portal) - BODY.marginDeg * DEG;
  const a1 = slotAngle(SLOT.giftBox) + BODY.marginDeg * DEG;
  const rIn = layout.beltRadius - BODY.inner;
  const rOut = layout.beltRadius + BODY.outer;
  const top = layout.height;

  // Plataforma flotante (sin patas) y un zocalo mas oscuro que la despega del aire
  root.add(mesh('Platform', sector(rIn, rOut, a0, a1, BODY.thickness), matte(COLORS.cream), 0, top - BODY.thickness, 0));
  root.add(mesh('Plinth', sector(rIn + 0.03, rOut - 0.03, a0 + 0.04, a1 - 0.04, 0.03), matte(COLORS.leafDark), 0, top - BODY.thickness - 0.03, 0));

  // Banda: franjas que se desplazan, con un borde a cada lado
  const beltMaterial = matte(0xffffff, { map: beltTexture(), roughness: 0.8 });
  const rB0 = layout.beltRadius - BODY.beltHalf;
  const rB1 = layout.beltRadius + BODY.beltHalf;
  const bandA0 = a0 + 0.05;
  const bandA1 = a1 - 0.05;
  root.add(mesh('Belt', arcStrip(rB0, rB1, bandA0, bandA1, top + 0.003, BELT_TILE), beltMaterial));
  const rails = new Group();
  rails.name = 'BeltRails';
  const railMaterial = matte(COLORS.yellow);
  rails.add(mesh('Inner', sector(rB0 - 0.012, rB0, bandA0, bandA1, 0.014), railMaterial, 0, top, 0));
  rails.add(mesh('Outer', sector(rB1, rB1 + 0.012, bandA0, bandA1, 0.014), railMaterial, 0, top, 0));
  root.add(rails);

  // Portal de entrada (slot 0): dos postes y un dintel sobre la banda
  const portal = slotGroup(layout, 'Portal', SLOT.portal);
  const red = matte(COLORS.red);
  for (const side of [-1, 1]) {
    portal.add(mesh('Post', new BoxGeometry(0.03, 0.27, 0.03), red, 0, 0.135, side * 0.125));
  }
  portal.add(mesh('Lintel', new BoxGeometry(0.03, 0.03, 0.31), red, 0, 0.285, 0));
  root.add(portal);

  // Base de la caja de regalo (ultimo slot)
  const gift = slotGroup(layout, 'GiftPad', SLOT.giftBox);
  gift.add(mesh('Pad', new CylinderGeometry(0.13, 0.13, 0.012, 32), matte(COLORS.yellow), 0, 0.006, 0));
  const ring = mesh('Ring', new TorusGeometry(0.13, 0.007, 8, 32), red, 0, 0.012, 0);
  ring.rotation.x = Math.PI / 2;
  gift.add(ring);
  root.add(gift);

  const lights = [];
  for (let s = 0; s < STATION_COUNT; s++) addStation(root, layout, s, lights);

  root.userData.parts = { beltMaterial, beltTile: BELT_TILE, lights };
  root.userData.layout = { ...layout, arc: ARC };
  return root;
}
