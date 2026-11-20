/* Posicion de las articulaciones de las manos (WebXR Hand Input: index-finger-tip es la 10.a de las 25,
   thumb-tip la 5.a...) en coordenadas del mundo. Solo hay datos con el seguimiento de manos activo;
   con controles (o en el emulador con controles) devuelve false y quien llama usa otra senal. */

/** Escribe en `out` la posicion mundial de la articulacion y devuelve true si se pudo leer. */
export function jointWorld(renderer, player, handedness, jointName, out) {
  const xr = renderer?.xr;
  const frame = xr?.getFrame?.();
  const session = xr?.getSession?.();
  const space = xr?.getReferenceSpace?.();
  if (!frame || !session || !space || !frame.getJointPose) return false;
  for (const source of session.inputSources) {
    if (source.handedness !== handedness || !source.hand) continue;
    const joint = source.hand.get(jointName);
    if (!joint) return false;
    const pose = frame.getJointPose(joint, space);
    if (!pose) return false;
    const p = pose.transform.position;
    out.set(p.x, p.y, p.z);
    player.localToWorld(out);
    return true;
  }
  return false;
}
