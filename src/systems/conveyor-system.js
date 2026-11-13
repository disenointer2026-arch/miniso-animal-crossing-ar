/* Llegada del personaje: sale del arco, la banda lo lleva al centro y se detiene
   mirando al usuario. La banda SOLO se mueve aqui; despues queda quieta. */
import { createSystem } from '@iwsdk/core';
import { AvatarFigure, Machine } from '../components.js';
import { MACHINE } from '../scene-assets/machine.scene-asset.js';
import { hint, phase, Phase } from '../state.js';

const ARRIVAL_SECONDS = 3.4;
const POP_SECONDS = 0.45;
const LIGHT_ON = 0x8cc37a;
const LIGHT_BUSY = 0xf6d365;
const LIGHT_OFF = 0xd9d2c3;

const easeOutCubic = (k) => 1 - (1 - k) ** 3;
const easeOutBack = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export class ConveyorSystem extends createSystem({
  machines: { required: [Machine] },
  avatars: { required: [AvatarFigure] },
}) {
  update(delta, time) {
    for (const machine of this.queries.machines.entities) {
      if (machine.getValue(Machine, 'arrived')) continue;
      const parts = machine.object3D?.userData.parts;
      if (!parts) continue;

      const previous = machine.getValue(Machine, 'arrivalTime');
      const elapsed = previous + delta;
      machine.setValue(Machine, 'arrivalTime', elapsed);

      const k = Math.min(elapsed / ARRIVAL_SECONDS, 1);
      const x = MACHINE.archX * (1 - easeOutCubic(k));
      const previousK = Math.min(previous / ARRIVAL_SECONDS, 1);
      const dx = x - MACHINE.archX * (1 - easeOutCubic(previousK));

      for (const entity of this.queries.avatars.entities) {
        const figure = entity.object3D;
        if (!figure) continue;
        const pop = easeOutBack(Math.min(elapsed / POP_SECONDS, 1));
        figure.scale.setScalar(Math.max(figure.userData.baseScale * pop, 0.0001));
        // Pequeno traqueteo mientras la banda se mueve
        const rattle = Math.abs(Math.sin(time * 14)) * 0.0025 * (1 - k);
        figure.position.set(x, MACHINE.beltTop + rattle, 0);
        // Viaja de perfil (hacia +X) y gira para quedar de frente al usuario
        figure.rotation.y = (Math.PI / 2) * (1 - smoothstep(0.55, 1, k));
      }

      // La banda y los rodillos avanzan lo mismo que el personaje
      parts.beltMaterial.map.offset.x -= dx * parts.beltMaterial.map.repeat.x;
      for (const roller of parts.rollers) roller.rotation.z -= dx / 0.012;

      // Indicadores: parpadean en secuencia durante el trayecto
      const active = Math.floor(time * 6) % parts.lights.length;
      for (let i = 0; i < parts.lights.length; i++) {
        const on = k >= 1 || i === active;
        const color = k >= 1 ? LIGHT_ON : on ? LIGHT_BUSY : LIGHT_OFF;
        parts.lights[i].material.color.setHex(color);
        parts.lights[i].material.emissive.setHex(on ? color : 0x000000);
        parts.lights[i].material.emissiveIntensity = on ? 0.6 : 0;
      }

      if (k >= 1) {
        machine.setValue(Machine, 'arrived', true);
        hint.value = '';
        phase.value = Phase.Instructions;
      }
    }
  }
}
