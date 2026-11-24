/* Panel "Comparte tu tarjeta" (el modal de la web, la tarjeta queda detras): Descargar imagen, Compartir desde el
   dispositivo, redes sociales (simuladas) y Copiar enlace. Se dibuja en lienzo con el sistema visual; los botones son
   UiItem (dedo o rayo). Los paneles "¡Tu avatar esta listo!" y "Compra satisfactoria" estan en design-panels.js. */
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
