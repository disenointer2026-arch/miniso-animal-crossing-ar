/* Animacion de reposo del personaje (respira y se mece con sus huesos). */
import { createSystem } from '@iwsdk/core';
import { AvatarFigure } from '../components.js';

export class AvatarSystem extends createSystem({
  avatars: { required: [AvatarFigure] },
}) {
  update(_delta, time) {
    for (const entity of this.queries.avatars.entities) {
      entity.object3D?.userData.avatar?.update(time);
    }
  }
}
