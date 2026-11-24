/* Geometria de la fabrica (modelo FABRICA.blend), puro calculo sin Three.js ni DOM.

   Coordenadas del MODELO (las de Blender): x al este, y al norte, z arriba, en unidades
   del modelo; 1 unidad = MODEL.scale metros. El usuario esta de pie en MODEL.user, a nivel
   del suelo, y la fabrica lo rodea. Sistema local de la fabrica (metros): el
   origen es el usuario, -Z al frente, +X a su derecha, Y arriba (y = 0 es el piso).

   Siete posiciones sobre la banda (slots): 0 salida del edificio MINISO | 1..5 las cinco
   estaciones | 6 caja de regalo (final). Cada slot tiene un PUNTO DE PIE (MODEL.stands): el
   usuario camina hasta el, de frente a la estacion. Un "marco" de estacion mira a ese punto: su +Z
   apunta al usuario, +X es su derecha mirando hacia afuera y "radial" positivo va hacia afuera. */

const DEG = Math.PI / 180;

export const MODEL = {
  scale: 0.034, // metros por unidad del modelo (fabrica grande: el usuario camina entre estaciones)
  beltTop: 6.9, // altura (z) de la superficie de la banda
  user: [23, -2], // donde esta de pie el usuario al calibrar: el centro del recorrido
  yaw: -13 * DEG, // giro de la fabrica respecto a la mirada: la estacion 1 queda al frente-izquierda
  /** Linea central de la banda, de la salida del edificio al final. */
  path: [
    [-9, 35], [-9, 20], [-8.5, 14], [-7, 10.5], [-4.5, 9], [0, 8.8], [12, 8.8], [14.5, 9.5], [16.5, 11.5],
    [18.8, 15], [20, 19], [20, 32], [20.5, 37], [22.5, 41], [26, 43.4], [30, 43.8], [37, 43.5], [41, 42.5],
    [44, 40], [45.5, 37], [46, 32], [46, -11], [45, -15], [43, -18], [40, -20.5], [36, -21.5], [-8, -21.6],
  ],
  /** Donde para el avatar en cada slot (sobre la banda). */
  stops: [[-9, 34], [6, 8.8], [20, 27], [46, 15], [30, -21.6], [2, -21.6], [-8, -21.6]],
  /** Centro de la caja de regalo, un poco mas alla del final de la banda. */
  giftBox: [-15.5, -21.6],
  /** Donde se para el usuario en cada slot: del lado de adentro de la banda, de frente a la
      estacion y a ~0.45 m de la banda (alcance comodo de la mano). El slot 0 usa el de la estacion 1. */
  stands: [[2, -1.5], [2, -1.5], [38, 27], [36, 8], [32, -13], [3, -13], [-8, -13]],
};

/** Los puntos de pie nunca quedan a mas de SAFE_STAND_RADIUS metros del punto donde el usuario calibro (su espacio
    libre verificado, el centro de la fabrica): mas lejos, la fabrica se sale del campo de visual o el usuario se
    acerca al limite de su area de juego. Un punto que lo supera se acerca al centro por la misma recta, y la
    estacion sigue a alcance de la mano. La fabrica no se mueve ni se reduce. */
export const SAFE_STAND_RADIUS = 0.72;
{
  const limit = SAFE_STAND_RADIUS / MODEL.scale; // en unidades del modelo
  MODEL.stands = MODEL.stands.map(([x, y]) => {
    const dx = x - MODEL.user[0];
    const dy = y - MODEL.user[1];
    const distance = Math.hypot(dx, dy);
    if (distance <= limit) return [x, y];
    const k = limit / distance;
    return [MODEL.user[0] + dx * k, MODEL.user[1] + dy * k];
  });
}

/** Alto del muñeco de referencia que trae el modelo (unidades del modelo): es el avatar base, sin cabello. */
export const AVATAR_UNITS = 4.3;

export const SLOT = { portal: 0, firstStation: 1, giftBox: 6 };
export const STATION_COUNT = 5;

/** Rangos validos de la calibracion (metros sobre el piso / desde la cabeza). */
export const LIMITS = {
  height: [0.7, 1.25],
  beltRadius: [0.5, 0.68],
};

/** Radio (m) alrededor del punto de pie en el que se considera que el usuario ya esta en su sitio. */
export const STAND_RADIUS = 0.4;

/** Valores de partida. beltRadius (el alcance medido con la mano) ajusta el tamano de la fabrica. */
export const DEFAULT_LAYOUT = {
  x: 0,
  z: 0,
  yaw: 0,
  floorY: 0,
  height: 0.95,
  beltRadius: 0.55,
};

export const clamp = (value, [min, max]) => Math.min(Math.max(value, min), max);

/** Estacion (0..4) -> slot. */
export const stationSlot = (station) => SLOT.firstStation + station;

/** Metros por unidad del modelo, ajustado por el alcance calibrado (entre -8 % y +8 %). */
export const modelScale = (layout) => MODEL.scale * clamp(layout.beltRadius / 0.55, [0.92, 1.08]);

/** Punto del modelo (mx, my, mz) en coordenadas locales de la fabrica. */
export function modelPoint(layout, mx, my, mz = MODEL.beltTop, out = { x: 0, y: 0, z: 0 }) {
  const s = modelScale(layout);
  out.x = (mx - MODEL.user[0]) * s;
  out.y = layout.height + (mz - MODEL.beltTop) * s;
  out.z = -(my - MODEL.user[1]) * s;
  return out;
}

