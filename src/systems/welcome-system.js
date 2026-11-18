/* Bienvenida: en el navegador el boton entra a la realidad aumentada;
   dentro del visor ("COMENZAR") inicia el reconocimiento del piso.
   Tambien reinicia el recorrido cuando se sale de la sesion. */
import { createSystem, VisibilityState } from '@iwsdk/core';
import { Factory, FactoryPart } from '../components.js';
import { phase, Phase, resetExperience } from '../state.js';

export class WelcomeSystem extends createSystem({
  factories: { required: [Factory] },
  parts: { required: [FactoryPart] },
}) {
  init() {
    const panel = this.world.getSceneObject('welcome-panel');
    const button = panel?.getElementById('start-button');
    const label = panel?.getElementById('start-label');
    if (!panel || !button) {
      console.warn('[bienvenida] No se encontro el panel o su boton');
      return;
    }

    const onClick = () => {
      const immersive =
        this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
      if (!immersive) this.world.launchXR();
      else if (phase.peek() === Phase.Welcome) phase.value = Phase.Space;
    };
    button.addEventListener('click', onClick);

    this.cleanupFuncs.push(
      () => button.removeEventListener('click', onClick),
      this.world.visibilityState.subscribe((state) => {
        const is2D = state === VisibilityState.NonImmersive;
        label?.setProperties({ text: is2D ? 'Entrar en RA' : 'COMENZAR' });
        if (is2D) this.reset();
      }),
      phase.subscribe((value) => {
        panel.visible = value === Phase.Welcome;
      }),
    );
  }

  /** Al salir de la sesion la fabrica se retira: su posicion ya no es valida. */
  reset() {
    for (const part of Array.from(this.queries.parts.entities)) {
      part.dispose();
    }
    for (const factory of Array.from(this.queries.factories.entities)) {
      factory.dispose();
    }
    resetExperience();
  }
}
