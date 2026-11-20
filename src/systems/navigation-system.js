/* Navegacion entre estaciones: cada estacion tiene dos botones espaciales en el
   borde interior de la plataforma (anterior / siguiente). Solo se ven los de la
   estacion activa. Cada boton muestra el icono y el nombre de la estacion a la que
   lleva (mismos iconos de la pagina original); al pulsarlo, la banda lleva al
   personaje hasta alli. Se accionan con el dedo (PokeInteractable) o con rayo +
   pellizco. */
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
import { Factory, FactoryPart, NavButton } from '../components.js';
import { SLOT, STATION_COUNT, slotPose, stationSlot } from '../core/layout.js';
import { CATEGORIES } from '../data/categories.js';
import { beltMoving, beltRequest, categoryIndex, layout, phase, Phase, stepCategory } from '../state.js';

/** Posicion de los botones: hacia el usuario (radial < 0), separados a cada lado. */
const NAV = { radial: -0.09, up: 0.01, offset: 0.095, tilt: 0.45 };
/** Despues de la ultima estacion, "siguiente" pasa a ser el boton de terminar. */
const FINISH = { label: 'Terminar avatar', icon: 'boton-llavero.svg', tag: 'LISTO' };
const targetFor = (direction) => CATEGORIES[categoryIndex.peek() + direction] ?? (direction > 0 ? FINISH : null);

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
  const target = targetFor(direction);
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
    // Los SVG son siluetas sin color (la pagina los tine con CSS): se tinen aqui
    const tint = button.userData.tint;
    const tctx = tint.getContext('2d');
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, tint.width, tint.height);
    tctx.drawImage(icon, (tint.width - iw) / 2, (tint.height - ih) / 2, iw, ih);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = '#5F4C45';
    tctx.fillRect(0, 0, tint.width, tint.height);
    ctx.drawImage(tint, cx - tint.width / 2, cy - tint.height / 2);
  }

  // Etiqueta pequena y nombre de la categoria (el canvas si dibuja tildes)
  const font = 'Nunito, "Segoe UI", Roboto, system-ui, sans-serif';
  ctx.fillStyle = '#5F4C45';
  ctx.textBaseline = 'middle';
  ctx.font = `800 28px ${font}`;
  const tag = target.tag ?? theme.tag;
  ctx.fillText(direction < 0 ? `‹ ${tag}` : `${tag} ›`, 176, 40);
  const words = target.label.split(' ');
  const lines = [];
  ctx.font = `800 44px ${font}`;
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && ctx.measureText(`${last} ${word}`).width < 318) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  const two = lines.length > 1;
  // El nombre se reduce hasta caber en el ancho disponible
  let size = two ? 44 : 58;
  ctx.font = `800 ${size}px ${font}`;
  while (size > 26 && lines.slice(0, 2).some((line) => ctx.measureText(line).width > 316)) {
    size -= 2;
    ctx.font = `800 ${size}px ${font}`;
  }
  lines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, 176, two ? 88 + i * 46 : 108);
  });
  texture.needsUpdate = true;
}

export class NavigationSystem extends createSystem({
  factories: { required: [Factory] },
  buttons: { required: [NavButton] },
  pressed: { required: [NavButton, Pressed] },
}) {
  init() {
    this.cooldown = 0;
    this.capGeometry = keycapGeometry();
    this.faceGeometry = new PlaneGeometry(WIDTH * 0.94, WIDTH * 0.94 * (TEX_H / TEX_W)).rotateX(-Math.PI / 2);

    this.cleanupFuncs.push(
      this.queries.factories.subscribe('qualify', (factory) => {
        for (let station = 0; station < STATION_COUNT; station++) {
          this.createButton(factory, station, -1);
          this.createButton(factory, station, 1);
        }
        this.refresh();
      }),
      beltMoving.subscribe(() => this.refresh()),
      this.queries.pressed.subscribe('qualify', (entity) => this.onPressed(entity)),
      categoryIndex.subscribe(() => this.refresh()),
      phase.subscribe(() => this.refresh()),
      () => {
        this.capGeometry.dispose();
        this.faceGeometry.dispose();
      },
    );
  }

  createButton(factory, station, direction) {
    const pose = slotPose(layout.peek(), stationSlot(station), NAV.radial, NAV.up);
    const root = new Group();
    root.name = `${direction < 0 ? 'nav-prev' : 'nav-next'}-${station + 1}`;
    // El desplazamiento va a lo largo de la tangente del arco (avance de la banda)
    const dx = direction * NAV.offset;
    root.position.set(
      pose.x + pose.tx * dx,
      pose.y,
      pose.z + pose.tz * dx,
    );
    root.rotation.order = 'YXZ';
    root.rotation.set(NAV.tilt, pose.rotY, 0);

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
    const tint = document.createElement('canvas');
    tint.width = tint.height = 96;
    root.userData = { canvas, texture, direction, cap, tint };

    const entity = this.world.createTransformEntity(root, { parent: factory });
    entity.addComponent(NavButton, { direction, station });
    entity.addComponent(FactoryPart);
    entity.addComponent(RayInteractable);
    entity.addComponent(PokeInteractable);
  }

  /** Solo se ven los botones de la estacion activa, y solo si existe la estacion a
      la que llevan y la banda esta quieta. */
  refresh() {
    const idle = phase.peek() === Phase.Customizing && !beltMoving.peek();
    for (const entity of this.queries.buttons.entities) {
      const button = entity.object3D;
      if (!button) continue;
      const active = entity.getValue(NavButton, 'station') === categoryIndex.peek();
      const target = targetFor(button.userData.direction);
      button.visible = idle && active && !!target;
      // Oculto = sin volumen: no puede tocarse por accidente
      button.scale.setScalar(button.visible ? 1 : 0.0001);
      if (button.visible) drawFace(button);
    }
  }

  onPressed(entity) {
    if (phase.peek() !== Phase.Customizing || this.cooldown > 0 || beltMoving.peek()) return;
    const button = entity.object3D;
    if (!button?.visible) return;
    const direction = entity.getValue(NavButton, 'direction');
    if (stepCategory(direction)) {
      this.cooldown = COOLDOWN_SECONDS;
    } else if (direction > 0 && categoryIndex.peek() === CATEGORIES.length - 1) {
      // Terminar avatar: la banda lleva al personaje a la caja de regalo
      this.cooldown = COOLDOWN_SECONDS;
      phase.value = Phase.Finishing;
      beltRequest.value = { slot: SLOT.giftBox };
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
