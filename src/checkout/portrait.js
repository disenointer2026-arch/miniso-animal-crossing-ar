/* Retrato del avatar para la tarjeta: se dibuja una copia del personaje, con la
   configuracion final, en una textura fuera de pantalla y se devuelve como imagen PNG
   (fondo transparente). No toca la escena que ve el usuario. */
import {
  AmbientLight,
  Box3,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderTarget,
} from '@iwsdk/core';
import { Avatar, texturesReady } from '../avatar/avatar.js';

/** view: encuadre de la camara. Por defecto el cuerpo entero; { y: 1.5, z: 2.3 } encuadra la cabeza. */
export async function renderPortrait(renderer, config, size = 640, view = { y: 0.95, z: 5.4 }) {
  const scene = litScene();
  const avatar = new Avatar(config).build();
  scene.add(avatar.root);
  await texturesReady(); // la boca (SVG) carga aparte: sin esperarla el retrato salia sin boca
  avatar.root.traverse((object) => {
    if (object.material?.map?.isCanvasTexture) object.material.map.needsUpdate = true; // se sube de nuevo a la GPU ya con el dibujo
  });
  const camera = new PerspectiveCamera(24, 1, 0.1, 30);
  camera.position.set(0, view.y, view.z);
  camera.lookAt(0, view.y, 0);
  return renderToDataURL(renderer, scene, camera, size);
}

/** Icono de una pieza suelta (p. ej. un charm): la encuadra entera, de frente y un poco desde arriba. */
export function renderObjectIcon(renderer, object, size = 256) {
  const scene = litScene();
  scene.add(object);
  const box = new Box3().setFromObject(object);
  const center = box.getCenter(new Vector3());
  const radius = Math.max(box.getSize(new Vector3()).length() / 2, 0.001);
  const camera = new PerspectiveCamera(30, 1, radius * 0.1, radius * 20);
  const distance = (radius / Math.sin((30 * Math.PI) / 360)) * 1.05;
  camera.position.set(center.x, center.y + distance * 0.18, center.z + distance);
  camera.lookAt(center);
  return renderToDataURL(renderer, scene, camera, size);
}

function litScene() {
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.7));
  const sun = new DirectionalLight(0xffffff, 2.4);
  sun.position.set(1.5, 3, 4);
  scene.add(sun);
  return scene;
}

function renderToDataURL(renderer, scene, camera, size) {
  const target = new WebGLRenderTarget(size, size, { samples: 4 });
  target.texture.colorSpace = SRGBColorSpace;
  const previousTarget = renderer.getRenderTarget();
  const previousXR = renderer.xr.enabled;
  const previousAlpha = renderer.getClearAlpha();
  const previousColor = renderer.getClearColor(new Color());

  renderer.xr.enabled = false; // dibujo aparte: no debe usar la camara del visor
  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 0);
  renderer.clear();
  renderer.render(scene, camera);
  const pixels = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
  renderer.setRenderTarget(previousTarget);
  renderer.setClearColor(previousColor, previousAlpha);
  renderer.xr.enabled = previousXR;
  target.dispose();

  // Las filas vienen de abajo hacia arriba: se voltean al copiarlas al lienzo
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const image = new ImageData(size, size);
  for (let y = 0; y < size; y++) {
    image.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  }
  canvas.getContext('2d').putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
