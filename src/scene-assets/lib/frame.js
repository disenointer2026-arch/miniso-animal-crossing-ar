/* Ayuda para colocar objetos de una estacion con las mismas coordenadas que
   src/core/layout.js: tangent (a lo largo de la banda), radial (+ hacia afuera) y
   up (sobre la banda). El objeto queda mirando al usuario (+Z). */
import { stationPoint } from '../../core/layout.js';

/** Coloca `object` en el punto de la estacion y devuelve ese punto. */
export function placeAtStation(object, layout, station, tangent, radial, up = 0) {
  const p = stationPoint(layout, station, tangent, radial, up);
  object.position.set(p.x, p.y, p.z);
  object.rotation.y = p.rotY;
  return p;
}
