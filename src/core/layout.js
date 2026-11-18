/* Geometria de la fabrica en anillo (puro calculo, sin Three.js ni DOM).

   La fabrica rodea al usuario: el centro del anillo es su cabeza y el piso es y = 0.
   Sistema local de la fabrica: -Z es "al frente" del usuario, +X su derecha.
   Un angulo theta se mide desde el frente, positivo hacia la derecha:
     x = r * sin(theta)    z = -r * cos(theta)

   Siete posiciones (slots) sobre el arco:
     0 portal de entrada | 1..5 las cinco estaciones | 6 caja de regalo
   Un "marco de slot" mira al centro: su +Z apunta al usuario y su +X es la
   direccion de avance de la banda. */

export const ARC = { firstDeg: -68, stepDeg: 34, slots: 7 };
export const SLOT = { portal: 0, firstStation: 1, giftBox: 6 };
export const STATION_COUNT = 5;

/** Medidas de la plataforma, en metros, respecto al radio de la banda. */
export const BODY = {
  inner: 0.17, // borde interior = beltRadius - inner
  outer: 0.27, // borde exterior = beltRadius + outer
  thickness: 0.06,
  beltHalf: 0.1,
  /** Pasillo angular extra antes del portal y despues de la caja (grados) */
  marginDeg: 17,
};

/** Rangos validos de la calibracion (metros sobre el piso / desde la cabeza). */
export const LIMITS = {
  height: [0.7, 1.25],
  beltRadius: [0.5, 0.68],
};

/** Valores de partida (tambien los usa el modelo registrado en el catalogo). */
export const DEFAULT_LAYOUT = {
  x: 0,
  z: 0,
  yaw: 0,
  floorY: 0,
  height: 0.95,
  beltRadius: 0.55,
};

const DEG = Math.PI / 180;

export const clamp = (value, [min, max]) => Math.min(Math.max(value, min), max);

/** Angulo (radianes) del slot. */
export const slotAngle = (slot) => (ARC.firstDeg + ARC.stepDeg * slot) * DEG;

/** Slot de la estacion (0..4). */
export const stationSlot = (station) => SLOT.firstStation + station;

/** Punto del anillo en el sistema local de la fabrica.
    radial: metros respecto al radio de la banda (+ hacia afuera).
    up: metros sobre la superficie de la banda. */
export function arcPoint(layout, theta, radial = 0, up = 0, out = { x: 0, y: 0, z: 0 }) {
  const r = layout.beltRadius + radial;
  out.x = r * Math.sin(theta);
  out.y = layout.height + up;
  out.z = -r * Math.cos(theta);
  return out;
}

/** Punto de una estacion en coordenadas de la fabrica.
    tangent: a lo largo de la banda (+ = derecha del usuario); radial: + hacia afuera;
    up: sobre la banda. rotY hace que +Z del objeto mire al usuario. */
export function stationPoint(layout, station, tangent = 0, radial = 0, up = 0) {
  return slotPoint(layout, stationSlot(station), tangent, radial, up);
}

/** Igual que stationPoint pero indicando el slot (0 portal ... 6 caja de regalo). */
export function slotPoint(layout, slot, tangent = 0, radial = 0, up = 0) {
  const pose = slotPose(layout, slot, radial, up);
  return {
    x: pose.x + Math.cos(pose.theta) * tangent,
    y: pose.y,
    z: pose.z + Math.sin(pose.theta) * tangent,
    rotY: pose.rotY,
    theta: pose.theta,
  };
}

/** Marco de un slot: posicion + giro en Y para mirar al centro. */
export function slotPose(layout, slot, radial = 0, up = 0) {
  const theta = slotAngle(slot);
  const point = arcPoint(layout, theta, radial, up);
  return { x: point.x, y: point.y, z: point.z, rotY: -theta, theta };
}
