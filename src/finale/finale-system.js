/* Cierre de la fabricacion (fase Finishing -> Choose):
   1. travel  la banda lleva al personaje hasta el final del recorrido
   2. enter   la bolsa MINISO espera abierta: el personaje salta por ENCIMA de su borde, queda sobre la boca y baja
              en vertical hasta apoyarse en el fondo (asoma la cabeza); nunca cruza las paredes
   3. close   la bolsa da un saltito de contenta
   4. fly     la fabrica se desvanece y la bolsa, con el personaje dentro, viaja al frente del usuario,
              girando y dejando destellos
   5. reveal  el personaje sale de la bolsa: sube por encima del borde, se aparta hacia el usuario creciendo y baja a su sitio
   idle: la figura flota delante de la bolsa (que queda detras, de fondo y sin tocarla) y gira sola (se puede girar con la
         mano) mientras se elige que hacer.
   El resto del flujo (pedido, tarjeta) coloca la bolsa y la figura con la senal "showcase". */
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
import { avatarHeight } from '../systems/belt-system.js';
import { createBag } from './bag.scene-asset.js';

/** Donde se muestran la caja y la figura (respecto al marco del usuario). Lo cambian los paneles. */
export const showcase = signal({ right: -0.28, forward: 0.65, scale: 1, visible: true });

const T = { enter: 1.9, close: 0.7, fly: 2.0, reveal: 2.4 };
const BOX_SCALE = 1.4;
const FINAL_HEIGHT = 0.36; // altura del personaje en la presentacion final (m): cerca del alto del panel de opciones
const BAG_BACK = 0.28; // la bolsa queda tanto mas atras que el personaje (m): fondo decorativo, sin tocarlo al girar
const AVATAR_FLOAT = 0.03; // el personaje flota apenas sobre la base de la bolsa
const RIM_CLEAR = 0.035; // holgura sobre el borde de la bolsa al entrar y salir (m, a escala de la bolsa)
const INSIDE_SCALE = 0.9; // el personaje dentro de la bolsa: la cabeza asoma por la boca
const SHOWCASE_DROP = -0.45; // altura de la caja respecto a la cabeza
const SPARKS = 90;
const PALETTE = [0xf6d365, 0xf89fad, 0x8cc37a, 0x8fb4e3, 0xffffff].map((c) => new Color(c));

