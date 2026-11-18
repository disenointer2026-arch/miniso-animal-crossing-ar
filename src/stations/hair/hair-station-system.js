/* Estacion 2: cabello.
   1. Elegir un estilo en el panel pone a trabajar la maquina (animacion y sonido);
      al terminar, el cabello sale en la bandeja.
   2. Se agarra con un pellizco y se suelta sobre la cabeza: si queda cerca, se coloca
      solo (ajuste automatico). Mientras se acerca, la cabeza se ilumina.
   3. Tocar el cabello puesto lo retira y queda suelto en la mano; soltarlo sobre el
      bote lo descarta. Si se suelta en otro sitio, vuelve a la bandeja.
   El color del cabello (pestana "Color") repinta el puesto y el que esta en la bandeja. */
import {
  Color,
  createSystem,
  GrabSystem,
  Grabbed,
  Group,
  Mesh,
  MeshBasicMaterial,
  OneHandGrabbable,
  PokeInteractable,
  Pressed,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { sfx } from '../../audio/sfx.js';
import { buildPart, recolorRole } from '../../avatar/avatar.js';
import {
  AvatarFigure,
  AvatarZone,
  Carryable,
  Factory,
  FactoryPart,
  HairMachine,
  HairProp,
} from '../../components.js';
import { registerDropHandler } from '../../interaction/carryable-system.js';
import { MODEL } from '../../data/avatar-defaults.js';
import { stationPoint } from '../../core/layout.js';
import { placeAtStation } from '../../scene-assets/lib/frame.js';
import { avatarConfig, beltMoving, categoryIndex, layout, phase, Phase, selection, setAvatar } from '../../state.js';
import { AVATAR_HEIGHT } from '../../systems/belt-system.js';
import { createBin, createHairMachine } from './hair-props.scene-asset.js';

const STATION = 1;
const MACHINE = { tangent: -0.15, radial: 0.2 };
const BIN_AT = { tangent: 0.15, radial: 0.17 };
const TRAY = { tangent: -0.15, radial: 0.135, up: 0.05 };
const PRODUCE_SECONDS = 2.4;
const GROW_SECONDS = 0.5;
const HEAD_SNAP = 0.14; // metros del origen del cabello al centro de la cabeza
const BIN_SNAP = 0.1;
const ZONE_RADIUS = 0.075;
const PROP_SCALE = AVATAR_HEIGHT / MODEL.height;

const easeOutBack = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;

export class HairStationSystem extends createSystem({
  factories: { required: [Factory] },
  machines: { required: [HairMachine] },
  props: { required: [HairProp, Carryable] },
  heldProps: { required: [HairProp, Grabbed] },
  zonePressed: { required: [AvatarZone, Pressed] },
  avatars: { required: [AvatarFigure] },
}) {
  init() {
    this.grab = this.world.getSystem(GrabSystem);
    this.factory = null;
    this.avatar = null;
    this.zone = null;
    this.zoneMaterial = null;
    this.bin = null;
    this.color = new Color();
    this.position = new Vector3();
    this.other = new Vector3();
    this.lastSelection = { ...selection.peek() };

    this.cleanupFuncs.push(
      registerDropHandler('hair', (entity) => this.onDrop(entity)),
      this.queries.factories.subscribe('qualify', (factory) => this.build(factory)),
      this.queries.factories.subscribe('disqualify', () => {
        this.factory = null;
        this.zone = null;
        this.bin = null;
      }),
      this.queries.avatars.subscribe('qualify', (entity) => {
        this.avatar = entity.object3D?.userData.avatar ?? null;
      }),
      this.queries.avatars.subscribe('disqualify', () => {
        this.avatar = null;
      }),
      this.queries.zonePressed.subscribe('qualify', () => this.removeWorn()),
      selection.subscribe((value) => this.onSelection(value)),
    );
  }

  active() {
    return phase.peek() === Phase.Customizing && categoryIndex.peek() === STATION && !beltMoving.peek();
  }

  build(factory) {
    this.factory = factory;
    const l = layout.peek();

    const machine = createHairMachine();
    placeAtStation(machine, l, STATION, MACHINE.tangent, MACHINE.radial);
    const machineEntity = this.world.createTransformEntity(machine, { parent: factory });
    machineEntity.addComponent(FactoryPart);
    machineEntity.addComponent(HairMachine);

    const bin = createBin();
    placeAtStation(bin, l, STATION, BIN_AT.tangent, BIN_AT.radial);
    const binEntity = this.world.createTransformEntity(bin, { parent: factory });
    binEntity.addComponent(FactoryPart);
    this.bin = bin.userData.opening;

    // Zona invisible sobre la cabeza: tocarla retira el cabello; se ilumina al acercar uno
    this.zoneMaterial = new MeshBasicMaterial({
      color: 0x8cc37a,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const zone = new Mesh(new SphereGeometry(ZONE_RADIUS, 16, 12), this.zoneMaterial);
    zone.name = 'HeadZone';
    const zoneEntity = this.world.createTransformEntity(zone, { parent: factory });
    zoneEntity.addComponent(FactoryPart);
    zoneEntity.addComponent(AvatarZone, { slot: 'hair' });
    zoneEntity.addComponent(PokeInteractable);
    this.zone = zone;
  }

  onSelection(value) {
    const previous = this.lastSelection;
    this.lastSelection = { ...value };
    if (value.hairColor !== previous.hairColor) this.recolor(value.hairColor);
    if (value.hair === previous.hair || !this.active()) return;
    if (value.hair === 'none') {
      this.removeProps();
      if (avatarConfig.peek().hair !== 'none') {
        setAvatar({ hair: 'none' });
        sfx.discard();
      }
    } else {
      this.startProduction(value.hair);
    }
  }

  recolor(hex) {
    setAvatar({ hairColor: hex });
    this.color.set(hex);
    for (const entity of this.queries.props.entities) {
      if (entity.object3D) recolorRole(entity.object3D, 'hair', this.color);
    }
  }

  removeProps() {
    for (const entity of Array.from(this.queries.props.entities)) {
      this.grab.forceRelease(entity);
      entity.dispose();
    }
  }

  startProduction(style) {
    for (const machine of this.queries.machines.entities) {
      this.removeProps();
      machine.setValue(HairMachine, 'style', style);
      machine.setValue(HairMachine, 'timer', 0);
      machine.setValue(HairMachine, 'producing', true);
    }
    sfx.whirr(PRODUCE_SECONDS);
  }

  /** Crea un cabello suelto. fromHead: nace en la cabeza (al retirarlo); si no, en la bandeja. */
  spawnProp(style, fromHead = false) {
    if (!this.factory) return;
    const l = layout.peek();
    const home = stationPoint(l, STATION, TRAY.tangent, TRAY.radial, TRAY.up);
    const root = new Group();
    root.name = 'HairProp';
    root.add(buildPart(`cabello-${style}`, { ...avatarConfig.peek(), hair: style }));
    root.scale.setScalar(fromHead ? PROP_SCALE : 0.0001);
    root.position.set(home.x, home.y, home.z);
    root.rotation.y = home.rotY;
    if (fromHead && this.avatar) {
      this.avatar.headGroup.getWorldPosition(this.position);
      this.factory.object3D.worldToLocal(this.position);
      root.position.copy(this.position);
    } else {
      root.userData.grow = 0;
    }
    const entity = this.world.createTransformEntity(root, { parent: this.factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(HairProp, { style });
    entity.addComponent(Carryable, {
      kind: 'hair',
      locked: !fromHead,
      home: [home.x, home.y, home.z],
      homeYaw: home.rotY,
    });
    entity.addComponent(OneHandGrabbable);
  }

  removeWorn() {
    const style = avatarConfig.peek().hair;
    if (!this.active() || style === 'none') return;
    setAvatar({ hair: 'none' });
    this.spawnProp(style, true);
    sfx.select();
  }

  /** Al soltar un cabello: al bote se descarta; sobre la cabeza se coloca. */
  onDrop(entity) {
    const object = entity.object3D;
    if (!object) return;
    object.getWorldPosition(this.position);
    if (this.bin) {
      this.bin.getWorldPosition(this.other);
      if (this.position.distanceTo(this.other) < BIN_SNAP) {
        sfx.discard();
        entity.dispose();
        return;
      }
    }
    if (this.avatar) {
      this.avatar.headGroup.getWorldPosition(this.other);
      if (this.position.distanceTo(this.other) < HEAD_SNAP) {
        setAvatar({ hair: entity.getValue(HairProp, 'style') });
        sfx.ding();
        entity.dispose();
      }
    }
  }

  updateMachines(delta, time) {
    for (const machine of this.queries.machines.entities) {
      const parts = machine.object3D?.userData.parts;
      if (!parts) continue;
      if (!machine.getValue(HairMachine, 'producing')) {
        parts.body.rotation.z = 0;
        continue;
      }
      const timer = machine.getValue(HairMachine, 'timer') + delta;
      machine.setValue(HairMachine, 'timer', timer);
      parts.body.rotation.z = Math.sin(time * 38) * 0.025;
      const on = Math.floor(time * 6) % 2 === 0;
      parts.lamp.material.color.setHex(on ? 0xf6d365 : 0xd9d2c3);
      if (timer >= PRODUCE_SECONDS) {
        machine.setValue(HairMachine, 'producing', false);
        parts.lamp.material.color.setHex(0x8cc37a);
        this.spawnProp(machine.getValue(HairMachine, 'style'));
        sfx.ding();
      }
    }
  }

  updateProps(delta) {
    for (const entity of this.queries.props.entities) {
      const object = entity.object3D;
      if (!object || object.userData.grow === undefined) continue;
      object.userData.grow += delta;
      const k = Math.min(object.userData.grow / GROW_SECONDS, 1);
      object.scale.setScalar(Math.max(PROP_SCALE * easeOutBack(k), 0.0001));
      if (k >= 1) {
        delete object.userData.grow;
        entity.setValue(Carryable, 'locked', false);
      }
    }
  }

  /** La zona sigue a la cabeza (que se mece) y se ilumina si se acerca un cabello. */
  updateZone() {
    const zone = this.zone;
    if (!zone || !this.avatar || !this.factory?.object3D) return;
    const show = this.active();
    zone.scale.setScalar(show ? 1 : 0.0001);
    this.avatar.headGroup.getWorldPosition(this.position);
    zone.position.copy(this.factory.object3D.worldToLocal(this.position));
    let near = false;
    for (const entity of this.queries.heldProps.entities) {
      entity.object3D?.getWorldPosition(this.other);
      this.avatar.headGroup.getWorldPosition(this.position);
      if (this.other.distanceTo(this.position) < HEAD_SNAP) near = true;
    }
    this.zoneMaterial.opacity = near ? 0.3 : 0;
  }

  update(delta, time) {
    this.updateMachines(delta, time);
    this.updateProps(delta);
    this.updateZone();
  }
}
