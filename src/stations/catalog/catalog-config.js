/* Catalogos de las estaciones 3 a 5. Los ids salen de src/data/categories.js, igual que la web.
   apply  parte del avatar que cambia | kind  sticker (plano, se queda en el libro), part (pieza .glb
   que se coloca y sale del mueble) o swatch (muestras de color, sin objeto) | target  donde se suelta
   zones  puntos tocables sobre el personaje para retirar lo puesto (head | root | charm).

   Estacion 3 (rostro): el LIBRO de stickers se agarra con una mano y se abre; sus 4 paginas son ojos,
     color de ojos, boca y nariz. Los stickers se sacan de la pagina con la otra mano.
   Estacion 4 (ropa): prendas repartidas en las baldas del armario; tres botones en los bloques de al
     lado cambian entre camisetas, pantalones y zapatos.
   Estacion 5 (charms): seis cajas cerradas (tres arriba y tres abajo) con el icono de su charm; al
     agarrar una con una mano se abre y de ella se saca el charm. Los accesorios van en una vitrina. */
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
      { apply: 'eyes', kind: 'sticker', target: 'head', ids: ids(FACE, 0), label: 'Ojos' },
      { apply: 'eyeColor', kind: 'swatch', target: 'head', ids: ids(FACE, 1), label: 'Color de ojos' },
      { apply: 'mouth', kind: 'sticker', target: 'head', ids: ids(FACE, 2), label: 'Boca' },
      { apply: 'nose', kind: 'sticker', target: 'head', ids: ids(FACE, 3), label: 'Nariz' },
    ],
    zones: [
      { key: 'eyes', space: 'head', at: [0, 0.03, 0.4], radius: 0.026 },
      { key: 'mouth', space: 'head', at: [0, -0.19, 0.38], radius: 0.024 },
      { key: 'nose', space: 'head', at: [0, -0.09, 0.43], radius: 0.02 },
    ],
  },
  [CLOTHES]: {
    furniture: 'wardrobe',
    groups: [
      { apply: 'shirt', kind: 'part', prefix: 'ropa', target: 'body', ids: ids(CLOTHES, 0), label: 'Camisetas' },
      { apply: 'pants', kind: 'part', prefix: 'ropa', target: 'body', ids: ids(CLOTHES, 1), label: 'Pantalones' },
      { apply: 'shoes', kind: 'part', prefix: 'zapatos', target: 'feet', ids: ids(CLOTHES, 2), label: 'Zapatos' },
    ],
    zones: [
      { key: 'shirt', space: 'root', at: [0, 0.95, 0.15], radius: 0.04 },
      { key: 'pants', space: 'root', at: [0, 0.6, 0.15], radius: 0.04 },
      { key: 'shoes', space: 'root', at: [0, 0.08, 0.2], radius: 0.035 },
    ],
  },
  [CHARMS]: {
    furniture: 'box',
    groups: [
      { apply: 'companion', kind: 'part', prefix: 'charm', target: 'body', ids: ids(CHARMS, 0), label: 'Charms' },
      { apply: 'accHead', kind: 'part', prefix: 'accesorio', target: 'head', ids: ids(CHARMS, 1), label: 'Accesorios' },
    ],
    zones: [
      { key: 'companion', space: 'charm', at: [0, 0, 0], radius: 0.06 },
      { key: 'accHead', space: 'head', at: [0, 0.45, 0], radius: 0.04 },
    ],
  },
};

// ---------- Muebles del modelo (puntos [x, y, altura] en unidades del modelo) ----------
export const FURNITURE = {
  /** Libro de stickers: sustituye a los dos libros pequenos del modelo. */
  book: [52.5, 5.3, 7],
  /** Armario: centro de las baldas (cuerpo de 3 unidades de ancho). Las baldas estan a 9.1, 12.1 y 15.1. */
  wardrobe: [29.75, -28, 9.1],
  /** Bloques tipo cajon a la derecha del armario: llevan los tres botones de camisetas / pantalones / zapatos. */
  closetButtons: [20.4, -25.3, 12.2],
  /** Estante de charms: la mesa naranja (arriba, z = 15) y el piso de abajo (z = 7.1). */
  boxes: { x: [-1.4, 3.2, 7.8], yTop: -27.4, yBottom: -24.9, zTop: 15, zBottom: 7.1 },
  /** Vitrina de accesorios: dos filas escalonadas al fondo de la mesa. */
  accessories: { y: [-30.4, -32.2], z: 15, x: [-3.2, 9.4] },
};

/** Orden de las seis cajas: [id del charm, fila (0 arriba, 1 abajo), columna]. */
export const CHEST_LAYOUT = [
  ['bolsa-dinero', 0, 0],
  ['guitarra', 0, 1],
  ['moneda', 0, 2],
  ['tulipan', 1, 0],
  ['nota-musical', 1, 1],
  ['regalo', 1, 2],
];

/** Posicion de un sticker o muestra en el libro abierto, respecto al centro del libro (metros: x derecha,
    z hacia el usuario). */
export function bookSlot(group, index, count) {
  if (group.kind === 'swatch') {
    const cols = 6;
    const col = index % cols;
    const row = Math.floor(index / cols);
    return [(col - (cols - 1) / 2) * 0.047, (row - 0.5) * 0.047 + 0.005];
  }
  const cols = count > 4 ? 4 : count;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const rows = Math.ceil(count / cols);
  return [(col - (cols - 1) / 2) * 0.068, (row - (rows - 1) / 2) * 0.07 + 0.005];
}

/** Posicion de una prenda en las baldas: [tangente, radial, altura sobre la balda mas baja] en metros.
    Dos por balda, uno delante y otro detras, de abajo arriba. */
export function wardrobeSlot(index, shelfPitch) {
  const shelf = Math.floor(index / 2);
  const col = index % 2;
  return [col ? 0.02 : -0.02, col ? 0.024 : -0.012, shelf * shelfPitch + 0.045];
}
