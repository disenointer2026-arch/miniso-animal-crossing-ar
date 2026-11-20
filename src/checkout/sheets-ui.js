/* Los tres paneles del cierre, segun el boceto del equipo y el modal de la web (dibujados en lienzo, con el sistema
   visual: crema con triangulos, rojo para las acciones, Nunito, esquinas redondeadas):
     createChoosePanel   "¡Tu avatar esta listo!": Pedir mi producto | Crear tarjeta Amiibo, y "Seguir editando"
     createConfirmPanel  "Compra satisfactoria": numero de guia, rastreo, Crear tarjeta Amiibo y "Salir de la experiencia"
     createSharePanel    "Comparte tu tarjeta" (la tarjeta queda detras): Descargar imagen, Compartir desde el
                         dispositivo, redes sociales (simuladas) y Copiar enlace
   Cada uno devuelve { group, setVisible, ... } y recibe sus acciones; los botones son UiItem (dedo o rayo). */
import { Group } from '@iwsdk/core';
import { FactoryPart } from '../components.js';
import { C } from '../ui/theme.js';
import {
  addItem,
  canvasPlane,
  drawPanelBackground,
  fitText,
  font,
  roundRectPath,
  text,
} from '../ui/world-ui.js';
import { wrap } from './dialog-ui.js';
import * as icons from './sheet-icons.js';

const PX = 1150;
const yAt = (height, fraction) => (0.5 - fraction) * height;

function makeSheet(world, { name, width, height, draw }) {
  const group = new Group();
  group.name = name;
  const back = canvasPlane(width, height, PX, draw);
  group.add(back.mesh);
  const entity = world.createTransformEntity(group);
  entity.addComponent(FactoryPart);
  const setVisible = (visible) => {
    group.visible = visible;
    group.scale.setScalar(visible ? 1 : 0.0001);
  };
  setVisible(false);
  return { group, entity, back, setVisible };
}

/** Boton tipo tarjeta (contorno rojo, titulo a la izquierda, icono a la derecha). */
function drawCardButton(ctx, w, h, state) {
  ctx.clearRect(0, 0, w, h);
  if (!state.label) return; // primer dibujo al crearse el boton, antes de recibir su texto
  const pad = 8;
  ctx.save();
  ctx.shadowColor = 'rgba(94, 77, 71, 0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = C.paper;
  roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 4, h * 0.24);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 7;
  ctx.strokeStyle = C.red;
  roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 4, h * 0.24);
  ctx.stroke();
  const iconSize = h * 0.5;
  const iconX = w - pad - h * 0.45;
  // Titulo en una o dos lineas (como en el boceto), a la izquierda del icono
  const maxWidth = w - h * 0.95 - pad * 2;
  let size = h * 0.3;
  ctx.font = font(800, size);
  let lines = wrap(ctx, state.label, maxWidth);
  while (lines.length > 2 && size > h * 0.18) {
    size -= 2;
    ctx.font = font(800, size);
    lines = wrap(ctx, state.label, maxWidth);
  }
  ctx.fillStyle = C.ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const lineHeight = size * 1.15;
  lines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, pad + w * 0.06, h * 0.5 + (i - (Math.min(lines.length, 2) - 1) / 2) * lineHeight);
  });
  const draw = icons[state.icon];
  draw?.(ctx, iconX, h * 0.5, iconSize, C.red);
}

/** Enlace subrayado con flecha ("← Seguir editando"). */
function drawLinkButton(ctx, w, h, state) {
  ctx.clearRect(0, 0, w, h);
  if (!state.label) return;
  ctx.font = font(800, h * 0.62);
  const label = state.label;
  const width = ctx.measureText(label).width;
  const arrow = h * 0.9;
  const total = arrow + width;
  const left = (w - total) / 2;
  text(ctx, '←', left + arrow * 0.35, h * 0.5, { size: h * 0.74, color: C.ink });
  text(ctx, label, left + arrow + width / 2, h * 0.46, { size: h * 0.62, color: C.ink });
  ctx.fillStyle = C.ink;
  ctx.fillRect(left + arrow, h * 0.46 + h * 0.36, width, Math.max(3, h * 0.05));
}

/** Boton redondo con X para cerrar. */
function drawCloseButton(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const r = Math.min(w, h) * 0.42;
  ctx.fillStyle = C.paper;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.yellowSoft;
  ctx.stroke();
  icons.drawClose(ctx, w / 2, h / 2, r * 0.9, C.ink);
}

