/* Catalogos de las estaciones 3 a 5. Los ids salen de src/data/categories.js, igual que la web.
   apply  parte del avatar que cambia | kind  sticker (plano, se queda en el libro), part (pieza .glb
   que se coloca y sale del mueble) o swatch (muestras de color, sin objeto) | target  donde se suelta
   zones  puntos tocables sobre el personaje para retirar lo puesto (head | root | charm).

   Estacion 3 (rostro): el LIBRO de stickers se agarra con una mano y se abre; sus 4 paginas son ojos,
     color de ojos, boca y nariz. Los stickers se sacan de la pagina con la otra mano.
   Estacion 4 (ropa y accesorios): prendas repartidas en las baldas del armario del modelo; los cuatro botones del
     modelo (camisetas, pantalones, zapatos y accesorios) cambian lo que se muestra.
   Estacion 5 (charms): las seis cajas del modelo, cerradas y con el icono de su charm; al agarrar una con una
     mano se abre y de ella se saca el charm. */
import { EYE_MAPS } from '../../data/avatar-defaults.js';
import { CATEGORIES } from '../../data/categories.js';

export const FACE = 2;
export const CLOTHES = 3;
export const CHARMS = 4;

const ids = (station, group) =>
  CATEGORIES[station].groups[group].options.map((o) => o.id).filter((id) => id !== 'none');

/** Imagen del sticker de cada opcion (ver src/assets.js). */
/** Numero del icono (botones-ojos-0N.png) de cada estilo de ojos. OJO: no es el numero del mapa de la cabeza (EYE_MAPS) ni la posicion
    en la lista de opciones; se comprobo por apariencia comparando cada icono con la textura que se pinta en la cabeza. */
export const EYE_ICON = { lashes: 1, classic: 2, lashesTop: 3, sleepy: 4, happy: 5, lashesBottom: 6, brow: 7, soft: 8 };

export const stickerTexture = {
  eyes: (id) => `sticker-ojos-${EYE_ICON[id]}`,
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
      { apply: 'shirt', kind: 'part', prefix: 'ropa', target: 'body', ids: ids(CLOTHES, 0), label: 'Camisetas', button: 'btn_camisa' },
      { apply: 'pants', kind: 'part', prefix: 'ropa', target: 'body', ids: ids(CLOTHES, 1), label: 'Pantalones', button: 'btn_pantalon' },
      { apply: 'shoes', kind: 'part', prefix: 'zapatos', target: 'feet', ids: ids(CLOTHES, 2), label: 'Zapatos', button: 'btn_zapatos' },
      { apply: 'accHead', kind: 'part', prefix: 'accesorio', target: 'head', ids: ids(CLOTHES, 3), label: 'Accesorios', button: 'btn_accesorios', small: true },
    ],
    zones: [
      { key: 'shirt', space: 'root', at: [0, 0.95, 0.15], radius: 0.04 },
      { key: 'pants', space: 'root', at: [0, 0.6, 0.15], radius: 0.04 },
      { key: 'shoes', space: 'root', at: [0, 0.08, 0.2], radius: 0.035 },
      { key: 'accHead', space: 'head', at: [0, 0.45, 0], radius: 0.04 },
    ],
  },
  [CHARMS]: {
    furniture: 'boxes',
    groups: [{ apply: 'companion', kind: 'part', prefix: 'charm', target: 'body', ids: ids(CHARMS, 0), label: 'Charms' }],
    zones: [{ key: 'companion', space: 'charm', at: [0, 0, 0], radius: 0.06 }],
  },
};

// ---------- Muebles del modelo (unidades del modelo) ----------
export const FURNITURE = {
  /** Libro de stickers: es el libro "libro_ojos" del modelo; este es el punto del fondo de su cubierta, sobre la mesa. */
  book: [49.7, 8.2, 7.3],
};

/** Armario: las prendas se acomodan donde el equipo puso las seis camisas de referencia (docs/fuentes/fabrica/medidas.json):
    tres columnas y dos baldas (arriba y en medio); una tercera fila usa la balda de abajo. */
export const CLOSET = {
  y: -26.23,
  /** x del centro de cada columna, de izquierda a derecha mirando el armario (la x del modelo decrece). */
  columns: [29.84, 27.1, 24.15],
  /** z del centro de las prendas colgadas en cada fila (las dos primeras son las camisas de referencia). */
  rows: [16.71, 13.34, 10.44],
  /** z de la superficie de cada balda: lo pequeño (zapatos, accesorios) se apoya ahi. */
  shelves: [15.3, 12.0, 9.1],
};

/** Posicion [x, y, z] del modelo del objeto `index` de un grupo del armario. */
export function closetSlot(index, small = false) {
  const row = Math.min(Math.floor(index / 3), 2);
  const col = index % 3;
  const z = small ? CLOSET.shelves[row] + 0.75 : CLOSET.rows[row];
  return [CLOSET.columns[col], CLOSET.y, z];
}

/** Cada caja del modelo (nodo caja_N) guarda un charm; arriba, de izquierda a derecha mirando las cajas: bolsa de
    dinero, guitarra y moneda; abajo: tulipan, nota musical y regalo. */
export const CHEST_NODES = {
  caja_4: 'bolsa-dinero',
  caja_5: 'guitarra',
  caja_6: 'moneda',
  caja_1: 'tulipan',
  caja_2: 'nota-musical',
  caja_3: 'regalo',
};

/** Pestañas del libro de stickers: cada una muestra su grupo de stickers (y, en "Ojos", tambien las muestras de color). */
export const FACE_TABS = [
  { label: 'Ojos', group: 0, color: '#F9C623' },
  { label: 'Boca', group: 2, color: '#8CC37A' },
  { label: 'Nariz', group: 3, color: '#F48FB1' },
];

/** Posicion [x, z] (metros, sistema del libro: x a la derecha, z hacia el usuario) de un sticker o una muestra. Las hojas van de
    x = ±0,16 y z = ±0,117 y, aplanadas, no tienen lomo marcado. Los stickers van en una cuadricula CENTRADA y alineada: columnas cada
    0,072 m (1 a 4 por fila, centradas) y filas cada 0,06 m desde arriba; con 3 (boca, nariz) una sola fila centrada; con 8 (ojos)
    dos filas de 4. Las muestras de color de ojos (12) van debajo, en 2 filas de 6. */
export function bookSlot(group, index, count) {
  if (group.kind === 'swatch') {
    return [((index % 6) - 2.5) * 0.045, 0.045 + Math.floor(index / 6) * 0.04];
  }
  const cols = Math.min(count, 4);
  const rows = Math.ceil(count / cols);
  const col = index % cols;
  const row = Math.floor(index / cols);
  const top = rows === 1 ? -0.03 : -0.075; // una fila: algo mas centrada en la hoja
  return [(col - (cols - 1) / 2) * 0.072, top + row * 0.06];
}
