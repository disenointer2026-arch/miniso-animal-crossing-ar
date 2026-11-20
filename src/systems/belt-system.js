/* Banda transportadora del modelo. El personaje sale del edificio MINISO, recorre la linea
   central de la banda (src/core/layout.js), para en la estacion 1 y luego va de una estacion a
   otra cuando cambia la estacion activa (botones anterior / siguiente) o se pide con
   beltRequest. Mientras viaja mira hacia donde avanza; al llegar gira hacia el usuario. El
   usuario nunca empuja la banda.
   Los campos angle/from/to del componente AvatarFigure guardan la distancia recorrida (s) a
   lo largo de la banda, en unidades del modelo. */
import { createSystem } from '@iwsdk/core';
import { Avatar } from '../avatar/avatar.js';
import { AvatarFigure, Factory, FactoryPart } from '../components.js';
import {
  SLOT,
  lerpAngle,
  modelScale,
  pathHeading,
  pathPoint,
  slotPose,
  slotS,
  stationSlot,
} from '../core/layout.js';
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

/** Altura del personaje sobre la banda, en metros. La maquina de cabello cuelga sobre la banda:
    el personaje tiene que caber debajo. */
export const AVATAR_HEIGHT = 0.18;

const BELT_SPEED = 0.4; // metros por segundo
const MIN_SECONDS = 1.8;
const MAX_SECONDS = 5.5;
const POP_SECONDS = 0.45;

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
    this.facing = 0; // giro con el que termina el trayecto en curso
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

  /** Segundos que tarda en recorrer una distancia (unidades del modelo). */
  secondsFor(distance) {
    const meters = Math.abs(distance) * modelScale(layout.peek());
    return Math.min(Math.max(meters / BELT_SPEED, MIN_SECONDS), MAX_SECONDS);
  }

  createAvatar(factory) {
    const avatar = new Avatar(avatarConfig.peek()).build();
    avatar.root.userData.avatar = avatar;
    avatar.root.userData.baseScale = AVATAR_HEIGHT / MODEL.height;
    avatar.root.scale.setScalar(0.0001);
    const slot = stationSlot(categoryIndex.peek()); // al recalibrar vuelve a la estacion donde estaba
    const start = slotS(SLOT.portal);
    const to = slotS(slot);
    this.facing = slotPose(layout.peek(), slot).rotY;
    this.place(avatar.root, start, 0);
    const entity = this.world.createTransformEntity(avatar.root, { parent: factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(AvatarFigure, {
      angle: start,
      from: start,
      to,
      duration: this.secondsFor(to - start),
      moving: true,
      entering: true,
    });
    beltMoving.value = true;
  }

  /** Lleva al personaje al slot indicado, si no esta ya ahi. */
  moveTo(slot) {
    for (const entity of this.queries.avatars.entities) {
      const from = entity.getValue(AvatarFigure, 'angle');
      const to = slotS(slot);
      if (Math.abs(to - from) < 1e-3) continue;
      this.facing = slotPose(layout.peek(), slot).rotY;
      entity.setValue(AvatarFigure, 'from', from);
      entity.setValue(AvatarFigure, 'to', to);
      entity.setValue(AvatarFigure, 'elapsed', 0);
      entity.setValue(AvatarFigure, 'duration', this.secondsFor(to - from));
      entity.setValue(AvatarFigure, 'moving', true);
      beltMoving.value = true;
    }
  }

  /** Posiciona la figura sobre la banda, a la distancia s (sistema local de la fabrica). */
  place(figure, s, lift) {
    pathPoint(layout.peek(), s, 0.003 + lift, this.point);
    figure.position.set(this.point.x, this.point.y, this.point.z);
  }

  update(delta, time) {
    for (const entity of this.queries.avatars.entities) {
      const figure = entity.object3D;
      if (!figure || !entity.getValue(AvatarFigure, 'moving')) continue;

      const elapsed = entity.getValue(AvatarFigure, 'elapsed') + delta;
      const duration = entity.getValue(AvatarFigure, 'duration');
      const from = entity.getValue(AvatarFigure, 'from');
      const to = entity.getValue(AvatarFigure, 'to');
      const k = Math.min(elapsed / duration, 1);
      const s = from + (to - from) * easeInOut(k);
      entity.setValue(AvatarFigure, 'elapsed', elapsed);
      entity.setValue(AvatarFigure, 'angle', s);

      const base = figure.userData.baseScale;
      const pop = entity.getValue(AvatarFigure, 'entering')
        ? easeOutBack(Math.min(elapsed / POP_SECONDS, 1))
        : 1;
      figure.scale.setScalar(Math.max(base * pop, 0.0001));
      // Pequeno traqueteo mientras la banda se mueve
      this.place(figure, s, Math.abs(Math.sin(time * 14)) * 0.0025 * (1 - k));
      // Viaja mirando hacia donde avanza y gira hacia el usuario al llegar
      const heading = pathHeading(s, Math.sign(to - from) || 1);
      figure.rotation.y = lerpAngle(heading, this.facing, smoothstep(0.6, 1, k));

      if (k >= 1) this.arrive(entity);
    }
  }

  arrive(entity) {
    const figure = entity.object3D;
    const s = entity.getValue(AvatarFigure, 'to');
    entity.setValue(AvatarFigure, 'moving', false);
    entity.setValue(AvatarFigure, 'entering', false);
    entity.setValue(AvatarFigure, 'angle', s);
    this.place(figure, s, 0);
    figure.scale.setScalar(figure.userData.baseScale);
    figure.rotation.y = this.facing;
    beltMoving.value = false;
    if (phase.peek() === Phase.Arriving) {
      hint.value = '';
      phase.value = instructionsSeen.peek() ? Phase.Customizing : Phase.Instructions;
    }
  }
}
