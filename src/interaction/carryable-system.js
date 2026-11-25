/* Objetos agarrables de las estaciones (latas, cabellos...). Se agarran con el
   pellizco (OneHandGrabbable de IWSDK); este sistema anade lo que el SDK no hace:
   - Al soltarlos, llama al manejador de su tipo (kind), que puede consumirlos
     (colocarlos en el avatar, tirarlos al bote).
   - Si se sueltan lejos de todo, vuelven solos a su sitio: nunca se pierden. */
import { createSystem, Grabbed, Quaternion, Vector3 } from '@iwsdk/core';
import { Carryable } from '../components.js';

const RETURN_DELAY = 1.4; // segundos quieto antes de volver
const RETURN_RATE = 7; // velocidad del regreso (1/s)
const BOOK_RETURN_DELAY = 12; // el libro de stickers se queda donde se suelta mucho mas tiempo: asi se pasa de una mano a otra

const dropHandlers = new Map();

/** Cuantos objetos se sostienen ahora y cuando se solto el ultimo (segundos). */
let heldCount = 0;
let lastRelease = -10;
const RELEASE_GRACE = 0.9; // despues de soltar, todavia no se puede retirar nada puesto

/** Verdadero mientras se sostiene un objeto (o acaba de soltarse): en ese momento no se debe quitar
    nada de lo ya puesto, para que al colocar una pieza el dedo no retire otra por accidente. */
export const interactionBusy = () => heldCount > 0 || performance.now() / 1000 - lastRelease < RELEASE_GRACE;

/** Agarres propios (con el seguimiento de manos, sin el sistema de agarre del SDK): cuentan como "mano ocupada" igual que los del SDK. */
export function beginExternalHold() {
  heldCount++;
}
export function endExternalHold() {
  heldCount = Math.max(0, heldCount - 1);
  lastRelease = performance.now() / 1000;
}

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
    heldCount = 0;
    lastRelease = -10;
    this.cleanupFuncs.push(
      this.queries.held.subscribe('qualify', (entity) => {
        heldCount++;
        entity.setValue(Carryable, 'idle', 0);
      }),
      this.queries.held.subscribe('disqualify', (entity) => {
        heldCount = Math.max(0, heldCount - 1);
        lastRelease = performance.now() / 1000;
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
      if (idle < (entity.getValue(Carryable, 'kind') === 'book' ? BOOK_RETURN_DELAY : RETURN_DELAY)) continue;
      const home = entity.getVectorView(Carryable, 'home');
      this.target.set(home[0], home[1], home[2]);
      const k = 1 - Math.exp(-RETURN_RATE * delta);
      object.position.lerp(this.target, k);
      this.rotation.setFromAxisAngle(this.axis, entity.getValue(Carryable, 'homeYaw'));
      object.quaternion.slerp(this.rotation, k);
    }
  }
}
