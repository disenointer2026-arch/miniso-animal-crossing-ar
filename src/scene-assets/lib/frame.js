/* Ayuda para colocar objetos con las mismas coordenadas que src/core/layout.js:
   tangent (a la derecha mirando hacia afuera), radial (+ hacia afuera) y up (arriba), respecto a
   un punto del modelo [x, y, z]. El objeto queda mirando al usuario (+Z). */
import { modelFrame } from '../../core/layout.js';

/** Coloca `object` junto al punto del modelo y devuelve el marco. */
export function placeAtAnchor(object, layout, anchor, tangent = 0, radial = 0, up = 0) {
  const p = modelFrame(layout, anchor, tangent, radial, up);
  object.position.set(p.x, p.y, p.z);
  object.rotation.y = p.rotY;
  return p;
}
