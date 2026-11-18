/* Retrato del avatar para la tarjeta: se dibuja una copia del personaje, con la
   configuracion final, en una textura fuera de pantalla y se devuelve como imagen PNG
   (fondo transparente). No toca la escena que ve el usuario. */
import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderTarget,
} from '@iwsdk/core';
import { Avatar } from '../avatar/avatar.js';

export function renderPortrait(renderer, config, size = 640) {
  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.7));
  const sun = new DirectionalLight(0xffffff, 2.4);
  sun.position.set(1.5, 3, 4);
  scene.add(sun);
  const avatar = new Avatar(config).build();
  scene.add(avatar.root);
  const camera = new PerspectiveCamera(24, 1, 0.1, 30);
  camera.position.set(0, 0.95, 5.4);
  camera.lookAt(0, 0.95, 0);

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
