/* Iconos de trazo redondeado (2 a 2,6 px, como pide la guia de estilo) para los paneles del cierre: camion,
   tarjeta con lapiz, descarga, compartir, enlace, hoja de Animal Crossing y las redes sociales. Todos se
   dibujan centrados en (cx, cy) con "s" como tamano. */
import { C } from '../ui/theme.js';

function stroke(ctx, color, s, factor = 0.075) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(3, s * factor);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

export function drawTruck(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  stroke(ctx, color, s);
  ctx.beginPath();
  ctx.roundRect(-0.5 * s, -0.3 * s, 0.62 * s, 0.46 * s, 0.05 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.12 * s, -0.12 * s);
  ctx.lineTo(0.34 * s, -0.12 * s);
  ctx.lineTo(0.52 * s, 0.06 * s);
  ctx.lineTo(0.52 * s, 0.16 * s);
  ctx.lineTo(0.12 * s, 0.16 * s);
  ctx.stroke();
  for (const x of [-0.28, 0.3]) {
    ctx.beginPath();
    ctx.arc(x * s, 0.2 * s, 0.1 * s, 0, Math.PI * 2);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

/** Tarjeta con lapiz (crear tarjeta Amiibo). */
export function drawCardEdit(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  stroke(ctx, color, s);
  ctx.beginPath();
  ctx.roundRect(-0.4 * s, -0.42 * s, 0.62 * s, 0.84 * s, 0.07 * s);
  ctx.stroke();
  // Lapiz: cuerpo diagonal y punta
  ctx.beginPath();
  ctx.moveTo(0.52 * s, -0.3 * s);
  ctx.lineTo(0.12 * s, 0.1 * s);
  ctx.stroke();
  ctx.lineWidth = s * 0.14;
  ctx.beginPath();
  ctx.moveTo(0.46 * s, -0.24 * s);
  ctx.lineTo(0.2 * s, 0.02 * s);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0.1 * s, 0.12 * s);
  ctx.lineTo(0.04 * s, 0.3 * s);
  ctx.lineTo(0.22 * s, 0.24 * s);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawDownload(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  stroke(ctx, color, s);
  ctx.beginPath();
  ctx.moveTo(0, -0.4 * s);
  ctx.lineTo(0, 0.14 * s);
  ctx.moveTo(-0.22 * s, -0.08 * s);
  ctx.lineTo(0, 0.16 * s);
  ctx.lineTo(0.22 * s, -0.08 * s);
  ctx.moveTo(-0.36 * s, 0.1 * s);
  ctx.lineTo(-0.36 * s, 0.34 * s);
  ctx.lineTo(0.36 * s, 0.34 * s);
  ctx.lineTo(0.36 * s, 0.1 * s);
  ctx.stroke();
  ctx.restore();
}

export function drawShare(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  stroke(ctx, color, s);
  const points = [
    [-0.28, 0],
    [0.28, -0.3],
    [0.28, 0.3],
  ];
  ctx.beginPath();
  ctx.moveTo(points[1][0] * s, points[1][1] * s);
  ctx.lineTo(points[0][0] * s, points[0][1] * s);
  ctx.lineTo(points[2][0] * s, points[2][1] * s);
  ctx.stroke();
  for (const [x, y] of points) {
    ctx.beginPath();
    ctx.arc(x * s, y * s, 0.13 * s, 0, Math.PI * 2);
    ctx.fillStyle = C.paper;
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

export function drawLink(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  stroke(ctx, color, s);
  ctx.rotate(-Math.PI / 4);
  for (const x of [-0.17, 0.17]) {
    ctx.beginPath();
    ctx.roundRect((x - 0.24) * s, -0.13 * s, 0.48 * s, 0.26 * s, 0.13 * s);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawClose(ctx, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  stroke(ctx, color, s, 0.1);
  ctx.beginPath();
  ctx.moveTo(-0.3 * s, -0.3 * s);
  ctx.lineTo(0.3 * s, 0.3 * s);
  ctx.moveTo(0.3 * s, -0.3 * s);
  ctx.lineTo(-0.3 * s, 0.3 * s);
  ctx.stroke();
  ctx.restore();
}

/** Hoja de Animal Crossing (el sello de la guia): verde hoja con nervio en verde bosque. */
export function drawLeaf(ctx, cx, cy, s) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = C.leaf;
  ctx.beginPath();
  ctx.moveTo(-0.38 * s, 0.4 * s);
  ctx.bezierCurveTo(-0.55 * s, -0.12 * s, 0, -0.5 * s, 0.42 * s, -0.44 * s);
  ctx.bezierCurveTo(0.48 * s, 0.02 * s, 0.1 * s, 0.52 * s, -0.38 * s, 0.4 * s);
  ctx.fill();
  ctx.strokeStyle = C.forest;
  ctx.lineWidth = s * 0.05;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-0.4 * s, 0.44 * s);
  ctx.quadraticCurveTo(-0.05 * s, 0.05 * s, 0.26 * s, -0.3 * s);
  ctx.stroke();
  ctx.restore();
}

/** Insignia de una red social (simulada): circulo de su color con sus iniciales. */
export function drawSocialBadge(ctx, cx, cy, r, kind) {
  if (!kind) return;
  ctx.save();
  let fill = '#000';
  let label = kind;
  if (kind === 'Instagram') {
    const gradient = ctx.createLinearGradient(cx - r, cy + r, cx + r, cy - r);
    gradient.addColorStop(0, '#F9A94B');
    gradient.addColorStop(0.5, '#DD2A7B');
    gradient.addColorStop(1, '#6A3FB0');
    fill = gradient;
    label = 'IG';
  } else if (kind === 'Facebook') {
    fill = '#1877F2';
    label = 'f';
  } else if (kind === 'X') {
    fill = '#111111';
    label = 'X';
  } else if (kind === 'WhatsApp') {
    fill = '#25B05B';
    label = 'WA';
  }
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `800 ${Math.round(r * (label.length > 1 ? 0.78 : 1.1))}px Nunito, system-ui, sans-serif`;
  ctx.fillText(label, cx, cy + r * 0.04);
  ctx.restore();
}
