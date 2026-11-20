/* Cierre de la fabricacion (fase Finishing -> Choose):
   1. travel  la banda lleva al personaje hasta el final del recorrido
   2. enter   la caja de regalo esta abierta: el personaje salta dentro y se encoge
   3. close   la tapa se cierra
   4. fly     la fabrica se desvanece y la caja viaja al frente del usuario, girando y
              dejando destellos
   5. reveal  la caja se abre y el personaje sale a su figura final
   idle: la figura gira sola (se puede girar con la mano) mientras se elige que hacer.
   El resto del flujo (pedido, tarjeta) coloca la caja y la figura con la senal "showcase". */
import {
  BufferGeometry,
  Color,
  createSystem,
  Float32BufferAttribute,
  Grabbed,
  OneHandGrabbable,
  Points,
  PointsMaterial,
  signal,
  Vector3,
} from '@iwsdk/core';
import { sfx } from '../audio/sfx.js';
import { AvatarFigure, Factory, FactoryPart } from '../components.js';
import { MODEL as FACTORY_MODEL, SLOT, modelPoint, pathPoint, slotPose, slotS, stationSlot } from '../core/layout.js';
import { beltMoving, beltRequest, layout, phase, Phase } from '../state.js';
import { captureFrame, frameYaw, framePoint } from './frame.js';
import { GIFT, createGiftBox } from './gift-box.scene-asset.js';

/** Donde se muestran la caja y la figura (respecto al marco del usuario). Lo cambian los paneles. */
export const showcase = signal({ right: -0.28, forward: 0.65, scale: 1, visible: true });

const T = { enter: 1.3, close: 0.7, fly: 2.0, reveal: 1.6 };
const BOX_SCALE = 1.4;
const AVATAR_SCALE = 1.3;
const SHOWCASE_DROP = -0.45; // altura de la caja respecto a la cabeza
const SPARKS = 90;
const PALETTE = [0xf6d365, 0xf89fad, 0x8cc37a, 0x8fb4e3, 0xffffff].map((c) => new Color(c));

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);

