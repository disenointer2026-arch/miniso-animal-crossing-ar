/* Superficie de las paginas del libro del modelo (nodo "libro_ojos" de la fabrica, mallas "Blanco P" y "Rojo miniso").
   Las dos hojas se abren desde el lomo (que va a lo largo de x en el sistema local del modelo, en z = -0,08) y se
   curvan hacia arriba: la altura del borde de cada hoja en funcion de z (medida en el glb) se interpola entre el borde
   izquierdo (x = -1) y el derecho (x = +1). Todo en unidades locales del nodo; el libro del juego (un Group) gira el
   nodo 90 grados y lo escala, y aqui se traduce a metros del libro: x a la derecha, z hacia el usuario, y arriba. */
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

/** Medidas del libro en unidades del glb: cubierta (z a lo largo del libro abierto, x de fondo) y hojas. */
export const BOOK_COVER = { z: 3.363, x: 2.476 };
/** Ancho del libro abierto en el juego (m): fija la escala (metros por unidad del glb) y, con ella, todas las medidas de las paginas. */
export const BOOK_COVER_WIDTH = 0.36;
export const BOOK_UNIT = BOOK_COVER_WIDTH / BOOK_COVER.z;

/** Altura (unidades del glb) a la que quedan las hojas una vez aplanadas. */
export const PAGE_FLAT = 0.1;

/** Aplana las hojas del libro (malla "Blanco P"): resta a cada vertice la ondulacion de su borde (EDGE_LEFT / EDGE_RIGHT segun el lado)
    para que la cara de arriba quede plana a PAGE_FLAT. Asi los stickers, las muestras y el texto quedan derechos y bien asentados sobre
    la hoja, en vez de seguir su curva. Se recorta una copia de la geometria (la del modelo es compartida). */
export function flattenPages(node) {
  node.traverse((object) => {
    if (!object.isMesh) return;
    const name = String(object.material?.name ?? '').replace(/[ _]/g, '').toLowerCase();
    if (name !== 'blancop') return;
    const geometry = object.geometry.clone();
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const edge = position.getX(i) < 0 ? EDGE_LEFT : EDGE_RIGHT;
      position.setY(i, position.getY(i) - (along(edge, position.getZ(i)) - PAGE_FLAT));
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    object.geometry = geometry;
  });
}

/** Altura (y, con el fondo de la cubierta en 0) de la superficie de la pagina en (rigX, rigZ) del libro, en metros: el mayor valor
    en un cuadrado de medio lado `half` alrededor del punto, para que lo que se apoya ahi (stickers, muestras) no quede hundido.
    Esas piezas van planas y paralelas a las paginas: asi quedan alineadas, no torcidas por la curva de las hojas. */
export function pageTop(rigX, rigZ, half = 0.03, unit = BOOK_UNIT) {
  return (PAGE_FLAT - BOOK_BOTTOM) * unit; // hojas planas: misma altura en todas partes
}
