/* Los paneles "¡Tu avatar esta listo!" y "Compra satisfactoria" del diseno del equipo (paneles-exp-meta.svg/pdf),
   reproducidos en lienzo con las medidas, colores y trazos del SVG (src/checkout/design-data.js): fondo crema con
   triangulos, titulos en Nunito Medium marron grisaceo, botones rojos con halo rosa e insignia de chulo, y enlaces
   subrayados. Cada boton es un elemento aparte (dedo o rayo): el fondo no se mueve, el boton reacciona. */
import { Group } from '@iwsdk/core';
import { FactoryPart } from '../components.js';
import { addItem, canvasPlane, font } from '../ui/world-ui.js';
import { DESIGN } from './design-data.js';

const K = 1.5; // pixeles de lienzo por unidad del SVG
const MARGIN = 34; // espacio alrededor del panel para su sombra (unidades del SVG)
const C = DESIGN.colors;

const hexToRgba = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

let tileCanvas = null;
/** Baldosa del patron de triangulos (1 px por unidad del SVG). */
function patternTile() {
  if (tileCanvas) return tileCanvas;
  const [tw, th] = DESIGN.pattern.tile;
  tileCanvas = document.createElement('canvas');
  tileCanvas.width = Math.ceil(tw);
  tileCanvas.height = Math.ceil(th);
  const ctx = tileCanvas.getContext('2d');
  ctx.fillStyle = C.pattern;
  for (const p of DESIGN.pattern.polygons) {
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.closePath();
    ctx.fill();
  }
  return tileCanvas;
}

/** Prepara el lienzo para dibujar en coordenadas del SVG (el origen del SVG queda donde estaba). */
function toSvgSpace(ctx, box) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(K, 0, 0, K, 0, 0);
  ctx.translate(-box[0], -box[1]);
}