export class FinaleSystem extends createSystem({
  factories: { required: [Factory] },
  avatars: { required: [AvatarFigure] },
  held: { required: [AvatarFigure, Grabbed] },
}) {
  init() {
    this.factory = null;
    this.avatarEntity = null;
    this.box = null;
    this.stage = 'none';
    this.t = 0;
    this.hidden = [];
    this.point = new Vector3();
    this.boxStart = new Vector3();
    this.goal = new Vector3();
    this.current = new Vector3();
    this.tmp = new Vector3();
    this.boxYaw = 0;
    this.targetYaw = 0;
    this.cursor = 0;
    this.createSparks();

    this.cleanupFuncs.push(
      this.queries.factories.subscribe('qualify', (factory) => {
        this.factory = factory;
      }),
      this.queries.factories.subscribe('disqualify', () => this.reset()),
      this.queries.avatars.subscribe('qualify', (entity) => {
        this.avatarEntity = entity;
      }),
      phase.subscribe((value) => {
        if (value === Phase.Finishing) this.begin();
        else if (value === Phase.Customizing && this.stage !== 'none') this.end();
        else if (value === Phase.Welcome) this.reset();
      }),
    );
  }

  reset() {
    this.stage = 'none';
    this.box = null;
    this.hidden.length = 0;
    this.factory = null;
    this.avatarEntity = null;
  }

  createSparks() {
    this.sparkLife = new Float32Array(SPARKS);
    this.sparkVelocity = new Float32Array(SPARKS * 3);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(SPARKS * 3).fill(-50), 3));
    geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(SPARKS * 3).fill(1), 3));
    this.sparks = new Points(
      geometry,
      new PointsMaterial({ size: 0.02, vertexColors: true, transparent: true, depthWrite: false }),
    );
    this.sparks.name = 'finale-sparks';
    this.sparks.frustumCulled = false;
    this.world.createTransformEntity(this.sparks, { persistent: true });
  }

  /** Lanza destellos desde un punto del mundo con una velocidad aproximada. */
  burst(count, origin, speed) {
    const position = this.sparks.geometry.attributes.position;
    const color = this.sparks.geometry.attributes.color;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % SPARKS;
      position.setXYZ(i, origin.x, origin.y, origin.z);
      const c = PALETTE[i % PALETTE.length];
      color.setXYZ(i, c.r, c.g, c.b);
      this.sparkVelocity[i * 3] = (Math.random() - 0.5) * speed;
      this.sparkVelocity[i * 3 + 1] = Math.random() * speed;
      this.sparkVelocity[i * 3 + 2] = (Math.random() - 0.5) * speed;
      this.sparkLife[i] = 0.9 + Math.random() * 0.5;
    }
    color.needsUpdate = true;
  }

  updateSparks(delta) {
    const position = this.sparks.geometry.attributes.position;
    for (let i = 0; i < SPARKS; i++) {
      if (this.sparkLife[i] <= 0) continue;
      this.sparkLife[i] -= delta;
      if (this.sparkLife[i] <= 0) {
        position.setXYZ(i, 0, -50, 0);
        continue;
      }
      this.sparkVelocity[i * 3 + 1] -= 0.8 * delta; // gravedad suave
      position.setXYZ(
        i,
        position.getX(i) + this.sparkVelocity[i * 3] * delta,
        position.getY(i) + this.sparkVelocity[i * 3 + 1] * delta,
        position.getZ(i) + this.sparkVelocity[i * 3 + 2] * delta,
      );
    }
    position.needsUpdate = true;
  }

  begin() {
    const factory = this.factory;
    if (!factory || !this.avatarEntity?.object3D) return;
    // La caja espera al final de la banda (centro de la base de regalo del modelo), mirando al usuario
    const [gx, gy] = FACTORY_MODEL.giftBox;
    const p = modelPoint(layout.peek(), gx, gy, FACTORY_MODEL.beltTop);
    const rotY = Math.atan2(-p.x, -p.z);
    const gift = createGiftBox();
    gift.position.set(p.x, p.y + 0.012, p.z);
    gift.rotation.y = rotY;
    gift.userData.parts.lid.rotation.x = GIFT.openAngle;
    this.box = this.world.createTransformEntity(gift, { parent: factory });
    this.box.addComponent(FactoryPart);
    this.boxStart.set(p.x, p.y + 0.012, p.z);
    this.boxYaw = rotY;
    this.go('travel');
  }

  go(stage) {
    this.stage = stage;
    this.t = 0;
    const factoryObject = this.factory?.object3D;
    if (stage === 'fly' && factoryObject) {
      captureFrame(this.player.head);
      const s = showcase.peek();
      this.goal.copy(factoryObject.worldToLocal(framePoint(this.tmp, s.right, s.forward, SHOWCASE_DROP)));
      this.current.copy(this.boxStart);
      this.targetYaw = frameYaw() - factoryObject.rotation.y;
      // La fabrica se desvanece en destellos; solo quedan la caja y el personaje
      const keep = [this.box?.object3D, this.avatarEntity?.object3D];
      this.hidden.length = 0;
      for (const child of factoryObject.children) {
        if (keep.includes(child) || !child.visible) continue;
        child.visible = false;
        this.hidden.push(child);
      }
      this.box.object3D.getWorldPosition(this.tmp);
      this.burst(40, this.tmp, 0.8);
      sfx.ding();
    }
    if (stage === 'reveal') {
      this.avatarEntity.object3D.visible = true;
      this.box.object3D.getWorldPosition(this.tmp);
      this.burst(60, this.tmp, 1.2);
      sfx.ding();
    }
    if (stage === 'idle') {
      this.avatarEntity.addComponent(OneHandGrabbable, { translate: false });
      phase.value = Phase.Choose;
    }
  }

  update(delta, time) {
    this.updateSparks(delta);
    if (this.stage === 'none') return;
    const figure = this.avatarEntity?.object3D;
    const gift = this.box?.object3D;
    if (!figure || !gift) return;
    this.t += delta;
    const base = figure.userData.baseScale;
    const lid = gift.userData.parts.lid;

    if (this.stage === 'travel') {
      if (!beltMoving.peek() && this.t > 0.3) this.go('enter');
    } else if (this.stage === 'enter') {
      const k = Math.min(this.t / T.enter, 1);
      const e = easeInOut(k);
      pathPoint(layout.peek(), slotS(SLOT.giftBox), 0.003, this.point);
      figure.position.set(
        this.point.x + (this.boxStart.x - this.point.x) * e,
        this.point.y + 0.017 * e + 0.16 * Math.sin(Math.PI * k),
        this.point.z + (this.boxStart.z - this.point.z) * e,
      );
      figure.scale.setScalar(base * (1 - 0.55 * e));
      figure.rotation.y = Math.atan2(this.boxStart.x - this.point.x, this.boxStart.z - this.point.z);
      if (k >= 1) this.go('close');
    } else if (this.stage === 'close') {
      const k = Math.min(this.t / T.close, 1);
      lid.rotation.x = GIFT.openAngle * (1 - easeInOut(k));
      if (k >= 1) {
        figure.visible = false;
        sfx.thunk();
        this.go('fly');
      }
    } else if (this.stage === 'fly') {
      const k = Math.min(this.t / T.fly, 1);
      const e = easeInOut(k);
      gift.position.lerpVectors(this.boxStart, this.goal, e);
      gift.position.y += 0.3 * Math.sin(Math.PI * k);
      gift.scale.setScalar(1 + (BOX_SCALE * showcase.peek().scale - 1) * e);
      gift.rotation.y = this.boxYaw + (this.targetYaw - this.boxYaw) * e + Math.PI * 2 * e;
      gift.getWorldPosition(this.tmp);
      if (Math.random() < 0.6) this.burst(1, this.tmp, 0.5);
      if (k >= 1) {
        this.current.copy(this.goal);
        this.go('reveal');
      }
    } else if (this.stage === 'reveal') {
      const k = Math.min(this.t / T.reveal, 1);
      const e = easeInOut(k);
      const s = showcase.peek().scale;
      lid.rotation.x = GIFT.openAngle * Math.min(this.t / 0.6, 1);
      figure.position.set(
        this.goal.x,
        this.goal.y + GIFT.height * BOX_SCALE * s * (0.4 + 0.6 * e),
        this.goal.z,
      );
      figure.scale.setScalar(base * AVATAR_SCALE * s * (0.25 + 0.75 * e));
      figure.rotation.y += delta * 2;
      if (k >= 1) this.go('idle');
    } else if (this.stage === 'idle') {
      this.follow(delta, figure, gift, base);
    }
  }

  /** La caja y la figura siguen la posicion que piden los paneles (senal "showcase"). */
  follow(delta, figure, gift, base) {
    const factoryObject = this.factory.object3D;
    const s = showcase.peek();
    framePoint(this.tmp, s.right, s.forward, SHOWCASE_DROP);
    this.current.lerp(factoryObject.worldToLocal(this.tmp), 1 - Math.exp(-4 * delta));
    gift.position.copy(this.current);
    gift.scale.setScalar(BOX_SCALE * s.scale);
    gift.rotation.y = this.targetYaw;
    figure.position.set(this.current.x, this.current.y + GIFT.height * BOX_SCALE * s.scale, this.current.z);
    figure.scale.setScalar(base * AVATAR_SCALE * s.scale);
    gift.visible = s.visible;
    figure.visible = s.visible;
    if (this.queries.held.entities.size === 0) figure.rotation.y += delta * 0.7; // mesa giratoria
  }

  /** "Seguir editando": vuelve la fabrica y el personaje regresa a la ultima estacion. */
  end() {
    const figure = this.avatarEntity?.object3D;
    if (this.avatarEntity?.hasComponent(OneHandGrabbable)) {
      this.avatarEntity.removeComponent(OneHandGrabbable);
    }
    this.box?.dispose();
    this.box = null;
    for (const child of this.hidden) child.visible = true;
    this.hidden.length = 0;
    this.stage = 'none';
    if (!figure) return;
    pathPoint(layout.peek(), slotS(SLOT.giftBox), 0.003, this.point);
    figure.position.set(this.point.x, this.point.y, this.point.z);
    figure.scale.setScalar(figure.userData.baseScale);
    figure.rotation.y = slotPose(layout.peek(), SLOT.giftBox).rotY;
    figure.visible = true;
    beltRequest.value = { slot: stationSlot(4) };
  }
}
