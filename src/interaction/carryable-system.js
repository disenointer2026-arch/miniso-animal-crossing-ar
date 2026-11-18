/* Objetos agarrables de las estaciones (latas, cabellos...). Se agarran con el
   pellizco (OneHandGrabbable de IWSDK); este sistema anade lo que el SDK no hace:
   - Al soltarlos, llama al manejador de su tipo (kind), que puede consumirlos
     (colocarlos en el avatar, tirarlos al bote).
   - Si se sueltan lejos de todo, vuelven solos a su sitio: nunca se pierden. */
import { createSystem, Grabbed, Quaternion, Vector3 } from '@iwsdk/core';
import { Carryable } from '../components.js';

const RETURN_DELAY = 1.4; // segundos quieto antes de volver
const RETURN_RATE = 7; // velocidad del regreso (1/s)

const dropHandlers = new Map();

/** Registra que hacer al soltar un objeto de este tipo. Devuelve como quitarlo. */
export function registerDropHandler(kind, handler) {
  dropHandlers.set(kind, handler);
  return () => dropHandlers.delete(kind);
}

export class CarryableSystem extends createSystem({
  resting: { required: [Carryable], excluded: [Grabbed] },
  held: { required: [Carryable, Grabbed] },
}) {
  init() {
    this.target = new Vector3();
    this.rotation = new Quaternion();
    this.axis = new Vector3(0, 1, 0);
    this.cleanupFuncs.push(
      this.queries.held.subscribe('qualify', (entity) => {
        entity.setValue(Carryable, 'idle', 0);
      }),
      this.queries.held.subscribe('disqualify', (entity) => {
        if (!entity.active) return;
        entity.setValue(Carryable, 'idle', 0);
        dropHandlers.get(entity.getValue(Carryable, 'kind'))?.(entity);
      }),
    );
  }

  update(delta) {
    for (const entity of this.queries.resting.entities) {
      if (entity.getValue(Carryable, 'locked')) continue;
      const object = entity.object3D;
      if (!object) continue;
      const idle = entity.getValue(Carryable, 'idle') + delta;
      entity.setValue(Carryable, 'idle', idle);
      if (idle < RETURN_DELAY) continue;
      const home = entity.getVectorView(Carryable, 'home');
      this.target.set(home[0], home[1], home[2]);
      const k = 1 - Math.exp(-RETURN_RATE * delta);
      object.position.lerp(this.target, k);
      this.rotation.setFromAxisAngle(this.axis, entity.getValue(Carryable, 'homeYaw'));
      object.quaternion.slerp(this.rotation, k);
    }
  }
}
