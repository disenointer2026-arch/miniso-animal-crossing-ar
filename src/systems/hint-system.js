/* Indicacion breve (panel UIKitML) que acompana la mirada del usuario.
   Cualquier sistema la cambia escribiendo en la senal "hint". */
import { createSystem, FollowBehavior, Follower } from '@iwsdk/core';
import { hint } from '../state.js';

export class HintSystem extends createSystem({}) {
  init() {
    let disposed = false;
    this.cleanupFuncs.push(() => {
      disposed = true;
    });

    this.world.assets.instantiate('hint-panel').then((panel) => {
      if (disposed) return;
      panel.scale.setScalar(0.1);
      panel.visible = false;
      const entity = this.world.createTransformEntity(panel, { persistent: true });
      entity.addComponent(Follower, {
        target: this.player.head,
        offsetPosition: [0, -0.16, -0.75],
        behavior: FollowBehavior.FaceTarget,
        maxAngle: 22,
        tolerance: 0.12,
        speed: 3,
      });
      const text = panel.getElementById('hint-text');
      this.cleanupFuncs.push(
        hint.subscribe((value) => {
          panel.visible = value !== '';
          if (value) text?.setProperties({ text: value });
        }),
      );
    });
  }
}
