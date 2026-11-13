/* Herramientas de personalizacion (modelos procedurales, mismo plastico que la
   maquina). Cada una trae una "zona de agarre" invisible, mas grande que el
   objeto, para que sea facil tomarla con la mano. Unidades en metros. */
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  TorusGeometry,
} from '@iwsdk/core';

const plastic = (color, extra = {}) =>
  new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });

/** Volumen transparente que amplia la zona donde la mano puede agarrar. */
function grabZone(width, height, depth) {
  const zone = new Mesh(
    new BoxGeometry(width, height, depth),
    new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  zone.name = 'grab-zone';
  return zone;
}

/** Pincel acostado a lo largo de X; la punta (userData.tip) toma el color cargado. */
export function createBrush() {
  const root = new Group();
  root.name = 'brush';
  const body = new Group();
  body.rotation.z = -Math.PI / 2; // construido en Y, acostado hacia +X
  const handle = new Mesh(new CylinderGeometry(0.006, 0.0045, 0.085, 14), plastic(0xc99a63));
  handle.position.y = -0.03;
  const ferrule = new Mesh(new CylinderGeometry(0.0068, 0.0068, 0.016, 14), plastic(0xe60012));
  ferrule.position.y = 0.02;
  const tipMaterial = plastic(0xfff6e6, { roughness: 0.9 });
  const tip = new Mesh(new ConeGeometry(0.0085, 0.032, 14), tipMaterial);
  tip.position.y = 0.044;
  body.add(handle, ferrule, tip);
  root.add(body, grabZone(0.15, 0.045, 0.05));
  root.userData.tip = tipMaterial;
  return root;
}

/** Bote de pintura; la superficie (userData.paint) muestra el color elegido. */
export function createPaintPot() {
  const root = new Group();
  root.name = 'paint-pot';
  const can = new Mesh(new CylinderGeometry(0.032, 0.03, 0.042, 28, 1, true), plastic(0xfff6e6, { side: 2 }));
  can.position.y = 0.021;
  const base = new Mesh(new CylinderGeometry(0.03, 0.03, 0.004, 28), plastic(0xfff6e6));
  base.position.y = 0.002;
  const band = new Mesh(new CylinderGeometry(0.0328, 0.0328, 0.012, 28, 1, true), plastic(0xe60012));
  band.position.y = 0.02;
  const rim = new Mesh(new TorusGeometry(0.032, 0.0025, 8, 28), plastic(0xfff6e6));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.042;
  const paintMaterial = plastic(0xffd8b5, { roughness: 0.25 });
  const paint = new Mesh(new CircleGeometry(0.031, 28), paintMaterial);
  paint.rotation.x = -Math.PI / 2;
  paint.position.y = 0.036;
  root.add(can, base, band, rim, paint);
  root.userData.paint = paintMaterial;
  return root;
}

/** Tijeras acostadas: dos hojas cruzadas y dos anillos para los dedos. */
export function createScissors() {
  const root = new Group();
  root.name = 'scissors';
  const steel = plastic(0xd9dde2, { roughness: 0.3, metalness: 0.4 });
  const red = plastic(0xe60012);
  const bladeGeometry = new BoxGeometry(0.07, 0.003, 0.011);
  bladeGeometry.translate(0.035, 0, 0);
  const ringGeometry = new TorusGeometry(0.012, 0.0032, 8, 22);
  ringGeometry.rotateX(Math.PI / 2);
  for (const side of [-1, 1]) {
    const half = new Group();
    half.rotation.y = side * 0.2;
    const blade = new Mesh(bladeGeometry, steel);
    blade.position.y = side * 0.0016;
    const ring = new Mesh(ringGeometry, red);
    ring.position.set(-0.03, 0, side * 0.011);
    const arm = new Mesh(new BoxGeometry(0.022, 0.004, 0.006), red);
    arm.position.set(-0.01, 0, side * 0.004);
    half.add(blade, ring, arm);
    root.add(half);
  }
  root.add(grabZone(0.13, 0.04, 0.07));
  return root;
}
