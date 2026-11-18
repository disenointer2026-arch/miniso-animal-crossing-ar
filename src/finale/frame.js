/* Marco "frente al usuario" para colocar lo que aparece al terminar: la caja, el avatar y
   los paneles. Se captura al empezar el cierre y despues todo se coloca respecto a el
   (a la derecha, al frente y a una altura respecto a la cabeza). Coordenadas del mundo. */
import { Quaternion, Vector3 } from '@iwsdk/core';

export const frame = {
  head: new Vector3(0, 1.6, 0),
  forward: new Vector3(0, 0, -1),
  right: new Vector3(1, 0, 0),
};
const rotation = new Quaternion();
const UP = new Vector3(0, 1, 0);

export function captureFrame(head) {
  head.getWorldPosition(frame.head);
  head.getWorldQuaternion(rotation);
  const forward = new Vector3(0, 0, -1).applyQuaternion(rotation);
  forward.y = 0;
  // Con la mirada casi vertical el giro no es fiable: se conserva el marco anterior
  if (forward.lengthSq() > 0.06) frame.forward.copy(forward.normalize());
  frame.right.crossVectors(frame.forward, UP);
}

/** Punto del mundo: right metros a la derecha, forward al frente y up respecto a la cabeza. */
export function framePoint(out, right, forward, up = 0) {
  out.copy(frame.head).addScaledVector(frame.right, right).addScaledVector(frame.forward, forward);
  out.y += up;
  return out;
}

/** Giro en Y para que un objeto con +Z como frente mire al usuario. */
export const frameYaw = () => Math.atan2(-frame.forward.x, -frame.forward.z);
