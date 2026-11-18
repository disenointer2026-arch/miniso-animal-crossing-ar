/* Geometrias de arco para la fabrica en anillo. Deterministas y sin DOM.
   Convencion de la fabrica: x = r sin(a), z = -r cos(a), y hacia arriba. */
import {
  DataTexture,
  ExtrudeGeometry,
  Float32BufferAttribute,
  BufferGeometry,
  RepeatWrapping,
  RGBAFormat,
  Shape,
  SRGBColorSpace,
} from '@iwsdk/core';

const stepsFor = (a0, a1) => Math.max(6, Math.ceil(Math.abs(a1 - a0) / 0.07));

/** Sector de corona circular con altura: base en y = 0, tope en y = height. */
export function sector(r0, r1, a0, a1, height) {
  const steps = stepsFor(a0, a1);
  const shape = new Shape();
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    if (i === 0) shape.moveTo(r1 * Math.sin(a), r1 * Math.cos(a));
    else shape.lineTo(r1 * Math.sin(a), r1 * Math.cos(a));
  }
  for (let i = steps; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / steps;
    shape.lineTo(r0 * Math.sin(a), r0 * Math.cos(a));
  }
  shape.closePath();
  const geometry = new ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 1,
  });
  // (x, y, z) -> (x, z, -y): el eje del dibujo pasa a ser -z y la extrusion sube
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Tira plana horizontal (cara hacia arriba) con UV: u a lo largo del arco en
    unidades de "tile" metros, v de 0 (interior) a 1 (exterior). */
export function arcStrip(r0, r1, a0, a1, y, tile = 0.12) {
  const steps = stepsFor(a0, a1);
  const mid = (r0 + r1) / 2;
  const position = [];
  const uv = [];
  const normal = [];
  const index = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    const u = ((a - a0) * mid) / tile;
    for (const [r, v] of [[r0, 0], [r1, 1]]) {
      position.push(r * Math.sin(a), y, -r * Math.cos(a));
      uv.push(u, v);
      normal.push(0, 1, 0);
    }
  }
  for (let i = 0; i < steps; i++) {
    const k = i * 2;
    index.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geometry.setAttribute('normal', new Float32BufferAttribute(normal, 3));
  geometry.setIndex(index);
  return geometry;
}

/** Franjas de la banda: crema y verde palido, repetibles a lo largo del arco. */
export function beltTexture() {
  const width = 16;
  const data = new Uint8Array(width * 2 * 4);
  for (let x = 0; x < width; x++) {
    const light = x < width / 2;
    const color = light ? [255, 250, 240] : [214, 232, 200];
    for (let y = 0; y < 2; y++) {
      data.set([...color, 255], (y * width + x) * 4);
    }
  }
  const texture = new DataTexture(data, width, 2, RGBAFormat);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