/** Fondo del panel: sombra calida, base blanca y, encima al 58 %, crema + triangulos + degradado. */
function paintBackground(ctx, spec) {
  const [x, y, w, h, r] = spec.rect;
  ctx.save();
  ctx.shadowColor = 'rgba(94, 77, 71, 0.34)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = '#ffffff';
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.globalAlpha = DESIGN.backgroundOpacity;
  ctx.fillStyle = C.base;
  ctx.fillRect(x, y, w, h);
  const pattern = ctx.createPattern(patternTile(), 'repeat');
  pattern.setTransform(new DOMMatrix().translate(...DESIGN.pattern.offset));
  ctx.globalAlpha = DESIGN.backgroundOpacity * DESIGN.pattern.opacity;
  ctx.fillStyle = pattern;
  ctx.fillRect(x, y, w, h);
  const [x1, y1, x2, y2] = spec.gradient;
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  for (const [offset, color, alpha] of DESIGN.gradientStops) gradient.addColorStop(offset, hexToRgba(color, alpha));
  ctx.globalAlpha = DESIGN.backgroundOpacity;
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function line(ctx, text, cx, y, size, color = C.text, align = 'center') {
  ctx.font = font(500, size);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(text, cx, y);
}

/** Texto en una linea que se encoge hasta caber en maxWidth. */
function fitLine(ctx, text, cx, y, size, maxWidth, color = C.text) {
  let s = size;
  ctx.font = font(500, s);
  while (s > 20 && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = font(500, s);
  }
  line(ctx, text, cx, y, s, color);
}

/** Boton rojo del diseno: rectangulo, halo rosa (si lo trae), insignia con chulo (si la trae) y texto blanco. */
function paintRedButton(ctx, spec, hovered) {
  const [x, y, w, h, r] = spec.rect;
  ctx.fillStyle = C.red;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  if (spec.halo) {
    ctx.fillStyle = C.halo;
    ctx.fill(new Path2D(spec.halo), 'evenodd');
  }
  if (spec.badge) {
    const { center, r: radius, inner, check } = spec.badge;
    ctx.fillStyle = C.halo;
    ctx.beginPath();
    ctx.arc(center[0], center[1], radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(center[0], center[1], inner, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.red;
    ctx.fill(new Path2D(check));
  }
  if (hovered) {
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.halo;
    roundRect(ctx, x - 5, y - 5, w + 10, h + 10, r + 5);
    ctx.stroke();
    ctx.restore();
  }
  const cx = x + w / 2;
  const first = spec.text.length > 1 ? y + (spec.firstBaseline ?? h * 0.5) : y + (spec.firstBaseline ?? h * 0.63);
  spec.text.forEach((text, i) => line(ctx, text, cx, first + i * (spec.lineHeight ?? 0), spec.size, '#ffffff'));
}

/** Enlace subrayado con flecha ("← Seguir editando"). */
function paintLink(ctx, spec) {
  ctx.fillStyle = C.text;
  ctx.fill(new Path2D(spec.arrow));
  line(ctx, spec.text, spec.x, spec.y, spec.size, C.text, 'left');
  ctx.fillRect(...spec.underline);
}

const pad = 12;
const expand = ([x, y, w, h], extra = pad) => [x - extra, y - extra, w + extra * 2, h + extra * 2];

/** Caja (en unidades del SVG) que cubre un boton con su insignia. */
function buttonBox(spec) {
  const [x, y, w, h] = spec.rect;
  let box = [x, y, x + w, y + h];
  if (spec.badge) {
    const { center, r } = spec.badge;
    box = [Math.min(box[0], center[0] - r), Math.min(box[1], center[1] - r), Math.max(box[2], center[0] + r), Math.max(box[3], center[1] + r)];
  }
  return expand([box[0], box[1], box[2] - box[0], box[3] - box[1]]);
}

function linkBox(spec) {
  const [ux, uy, uw, uh] = spec.underline;
  const top = spec.y - spec.size * 0.95;
  return expand([ux, top, uw, uy + uh - top]);
}

/** Crea un panel: fondo + botones + enlace. `m` son metros por unidad del SVG. */
function createDesignPanel(world, { name, spec, meters, drawContent, buttons, link }) {
  const [rx, ry, rw, rh] = spec.rect;
  const box = [rx - MARGIN, ry - MARGIN, rw + MARGIN * 2, rh + MARGIN * 2];
  const group = new Group();
  group.name = name;
  const back = canvasPlane(box[2] * meters, box[3] * meters, K / meters, (ctx, w, h, state) => {
    toSvgSpace(ctx, box);
    paintBackground(ctx, spec);
    drawContent(ctx, state);
  });
  group.add(back.mesh);
  const entity = world.createTransformEntity(group);
  entity.addComponent(FactoryPart);

  const toMeters = (svgX, svgY) => [(svgX - (rx + rw / 2)) * meters, ((ry + rh / 2) - svgY) * meters];
  const items = {};
  const place = (key, itemBox, draw, onPress) => {
    const [bx, by, bw, bh] = itemBox;
    const [px, py] = toMeters(bx + bw / 2, by + bh / 2);
    const item = addItem(world, entity, {
      x: px,
      y: py,
      z: 0.004,
      width: bw * meters,
      height: bh * meters,
      pxPerMeter: K / meters,
      name: `${name}-${key}`,
      draw: (ctx, w, h, state) => {
        toSvgSpace(ctx, itemBox);
        draw(ctx, state);
      },
      onPress,
    });
    item.mesh.userData.silent = false;
    items[key] = item;
    return item;
  };
  for (const { key, spec: buttonSpec, onPress } of buttons) {
    place(key, buttonBox(buttonSpec), (ctx, state) => paintRedButton(ctx, buttonSpec, !!state.hovered), onPress);
  }
  place('link', linkBox(link.spec), (ctx) => paintLink(ctx, link.spec), link.onPress);

  const setVisible = (visible) => {
    group.visible = visible;
    group.scale.setScalar(visible ? 1 : 0.0001);
  };
  setVisible(false);
  return { group, entity, back, items, setVisible };
}

// ---------- "¡Tu avatar esta listo!" ----------
export function createAvatarReadyPanel(world, { order, card, back }) {
  const spec = DESIGN.avatarReady;
  const cx = spec.rect[0] + spec.rect[2] / 2;
  const orderSpec = { ...spec.order, firstBaseline: 68.36 };
  const cardSpec = { ...spec.card, ...{ firstBaseline: 50.36 } };
  return createDesignPanel(world, {
    name: 'AvatarReady',
    spec,
    meters: 0.6 / spec.rect[2],
    drawContent: (ctx) => {
      spec.title.lines.forEach((text, i) => line(ctx, text, cx, spec.title.y + i * spec.title.lineHeight, spec.title.size));
      spec.subtitle.lines.forEach((text, i) => line(ctx, text, cx, spec.subtitle.y + i * spec.subtitle.lineHeight, spec.subtitle.size));
    },
    buttons: [
      { key: 'order', spec: orderSpec, onPress: order },
      { key: 'card', spec: cardSpec, onPress: card },
    ],
    link: { spec: spec.link, onPress: back },
  });
}

// ---------- "Compra satisfactoria" ----------
export function createPurchasePanel(world, { card, exit }) {
  const spec = DESIGN.purchase;
  const cx = spec.rect[0] + spec.rect[2] / 2;
  const cardSpec = { ...spec.card, firstBaseline: 96.87 };
  const panel = createDesignPanel(world, {
    name: 'Purchase',
    spec,
    meters: 0.5 / spec.rect[2],
    drawContent: (ctx, state) => {
      ctx.fillStyle = C.leaf;
      ctx.fill(new Path2D(spec.leaf));
      line(ctx, spec.title.text, cx, spec.title.y, spec.title.size);
      fitLine(ctx, `${spec.guide.label}${state.number ?? ''}`, cx, spec.guide.y, spec.guide.size, spec.rect[2] * 0.9);
      spec.info.lines.forEach((text, i) => line(ctx, text, cx, spec.info.y + i * spec.info.lineHeight, spec.info.size));
    },
    buttons: [{ key: 'card', spec: cardSpec, onPress: card }],
    link: { spec: spec.link, onPress: exit },
  });
  /** state: { number } */
  panel.set = (state) => panel.back.redraw(state);
  return panel;
}
