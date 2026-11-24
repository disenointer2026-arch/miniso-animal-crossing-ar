/* Puntos del modelo [x, y, z] (unidades de Blender) de lo que no se toma directamente de un nodo del modelo.
   Los botones, las cajas, el armario y las baldas se calculan a partir de los nodos del glb (ver
   src/factory/model-nodes.js y src/stations/catalog/catalog-config.js). Las medidas de referencia que dejo el
   equipo en el modelo (muñeco, camisas y lata) estan en docs/fuentes/fabrica/medidas.json. */
export const ANCHORS = {
  canHome: [8.29, 8.97, 7.0], // la lata apoya en la banda, junto al personaje (referencia "Lata aerosol" del modelo)
  hairTray: [24.5, 27, 7], // bandeja de salida de la maquina de cabello (la reja)
  hairBin: [24.5, 21.5, 7], // bote de descarte
};

/** Piezas del modelo que no se dibujan porque las reemplaza un objeto funcional: el libro de la estacion de
    rostro lo sustituye el libro de stickers que se agarra. */
export const HIDDEN_NODES = ['libro_ojos'];
