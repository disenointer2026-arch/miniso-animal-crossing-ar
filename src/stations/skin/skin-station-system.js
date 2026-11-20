/* Estacion 1: color de piel.
   1. Elegir un tono en la pantalla del modelo (muestras redondas sobre el nodo "pantalla") hace caer
      una lata de ese color del dispensador.
   2. La lata se agarra con una mano (OneHandGrabbable).
   3. El aerosol se acciona PULSANDO LA VALVULA (el boton de arriba) con la punta del dedo indice:
      sale pintura (particulas + sonido) y, si la boquilla apunta al personaje, su color se mezcla
      poco a poco con el de la lata. Al llegar, queda guardado en avatarConfig; se puede repetir con
      otro tono. Con controles (sin manos) el gatillo de la mano que sostiene la lata hace de dedo. */
import {
  BufferGeometry,
  Color,
  createSystem,
  Float32BufferAttribute,
  GrabSystem,
  Grabbed,
  OneHandGrabbable,
  Points,
  PointsMaterial,
  Vector3,
} from '@iwsdk/core';
import { sfx } from '../../audio/sfx.js';
import { AvatarFigure, Carryable, Factory, FactoryPart, SprayCan } from '../../components.js';
import { modelFrame } from '../../core/layout.js';
import { ANCHORS } from '../../factory/anchors.js';
import { jointWorld } from '../../interaction/hand-joints.js';
import { placeAtAnchor } from '../../scene-assets/lib/frame.js';
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
import { AVATAR_HEIGHT } from '../../systems/belt-system.js';
import { C } from '../../ui/theme.js';
import { addItem, createUiPanel, drawSwatch } from '../../ui/world-ui.js';
import { SKIN_TONES } from '../../data/categories.js';
import { CAN, CAN_NOZZLE, CAN_VALVE, createSprayCan, createTray } from './skin-props.scene-asset.js';

const STATION = 0;
const SLOT = 1; // slot de la banda de esta estacion
const HOME_UP = 0.008 + CAN.height / 2; // la lata descansa sobre la bandeja
const DROP_HEIGHT = 0.25;
const FALL_SECONDS = 0.5;
const SPRAY_RANGE = 0.45; // metros de la boquilla al personaje
const SPRAY_CONE = 0.95; // radianes de tolerancia al apuntar
const PAINT_TIME = 0.8; // segundos para mezclar casi todo el color
const PRESS_RADIUS = 0.06; // distancia de la punta del dedo a la valvula para pulsarla
const PARTICLES = 60;
const PARTICLE_LIFE = 0.45;

/** Pantalla del modelo (nodo "pantalla", cara hacia el usuario): el panel crema se coloca sobre ella. */
const SCREEN = { at: [-2, 11.7, 14.3], width: 0.3, height: 0.27 };
const GRID = { cols: 4, pitch: 0.068, size: 0.066, top: 0.045, rowPitch: 0.07 };

