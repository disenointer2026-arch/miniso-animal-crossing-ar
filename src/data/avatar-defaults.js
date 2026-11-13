/* Avatar predeterminado y medidas del personaje modelado.
   Mismos valores que la pagina original (src/data/avatarOptions.js y
   src/three/avatarDims.js), para que el personaje sea identico. */

export const DEFAULT_AVATAR = {
  skin: '#FFD8B5',
  hair: 'corto',
  hairColor: '#5A3932',
  eyes: 'brow',
  eyeColor: '#9C7657',
  nose: 'triangle',
  mouth: 'smile',
  shirt: 'camisa',
  pants: 'short',
  shoes: 'zapatos',
  accHead: 'none',
  companion: 'none',
};

/** Las narices son naranjas, como en sus botones; no cambian con el tono de piel. */
export const NOSE_ORANGE = '#EC713F';

/** Numero del mapa UV de cada estilo de ojos (public/images/ojos/N-*.png). */
export const EYE_MAPS = {
  lashes: 1,
  soft: 2,
  classic: 3,
  brow: 4,
  lashesTop: 5,
  lashesBottom: 6,
  sleepy: 7,
  happy: 8,
};

/** Zona de los ojos dentro del mapa UV de la cabeza (origen arriba). */
export const EYE_CROP = { x: 0.616822, y: 0.735191, w: 0.224299, h: 0.131117 };

/** Boca: dibujo SVG pegado sobre la cara. Medidas en unidades de la cabeza. */
export const MOUTH = {
  y: -0.21,
  width: 949 * 0.00033,
  height: 408 * 0.00033,
  files: { smile: 'sonrisa', cat: 'gato', teeth: 'dientes' },
};

/* Medidas tomadas en Blender al exportar el personaje (metros, sin escalar). */
export const MODEL = {
  headY: 1.4775, // centro de la cabeza sobre el suelo
  headHalf: [0.4196, 0.3984, 0.4228],
  /** Altura total aproximada: sirve para escalar el personaje sobre la banda */
  height: 1.4775 + 0.3984,
  // Profundidad real de la cara (z) en una cuadricula de 5 cm desde (-0.30, -0.30)
  face: {
    x0: -0.3,
    y0: -0.3,
    step: 0.05,
    rows: [
      [0.174, 0.251, 0.297, 0.329, 0.347, 0.357, 0.363, 0.357, 0.347, 0.33, 0.297, 0.25, 0.174],
      [0.261, 0.315, 0.351, 0.373, 0.387, 0.394, 0.398, 0.394, 0.387, 0.374, 0.351, 0.314, 0.258],
      [0.301, 0.348, 0.375, 0.394, 0.406, 0.412, 0.415, 0.413, 0.406, 0.395, 0.376, 0.349, 0.299],
      [0.307, 0.353, 0.381, 0.4, 0.411, 0.417, 0.42, 0.418, 0.411, 0.401, 0.382, 0.353, 0.305],
      [0.304, 0.341, 0.369, 0.388, 0.401, 0.408, 0.412, 0.408, 0.401, 0.389, 0.369, 0.341, 0.304],
      [0.302, 0.339, 0.362, 0.379, 0.395, 0.4, 0.404, 0.4, 0.395, 0.38, 0.363, 0.339, 0.303],
      [0.295, 0.337, 0.358, 0.375, 0.389, 0.394, 0.398, 0.395, 0.389, 0.376, 0.359, 0.338, 0.295],
      [0.287, 0.327, 0.35, 0.369, 0.383, 0.391, 0.392, 0.392, 0.383, 0.369, 0.35, 0.326, 0.288],
      [0.27, 0.31, 0.341, 0.358, 0.372, 0.381, 0.385, 0.381, 0.373, 0.359, 0.342, 0.31, 0.271],
      [0.244, 0.287, 0.317, 0.339, 0.351, 0.357, 0.366, 0.357, 0.351, 0.34, 0.318, 0.287, 0.244],
      [0.204, 0.259, 0.293, 0.315, 0.329, 0.335, 0.342, 0.336, 0.33, 0.316, 0.293, 0.259, 0.203],
      [0.146, 0.212, 0.249, 0.277, 0.295, 0.304, 0.31, 0.304, 0.294, 0.278, 0.251, 0.212, 0.147],
    ],
  },
};

/** Escala que lleva las medidas "procedurales" de la cabeza (radio 0.5) al modelo. */
export const HEAD_FIT = [
  MODEL.headHalf[0] / 0.5,
  MODEL.headHalf[1] / (0.5 * 0.9),
  MODEL.headHalf[2] / (0.5 * 0.93),
];
