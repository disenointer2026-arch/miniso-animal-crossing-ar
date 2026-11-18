/* Banda transportadora en arco. El personaje sale del portal, para en la
   estacion 1 y luego va de una estacion a otra cuando cambia la estacion activa
   (botones anterior / siguiente). Solo se mueve la banda durante el trayecto;
   el usuario nunca la empuja. */
import { createSystem } from '@iwsdk/core';
import { Avatar } from '../avatar/avatar.js';
import { AvatarFigure, Factory, FactoryPart } from '../components.js';
import { SLOT, arcPoint, slotAngle, stationSlot } from '../core/layout.js';
import { MODEL } from '../data/avatar-defaults.js';
import {
  avatarConfig,
  beltMoving,
  beltRequest,
  categoryIndex,
  hint,
  instructionsSeen,
  layout,
  phase,
  Phase,
} from '../state.js';

/** Altura del personaje sobre la banda, en metros. */
export const AVATAR_HEIGHT = 0.25;

const SECONDS_PER_SLOT = 2.2;
const ENTRANCE_SECONDS = 3.2;
const POP_SECONDS = 0.45;
const LIGHT_ON = 0x8cc37a;
const LIGHT_BUSY = 0xf6d365;
const LIGHT_OFF = 0xd9d2c3;

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
const easeOutBack = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;
const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export class BeltSystem extends createSystem({
  factories: { required: [Factory] },
  avatars: { required: [AvatarFigure] },
}) {
  init() {
    this.point = { x: 0, y: 0, z: 0 };
    this.factory = null;
    this.cleanupFuncs.push(
      this.queries.factories.subscribe('qualify', (factory) => {
        this.factory = factory;
        this.createAvatar(factory);
      }),
      this.queries.factories.subscribe('disqualify', () => {
        this.factory = null;
      }),
      beltRequest.subscribe((request) => {
        if (request) this.moveTo(request.slot);
      }),
      categoryIndex.subscribe((index) => {
        if (phase.peek() === Phase.Customizing) this.moveTo(stationSlot(index));
      }),
    );
  }

  createAvatar(factory) {
    const avatar = new Avatar(avatarConfig.peek()).build();
    avatar.root.userData.avatar = avatar;
    avatar.root.userData.baseScale = AVATAR_HEIGHT / MODEL.height;
    avatar.root.scale.setScalar(0.0001);
    const start = slotAngle(SLOT.portal);
    this.place(avatar.root, start, 0);
    const entity = this.world.createTransformEntity(avatar.root, { parent: factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(AvatarFigure, {
      angle: start,
      from: start,
      to: slotAngle(stationSlot(categoryIndex.peek())), // al recalibrar vuelve a la estacion donde estaba
      duration: ENTRANCE_SECONDS,
      moving: true,
      entering: true,
    });
    beltMoving.value = true;
  }

  /** Lleva al personaje al slot indicado, si no esta ya ahi. */
  moveTo(slot) {
    for (const entity of this.queries.avatars.entities) {
      const from = entity.getValue(AvatarFigure, 'angle');
      const to = slotAngle(slot);
      if (Math.abs(to - from) < 1e-3) continue;
      entity.setValue(AvatarFigure, 'from', from);
      entity.setValue(AvatarFigure, 'to', to);
      entity.setValue(AvatarFigure, 'elapsed', 0);
      entity.setValue(AvatarFigure, 'duration', SECONDS_PER_SLOT);
      entity.setValue(AvatarFigure, 'moving', true);
      beltMoving.value = true;
    }
  }

  /** Posiciona la figura sobre la banda (sistema local de la fabrica). */
  place(figure, theta, lift) {
    arcPoint(layout.peek(), theta, 0, 0.003 + lift, this.point);
    figure.position.set(this.point.x, this.point.y, this.point.z);
  }

  /** Lamparas de estacion: parpadean en el trayecto; en reposo marca la activa. */
  setLights(factory, moving, time) {
    const lights = factory.object3D?.userData.parts?.lights;
    if (!lights) return;
    const blink = Math.floor(time * 6) % lights.length;
    lights.forEach((lamp, i) => {
      const on = moving ? i === blink : i === categoryIndex.peek();
      const color = moving ? LIGHT_BUSY : on ? LIGHT_ON : LIGHT_OFF;
      lamp.material.color.setHex(color);
      lamp.material.emissive.setHex(on ? color : 0x000000);
      lamp.material.emissiveIntensity = on ? 0.6 : 0;
    });
  }

  update(delta, time) {
    for (const entity of this.queries.avatars.entities) {
      const figure = entity.object3D;
      if (!figure || !entity.getValue(AvatarFigure, 'moving')) continue;
      const factory = this.factory;
      const parts = factory?.object3D?.userData.parts;

      const elapsed = entity.getValue(AvatarFigure, 'elapsed') + delta;
      const duration = entity.getValue(AvatarFigure, 'duration');
      const from = entity.getValue(AvatarFigure, 'from');
      const to = entity.getValue(AvatarFigure, 'to');
      const k = Math.min(elapsed / duration, 1);
      const angle = from + (to - from) * easeInOut(k);
      const previous = entity.getValue(AvatarFigure, 'angle');
      entity.setValue(AvatarFigure, 'elapsed', elapsed);
      entity.setValue(AvatarFigure, 'angle', angle);

      // Las franjas de la banda avanzan lo mismo que el personaje
      if (parts) {
        const radius = layout.peek().beltRadius;
        parts.beltMaterial.map.offset.x -= ((angle - previous) * radius) / parts.beltTile;
      }

      const base = figure.userData.baseScale;
      const pop = entity.getValue(AvatarFigure, 'entering')
        ? easeOutBack(Math.min(elapsed / POP_SECONDS, 1))
        : 1;
      figure.scale.setScalar(Math.max(base * pop, 0.0001));
      // Pequeno traqueteo mientras la banda se mueve
      this.place(figure, angle, Math.abs(Math.sin(time * 14)) * 0.0025 * (1 - k));
      // Viaja de perfil y gira para quedar de frente al usuario al llegar
      const direction = Math.sign(to - from);
      figure.rotation.y = -angle + direction * (Math.PI / 2) * (1 - smoothstep(0.6, 1, k));
      if (factory) this.setLights(factory, true, time);

      if (k >= 1) this.arrive(entity, factory, time);
    }
  }

  arrive(entity, factory, time) {
    const figure = entity.object3D;
    const angle = entity.getValue(AvatarFigure, 'to');
    entity.setValue(AvatarFigure, 'moving', false);
    entity.setValue(AvatarFigure, 'entering', false);
    entity.setValue(AvatarFigure, 'angle', angle);
    this.place(figure, angle, 0);
    figure.scale.setScalar(figure.userData.baseScale);
    figure.rotation.y = -angle;
    if (factory) this.setLights(factory, false, time);
    beltMoving.value = false;
    if (phase.peek() === Phase.Arriving) {
      hint.value = '';
      phase.value = instructionsSeen.peek() ? Phase.Customizing : Phase.Instructions;
    }
  }
}