// ---------- Recorrido de la banda ----------
const PATH = MODEL.path;
const CUM = [0];
for (let i = 1; i < PATH.length; i++) {
  CUM.push(CUM[i - 1] + Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]));
}
export const PATH_LENGTH = CUM[CUM.length - 1];

/** Distancia recorrida (en unidades del modelo) del punto de la banda mas cercano a (x, y). */
function pathPosition(x, y) {
  let best = { d: Infinity, s: 0 };
  for (let i = 0; i < PATH.length - 1; i++) {
    const [ax, ay] = PATH[i];
    const [bx, by] = PATH[i + 1];
    const len2 = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = Math.min(Math.max(((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / len2, 0), 1);
    const d = Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay)));
    if (d < best.d) best = { d, s: CUM[i] + t * Math.sqrt(len2) };
  }
  return best.s;
}
const STOP_S = MODEL.stops.map(([x, y]) => pathPosition(x, y));

/** Distancia (unidades del modelo) a la que esta cada slot a lo largo de la banda. */
export const slotS = (slot) => STOP_S[slot];

function segmentAt(s) {
  const target = Math.min(Math.max(s, 0), PATH_LENGTH);
  let i = 1;
  while (i < CUM.length - 1 && CUM[i] < target) i++;
  return i;
}

/** Punto de la banda a la distancia s (lift: metros sobre la superficie). */
export function pathPoint(layout, s, lift = 0, out = { x: 0, y: 0, z: 0 }) {
  const i = segmentAt(s);
  const span = CUM[i] - CUM[i - 1];
  const t = span > 0 ? (Math.min(Math.max(s, 0), PATH_LENGTH) - CUM[i - 1]) / span : 0;
  const x = PATH[i - 1][0] + t * (PATH[i][0] - PATH[i - 1][0]);
  const y = PATH[i - 1][1] + t * (PATH[i][1] - PATH[i - 1][1]);
  modelPoint(layout, x, y, MODEL.beltTop, out);
  out.y += lift;
  return out;
}

/** Giro en Y para mirar en el sentido de avance de la banda (forward = -1 para mirar hacia atras). */
export function pathHeading(s, forward = 1) {
  const i = segmentAt(s);
  const dx = (PATH[i][0] - PATH[i - 1][0]) * forward;
  const dy = (PATH[i][1] - PATH[i - 1][1]) * forward;
  return Math.atan2(dx, -dy);
}

/** Interpola dos angulos por el camino mas corto. */
export function lerpAngle(a, b, t) {
  const d = ((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return a + d * t;
}

// ---------- Marcos (estaciones y muebles) ----------
/** Punto de pie de un slot en coordenadas locales de la fabrica (sobre el piso: y = 0). */
export function standPoint(layout, slot, out = { x: 0, y: 0, z: 0 }) {
  const [mx, my] = MODEL.stands[slot];
  modelPoint(layout, mx, my, MODEL.beltTop, out);
  out.y = 0;
  return out;
}

const FACE = { x: 0, y: 0, z: 0 };

/** Marco en un punto del plano local (x, z): gira para mirar al punto (fx, fz) (donde esta el
    usuario) y devuelve el punto desplazado tangent (derecha), radial (hacia afuera) y up (arriba). */
function frameAt(x, y, z, tangent, radial, up, fx = 0, fz = 0) {
  const dx = x - fx;
  const dz = z - fz;
  const distance = Math.hypot(dx, dz) || 1;
  const rotY = Math.atan2(-dx, -dz); // +Z del objeto mira al usuario
  const tx = Math.cos(rotY);
  const tz = -Math.sin(rotY);
  const ox = dx / distance; // hacia afuera
  const oz = dz / distance;
  return {
    x: x + tx * tangent + ox * radial,
    y: y + up,
    z: z + tz * tangent + oz * radial,
    rotY,
    tx,
    tz,
  };
}

/** Marco de un punto cualquiera del modelo [mx, my, mz]. Mira al punto de pie del `slot` dado;
    sin slot, mira al origen (el lugar donde el usuario calibro). */
export function modelFrame(layout, point, tangent = 0, radial = 0, up = 0, slot = null) {
  const p = modelPoint(layout, point[0], point[1], point[2] ?? MODEL.beltTop);
  const face = slot === null ? FACE : standPoint(layout, slot);
  return frameAt(p.x, p.y, p.z, tangent, radial, up, face.x, face.z);
}

/** Marco de un slot (donde para el avatar); up se mide sobre la banda. */
export function slotPose(layout, slot, radial = 0, up = 0) {
  const [mx, my] = MODEL.stops[slot];
  return modelFrame(layout, [mx, my, MODEL.beltTop], 0, radial, up, slot);
}

export function slotPoint(layout, slot, tangent = 0, radial = 0, up = 0) {
  const [mx, my] = MODEL.stops[slot];
  return modelFrame(layout, [mx, my, MODEL.beltTop], tangent, radial, up, slot);
}

export function stationPoint(layout, station, tangent = 0, radial = 0, up = 0) {
  return slotPoint(layout, stationSlot(station), tangent, radial, up);
}