// ---------- "¡Tu avatar esta listo!" ----------
export function createChoosePanel(world, { order, card, back }) {
  const W = 0.64;
  const H = 0.56;
  const sheet = makeSheet(world, {
    name: 'ChoosePanel',
    width: W,
    height: H,
    draw: (ctx, w, h) => {
      drawPanelBackground(ctx, w, h);
      text(ctx, '¡Tu avatar', w / 2, h * 0.16, { size: h * 0.105, color: C.ink });
      text(ctx, 'está listo!', w / 2, h * 0.285, { size: h * 0.105, color: C.ink });
      text(ctx, 'Esta es tu obra maestra.', w / 2, h * 0.43, { size: h * 0.046, weight: 700, color: C.ink2 });
      text(ctx, '¿Quieres hacer algo más con ella?', w / 2, h * 0.49, { size: h * 0.046, weight: 700, color: C.ink2 });
    },
  });
  const cardSize = { width: 0.285, height: 0.13 };
  const make = (name, spec, x, y, size, draw, onPress) =>
    addItem(world, sheet.entity, { x, y, width: size.width, height: size.height, pxPerMeter: PX, name, draw, onPress, ...spec });
  const orderButton = make('choose-order', {}, -0.15, yAt(H, 0.7), cardSize, drawCardButton, order);
  const cardButton = make('choose-card', {}, 0.15, yAt(H, 0.7), cardSize, drawCardButton, card);
  orderButton.redraw({ label: 'Pedir mi producto', icon: 'drawTruck' });
  cardButton.redraw({ label: 'Crear tarjeta Amiibo', icon: 'drawCardEdit' });
  const backButton = make('choose-back', {}, 0, yAt(H, 0.9), { width: 0.3, height: 0.05 }, drawLinkButton, back);
  backButton.redraw({ label: 'Seguir editando' });
  const closeButton = make('choose-close', {}, W / 2 - 0.05, H / 2 - 0.05, { width: 0.06, height: 0.06 }, drawCloseButton, back);
  closeButton.redraw({});
  return sheet;
}

// ---------- "Compra satisfactoria" ----------
export function createConfirmPanel(world, { card, exit }) {
  const W = 0.6;
  const H = 0.62;
  const sheet = makeSheet(world, {
    name: 'ConfirmPanel',
    width: W,
    height: H,
    draw: (ctx, w, h, state) => {
      drawPanelBackground(ctx, w, h);
      icons.drawLeaf(ctx, w / 2, h * 0.115, h * 0.15);
      fitText(ctx, 'Compra satisfactoria', w / 2, h * 0.255, w * 0.86, { size: h * 0.085, color: C.ink });
      fitText(ctx, `N.º guía de pedido: ${state.number ?? '-'}`, w / 2, h * 0.385, w * 0.86, {
        size: h * 0.052,
        color: C.redBrand,
      });
      text(ctx, 'Rastrea desde nuestro sitio web', w / 2, h * 0.495, { size: h * 0.04, weight: 700, color: C.ink2 });
      text(ctx, 'oficial www.miniso.com', w / 2, h * 0.55, { size: h * 0.04, weight: 700, color: C.ink2 });
    },
  });
  const wide = { width: 0.5, height: 0.105 };
  const cardButton = addItem(world, sheet.entity, {
    x: 0,
    y: yAt(H, 0.73),
    width: wide.width,
    height: wide.height,
    pxPerMeter: PX,
    name: 'confirm-card',
    draw: drawCardButton,
    onPress: card,
  });
  cardButton.redraw({ label: 'Crear tarjeta Amiibo', icon: 'drawCardEdit' });
  const exitButton = addItem(world, sheet.entity, {
    x: 0,
    y: yAt(H, 0.9),
    width: 0.34,
    height: 0.05,
    pxPerMeter: PX,
    name: 'confirm-exit',
    draw: drawLinkButton,
    onPress: exit,
  });
  exitButton.redraw({ label: 'Salir de la experiencia' });
  sheet.set = (state) => sheet.back.redraw(state);
  return sheet;
}

// ---------- "Comparte tu tarjeta" ----------
function drawActionButton(ctx, w, h, state) {
  ctx.clearRect(0, 0, w, h);
  if (!state.label) return;
  const pad = 8;
  const bh = h - pad * 2 - 6;
  if (state.primary) {
    ctx.save();
    ctx.shadowColor = C.redDark;
    ctx.shadowOffsetY = 7;
    ctx.fillStyle = C.red;
    roundRectPath(ctx, pad, pad, w - pad * 2, bh, h * 0.3);
    ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = '#fff';
    roundRectPath(ctx, pad, pad, w - pad * 2, bh, h * 0.3);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.red;
    roundRectPath(ctx, pad, pad, w - pad * 2, bh, h * 0.3);
    ctx.stroke();
  }
  fitText(ctx, state.label, pad + w * 0.05, pad + bh / 2 + 1, w * 0.74, {
    size: h * 0.36,
    color: state.primary ? '#fff' : C.field,
    align: 'left',
  });
  icons[state.icon]?.(ctx, w - pad - w * 0.075, pad + bh / 2, h * 0.42, state.primary ? '#fff' : C.red);
}

