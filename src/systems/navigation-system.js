/* Navegacion entre categorias: dos botones espaciales sobre la consola frontal.
   Cada boton muestra el icono y el nombre de la categoria a la que lleva
   (mismos iconos de la pagina original). NO mueven la banda.
   Se accionan tocandolos con el dedo (PokeInteractable) o con rayo + pellizco. */
import {
  CanvasTexture,
  createSystem,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PokeInteractable,
  Pressed,
  RayInteractable,
  Shape,
  SRGBColorSpace,
} from '@iwsdk/core';
import { Machine, MachinePart, NavButton } from '../components.js';
import { CATEGORIES } from '../data/categories.js';
import { MACHINE } from '../scene-assets/machine.scene-asset.js';
import { categoryIndex, phase, Phase, stepCategory } from '../state.js';

const WIDTH = 0.16;
const DEPTH = 0.055;
const HEIGHT = 0.02;
const TEX_W = 512;
const TEX_H = 176;
const COOLDOWN_SECONDS = 0.45;

const THEME = {
  [-1]: { face: '#FFF6E6', cap: 0xfff6e6, tag: 'ANTERIOR' },
  1: { face: '#F9C623', cap: 0xf5ba00, tag: 'SIGUIENTE' },
};

const publicAssetUrl = (filePath) =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

/** Iconos de categoria (SVG de la pagina), cargados una sola vez. */
const iconCache = new Map();
function loadIcon(file, onReady) {
  let image = iconCache.get(file);
  if (!image) {
    image = new Image();
    image.src = publicAssetUrl(`images/ui/${file}`);
    iconCache.set(file, image);
  }
  if (image.complete && image.naturalWidth > 0) return image;
  image.addEventListener('load', onReady, { once: true });
  return null;
}

function keycapGeometry() {
  const w = WIDTH / 2;
  const d = DEPTH / 2;
  const r = d * 0.9;
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
    depth: HEIGHT - 0.006,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0.003, 0);
  return geometry;
}

/** Dibuja la cara del boton: icono + etiqueta + nombre de la categoria destino. */
function drawFace(button) {
  const { canvas, texture, direction } = button.userData;
  const target = CATEGORIES[categoryIndex.peek() + direction];
  const ctx = canvas.getContext('2d');
  const theme = THEME[direction];
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = theme.face;
  ctx.beginPath();
  ctx.roundRect(0, 0, TEX_W, TEX_H, TEX_H / 2);
  ctx.fill();
  if (!target) {
    texture.needsUpdate = true;
    return;
  }

  // Icono dentro de un circulo blanco (a la izquierda en "siguiente", igual en "anterior")
  const cx = 92;
  const cy = TEX_H / 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, 66, 0, Math.PI * 2);
  ctx.fill();
  const icon = loadIcon(target.icon, () => drawFace(button));
  if (icon) {
    const size = 92;
    const ratio = icon.naturalWidth / icon.naturalHeight;
    const iw = ratio >= 1 ? size : size * ratio;
    const ih = ratio >= 1 ? size / ratio : size;
    ctx.drawImage(icon, cx - iw / 2, cy - ih / 2, iw, ih);
  }

  // Etiqueta pequena y nombre de la categoria (el canvas si dibuja tildes)
  const font = 'Nunito, "Segoe UI", Roboto, system-ui, sans-serif';
  ctx.fillStyle = '#5F4C45';
  ctx.textBaseline = 'middle';
  ctx.font = `800 24px ${font}`;
  ctx.fillText(direction < 0 ? `‹ ${theme.tag}` : `${theme.tag} ›`, 178, 44);
  const words = target.label.split(' ');
  const lines = [];
  ctx.font = `800 40px ${font}`;
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && ctx.measureText(`${last} ${word}`).width < 300) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  const two = lines.length > 1;
  ctx.font = `800 ${two ? 34 : 42}px ${font}`;
  lines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, 178, two ? 92 + i * 38 : 106);
  });
  texture.needsUpdate = true;
}

export class NavigationSystem extends createSystem({
  machines: { required: [Machine] },
  buttons: { required: [NavButton] },
  pressed: { required: [NavButton, Pressed] },
}) {
  init() {
    this.cooldown = 0;
    this.capGeometry = keycapGeometry();
    this.faceGeometry = new PlaneGeometry(WIDTH * 0.94, WIDTH * 0.94 * (TEX_H / TEX_W)).rotateX(-Math.PI / 2);

    this.cleanupFuncs.push(
      this.queries.machines.subscribe('qualify', (machine) => {
        this.createButton(machine, -1);
        this.createButton(machine, 1);
        this.refresh();
      }),
      this.queries.pressed.subscribe('qualify', (entity) => this.onPressed(entity)),
      categoryIndex.subscribe(() => this.refresh()),
      phase.subscribe(() => this.refresh()),
      () => {
        this.capGeometry.dispose();
        this.faceGeometry.dispose();
      },
    );
  }

  createButton(machine, direction) {
    const nav = MACHINE.navButtons;
    const root = new Group();
    root.name = direction < 0 ? 'nav-prev' : 'nav-next';
    root.position.set(direction < 0 ? nav.prevX : nav.nextX, nav.y, nav.z);
    root.rotation.x = nav.tilt;

    const cap = new Mesh(
      this.capGeometry,
      new MeshStandardMaterial({ color: THEME[direction].cap, roughness: 0.5 }),
    );
    cap.name = 'cap';
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    const face = new Mesh(
      this.faceGeometry,
      new MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
    );
    face.position.y = HEIGHT + 0.0006;
    cap.add(face);
    root.add(cap);
    root.userData = { canvas, texture, direction, cap };

    const entity = this.world.createTransformEntity(root, { parent: machine });
    entity.addComponent(NavButton, { direction });
    entity.addComponent(MachinePart);
    entity.addComponent(RayInteractable);
    entity.addComponent(PokeInteractable);
  }

  /** Muestra cada boton solo si existe la categoria a la que lleva. */
  refresh() {
    const customizing = phase.peek() === Phase.Customizing;
    for (const entity of this.queries.buttons.entities) {
      const button = entity.object3D;
      if (!button) continue;
      const target = CATEGORIES[categoryIndex.peek() + button.userData.direction];
      button.visible = customizing && !!target;
      // Oculto = sin volumen: no puede tocarse por accidente
      button.scale.setScalar(button.visible ? 1 : 0.0001);
      if (button.visible) drawFace(button);
    }
  }

  onPressed(entity) {
    if (phase.peek() !== Phase.Customizing || this.cooldown > 0) return;
    const button = entity.object3D;
    if (!button?.visible) return;
    if (stepCategory(entity.getValue(NavButton, 'direction'))) {
      this.cooldown = COOLDOWN_SECONDS;
    }
  }

  update(delta) {
    if (this.cooldown > 0) this.cooldown -= delta;
    // El boton se hunde mientras esta presionado
    for (const entity of this.queries.buttons.entities) {
      const cap = entity.object3D?.userData.cap;
      if (!cap) continue;
      const target = entity.hasComponent(Pressed) ? -0.007 : 0;
      cap.position.y += (target - cap.position.y) * Math.min(1, delta * 20);
    }
  }
}
