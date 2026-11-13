/* Bienvenida: en el navegador el boton entra a la realidad aumentada;
   dentro del visor ("COMENZAR") inicia el reconocimiento de la superficie.
   Tambien reinicia el recorrido cuando se sale de la sesion. */
import { createSystem, VisibilityState } from '@iwsdk/core';
import { Machine, MachinePart } from '../components.js';
import { phase, Phase, resetExperience } from '../state.js';

export class WelcomeSystem extends createSystem({
  machines: { required: [Machine] },
  parts: { required: [MachinePart] },
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
      else if (phase.peek() === Phase.Welcome) phase.value = Phase.Placing;
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

  /** Al salir de la sesion, la maquina se retira: su posicion ya no es valida. */
  reset() {
    for (const part of Array.from(this.queries.parts.entities)) {
      part.dispose();
    }
    for (const machine of Array.from(this.queries.machines.entities)) {
      machine.dispose();
    }
    resetExperience();
  }
}
