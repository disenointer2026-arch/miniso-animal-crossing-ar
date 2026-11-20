/* Dialogo crema del cierre (dibujado en lienzo, con tildes): titulo, texto y hasta tres botones tipo
   tarjeta con contorno rojo, como el panel "¡Tu avatar esta listo!" de la web:
     - tres botones: dos tarjetas lado a lado y una ancha abajo ("Seguir editando")
     - dos botones: dos tarjetas | un boton: uno ancho.
   No tiene campo de nombre ni resumen plegable (se retiraron). set(spec) cambia el contenido. */
import { Group } from '@iwsdk/core';
import { FactoryPart } from '../components.js';
import { C } from '../ui/theme.js';
import {
  addItem,
  canvasPlane,
  drawPanelBackground,
  fitText,
  roundRectPath,
  text,
} from '../ui/world-ui.js';
import { font } from '../ui/world-ui.js';

const SIZE = { width: 0.74, height: 0.58 };
const CARD = { width: 0.345, height: 0.15 };
const WIDE = { width: 0.7, height: 0.095 };
const PX = 1150;

/** Parte un texto (con saltos de linea) en lineas que caben en maxWidth. */
export function wrap(ctx, value, maxWidth) {
  const lines = [];
  for (const paragraph of String(value).split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Tarjeta-boton: contorno rojo, titulo, subtitulo y flecha roja (hacia atras en "Seguir editando"). */
function drawButton(ctx, w, h, state) {
  ctx.clearRect(0, 0, w, h);
  const spec = state.spec;
  if (!spec) return;
  const pad = 8;
  ctx.save();
  ctx.shadowColor = 'rgba(94, 77, 71, 0.25)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = C.paper;
  roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 4, h * 0.22);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 7;
  ctx.strokeStyle = C.red;
  roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 4, h * 0.22);
  ctx.stroke();
  const left = pad + w * 0.05;
  const maxWidth = w * 0.72;
  const arrowX = w - pad - w * 0.07;
  if (spec.sub) {
    fitText(ctx, spec.label, left, h * 0.36, maxWidth, { size: h * 0.26, color: C.ink, align: 'left' });
    fitText(ctx, spec.sub, left, h * 0.68, maxWidth, { size: h * 0.16, weight: 700, color: C.ink2, align: 'left' });
  } else {
    fitText(ctx, spec.label, left, h * 0.5, maxWidth, { size: h * 0.34, color: C.ink, align: 'left' });
  }
  text(ctx, spec.back ? '←' : '→', arrowX, h * 0.5, { size: h * 0.36, color: C.red });
}

export function createDialog(world) {
  const group = new Group();
  group.name = 'Dialog';
  const back = canvasPlane(SIZE.width, SIZE.height, PX, (ctx, w, h, state) => {
    drawPanelBackground(ctx, w, h);
    const spec = state.spec;
    if (!spec) return;
    let y = h * 0.1;
    if (spec.kicker) {
      text(ctx, spec.kicker, w / 2, y, { size: h * 0.036, weight: 800, color: C.forest });
      y += h * 0.07;
    }
    fitText(ctx, spec.title, w / 2, y + h * 0.03, w * 0.86, { size: h * 0.082, color: C.ink });
    y += h * 0.12;
    ctx.font = font(700, h * 0.04);
    ctx.fillStyle = C.ink2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    wrap(ctx, spec.body, w * 0.84).forEach((line, i) => ctx.fillText(line, w / 2, y + i * h * 0.056));
  });
  group.add(back.mesh);
  const entity = world.createTransformEntity(group);
  entity.addComponent(FactoryPart);

  const handlers = [null, null, null];
  const make = (index, size, name) => {
    const item = addItem(world, entity, {
      width: size.width,
      height: size.height,
      pxPerMeter: PX,
      name,
      draw: drawButton,
      onPress: () => handlers[index]?.(),
    });
    item.mesh.userData.silent = false;
    return item;
  };
  const items = [make(0, CARD, 'dialog-a'), make(1, CARD, 'dialog-b'), make(2, WIDE, 'dialog-c')];

  /** spec: { kicker?, title, body, buttons: [{ label, sub?, back?, run }] } */
  const set = (spec) => {
    back.redraw({ spec });
    const count = spec.buttons.length;
    const bottom = -SIZE.height / 2 + 0.045;
    // Dos tarjetas arriba y una ancha abajo (si hay tres); con uno o dos botones, se reparten solos
    const slots =
      count >= 3
        ? [
            { item: items[0], x: -0.18, y: bottom + WIDE.height + 0.02 + CARD.height / 2 },
            { item: items[1], x: 0.18, y: bottom + WIDE.height + 0.02 + CARD.height / 2 },
            { item: items[2], x: 0, y: bottom + WIDE.height / 2 },
          ]
        : count === 2
          ? [
              { item: items[0], x: -0.18, y: bottom + CARD.height / 2 },
              { item: items[1], x: 0.18, y: bottom + CARD.height / 2 },
            ]
          : [{ item: items[2], x: 0, y: bottom + WIDE.height / 2 }];
    items.forEach((item) => item.setShown(false));
    handlers.fill(null);
    slots.forEach((slot, i) => {
      const button = spec.buttons[i];
      slot.item.mesh.position.set(slot.x, slot.y, 0.004);
      slot.item.setShown(true);
      slot.item.redraw({ spec: button });
      handlers[items.indexOf(slot.item)] = button.run;
    });
  };

  const setVisible = (visible) => {
    group.visible = visible;
    group.scale.setScalar(visible ? 1 : 0.0001);
  };
  setVisible(false);
  return { group, entity, set, setVisible };
}
