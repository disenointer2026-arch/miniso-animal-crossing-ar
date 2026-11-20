/* Acciona los elementos de la interfaz espacial (UiItem): al pulsarlos llama a su onPress y
   mientras el dedo o el rayo los senala se agrandan un poco (halo de hover de la guia). Los
   elementos ocultos (userData.shown = false) quedan sin volumen para que no se toquen por accidente. */
import { createSystem, Hovered, Pressed } from '@iwsdk/core';
import { sfx } from '../audio/sfx.js';
import { UiItem } from '../components.js';

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
        data.cooldown = PRESS_COOLDOWN;
        if (!data.silent) sfx.select();
        data.onPress?.(entity);
      }),
    );
  }

  update(delta) {
    for (const entity of this.queries.items.entities) {
      const object = entity.object3D;
      if (!object) continue;
      const data = object.userData;
      if (data.cooldown > 0) data.cooldown -= delta;
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
