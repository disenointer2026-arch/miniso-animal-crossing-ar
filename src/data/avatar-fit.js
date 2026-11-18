/* Reglas de ajuste de las piezas del personaje, portadas de la pagina original
   (src/data/avatarOptions.js). Las medidas estan en unidades del modelo del avatar. */

const OVER_HAIR = { scale: 1.08 };
const BAND_FIT = {
  scale: [0.95, 1.05, 1.02],
  byHair: { afro: { rotation: [0.17, 0, 0], scale: [0.95, 1.1, 1.02] } },
};
const HEADPHONES_FIT = { byHair: { afro: { rotation: [-0.1, 0, 0], scale: [1, 1.18, 1] } } };

/** Ajuste propio de cada accesorio de cabeza (los demas van tal cual). */
export const ACCESSORY_FIT = {
  balaca: BAND_FIT,
  mono: OVER_HAIR,
  flor: OVER_HAIR,
  audifonos: HEADPHONES_FIT,
};

/** La web recorta el pelo bajo la gorra y el sombrero; aqui se oculta el pelo mientras estan puestos. */
export const HIDES_HAIR = new Set(['gorra', 'sombrero']);

/** El overol tapa la parte superior: el modelo de la camiseta lo atraviesa. */
export const HIDES_SHIRT = new Set(['overol']);

const spot = ({ tilt = 0, scale = 1, back = 0, down = 0 } = {}) => ({
  position: [0.46, 0, -0.34],
  rotation: [0, -0.45, -tilt],
  scale,
  back,
  down,
});

/** Lugar de cada charm junto al personaje. */
export const CHARM_FIT = {
  'bolsa-dinero': spot({ scale: 1.2, back: 0.25, down: 0.1 }),
  guitarra: spot({ tilt: 0.35, down: 0.15 }),
  moneda: spot(),
  'nota-musical': spot({ tilt: 0.35, scale: 1.2, down: 0.15 }),
  regalo: spot({ scale: 1.2, back: 0.25, down: 0.1 }),
  tulipan: spot(),
};

/** En la personalizacion el charm se ve mas grande y flotando; el tulipan se queda en el suelo. */
export const CHARM_SHOWCASE = { scale: 1.3, lift: 0.35, right: 0.14, grounded: ['tulipan'] };
