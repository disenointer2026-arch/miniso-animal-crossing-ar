/* Maquina de figuras MINISO x Animal Crossing (modelo procedural).
   Origen: centro de la base, en el punto de contacto con la mesa.
   +Z mira hacia el usuario, +X es su derecha. Unidades en metros.

   Las partes que se animan quedan en root.userData.parts:
     rollers       -> rodillos que giran durante la llegada
     beltMaterial  -> su textura se desplaza durante la llegada
     lights        -> indicadores del frente */
import {
  CylinderGeometry,
  DataTexture,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  RepeatWrapping,
  RGBAFormat,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from '@iwsdk/core';

/** Medidas compartidas con los sistemas (colocacion, banda, avatar). */
export const MACHINE = {
  width: 0.8,
  depth: 0.3,
  feetHeight: 0.014,
  bodyHeight: 0.06,
  beltWidth: 0.7,
  beltDepth: 0.2,
  beltThickness: 0.01,
  /** Altura de la superficie de la banda sobre la mesa */
  get beltTop() {
    return this.feetHeight + this.bodyHeight + this.beltThickness;
  },
  /** x del arco de entrada (extremo izquierdo) */
  archX: -0.33,
  /** Consola frontal izquierda: base de los botones de navegacion */
  console: { x: -0.2, z: 0.2, width: 0.37, depth: 0.09, height: 0.016 },
  /** Posicion de cada boton sobre la consola e inclinacion hacia el usuario */
  navButtons: { prevX: -0.288, nextX: -0.112, y: 0.03, z: 0.2, tilt: 0.45 },
  /** Zona de herramientas: a la derecha del personaje, sobre la banda */
  tools: { x: 0.25 },
};

const COLORS = {
  cream: 0xfff6e6,
  red: 0xe60012,
  leaf: 0x8cc37a,
  leafDark: 0x6ba35e,
  yellow: 0xf6d365,
  belt: 0xffffff,
  lightOff: 0xd9d2c3,
};

function plastic(color, extra = {}) {
  return new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0, ...extra });
}

/** Caja de esquinas redondeadas: ancho (x), alto (y), fondo (z); apoyada en y = 0. */
function roundedBox(width, height, depth, radius, bevel = 0.004) {
  const w = width / 2 - bevel;
  const d = depth / 2 - bevel;
  const r = Math.min(radius, w, d);
  const shape = new Shape();
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);
  const geometry = new ExtrudeGeometry(shape, {
    depth: height - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });
  // La extrusion sale en +Z: se acuesta para que crezca en +Y
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bevel, 0);
  return geometry;
}

/** Franjas suaves de la banda: al desplazar la textura se nota el movimiento. */
function beltTexture() {
  const size = 32;
  const data = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const stripe = i < size / 2;
    const [r, g, b] = stripe ? [0xbf, 0xdc, 0xd3] : [0xa9, 0xcf, 0xc4];
    data.set([r, g, b, 255], i * 4);
  }
  const texture = new DataTexture(data, size, 1, RGBAFormat);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(14, 1);
  texture.needsUpdate = true;
  return texture;
}

