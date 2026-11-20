/* Puntos del modelo [x, y, z] (unidades de Blender) de las estaciones 1 y 2, y las piezas del modelo que
   no se dibujan porque las reemplaza un objeto funcional. Los de las estaciones 3 a 5 (libro, armario,
   cajas, vitrina) estan en src/stations/catalog/catalog-config.js (FURNITURE). Se ajustan mirando el
   modelo en el emulador (ver docs/PRUEBAS.md). */
export const ANCHORS = {
  skinTray: [11.5, 13, 7], // bandeja donde cae la lata, junto a los dispensadores
  hairTray: [24.5, 27, 7], // bandeja de salida de la maquina de cabello
  hairBin: [24.5, 21.5, 7], // bote de descarte
};

/** Piezas del modelo que no se dibujan: los libros pequenos los sustituye el libro funcional y las cuatro
    cajas de carton del estante, las seis cajas de charms. Ojo: three.js quita los puntos de los nombres de
    nodo ("Caja.002" pasa a "Caja002"). */
export const HIDDEN_NODES = ['libro', 'libro001', 'Caja', 'Caja001', 'Caja002', 'Caja003'];
