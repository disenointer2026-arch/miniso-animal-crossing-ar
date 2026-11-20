/* Interfaz espacial dibujada en lienzos (canvas 2D): paneles crema con patron de triangulos, muestras
   de color redondas con chulo rojo, botones pildora rojos... con el sistema visual de la guia
   (src/ui/theme.js). Cada elemento pulsable es una malla pequena con su propia textura y su
   entidad (UiItem + RayInteractable + PokeInteractable): se acciona con el dedo o con rayo + pellizco.
   El texto del lienzo si dibuja tildes, enie y signos de apertura. */
import {
  CanvasTexture,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  PokeInteractable,
  RayInteractable,
  SRGBColorSpace,
} from '@iwsdk/core';
import { FactoryPart, UiItem } from '../components.js';
import { C, FONT_FAMILY } from './theme.js';

// ---------- Tipografia ----------
let fontsReady = null;

/** Carga Nunito (400, 700 y 800). Devuelve una promesa que se cumple siempre. */
export function loadFonts() {
  if (fontsReady) return fontsReady;
  const base = import.meta.env.BASE_URL;
  const faces = [
    ['400', 'Nunito_400Regular.ttf'],
    ['700', 'Nunito_700Bold.ttf'],
    ['800', 'Nunito_800ExtraBold.ttf'],
  ];
  fontsReady = Promise.all(
    faces.map(([weight, file]) =>
      new FontFace('Nunito', `url(${base}fonts/${file})`, { weight })
        .load()
        .then((face) => document.fonts.add(face)),
    ),
  ).catch(() => {});
  return fontsReady;
}

export const font = (weight, size) => `${weight} ${Math.round(size)}px ${FONT_FAMILY}`;

// ---------- Dibujo ----------
export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Patron de triangulos de Animal Crossing sobre el fondo ya pintado (clip al rectangulo redondeado). */
function drawTriangles(ctx, w, h) {
  const size = Math.max(26, Math.round(w / 22));
  ctx.fillStyle = C.triangles;
  for (let row = 0, y = 0; y < h + size; row++, y += size * 1.1) {
    for (let x = (row % 2) * size; x < w + size; x += size * 2) {
      ctx.beginPath();
      ctx.moveTo(x, y + size * 0.7);
      ctx.lineTo(x + size * 0.36, y);
      ctx.lineTo(x + size * 0.72, y + size * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Fondo de panel: crema, contorno amarillo suave, triangulos y sombra calida. */
export function drawPanelBackground(ctx, w, h, { radius = 56, fill = C.panel, edge = C.yellowSoft, pattern = true } = {}) {
  ctx.clearRect(0, 0, w, h);
  const pad = 10;
  ctx.save();
  ctx.shadowColor = 'rgba(94, 77, 71, 0.25)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = fill;
  roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 6, radius);
  ctx.fill();
  ctx.restore();
  if (pattern) {
    ctx.save();
    roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 6, radius);
    ctx.clip();
    drawTriangles(ctx, w, h);
    ctx.restore();
  }
  ctx.lineWidth = 6;
  ctx.strokeStyle = edge;
  roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 6, radius);
  ctx.stroke();
}

/** Texto en una linea, centrado en (x, y). */
export function text(ctx, str, x, y, { size = 40, weight = 800, color = C.ink, align = 'center' } = {}) {
  ctx.font = font(weight, size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(str, x, y);
}

/** Texto que se reduce hasta caber en maxWidth. */
export function fitText(ctx, str, x, y, maxWidth, opts = {}) {
  let size = opts.size ?? 40;
  ctx.font = font(opts.weight ?? 800, size);
  while (size > 14 && ctx.measureText(str).width > maxWidth) {
    size -= 2;
    ctx.font = font(opts.weight ?? 800, size);
  }
  text(ctx, str, x, y, { ...opts, size });
}

/** Circulo rojo con chulo blanco (esquina de lo elegido, como en la guia). */
export function drawCheck(ctx, cx, cy, r) {
  ctx.fillStyle = C.red;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(4, r * 0.28);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.42, cy + r * 0.02);
  ctx.lineTo(cx - r * 0.1, cy + r * 0.34);
  ctx.lineTo(cx + r * 0.44, cy - r * 0.3);
  ctx.stroke();
}

/** Muestra de color redonda (como las del personalizador). Elegida: contorno rojo y chulo. */
export function drawSwatch(ctx, w, h, color, selected, hovered = false) {
  ctx.clearRect(0, 0, w, h);
  const r = Math.min(w, h) * 0.36;
  const cx = w / 2;
  const cy = h / 2;
  if (hovered) {
    ctx.fillStyle = 'rgba(248, 113, 113, 0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 14, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.shadowColor = 'rgba(94, 77, 71, 0.25)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = selected ? 9 : 4;
  ctx.strokeStyle = selected ? C.red : 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  if (selected) drawCheck(ctx, cx + r * 0.72, cy - r * 0.72, r * 0.34);
}

/** Boton principal: pildora roja, texto blanco en peso 800 (>= 18 px, contraste AA), halo al pasar. */
export function drawPill(ctx, w, h, label, { fill = C.red, color = '#fff', hovered = false, outline = false, size = 0 } = {}) {
  ctx.clearRect(0, 0, w, h);
  const pad = 10;
  const bw = w - pad * 2;
  const bh = h - pad * 2 - 8;
  if (hovered) {
    ctx.fillStyle = 'rgba(248, 113, 113, 0.5)';
    roundRectPath(ctx, 0, 0, w, h - 4, h / 2);
    ctx.fill();
  }
  ctx.save();
  if (!outline) {
    ctx.shadowColor = C.redDark;
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 8;
  }
  ctx.fillStyle = outline ? '#fff' : fill;
  roundRectPath(ctx, pad, pad, bw, bh, bh / 2);
  ctx.fill();
  ctx.restore();
  if (outline) {
    ctx.lineWidth = 6;
    ctx.strokeStyle = fill;
    roundRectPath(ctx, pad, pad, bw, bh, bh / 2);
    ctx.stroke();
  }
  fitText(ctx, label, w / 2, pad + bh / 2 + 2, bw * 0.84, {
    size: size || bh * 0.46,
    weight: 800,
    color: outline ? fill : color,
  });
}

// ---------- Mallas con lienzo ----------
const geometryCache = new Map();
const planeGeometry = (w, h) => {
  const key = `${w.toFixed(4)}x${h.toFixed(4)}`;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = new PlaneGeometry(w, h);
    geometryCache.set(key, geometry);
  }
  return geometry;
};

/** Plano de `width` x `height` metros con un lienzo; draw(ctx, w, h, state) lo (re)dibuja. */
export function canvasPlane(width, height, pxPerMeter, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(8, Math.round(width * pxPerMeter));
  canvas.height = Math.max(8, Math.round(height * pxPerMeter));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  const mesh = new Mesh(
    planeGeometry(width, height),
    new MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false, depthWrite: false }),
  );
  // Las transparencias se ordenan por la distancia de su centro: el fondo de un panel podia dibujarse
  // despues de los botones de abajo y taparlos. renderOrder fija el orden: fondos 5, botones 12.
  mesh.renderOrder = 5;
  const ctx = canvas.getContext('2d');
  const plane = {
    mesh,
    canvas,
    ctx,
    texture,
    state: {},
    redraw(patch) {
      if (patch) Object.assign(plane.state, patch);
      draw(ctx, canvas.width, canvas.height, plane.state);
      texture.needsUpdate = true;
    },
    dispose() {
      texture.dispose();
      mesh.material.dispose();
    },
  };
  plane.redraw();
  loadFonts().then(() => plane.redraw());
  return plane;
}

