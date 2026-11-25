/* Estacion 1: color de piel.
   1. Los doce botones redondos de la pantalla del modelo (nodos btn_piel_1 .. btn_piel_12) son pulsables: elegir un
      tono hace caer una lata de ese color junto al personaje.
   2. La lata (modelo del equipo, con la textura del tono) se agarra con UNA MANO como un aerosol de verdad. Con el
      seguimiento de manos (Quest 3): se cierra la mano alrededor de la lata (medio, anular y menique flexionados; la
      palma la rodea) y la lata queda sujeta con el eje a lo largo de la palma (de menique a indice), la valvula hacia
      el lado del indice y la boquilla al frente. Abrir la mano la suelta al instante y la lata cae a su sitio. Con controles se agarra con el pellizco
      (OneHandGrabbable) como antes.
   3. El aerosol se acciona FLEXIONANDO EL INDICE de la misma mano sobre la VALVULA (el boton de arriba): sale pintura
      (particulas + sonido) y, si la boquilla apunta al personaje, su color se mezcla poco a poco con el de la lata.
      Acercar la mano o tener el indice estirado no la activa. Al llegar, queda guardado en avatarConfig; se puede
      repetir con otro tono. Con controles el gatillo de la mano que sostiene la lata hace de dedo. */
import {
  BufferGeometry,
  Color,
  createSystem,
  Float32BufferAttribute,
  GrabSystem,
  Grabbed,
  Matrix4,
  OneHandGrabbable,
  Points,
  PointsMaterial,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import { sfx } from '../../audio/sfx.js';
import { AvatarFigure, Carryable, Factory, FactoryPart, SprayCan } from '../../components.js';
import { modelFrame, modelScale } from '../../core/layout.js';
import { ANCHORS } from '../../factory/anchors.js';
import { jointWorld } from '../../interaction/hand-joints.js';
import { addModelButton } from '../../factory/model-nodes.js';
import {
  avatarConfig,
  beltMoving,
  categoryIndex,
  layout,
  phase,
  Phase,
  select,
  selection,
  setAvatar,
} from '../../state.js';
import { avatarHeight } from '../../systems/belt-system.js';
import { SKIN_TONES } from '../../data/categories.js';
import { CAN_NOZZLE, CAN_VALVE, createSprayCan } from './skin-props.scene-asset.js';

const STATION = 0;
const SLOT = 1; // slot de la banda de esta estacion
const DROP_HEIGHT = 0.25;
const FALL_SECONDS = 0.5;
const SPRAY_RANGE = 0.45; // metros de la boquilla al personaje
const SPRAY_CONE = 0.95; // radianes de tolerancia al apuntar
const PAINT_TIME = 0.8; // segundos para mezclar casi todo el color
const PRESS_RADIUS = 0.055; // distancia de la punta del indice a la valvula para pulsarla
// Agarre anatomico (distancias en metros, de la punta de cada dedo al centro de la palma)
const CURL_CLOSE = 0.088; // un dedo esta flexionado (envolviendo la lata) por debajo de esto
const CURL_OPEN = 0.115; // y se considera abierto por encima de esto (histeresis)
const RELEASE_HOLD = 0; // segundos con la mano abierta antes de soltar la lata: en cuanto se abre, se suelta
const GRASP_REACH = 0.09; // distancia maxima de la palma al eje de la lata para poder agarrarla
const INDEX_BENT = 0.078; // el indice esta flexionado si su punta queda a menos de esto del nudillo (estirado mide ~0,09)
const HOLD_OFFSET = 0.03; // la lata queda a esta distancia de la palma, hacia el lado de los dedos
const HOLD_SHIFT = -0.01; // y desplazada hacia el menique: la valvula queda justo sobre el nudillo del indice (la punta del indice flexionado no sale de su plano)
const HOLD_RATE = 22; // rapidez con que la lata se acomoda en la mano (1/s)
const HAND_JOINTS = [
  ['wrist', 'wrist'],
  ['indexK', 'index-finger-phalanx-proximal'],
  ['middleK', 'middle-finger-phalanx-proximal'],
  ['pinkyK', 'pinky-finger-phalanx-proximal'],
  ['indexTip', 'index-finger-tip'],
  ['middleTip', 'middle-finger-tip'],
  ['ringTip', 'ring-finger-tip'],
  ['pinkyTip', 'pinky-finger-tip'],
];
const PARTICLES = 60;
const PARTICLE_LIFE = 0.45;

export class SkinStationSystem extends createSystem({
  factories: { required: [Factory] },
  cans: { required: [SprayCan, Carryable] },
  held: { required: [SprayCan, Grabbed] },
  avatars: { required: [AvatarFigure] },
}) {
  init() {
    this.grab = this.world.getSystem(GrabSystem);
    this.factory = null;
    this.buttons = [];
    this.avatar = null;
    this.nozzle = new Vector3();
    this.valve = new Vector3();
    this.tip = new Vector3();
    // Agarre anatomico con seguimiento de manos
    this.hand = { palm: new Vector3(), X: new Vector3(), Y: new Vector3(), Z: new Vector3() };
    for (const [key] of HAND_JOINTS) this.hand[key] = new Vector3();
    this.grip = null; // { entity, side }
    this.openTime = 0; // cuanto lleva la mano sujetando la lata abierta
    this.handsTracked = false;
    this.basis = new Matrix4();
    this.heldQuaternion = new Quaternion();
    this.parentQuaternion = new Quaternion();
    this.holdPoint = new Vector3();
    this.axis = new Vector3();
    this.scratch = new Vector3();
    this.up = new Vector3();
    this.offset = new Vector3();
    this.direction = new Vector3();
    this.target = new Vector3();
    this.toTarget = new Vector3();
    this.current = new Color(avatarConfig.peek().skin);
    this.goal = new Color();
    this.scratchColor = new Color();
    this.goalHex = '';
    this.spraying = false;
    this.lastSkin = selection.peek().skin;
    this.emit = 0;
    this.cursor = 0;
    this.createParticles();
    if (import.meta.env.DEV && window.__miniso) window.__miniso.skin = this; // solo desarrollo: para probar el agarre en el emulador

    this.cleanupFuncs.push(
      this.queries.factories.subscribe('qualify', (factory) => this.build(factory)),
      this.queries.factories.subscribe('disqualify', () => {
        this.factory = null;
        this.buttons = [];
      }),
      this.queries.avatars.subscribe('qualify', (entity) => {
        this.avatar = entity.object3D?.userData.avatar ?? null;
      }),
      this.queries.avatars.subscribe('disqualify', () => {
        this.avatar = null;
      }),
      phase.subscribe(() => this.refreshButtons()),
      beltMoving.subscribe(() => this.refreshButtons()),
      categoryIndex.subscribe(() => this.refreshButtons()),
      selection.subscribe((value) => {
        this.refreshButtons();
        if (value.skin === this.lastSkin) return;
        this.lastSkin = value.skin;
        if (phase.peek() === Phase.Customizing && categoryIndex.peek() === STATION) {
          this.spawnCan(value.skin);
        }
      }),
      avatarConfig.subscribe((config) => {
        if (!this.spraying) this.current.set(config.skin);
      }),
      () => sfx.sprayStop(),
    );
  }

  createParticles() {
    const positions = new Float32Array(PARTICLES * 3).fill(-50);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.velocity = new Float32Array(PARTICLES * 3);
    this.life = new Float32Array(PARTICLES);
    this.material = new PointsMaterial({
      size: 0.02,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.points = new Points(geometry, this.material);
    this.points.name = 'spray-particles';
    this.points.frustumCulled = false;
    this.world.createTransformEntity(this.points, { persistent: true });
  }

  build(factory) {
    this.factory = factory;
    // Los doce botones de la pantalla del modelo
    this.buttons = SKIN_TONES.map((tone, i) => {
      const button = addModelButton(this.world, factory, `btn_piel_${i + 1}`, {
        slot: SLOT,
        depth: 0.006,
        onPress: () => select('skin', tone.id),
      });
      return { button, id: tone.id };
    }).filter((entry) => entry.button);
    this.refreshButtons();
  }

  /** Los botones solo se pulsan cuando esta estacion esta activa; el elegido lleva la insignia roja. */
  refreshButtons() {
    const show = phase.peek() === Phase.Customizing && categoryIndex.peek() === STATION && !beltMoving.peek();
    const chosen = selection.peek().skin;
    for (const { button, id } of this.buttons) {
      button.setShown(show);
      button.setSelected(show && id === chosen);
    }
  }

  /** Cae una lata nueva junto al personaje; la anterior (si habia) se retira. */
  spawnCan(hex) {
    if (!this.factory) return;
    for (const entity of Array.from(this.queries.cans.entities)) {
      this.grab.forceRelease(entity);
      entity.dispose();
    }
    const l = layout.peek();
    const index = SKIN_TONES.findIndex((tone) => tone.id === hex) + 1;
    const home = modelFrame(l, ANCHORS.canHome, 0, 0, 0, SLOT);
    const can = createSprayCan(index || 1, modelScale(l));
    can.position.set(home.x, home.y + DROP_HEIGHT, home.z);
    can.rotation.y = home.rotY; // la boquilla (+Z de la lata) mira al usuario
    can.userData.fall = { t: 0, from: home.y + DROP_HEIGHT, to: home.y };
    const entity = this.world.createTransformEntity(can, { parent: this.factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(SprayCan, { color: hex });
    entity.addComponent(Carryable, {
      kind: 'can',
      locked: true,
      home: [home.x, home.y, home.z],
      homeYaw: home.rotY,
    });
    this.useGrabMode(entity); // con manos se agarra con la mano cerrada; con controles, con el pellizco
    sfx.select();
  }

  updateFalls(delta) {
    for (const entity of this.queries.cans.entities) {
      const object = entity.object3D;
      const fall = object?.userData.fall;
      if (!fall) continue;
      fall.t += delta;
      const k = Math.min(fall.t / FALL_SECONDS, 1);
      object.position.y = fall.from + (fall.to - fall.from) * k * k;
      if (k >= 1) {
        object.userData.fall = null;
        entity.setValue(Carryable, 'locked', false);
        sfx.thunk();
      }
    }
  }

  /** Lee las articulaciones de una mano y calcula su marco: Y = de menique a indice, Z = hacia delante (de la muneca a los
      dedos), X = Y x Z. Devuelve false si esa mano no esta seguida. */
  readHand(side) {
    const h = this.hand;
    for (const [key, name] of HAND_JOINTS) {
      if (!jointWorld(this.renderer, this.player, side, name, h[key])) return false;
    }
    h.palm.copy(h.wrist).add(h.indexK).add(h.middleK).add(h.pinkyK).multiplyScalar(0.25);
    h.Y.subVectors(h.indexK, h.pinkyK).normalize();
    h.Z.subVectors(h.middleK, h.wrist);
    h.Z.addScaledVector(h.Y, -h.Z.dot(h.Y)).normalize();
    h.X.crossVectors(h.Y, h.Z);
    return true;
  }

  /** Cuantos dedos (medio, anular, menique) envuelven algo: su punta esta cerca de la palma. `limit` = CURL_CLOSE o CURL_OPEN. */
  curledFingers(limit) {
    const h = this.hand;
    return (
      (h.palm.distanceTo(h.middleTip) < limit ? 1 : 0) +
      (h.palm.distanceTo(h.ringTip) < limit ? 1 : 0) +
      (h.palm.distanceTo(h.pinkyTip) < limit ? 1 : 0)
    );
  }

  /** Con manos la lata no usa el pellizco (ocupa el indice): se quita OneHandGrabbable y la lata se agarra con la mano cerrada.
      Con controles se conserva el agarre del SDK. */
  useGrabMode(entity) {
    const has = entity.hasComponent(OneHandGrabbable);
    if (this.handsTracked && has) {
      if (this.queries.held.entities.has(entity)) this.grab.forceRelease(entity);
      entity.removeComponent(OneHandGrabbable);
    } else if (!this.handsTracked && !has) {
      entity.addComponent(OneHandGrabbable);
    }
  }

  /** Distancia de un punto al eje de la lata (el segmento de su base a su valvula). */
  distanceToCan(object, point) {
    object.updateWorldMatrix(true, false);
    object.getWorldPosition(this.scratch); // base
    this.valve.set(CAN_VALVE[0], CAN_VALVE[1], CAN_VALVE[2]).applyMatrix4(object.matrixWorld);
    this.axis.subVectors(this.valve, this.scratch);
    const length = this.axis.length();
    this.axis.divideScalar(length || 1);
    const t = Math.min(Math.max(this.offset.subVectors(point, this.scratch).dot(this.axis), 0), length);
    this.holdPoint.copy(this.scratch).addScaledVector(this.axis, t);
    return this.holdPoint.distanceTo(point);
  }

  /** Agarre y suelta con la mano cerrada (solo con el seguimiento de manos). */
  updateGrip(delta) {
    this.handsTracked = jointWorld(this.renderer, this.player, 'right', 'wrist', this.tip) || jointWorld(this.renderer, this.player, 'left', 'wrist', this.tip);
    for (const entity of this.queries.cans.entities) this.useGrabMode(entity);
    if (!this.handsTracked) {
      this.grip = null;
      return;
    }
    const factoryObject = this.factory?.object3D;
    if (this.grip) {
      const { entity, side } = this.grip;
      const object = entity.object3D;
      const tracked = entity.active && object && this.readHand(side);
      // Mano abierta = ya no envuelve la lata con los tres dedos. Si sigue asi RELEASE_HOLD segundos seguidos, se suelta.
      const open = tracked && this.curledFingers(CURL_OPEN) < 3;
      this.openTime = open ? this.openTime + delta : 0;
      if (!tracked || (open && this.openTime >= RELEASE_HOLD)) {
        if (entity.active) {
          entity.setValue(Carryable, 'locked', false);
          entity.setValue(Carryable, 'idle', 1.0); // casi de inmediato cae/vuelve a su sitio en la banda
          sfx.select();
        }
        this.grip = null;
        this.openTime = 0;
        return;
      }
      this.holdCan(object, delta, factoryObject);
      entity.setValue(Carryable, 'idle', 0);
      return;
    }
    for (const entity of this.queries.cans.entities) {
      const object = entity.object3D;
      if (!object || object.userData.fall || !factoryObject) continue;
      for (const side of ['right', 'left']) {
        if (!this.readHand(side) || this.curledFingers(CURL_CLOSE) < 3) continue;
        if (this.distanceToCan(object, this.hand.palm) > GRASP_REACH) continue;
        this.grip = { entity, side };
        this.openTime = 0;
        entity.setValue(Carryable, 'locked', true); // mientras la mano la sujeta no vuelve sola a su sitio
        sfx.select();
        return;
      }
    }
  }

  /** Acomoda la lata en la palma: eje de menique a indice (valvula hacia el indice), boquilla al frente, un poco hacia el
      lado de los dedos para que la palma la rodee. */
  holdCan(object, delta, factoryObject) {
    const h = this.hand;
    // Hacia que lado de la palma envuelven los dedos (signo de la normal de la palma)
    this.scratch.copy(h.middleTip).add(h.ringTip).add(h.pinkyTip).multiplyScalar(1 / 3).sub(h.palm);
    const sign = this.scratch.dot(h.X) >= 0 ? 1 : -1;
    object.getWorldScale(this.axis);
    const half = (CAN_VALVE[1] * this.axis.x) / 2; // media lata, en metros
    this.holdPoint
      .copy(h.palm)
      .addScaledVector(h.X, HOLD_OFFSET * sign)
      .addScaledVector(h.Y, HOLD_SHIFT - half); // origen de la lata: el centro de su base
    this.basis.makeBasis(h.X, h.Y, h.Z); // +Y de la lata = valvula, +Z = boquilla
    this.heldQuaternion.setFromRotationMatrix(this.basis);
    const parent = object.parent;
    if (parent) {
      parent.updateWorldMatrix(true, false);
      parent.getWorldQuaternion(this.parentQuaternion).invert();
      this.heldQuaternion.premultiply(this.parentQuaternion);
      parent.worldToLocal(this.holdPoint);
    }
    const k = 1 - Math.exp(-HOLD_RATE * delta);
    object.position.lerp(this.holdPoint, k);
    object.quaternion.slerp(this.heldQuaternion, k);
  }

  /** Verdadero si se pulsa la valvula. Con manos: el indice de la MISMA mano que sostiene la lata, flexionado, con la punta
      sobre la valvula (no basta acercarla ni tener el indice estirado). Con controles: el gatillo de la mano que sostiene. */
  valvePressed(holder) {
    const debug = import.meta.env.DEV && window.__miniso ? (window.__miniso.spray = { holder, tips: [] }) : null;
    if (this.handsTracked) {
      if (!this.grip || this.grip.side !== holder || !this.readHand(holder)) return false;
      const h = this.hand;
      this.offset.subVectors(h.indexTip, this.valve);
      const bent = h.indexTip.distanceTo(h.indexK) < INDEX_BENT;
      const onTop = this.offset.length() < PRESS_RADIUS && this.offset.dot(this.up) > -0.055;
      debug?.tips.push({ side: holder, distance: +this.offset.length().toFixed(3), above: +this.offset.dot(this.up).toFixed(3), bent });
      return bent && onTop;
    }
    return this.input.xr.getSelectState(holder).active;
  }

  /** El tope de la lata se hunde un poco mientras se pulsa la valvula y vuelve al soltarla. */
  moveValve(object, pressed, delta) {
    const model = object.userData.model;
    if (!model) return;
    const target = pressed ? 0.975 : 1;
    model.scale.y += (target - model.scale.y) * Math.min(1, delta * 25);
  }

  /** Devuelve true si algun aerosol esta rociando (lata en una mano, valvula pulsada). */
  updateSpray(delta) {
    let active = false;
    for (const entity of this.queries.cans.entities) {
      const object = entity.object3D;
      if (!object) continue;
      const hand = this.grip?.entity === entity
        ? this.grip.side
        : this.queries.held.entities.has(entity)
          ? this.grab.getHolderHand(entity)
          : null;
      if (!hand) {
        this.moveValve(object, false, delta);
        continue;
      }
      object.updateWorldMatrix(true, false);
      this.valve.set(CAN_VALVE[0], CAN_VALVE[1], CAN_VALVE[2]).applyMatrix4(object.matrixWorld);
      this.up.set(0, 1, 0).transformDirection(object.matrixWorld);
      const pressed = this.valvePressed(hand);
      this.moveValve(object, pressed, delta);
      if (import.meta.env.DEV && window.__miniso?.spray) window.__miniso.spray.pressed = pressed;
      if (!pressed) continue;
      this.nozzle.set(CAN_NOZZLE[0], CAN_NOZZLE[1], CAN_NOZZLE[2]).applyMatrix4(object.matrixWorld);
      this.direction.set(0, 0, 1).transformDirection(object.matrixWorld);
      const hex = entity.getValue(SprayCan, 'color');
      if (hex !== this.goalHex) {
        this.goalHex = hex;
        this.goal.set(hex);
        this.material.color.set(hex);
      }
      active = true;
      this.paint(delta);
    }
    if (active && !this.spraying) sfx.sprayStart();
    if (!active && this.spraying) {
      sfx.sprayStop();
      this.commitSkin(); // el tono que se ve en el personaje es el que queda guardado (tarjeta, pedido), aunque no haya llegado al color exacto
    }
    this.spraying = active;
    return active;
  }

  /** Guarda en avatarConfig el color de piel que tiene ahora el personaje (el mezclado al rociar). */
  commitSkin() {
    const saved = this.scratchColor.set(avatarConfig.peek().skin);
    const c = this.current;
    if (Math.abs(c.r - saved.r) + Math.abs(c.g - saved.g) + Math.abs(c.b - saved.b) < 0.01) return; // ya esta guardado
    setAvatar({ skin: `#${c.getHexString()}`.toUpperCase() });
  }

  /** Mezcla el color del personaje con el de la lata si la boquilla lo apunta. */
  paint(delta) {
    const avatar = this.avatar;
    if (!avatar || beltMoving.peek()) return;
    avatar.root.getWorldPosition(this.target);
    this.target.y += avatarHeight() * 0.5;
    this.toTarget.subVectors(this.target, this.nozzle);
    const distance = this.toTarget.length();
    if (import.meta.env.DEV && window.__miniso?.spray) {
      window.__miniso.spray.aim = { distance: +distance.toFixed(3), angle: +this.direction.angleTo(this.toTarget).toFixed(2) };
    }
    if (distance > SPRAY_RANGE || this.direction.angleTo(this.toTarget) > SPRAY_CONE) return;
    this.current.lerp(this.goal, 1 - Math.exp(-delta / PAINT_TIME));
    avatar.setRoleColor('skin', this.current);
    const near =
      Math.abs(this.current.r - this.goal.r) < 0.01 &&
      Math.abs(this.current.g - this.goal.g) < 0.01 &&
      Math.abs(this.current.b - this.goal.b) < 0.01;
    if (near && avatarConfig.peek().skin !== this.goalHex) {
      setAvatar({ skin: this.goalHex });
      sfx.ding();
    }
  }

  updateParticles(delta, active) {
    const position = this.points.geometry.attributes.position;
    if (active) {
      this.emit += 45 * delta;
      while (this.emit >= 1) {
        this.emit -= 1;
        const i = this.cursor;
        this.cursor = (this.cursor + 1) % PARTICLES;
        position.setXYZ(i, this.nozzle.x, this.nozzle.y, this.nozzle.z);
        this.velocity[i * 3] = this.direction.x * 0.6 + (Math.random() - 0.5) * 0.25;
        this.velocity[i * 3 + 1] = this.direction.y * 0.6 + (Math.random() - 0.5) * 0.25;
        this.velocity[i * 3 + 2] = this.direction.z * 0.6 + (Math.random() - 0.5) * 0.25;
        this.life[i] = PARTICLE_LIFE;
      }
    }
    for (let i = 0; i < PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= delta;
      if (this.life[i] <= 0) {
        position.setXYZ(i, 0, -50, 0);
        continue;
      }
      position.setXYZ(
        i,
        position.getX(i) + this.velocity[i * 3] * delta,
        position.getY(i) + this.velocity[i * 3 + 1] * delta,
        position.getZ(i) + this.velocity[i * 3 + 2] * delta,
      );
    }
    position.needsUpdate = true;
  }

  /** Solo desarrollo: deja en window.__miniso.skinDebug lo que ve el agarre (curvatura de los dedos, distancia a la lata...). */
  debugHands() {
    const out = { tracked: this.handsTracked, grip: this.grip?.side ?? null, hands: {} };
    const can = this.queries.cans.entities.values().next().value?.object3D;
    for (const side of ['right', 'left']) {
      if (!this.readHand(side)) {
        out.hands[side] = null;
        continue;
      }
      const h = this.hand;
      out.hands[side] = {
        palm: h.palm.toArray().map((v) => +v.toFixed(3)),
        curl: [h.middleTip, h.ringTip, h.pinkyTip].map((t) => +h.palm.distanceTo(t).toFixed(3)),
        canDistance: can ? +this.distanceToCan(can, h.palm).toFixed(3) : null,
        indexBend: +h.indexTip.distanceTo(h.indexK).toFixed(3),
        valveDistance: can ? +h.indexTip.distanceTo(this.valve).toFixed(3) : null,
      };
    }
    if (can) {
      can.getWorldPosition(this.scratch);
      out.can = this.scratch.toArray().map((v) => +v.toFixed(3));
      this.valve.set(CAN_VALVE[0], CAN_VALVE[1], CAN_VALVE[2]).applyMatrix4(can.matrixWorld);
      out.valve = this.valve.toArray().map((v) => +v.toFixed(3));
    }
    window.__miniso.skinDebug = out;
  }

  update(delta) {
    this.updateFalls(delta);
    if (import.meta.env.DEV && window.__miniso && this.handsTracked) this.debugHands();
    this.updateGrip(delta);
    this.updateParticles(delta, this.updateSpray(delta));
  }
}
