/* Generador de la tarjeta coleccionable (lienzo 2D -> imagen). Portado de la pagina original
   (src/components/cardRenderer.js): fondo = plantilla SVG del tema; encima, el retrato y los
   textos en los mismos lugares. Proporcion 5:7. Es una tarjeta digital conceptual inspirada
   en el formato de las tarjetas Amiibo, no un producto oficial de Nintendo. */
import { CARD, hashString } from '../data/shop.js';

export const CARD_W = 750;
export const CARD_H = 1050;

const TPL_W = 1315; // medidas de la plantilla (viewBox 1315 x 1842)
const TPL = {
  number: { x: 1143.4, y: 216.7, size: 78.6 },
  portrait: { x: 657.5, bottom: 1450, size: 1120 },
  shadow: { x: 657.5, y: 1408, rx: 250, ry: 34 },
  name: { x: 657.5, y: 1621, size: 117.5, maxWidth: 1000 },
  birthday: { x: 594, y: 1773.4, size: 98.3 },
  code: { x: 986.4, y: 1767.2, size: 29.6 },
};

const publicAssetUrl = (filePath) => `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

export const cardSerial = (avatar) => String(hashString(JSON.stringify(avatar)) % 100000).padStart(5, '0');

function cardCode(avatar) {
  const n = String(hashString(`codigo${JSON.stringify(avatar)}`) % 100000000).padStart(8, '0');
  return `${n.slice(0, 2)} - ${n.slice(2, 5)} - ${n.slice(5)}`;
}

/** Dibuja la tarjeta. o = { portrait (imagen), name, birthday ("dd/mm"), theme (id), avatar }. */
export async function drawCard(o) {
  const theme = CARD.themes.find((t) => t.id === o.theme) || CARD.themes[0];
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  const [background, portrait] = await Promise.all([
    loadImage(publicAssetUrl(theme.svg)),
    loadImage(o.portrait),
  ]);
  ctx.scale(CARD_W / TPL_W, CARD_W / TPL_W);
  if (background) ctx.drawImage(background, 0, 0, TPL_W, (TPL_W * CARD_H) / CARD_W);

  const { shadow, portrait: place } = TPL;
  ctx.fillStyle = 'rgba(0, 0, 0, .16)';
  ctx.beginPath();
  ctx.ellipse(shadow.x, shadow.y, shadow.rx, shadow.ry, 0, 0, Math.PI * 2);
  ctx.fill();
  if (portrait) ctx.drawImage(portrait, place.x - place.size / 2, place.bottom - place.size, place.size, place.size);

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'center';
  ctx.fillStyle = theme.accent;
  ctx.font = `800 ${TPL.number.size}px "Nunito", sans-serif`;
  ctx.fillText(cardSerial(o.avatar).slice(-3), TPL.number.x, TPL.number.y);

  ctx.fillStyle = '#FFFFFF';
  const name = (o.name || 'Tu avatar').slice(0, 18);
  let size = TPL.name.size;
  do {
    ctx.font = `800 ${size}px "Nunito", sans-serif`;
    size -= 4;
  } while (ctx.measureText(name).width > TPL.name.maxWidth && size > 50);
  ctx.fillText(name, TPL.name.x, TPL.name.y);

  ctx.textAlign = 'left';
  ctx.font = `400 ${TPL.birthday.size}px "Nunito", sans-serif`;
  ctx.fillText(o.birthday || '--/--', TPL.birthday.x, TPL.birthday.y);
  ctx.font = `200 ${TPL.code.size}px "Nunito", sans-serif`;
  ctx.fillText(cardCode(o.avatar), TPL.code.x, TPL.code.y);
  return canvas;
}