function drawSocialButton(ctx, w, h, state) {
  ctx.clearRect(0, 0, w, h);
  if (!state.kind) return;
  const pad = 7;
  ctx.save();
  ctx.shadowColor = 'rgba(94, 77, 71, 0.18)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#fff';
  roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 3, h * 0.18);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 5;
  ctx.strokeStyle = C.yellowSoft;
  roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 3, h * 0.18);
  ctx.stroke();
  icons.drawSocialBadge(ctx, w / 2, h * 0.38, w * 0.2, state.kind);
  fitText(ctx, state.kind, w / 2, h * 0.78, w * 0.86, { size: h * 0.15, weight: 700, color: C.field });
}

function drawCopyPill(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const pad = 6;
  ctx.save();
  ctx.shadowColor = 'rgba(94, 77, 71, 0.18)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = '#F8F1C6';
  roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 3, h / 2);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#E8DE9D';
  roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 3, h / 2);
  ctx.stroke();
  icons.drawLink(ctx, h * 0.62, h * 0.48, h * 0.42, C.muted);
  fitText(ctx, 'Copiar enlace', h * 1.0, h * 0.5, w - h * 1.2, { size: h * 0.36, weight: 700, color: C.muted, align: 'left' });
}

export function createSharePanel(world, { download, device, social, copy, close }) {
  const W = 0.54;
  const H = 0.66;
  const sheet = makeSheet(world, {
    name: 'SharePanel',
    width: W,
    height: H,
    draw: (ctx, w, h, state) => {
      drawPanelBackground(ctx, w, h, { fill: '#FFFFFF', edge: '#F1E9C4', pattern: false, radius: 64 });
      text(ctx, 'Lista para compartir', w * 0.075, h * 0.075, { size: h * 0.032, weight: 800, color: C.red, align: 'left' });
      text(ctx, 'Comparte tu tarjeta', w * 0.075, h * 0.145, { size: h * 0.062, weight: 800, color: '#111', align: 'left' });
      ctx.font = font(700, h * 0.03);
      ctx.fillStyle = C.ink2;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      wrap(ctx, 'Descárgala como imagen o elige una red. Es una simulación: no se publicará nada.', w * 0.86).forEach(
        (line, i) => ctx.fillText(line, w * 0.075, h * 0.215 + i * h * 0.037),
      );
      text(ctx, 'Redes sociales (simulado)', w * 0.075, h * 0.6, { size: h * 0.03, weight: 800, color: C.field, align: 'left' });
      if (state.status) {
        const color = state.tone === 'error' ? C.redDark : state.tone === 'ok' ? C.forest : C.ink2;
        ctx.font = font(800, h * 0.031);
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        wrap(ctx, state.status, w * 0.86).slice(0, 2).forEach((line, i) => ctx.fillText(line, w * 0.075, h * 0.912 + i * h * 0.036));
      }
    },
  });
  const buttonSize = { width: 0.47, height: 0.075 };
  const downloadButton = addItem(world, sheet.entity, {
    x: 0,
    y: yAt(H, 0.365),
    width: buttonSize.width,
    height: buttonSize.height,
    pxPerMeter: PX,
    name: 'share-download',
    draw: drawActionButton,
    onPress: download,
  });
  downloadButton.redraw({ label: 'Descargar imagen', icon: 'drawDownload', primary: true });
  const deviceButton = addItem(world, sheet.entity, {
    x: 0,
    y: yAt(H, 0.465),
    width: buttonSize.width,
    height: buttonSize.height,
    pxPerMeter: PX,
    name: 'share-device',
    draw: drawActionButton,
    onPress: device,
  });
  deviceButton.redraw({ label: 'Compartir desde el dispositivo', icon: 'drawShare', primary: false });
  ['Instagram', 'Facebook', 'X', 'WhatsApp'].forEach((kind, i) => {
    const item = addItem(world, sheet.entity, {
      x: (i - 1.5) * 0.1175,
      y: yAt(H, 0.715),
      width: 0.108,
      height: 0.1,
      pxPerMeter: PX,
      name: `share-${kind}`,
      draw: drawSocialButton,
      onPress: () => social(kind),
    });
    item.redraw({ kind });
  });
  const copyButton = addItem(world, sheet.entity, {
    x: -W / 2 + 0.075 + 0.105,
    y: yAt(H, 0.835),
    width: 0.21,
    height: 0.05,
    pxPerMeter: PX,
    name: 'share-copy',
    draw: drawCopyPill,
    onPress: copy,
  });
  copyButton.redraw({});
  const closeButton = addItem(world, sheet.entity, {
    x: W / 2 - 0.05,
    y: H / 2 - 0.05,
    width: 0.06,
    height: 0.06,
    pxPerMeter: PX,
    name: 'share-close',
    draw: drawCloseButton,
    onPress: close,
  });
  closeButton.redraw({});
  /** Mensaje de resultado bajo los botones: tone = ok | error | info. */
  sheet.setStatus = (status, tone = 'info') => sheet.back.redraw({ status, tone });
  return sheet;
}
