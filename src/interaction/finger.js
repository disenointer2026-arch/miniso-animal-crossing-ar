/* Los botones se accionan al PRESIONARLOS con la punta del indice, no apuntando desde lejos con el rayo.
   Cada cuadro, UiSystem llama a sampleFingers(): guarda la punta del indice de cada mano y si hay
   seguimiento de manos. Con controles (sin manos) todo se acepta, porque no hay dedos que medir. */
import { Box3, Vector3 } from '@iwsdk/core';
import { jointWorld } from './hand-joints.js';

const SIDES = ['right', 'left'];
const tips = { right: new Vector3(), left: new Vector3() };
const valid = { right: false, left: false };
const wrist = new Vector3();
let tracked = false;
const local = new Vector3();
const box = new Box3();

/** Lee las manos de este cuadro (solo valido dentro del cuadro XR). */
export function sampleFingers(renderer, player) {
  let any = false;
  for (const side of SIDES) {
    valid[side] = jointWorld(renderer, player, side, 'index-finger-tip', tips[side]);
    any = any || valid[side] || jointWorld(renderer, player, side, 'wrist', wrist);
  }
  tracked = any;
}

export function handsTracked() {
  return tracked;
}

/** Distancia de la punta del indice mas cercana a un punto (Infinity si no hay dedos). */
export function fingerDistance(point) {
  let best = Infinity;
  for (const side of SIDES) if (valid[side]) best = Math.min(best, tips[side].distanceTo(point));
  return best;
}

/** Distancia de la punta del indice mas cercana a la caja del objeto (los botones son anchos: el centro no basta). */
export function fingerDistanceToObject(object) {
  box.setFromObject(object);
  let best = Infinity;
  for (const side of SIDES) if (valid[side]) best = Math.min(best, box.distanceToPoint(tips[side]));
  return best;
}

/** Con manos, el dedo debe estar a menos de `margin` metros del objeto; con controles siempre cuenta. */
export function pokeAllowedOnObject(object, margin = 0.04) {
  return !tracked || fingerDistanceToObject(object) < margin;
}

/** Verdadero si el toque cuenta: con manos, el dedo debe estar a menos de `radius` del punto; con controles siempre. */
export function pokeAllowed(point, radius) {
  return !tracked || fingerDistance(point) < radius;
}

/** Para un panel plano de UIKit: el dedo debe estar a menos de `depth` metros de su plano, dentro de su zona. */
export function pokeAllowedOnPanel(panel, depth = 0.1) {
  if (!tracked) return true;
  const s = panel.getWorldScale(wrist).x || 1;
  for (const side of SIDES) {
    if (!valid[side]) continue;
    local.copy(tips[side]);
    panel.worldToLocal(local);
    if (Math.abs(local.z) * s < depth && Math.abs(local.x) * s < 0.7 && Math.abs(local.y) * s < 0.7) return true;
  }
  return false;
}

/** Envuelve un manejador de pulsacion (pointerdown: el dedo no siempre llega a generar un clic) de un panel: con manos solo responde si el dedo esta presionando el panel. */
export function touchOnly(getPanel, handler, { remote = false } = {}) {
  let last = 0;
  return (...args) => {
    const now = performance.now();
    if (now - last < 300) return; // un dedo que roza el panel puede repetir el evento
    const panel = getPanel();
    // remote: panel con seleccion a distancia (rayo de la mano + pellizco): no exige tocarlo con el dedo
    if (!remote && panel && !pokeAllowedOnPanel(panel)) return;
    last = now;
    handler(...args);
  };
}