/** Panel crema (grupo) con fondo y titulo opcional. Los elementos pulsables se anaden con addItem. */
export function createUiPanel({ width, height, title, subtitle, pxPerMeter = 1400 }) {
  const group = new Group();
  const back = canvasPlane(width, height, pxPerMeter, (ctx, w, h) => {
    drawPanelBackground(ctx, w, h);
    if (title) text(ctx, title, w / 2, h * 0.095, { size: h * 0.062, color: C.ink });
    if (subtitle) text(ctx, subtitle, w / 2, h * 0.155, { size: h * 0.036, weight: 700, color: C.ink2 });
  });
  back.mesh.name = 'ui-back';
  group.add(back.mesh);
  group.userData.back = back;
  group.userData.size = { width, height };
  return group;
}

/** Elemento pulsable dentro de un panel o de la fabrica. Devuelve { entity, mesh, redraw, setShown }.
    onPress se llama al pulsar (dedo o rayo + pellizco). x, y, z en metros respecto al padre. */
export function addItem(world, parentEntity, { x = 0, y = 0, z = 0.004, width, height, pxPerMeter = 1400, draw, onPress, name = 'ui-item' }) {
  const plane = canvasPlane(width, height, pxPerMeter, draw);
  plane.mesh.name = name;
  plane.mesh.renderOrder = 12;
  plane.mesh.position.set(x, y, z);
  plane.mesh.userData.onPress = onPress;
  plane.mesh.userData.baseScale = 1;
  plane.mesh.userData.shown = true;
  const entity = world.createTransformEntity(plane.mesh, { parent: parentEntity });
  entity.addComponent(FactoryPart);
  entity.addComponent(UiItem);
  entity.addComponent(RayInteractable);
  entity.addComponent(PokeInteractable);
  plane.entity = entity;
  plane.setShown = (shown) => {
    plane.mesh.userData.shown = shown;
    plane.mesh.visible = shown;
  };
  return plane;
}
