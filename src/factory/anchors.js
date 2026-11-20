/* Puntos del modelo [x, y, z] (unidades de Blender) donde van los objetos que se agarran, y
   las piezas del modelo que se ocultan porque las reemplaza un objeto funcional. Se ajustan
   mirando el modelo en el emulador (ver docs/PRUEBAS.md). */
export const ANCHORS = {
  skinTray: [11.5, 13, 7], // bandeja donde cae la lata, junto a los dispensadores
  hairTray: [24.5, 27, 7], // bandeja de salida de la maquina de cabello
  hairBin: [24.5, 21.5, 7], // bote de descarte
  faceBook: [52.5, 5.3, 7], // libro de stickers (sustituye a los dos libros pequenos del modelo)
  clothesTop: [24.6, -27, 18.5], // sobre el armario
  charmsShelf: [3.3, -28.7, 15], // sobre el estante de las cajas
};

/** Piezas del modelo que no se dibujan: las dos cajas de arriba del estante dejan sitio a los
    charms y los libros pequenos los sustituye el libro funcional. */
/** Ojo: three.js quita los puntos de los nombres de nodo ("Caja.002" pasa a "Caja002"). */
export const HIDDEN_NODES = ['libro', 'libro001', 'Caja002', 'Caja003'];
