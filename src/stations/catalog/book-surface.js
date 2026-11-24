/* Superficie de las paginas del libro del modelo (nodo "libro_ojos" de la fabrica, mallas "Blanco P" y "Rojo miniso").
   Las dos hojas se abren desde el lomo (que va a lo largo de x en el sistema local del modelo, en z = -0,08) y se
   curvan hacia arriba: la altura del borde de cada hoja en funcion de z (medida en el glb) se interpola entre el borde
   izquierdo (x = -1) y el derecho (x = +1). Todo en unidades locales del nodo; el libro del juego (un Group) gira el
   nodo 90 grados y lo escala, y aqui se traduce a metros del libro: x a la derecha, z hacia el usuario, y arriba. */
import { Vector3 } from '@iwsdk/core';

/** Parejas [z, y de la cara superior] a lo largo del borde izquierdo (x = -1) y del derecho (x = +1) de las hojas. */
const EDGE_LEFT = [[-1.5, -0.021], [-1.068, 0.07], [-0.579, 0.147], [-0.264, 0.12], [-0.076, 0.056], [0.105, 0.106], [0.425, 0.162], [0.915, 0.099], [1.35, 0.021]];
const EDGE_RIGHT = [[-1.35, -0.021], [-0.919, 0.07], [-0.43, 0.147], [-0.115, 0.119], [0.073, 0.056], [0.254, 0.106], [0.575, 0.162], [1.064, 0.099], [1.5, 0.021]];
/** y de la cara de abajo de la cubierta roja (el libro apoya ahi). */
export const BOOK_BOTTOM = -0.265;

function along(edge, z) {
  if (z <= edge[0][0]) return edge[0][1];
  for (let i = 1; i < edge.length; i++) {
    if (z <= edge[i][0]) {
      const k = (z - edge[i - 1][0]) / (edge[i][0] - edge[i - 1][0]);
      return edge[i - 1][1] + (edge[i][1] - edge[i - 1][1]) * k;
    }
  }
  return edge[edge.length - 1][1];
}

/** Altura de la hoja en (x, z) locales del nodo. */
export function pageHeight(x, z) {
  const t = Math.min(Math.max((x + 1) / 2, 0), 1);
  return along(EDGE_LEFT, z) * (1 - t) + along(EDGE_RIGHT, z) * t;
}

/** Superficie de la hoja en el punto (rigX, rigZ) del libro (metros; `unit` = metros por unidad local del nodo): devuelve
    la altura y (el fondo de la cubierta esta en y = 0) y escribe la normal en `normal`. */
export function pageSurface(unit, rigX, rigZ, normal = new Vector3()) {
  const lz = rigX / unit; // el nodo gira 90 grados: z local -> x del libro, x local -> -z del libro
  const lx = -rigZ / unit;
  const e = 0.05;
  const dydx = (pageHeight(lx, lz + e) - pageHeight(lx, lz - e)) / (2 * e); // pendiente a lo largo de x del libro
  const dydz = -(pageHeight(lx + e, lz) - pageHeight(lx - e, lz)) / (2 * e); // y a lo largo de z del libro
  normal.set(-dydx, 1, -dydz).normalize();
  return { y: (pageHeight(lx, lz) - BOOK_BOTTOM) * unit, normal };
}
