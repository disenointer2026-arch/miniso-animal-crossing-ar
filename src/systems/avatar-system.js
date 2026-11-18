/* El personaje: animacion de reposo (respira y se mece con sus huesos) y reflejo
   de avatarConfig, la fuente de verdad, en el modelo. */
import { createSystem } from '@iwsdk/core';
import { AvatarFigure } from '../components.js';
import { avatarConfig } from '../state.js';

export class AvatarSystem extends createSystem({
  avatars: { required: [AvatarFigure] },
}) {
  init() {
    this.cleanupFuncs.push(
      avatarConfig.subscribe((config) => {
        for (const entity of this.queries.avatars.entities) {
          entity.object3D?.userData.avatar?.sync(config);
        }
      }),
    );
  }

  update(_delta, time) {
    for (const entity of this.queries.avatars.entities) {
      entity.object3D?.userData.avatar?.update(time);
    }
  }
}
