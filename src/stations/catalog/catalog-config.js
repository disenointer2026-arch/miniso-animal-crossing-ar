/* Catalogos de las estaciones 3 a 5. Cada pestana del panel (grupo) muestra sus objetos
   en el mueble de la estacion. Los ids salen de src/data/categories.js, igual que la web.
   apply  parte del avatar que cambia | kind  sticker (plano, queda en el libro) o part
   (pieza .glb que se coloca y sale del mueble) | target  donde se suelta
   zones  puntos tocables sobre el personaje para retirar lo puesto (head | root | charm). */
import { EYE_MAPS } from '../../data/avatar-defaults.js';
import { CATEGORIES } from '../../data/categories.js';

export const FACE = 2;
export const CLOTHES = 3;
export const CHARMS = 4;

const ids = (station, group) =>
  CATEGORIES[station].groups[group].options.map((o) => o.id).filter((id) => id !== 'none');

/** Imagen del sticker de cada opcion (ver src/assets.js). */
export const stickerTexture = {
  eyes: (id) => `sticker-ojos-${EYE_MAPS[id]}`,
  mouth: (id) => `sticker-boca-${id}`,
  nose: (id) => `sticker-nariz-${id}`,
};

export const CATALOGS = {
  [FACE]: {
    furniture: 'book',
    groups: [
      { apply: 'eyes', kind: 'sticker', target: 'head', ids: ids(FACE, 0) },
      { apply: 'eyes', kind: 'sticker', target: 'head', ids: ids(FACE, 0) }, // pestana "Color de ojos"
      { apply: 'mouth', kind: 'sticker', target: 'head', ids: ids(FACE, 2) },
      { apply: 'nose', kind: 'sticker', target: 'head', ids: ids(FACE, 3) },
    ],
    zones: [
      { key: 'eyes', space: 'head', at: [0, 0.03, 0.4], radius: 0.018 },
      { key: 'mouth', space: 'head', at: [0, -0.19, 0.38], radius: 0.018 },
      { key: 'nose', space: 'head', at: [0, -0.09, 0.43], radius: 0.014 },
    ],
  },
  [CLOTHES]: {
    furniture: 'wardrobe',
    groups: [
      { apply: 'shirt', kind: 'part', prefix: 'ropa', target: 'body', ids: ids(CLOTHES, 0) },
      { apply: 'pants', kind: 'part', prefix: 'ropa', target: 'body', ids: ids(CLOTHES, 1) },
      { apply: 'shoes', kind: 'part', prefix: 'zapatos', target: 'feet', ids: ids(CLOTHES, 2) },
    ],
    zones: [
      { key: 'shirt', space: 'root', at: [0, 0.95, 0.15], radius: 0.022 },
      { key: 'pants', space: 'root', at: [0, 0.6, 0.15], radius: 0.022 },
      { key: 'shoes', space: 'root', at: [0, 0.08, 0.2], radius: 0.022 },
    ],
  },
  [CHARMS]: {
    furniture: 'box',
    groups: [
      { apply: 'companion', kind: 'part', prefix: 'charm', target: 'body', ids: ids(CHARMS, 0) },
      { apply: 'accHead', kind: 'part', prefix: 'accesorio', target: 'head', ids: ids(CHARMS, 1) },
    ],
    zones: [
      { key: 'companion', space: 'charm', at: [0, 0, 0], radius: 0.035 },
      { key: 'accHead', space: 'head', at: [0, 0.45, 0], radius: 0.03 },
    ],
  },
};

/** Cuadricula de objetos en el mueble: columnas, separacion y filas (tangente / radial / altura). */
export const SHELF = {
  book: { cols: 4, gap: 0.058, rows: [0.03, -0.03], up: 0.026, radialSingle: 0 },
  wardrobe: { cols: 3, gap: 0.115, rows: [0, 0], up: [0.065, 0.19] },
  box: { cols: 5, gap: 0.075, rows: [0.035, -0.035], up: 0.045 },
};

/** Posicion de un objeto respecto al punto del mueble (ver ANCHORS): [tangente, radial, altura]. */
export function slotOf(furniture, index, count) {
  const shelf = SHELF[furniture];
  const cols = furniture === 'book' && count <= 3 ? count : shelf.cols;
  const row = Math.floor(index / cols);
  const col = index % cols;
  const inRow = Math.min(cols, count - row * cols);
  const tangent = (col - (inRow - 1) / 2) * shelf.gap;
  const single = furniture === 'book' && count <= 3;
  const radial = single ? shelf.radialSingle : shelf.rows[row];
  const up = Array.isArray(shelf.up) ? shelf.up[row] : shelf.up;
  return [tangent, radial, up];
}
