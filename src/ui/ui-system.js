/* Acciona los elementos de la interfaz espacial (UiItem): al pulsarlos llama a su onPress y
   mientras el dedo o el rayo los senala se agrandan un poco (halo de hover de la guia). Los
   elementos ocultos (userData.shown = false) quedan sin volumen para que no se toquen por accidente. */
import { createSystem, Hovered, Pressed } from '@iwsdk/core';
import { sfx } from '../audio/sfx.js';
import { UiItem } from '../components.js';
import { interactionBusy } from '../interaction/carryable-system.js';
import { handsTracked, pokeAllowedOnObject, sampleFingers } from '../interaction/finger.js';

const FINGER_REACH = 0.04; // metros del borde del elemento a la punta del indice para contar como presion
const DIRECT_REACH = 0.015; // contacto: la punta del indice llega a menos de esto de la cara del boton
const DIRECT_REARM = 0.04; // el boton se rearma cuando el dedo se aleja mas que esto
const PRESS_COOLDOWN = 0.22; // segundos entre dos pulsaciones del mismo elemento

export class UiSystem extends createSystem({
  items: { required: [UiItem] },
  pressed: { required: [UiItem, Pressed] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.pressed.subscribe('qualify', (entity) => {
        const object = entity.object3D;
        const data = object?.userData;
        if (!data?.shown || data.cooldown > 0) return;
        // Con manos solo cuenta presionar con el indice; apuntar desde lejos y pellizcar no acciona el boton
        // (salvo los botones marcados `remote`: seleccion a distancia con rayo + pellizco)
        if (!data.remote && !pokeAllowedOnObject(object, data.reach ?? FINGER_REACH, !!data.noPinch)) return;
        this.fire(entity, data);
      }),
    );
  }

  fire(entity, data) {
    data.cooldown = PRESS_COOLDOWN;
    if (!data.silent) sfx.select();
    data.onPress?.(entity);
  }

  update(delta) {
    sampleFingers(this.renderer, this.player);
    for (const entity of this.queries.items.entities) {
      const object = entity.object3D;
      if (!object) continue;
      const data = object.userData;
      if (data.cooldown > 0) data.cooldown -= delta;
      // Contacto directo (manos): el indice de CUALQUIER mano toca el boton. Funciona desde la primera vez, a la izquierda o a la derecha,
      // sin depender de que el SDK registre la pulsacion. El borde de bajada (dedo lejos) rearma el boton.
      if (data.direct && handsTracked()) {
        if (data.shown && pokeAllowedOnObject(object, DIRECT_REACH, true)) {
          if (!data.touching && !(data.cooldown > 0) && !interactionBusy()) {
            data.touching = true;
            this.fire(entity, data);
          }
        } else if (!data.shown || !pokeAllowedOnObject(object, DIRECT_REARM, true)) {
          data.touching = false;
        }
      }
      // Boton del modelo: el nodo del glb se hunde al pulsarlo y se adelanta un poco al pasar el dedo
      if (data.node) {
        const want = entity.hasComponent(Pressed) ? 1 : entity.hasComponent(Hovered) ? -0.25 : 0;
        data.pressK += (want - data.pressK) * Math.min(1, delta * 22);
        data.node.position.copy(data.nodeBase).addScaledVector(data.pressDir, data.pressK * data.pressDepth);
      }
      if (data.noScale) continue;
      let target = 0.0001;
      if (data.shown) {
        target = data.baseScale ?? 1;
        if (entity.hasComponent(Pressed)) target *= 0.94;
        else if (entity.hasComponent(Hovered)) target *= 1.07;
      }
      const k = Math.min(1, delta * 16);
      object.scale.setScalar(object.scale.x + (target - object.scale.x) * k);
    }
  }
}
