/* Estacion 1: color de piel.
   1. Elegir un tono en el panel hace caer una lata de ese color del dispensador.
   2. La lata se agarra con un pellizco de una mano (OneHandGrabbable).
   3. Con la lata en la mano, pellizcar con la OTRA mano acciona el aerosol: sale
      pintura (particulas + sonido) y, si la boquilla apunta al personaje, su color
      se mezcla poco a poco con el de la lata. Al llegar, queda guardado en
      avatarConfig; se puede repetir con otro tono. */
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
import { stationPoint } from '../../core/layout.js';
import { placeAtStation } from '../../scene-assets/lib/frame.js';
import { avatarConfig, beltMoving, categoryIndex, layout, phase, Phase, selection, setAvatar } from '../../state.js';
import { AVATAR_HEIGHT } from '../../systems/belt-system.js';
import { CAN, CAN_NOZZLE, createDispenser, createSprayCan } from './skin-props.scene-asset.js';

const STATION = 0;
const DISPENSER = { tangent: -0.14, radial: 0.21 };
const HOME = { tangent: -0.14, radial: 0.145, up: 0.006 + CAN.height / 2 };
const DROP_HEIGHT = 0.2;
const FALL_SECONDS = 0.5;
const SPRAY_RANGE = 0.3; // metros de la boquilla al personaje
const SPRAY_CONE = 0.75; // radianes de tolerancia al apuntar
const PAINT_TIME = 0.8; // segundos para mezclar casi todo el color
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
    this.avatar = null;
    this.nozzle = new Vector3();
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
      selection.subscribe((value) => {
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
      size: 0.014,
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
    const dispenser = createDispenser();
    placeAtStation(dispenser, layout.peek(), STATION, DISPENSER.tangent, DISPENSER.radial);
    const entity = this.world.createTransformEntity(dispenser, { parent: factory });
    entity.addComponent(FactoryPart);
  }

  /** Cae una lata nueva del dispensador; la anterior (si habia) se retira. */
  spawnCan(hex) {
    if (!this.factory) return;
    for (const entity of Array.from(this.queries.cans.entities)) {
      this.grab.forceRelease(entity);
      entity.dispose();
    }
    const l = layout.peek();
    const home = stationPoint(l, STATION, HOME.tangent, HOME.radial, HOME.up);
    const can = createSprayCan(hex);
    can.position.set(home.x, home.y + DROP_HEIGHT, home.z);
    can.rotation.y = home.rotY;
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

  /** Devuelve true si algun aerosol esta rociando (lata en una mano, pellizco en la otra). */
  updateSpray(delta) {
    let active = false;
    for (const entity of this.queries.held.entities) {
      const hand = this.grab.getHolderHand(entity);
      if (!hand) continue;
      const other = hand === 'left' ? 'right' : 'left';
      if (!this.input.xr.getSelectState(other).active) continue;
      const object = entity.object3D;
      object.updateWorldMatrix(true, false);
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