export function createMachine() {
  const M = MACHINE;
  const root = new Group();
  root.name = 'machine';

  const cream = plastic(COLORS.cream);
  const red = plastic(COLORS.red);
  const leaf = plastic(COLORS.leaf);
  const leafDark = plastic(COLORS.leafDark);
  const yellow = plastic(COLORS.yellow);
  const beltMaterial = plastic(COLORS.belt, { map: beltTexture(), roughness: 0.8 });

  // --- Patas ---
  const footGeometry = new CylinderGeometry(0.022, 0.026, M.feetHeight, 20);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new Mesh(footGeometry, red);
      foot.position.set(sx * (M.width / 2 - 0.06), M.feetHeight / 2, sz * (M.depth / 2 - 0.05));
      root.add(foot);
    }
  }

  // --- Cuerpo ---
  const body = new Mesh(roundedBox(M.width, M.bodyHeight, M.depth, 0.04), cream);
  body.position.y = M.feetHeight;
  body.name = 'machine-body';
  root.add(body);

  // Franja roja al frente y atras (identidad MINISO)
  const trimGeometry = roundedBox(M.width - 0.1, 0.012, 0.008, 0.003, 0.002);
  for (const sz of [-1, 1]) {
    const trim = new Mesh(trimGeometry, red);
    trim.position.set(0, M.feetHeight + 0.008, sz * (M.depth / 2 + 0.001));
    root.add(trim);
  }

  // --- Banda ---
  const belt = new Mesh(roundedBox(M.beltWidth, M.beltThickness, M.beltDepth, 0.012, 0.002), beltMaterial);
  belt.position.y = M.feetHeight + M.bodyHeight;
  belt.name = 'belt';
  root.add(belt);

  // --- Rodillos ---
  const rollers = [];
  // Dos grandes en los extremos de la banda
  const endRollerGeometry = new CylinderGeometry(0.014, 0.014, M.beltDepth + 0.02, 20);
  endRollerGeometry.rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const roller = new Mesh(endRollerGeometry, yellow);
    roller.position.set(sx * (M.beltWidth / 2 + 0.012), M.feetHeight + M.bodyHeight + 0.004, 0);
    root.add(roller);
    rollers.push(roller);
  }
  // Rodillos laterales: una fila al frente y otra atras, a lo largo de la banda
  const sideRollerGeometry = new CylinderGeometry(0.011, 0.011, 0.026, 6);
  sideRollerGeometry.rotateX(Math.PI / 2);
  const sideCount = 9;
  for (const sz of [-1, 1]) {
    for (let i = 0; i < sideCount; i++) {
      const roller = new Mesh(sideRollerGeometry, i % 2 ? leaf : yellow);
      const x = -M.beltWidth / 2 + 0.05 + (i * (M.beltWidth - 0.1)) / (sideCount - 1);
      roller.position.set(x, M.feetHeight + M.bodyHeight + 0.003, sz * (M.beltDepth / 2 + 0.024));
      root.add(roller);
      rollers.push(roller);
    }
  }

  // --- Arco de entrada (extremo izquierdo): de aqui sale el personaje ---
  const arch = new Group();
  arch.name = 'arch';
  arch.position.set(M.archX, M.feetHeight + M.bodyHeight, 0);
  const postHeight = 0.15;
  const archRadius = 0.125;
  const tube = 0.014;
  const postGeometry = new CylinderGeometry(tube, tube, postHeight, 16);
  for (const sz of [-1, 1]) {
    const post = new Mesh(postGeometry, leaf);
    post.position.set(0, postHeight / 2, sz * archRadius);
    arch.add(post);
  }
  const crownGeometry = new TorusGeometry(archRadius, tube, 12, 28, Math.PI);
  crownGeometry.rotateY(Math.PI / 2); // el arco queda en el plano YZ
  const crown = new Mesh(crownGeometry, leaf);
  crown.position.y = postHeight;
  arch.add(crown);
  // Hoja decorativa en la cima
  const leafTop = new Mesh(new SphereGeometry(0.03, 16, 12), leafDark);
  leafTop.scale.set(0.55, 0.9, 1.25);
  leafTop.rotation.x = 0.5;
  leafTop.position.y = postHeight + archRadius + 0.03;
  arch.add(leafTop);
  root.add(arch);

  // --- Consola de navegacion (frente izquierdo) ---
  const c = M.console;
  const consoleBase = new Mesh(roundedBox(c.width, c.height, c.depth, 0.02), red);
  consoleBase.position.set(c.x, 0, c.z);
  consoleBase.name = 'console';
  root.add(consoleBase);

  // --- Indicadores del frente ---
  const lights = [];
  const lightGeometry = new SphereGeometry(0.011, 16, 12);
  for (let i = 0; i < 3; i++) {
    const material = plastic(COLORS.lightOff, { emissive: 0x000000 });
    const light = new Mesh(lightGeometry, material);
    light.scale.z = 0.5;
    light.position.set(0.07 + i * 0.03, M.feetHeight + M.bodyHeight * 0.62, M.depth / 2);
    root.add(light);
    lights.push(light);
  }

  root.userData.parts = { rollers, beltMaterial, lights };
  return root;
}
