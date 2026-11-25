/* Bienvenida: en el navegador el boton entra a la realidad aumentada;
   dentro del visor ("COMENZAR") pasa a ubicar la fabrica con la mano.
   Tambien reinicia el recorrido cuando se sale de la sesion. */
import { createSystem, VisibilityState } from '@iwsdk/core';
import { sfx } from '../audio/sfx.js';
import { touchOnly } from '../interaction/finger.js';
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
      sfx.unlock(); // el navegador exige un gesto antes de reproducir audio
      sfx.select();
      sfx.playMusic();
      const immersive =
        this.world.visibilityState.peek() !== VisibilityState.NonImmersive;
      if (!immersive) this.world.launchXR();
      else if (phase.peek() === Phase.Welcome) phase.value = Phase.Calibrating; // sin reconocimiento de suelo: se ubica la fabrica con las manos
    };
    const onTouch = touchOnly(() => panel, onClick);
    button.addEventListener('click', onTouch);

    this.cleanupFuncs.push(
      () => button.removeEventListener('click', onTouch),
      this.world.visibilityState.subscribe((state) => {
        const is2D = state === VisibilityState.NonImmersive;
        label?.setProperties({ text: is2D ? 'Entrar en RA' : 'COMENZAR' });
        if (is2D) this.reset();
      }),
      phase.subscribe((value) => {
        panel.visible = value === Phase.Welcome;
        if (value === Phase.Welcome) this.disposeFactory(); // tambien al crear otro avatar
      }),
    );
  }

  /** Al salir de la sesion la fabrica se retira: su posicion ya no es valida. */
  reset() {
    this.disposeFactory();
    resetExperience();
  }

  disposeFactory() {
    for (const part of Array.from(this.queries.parts.entities)) {
      part.dispose();
    }
    for (const factory of Array.from(this.queries.factories.entities)) {
      factory.dispose();
    }
  }
}