export class SkinStationSystem extends createSystem({
  factories: { required: [Factory] },
  cans: { required: [SprayCan, Carryable] },
  held: { required: [SprayCan, Grabbed] },
  avatars: { required: [AvatarFigure] },
}) {
  init() {
    this.grab = this.world.getSystem(GrabSystem);
    this.factory = null;
    this.avatar = null;
    this.nozzle = new Vector3();
    this.valve = new Vector3();
    this.tip = new Vector3();
    this.up = new Vector3();
    this.offset = new Vector3();
    this.direction = new Vector3();
    this.target = new Vector3();
    this.toTarget = new Vector3();
    this.current = new Color(avatarConfig.peek().skin);
    this.goal = new Color();
    this.goalHex = '';
    this.spraying = false;
    this.lastSkin = selection.peek().skin;
    this.emit = 0;
    this.cursor = 0;
    this.createParticles();

    this.cleanupFuncs.push(
      this.queries.factories.subscribe('qualify', (factory) => this.build(factory)),
      this.queries.factories.subscribe('disqualify', () => {
        this.factory = null;
      }),
      this.queries.avatars.subscribe('qualify', (entity) => {
        this.avatar = entity.object3D?.userData.avatar ?? null;
      }),
      this.queries.avatars.subscribe('disqualify', () => {
        this.avatar = null;
      }),
      phase.subscribe(() => this.refreshScreen()),
      beltMoving.subscribe(() => this.refreshScreen()),
      categoryIndex.subscribe(() => this.refreshScreen()),
      selection.subscribe((value) => {
        this.refreshScreen();
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

  /** Pantalla crema sobre el nodo "pantalla": doce muestras redondas de tono de piel. */
  buildScreen(factory) {
    const l = layout.peek();
    const panel = createUiPanel({
      width: SCREEN.width,
      height: SCREEN.height,
      title: 'Tono de piel',
      subtitle: 'Elige un tono: cae una lata del dispensador',
    });
    placeAtAnchor(panel, l, SCREEN.at, 0, 0, 0, SLOT);
    const entity = this.world.createTransformEntity(panel, { parent: factory });
    entity.addComponent(FactoryPart);
    this.screen = panel;
    this.swatches = SKIN_TONES.map((tone, i) => {
      const col = i % GRID.cols;
      const row = Math.floor(i / GRID.cols);
      const item = addItem(this.world, entity, {
        x: (col - (GRID.cols - 1) / 2) * GRID.pitch,
        y: GRID.top - row * GRID.rowPitch,
        width: GRID.size,
        height: GRID.size,
        pxPerMeter: 1300,
        name: `swatch-${tone.id}`,
        draw: (ctx, w, h, state) => drawSwatch(ctx, w, h, tone.id, !!state.selected),
        onPress: () => select('skin', tone.id),
      });
      item.mesh.userData.silent = true;
      return { item, id: tone.id };
    });
    this.refreshScreen();
  }

  refreshScreen() {
    const panel = this.screen;
    if (!panel) return;
    const show = phase.peek() === Phase.Customizing && categoryIndex.peek() === STATION && !beltMoving.peek();
    panel.visible = show;
    panel.scale.setScalar(show ? 1 : 0.0001);
    const chosen = selection.peek().skin;
    for (const { item, id } of this.swatches) item.redraw({ selected: id === chosen });
  }

  build(factory) {
    this.factory = factory;
    const tray = createTray();
    placeAtAnchor(tray, layout.peek(), ANCHORS.skinTray, 0, 0, 0, SLOT);
    const entity = this.world.createTransformEntity(tray, { parent: factory });
    entity.addComponent(FactoryPart);
    this.buildScreen(factory);
  }

  /** Cae una lata nueva del dispensador; la anterior (si habia) se retira. */
  spawnCan(hex) {
    if (!this.factory) return;
    for (const entity of Array.from(this.queries.cans.entities)) {
      this.grab.forceRelease(entity);
      entity.dispose();
    }
    const l = layout.peek();
    const home = modelFrame(l, ANCHORS.skinTray, 0, 0, HOME_UP, SLOT);
    const can = createSprayCan(hex);
    can.position.set(home.x, home.y + DROP_HEIGHT, home.z);
    can.rotation.y = home.rotY + Math.PI; // la boquilla (+Z de la lata) apunta hacia el personaje, no hacia el usuario
    can.userData.fall = { t: 0, from: home.y + DROP_HEIGHT, to: home.y };
    const entity = this.world.createTransformEntity(can, { parent: this.factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(SprayCan, { color: hex });
    entity.addComponent(Carryable, {
      kind: 'can',
      locked: true,
      home: [home.x, home.y, home.z],
      homeYaw: home.rotY + Math.PI,
    });
    entity.addComponent(OneHandGrabbable);
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

  /** Verdadero si la punta de un dedo indice pulsa la valvula (por arriba o al lado). Con controles
      no hay dedos: el gatillo de la mano que sostiene la lata cumple ese papel. */
  valvePressed(holder) {
    let tracked = false;
    const debug = import.meta.env.DEV && window.__miniso ? (window.__miniso.spray = { holder, tips: [] }) : null;
    for (const side of ['right', 'left']) {
      if (!jointWorld(this.renderer, this.player, side, 'index-finger-tip', this.tip)) continue;
      tracked = true;
      this.offset.subVectors(this.tip, this.valve);
      debug?.tips.push({ side, distance: +this.offset.length().toFixed(3), above: +this.offset.dot(this.up).toFixed(3) });
      if (this.offset.length() < PRESS_RADIUS && this.offset.dot(this.up) > -0.02) return true;
    }
    if (debug) {
      debug.tracked = tracked;
      debug.valve = this.valve.toArray().map((v) => +v.toFixed(3));
    }
    return tracked ? false : this.input.xr.getSelectState(holder).active;
  }

  /** Hunde la valvula mientras se pulsa y la devuelve suavemente al soltarla. */
  moveValve(object, pressed, delta) {
    const valve = object.userData.valve;
    if (!valve) return;
    const target = object.userData.valveRest - (pressed ? 0.009 : 0);
    valve.position.y += (target - valve.position.y) * Math.min(1, delta * 25);
  }

  /** Devuelve true si algun aerosol esta rociando (lata en una mano, valvula pulsada). */
  updateSpray(delta) {
    let active = false;
    for (const entity of this.queries.cans.entities) {
      const object = entity.object3D;
      if (!object) continue;
      const hand = this.queries.held.entities.has(entity) ? this.grab.getHolderHand(entity) : null;
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
    if (!active && this.spraying) sfx.sprayStop();
    this.spraying = active;
    return active;
  }

  /** Mezcla el color del personaje con el de la lata si la boquilla lo apunta. */
  paint(delta) {
    const avatar = this.avatar;
    if (!avatar || beltMoving.peek()) return;
    avatar.root.getWorldPosition(this.target);
    this.target.y += AVATAR_HEIGHT * 0.5;
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

  update(delta) {
    this.updateFalls(delta);
    this.updateParticles(delta, this.updateSpray(delta));
  }
}