const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2);
/** Avance suave de 0 a 1 mientras k recorre [a, b]. */
const span = (k, a, b) => easeInOut(Math.min(Math.max((k - a) / (b - a), 0), 1));

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
    this.goal = new Vector3(); // bolsa
    this.current = new Vector3();
    this.avatarGoal = new Vector3(); // personaje en la presentacion
    this.avatarCurrent = new Vector3();
    this.tmp = new Vector3();
    this.boxYaw = 0;
    this.targetYaw = 0;
    this.cursor = 0;
    this.createSparks();
    if (import.meta.env.DEV && window.__miniso) window.__miniso.finale = this; // solo desarrollo: para ubicar la bolsa en las pruebas

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
    // La bolsa espera al final de la banda (centro de la base de regalo del modelo), con el logo hacia el usuario
    const [gx, gy] = FACTORY_MODEL.giftBox;
    const p = modelPoint(layout.peek(), gx, gy, FACTORY_MODEL.beltTop);
    const rotY = Math.atan2(-p.x, -p.z);
    const gift = createBag(layout.peek());
    gift.position.set(p.x, p.y + 0.012, p.z);
    gift.rotation.y = rotY;
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
      this.goal.copy(factoryObject.worldToLocal(framePoint(this.tmp, s.right, s.forward + BAG_BACK * s.scale, SHOWCASE_DROP)));
      this.avatarGoal.copy(factoryObject.worldToLocal(framePoint(this.tmp, s.right, s.forward, SHOWCASE_DROP + AVATAR_FLOAT)));
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
    const rim = gift.userData.rim;
    const floor = gift.userData.floor;

    if (this.stage === 'travel') {
      if (!beltMoving.peek() && this.t > 0.3) this.go('enter');
    } else if (this.stage === 'enter') {
      // Del fondo de la banda a la bolsa SIN cruzar sus paredes: sube por encima del borde (0-35 %), avanza hasta quedar
      // sobre la boca (20-65 %) y baja en vertical hasta apoyarse en el fondo (68-100 %)
      const k = Math.min(this.t / T.enter, 1);
      pathPoint(layout.peek(), slotS(SLOT.giftBox), 0.003, this.point);
      const over = this.boxStart.y + rim + RIM_CLEAR; // los pies pasan por encima del borde
      const inside = this.boxStart.y + floor;
      const up = span(k, 0, 0.35);
      const across = span(k, 0.2, 0.65);
      const down = span(k, 0.68, 1);
      const y = k < 0.68 ? this.point.y + (over - this.point.y) * up : over + (inside - over) * down;
      figure.position.set(
        this.point.x + (this.boxStart.x - this.point.x) * across,
        y,
        this.point.z + (this.boxStart.z - this.point.z) * across,
      );
      figure.scale.setScalar(base * (1 - (1 - INSIDE_SCALE) * across));
      figure.rotation.y = Math.atan2(this.boxStart.x - this.point.x, this.boxStart.z - this.point.z);
      if (k >= 1) this.go('close');
    } else if (this.stage === 'close') {
      // La bolsa se aplasta un poquito y rebota (saltito de contenta)
      const k = Math.min(this.t / T.close, 1);
      gift.scale.set(1 + 0.05 * Math.sin(Math.PI * k), 1 - 0.07 * Math.sin(Math.PI * k), 1 + 0.05 * Math.sin(Math.PI * k));
      figure.scale.setScalar(base * INSIDE_SCALE * (1 - 0.07 * Math.sin(Math.PI * k)));
      if (k >= 1) {
        gift.scale.setScalar(1);
        sfx.thunk();
        this.go('fly');
      }
    } else if (this.stage === 'fly') {
      const k = Math.min(this.t / T.fly, 1);
      const e = easeInOut(k);
      gift.position.lerpVectors(this.boxStart, this.goal, e);
      gift.position.y += 0.3 * Math.sin(Math.PI * k);
      const g = 1 + (BOX_SCALE * showcase.peek().scale - 1) * e;
      gift.scale.setScalar(g);
      gift.rotation.y = this.boxYaw + (this.targetYaw - this.boxYaw) * e + Math.PI * 2 * e;
      // El personaje va dentro de la bolsa: se mueve, gira y crece con ella
      figure.position.set(gift.position.x, gift.position.y + floor * g, gift.position.z);
      figure.scale.setScalar(base * INSIDE_SCALE * g);
      figure.rotation.y = gift.rotation.y;
      gift.getWorldPosition(this.tmp);
      if (Math.random() < 0.6) this.burst(1, this.tmp, 0.5);
      if (k >= 1) {
        this.current.copy(this.goal);
        this.go('reveal');
      }
    } else if (this.stage === 'reveal') {
      // Sale de la bolsa: sube en vertical por encima del borde (0-30 %), se aparta hacia el usuario creciendo mientras
      // sigue por encima del borde (30-70 %) y baja a su sitio, delante de la bolsa (70-100 %)
      const k = Math.min(this.t / T.reveal, 1);
      const s = showcase.peek().scale;
      const g = BOX_SCALE * s;
      const insideY = this.goal.y + floor * g;
      const topY = this.goal.y + rim * g + RIM_CLEAR * g;
      const final = this.avatarGoal;
      const rise = span(k, 0, 0.3);
      const out = span(k, 0.3, 0.7);
      const drop = span(k, 0.7, 1);
      const y = k < 0.7 ? insideY + (Math.max(topY, final.y) - insideY) * rise : Math.max(topY, final.y) + (final.y - Math.max(topY, final.y)) * drop;
      figure.position.set(this.goal.x + (final.x - this.goal.x) * out, y, this.goal.z + (final.z - this.goal.z) * out);
      const insideScale = INSIDE_SCALE * g;
      const finalScale = this.finalScale(base) * s;
      figure.scale.setScalar(base * (insideScale + (finalScale - insideScale) * out));
      figure.rotation.y += delta * 2;
      if (k >= 1) {
        this.avatarCurrent.copy(final);
        this.go('idle');
      }
    } else if (this.stage === 'idle') {
      this.follow(delta, figure, gift, base, time);
    }
  }

  /** Escala del personaje (respecto a su tamano en la banda) para medir FINAL_HEIGHT en la presentacion. */
  finalScale() {
    return FINAL_HEIGHT / avatarHeight(layout.peek());
  }

  /** La bolsa (de fondo) y el personaje (delante, flotando) siguen la posicion que piden los paneles (senal "showcase"). */
  follow(delta, figure, gift, base, time) {
    const factoryObject = this.factory.object3D;
    const s = showcase.peek();
    const k = 1 - Math.exp(-4 * delta);
    framePoint(this.tmp, s.right, s.forward + BAG_BACK * s.scale, SHOWCASE_DROP);
    this.current.lerp(factoryObject.worldToLocal(this.tmp), k);
    gift.position.copy(this.current);
    gift.scale.setScalar(BOX_SCALE * s.scale);
    gift.rotation.y = this.targetYaw;
    framePoint(this.tmp, s.right, s.forward, SHOWCASE_DROP + AVATAR_FLOAT);
    this.avatarCurrent.lerp(factoryObject.worldToLocal(this.tmp), k);
    figure.position.set(this.avatarCurrent.x, this.avatarCurrent.y + Math.sin(time * 1.8) * 0.008, this.avatarCurrent.z);
    figure.scale.setScalar(base * this.finalScale() * s.scale);
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
