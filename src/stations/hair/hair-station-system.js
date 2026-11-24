/* Estacion 2: cabello.
   1. Elegir un estilo en el panel de la maquina (tablero gris con borde rojo, como el de la piel; tarjetas con
      mini avatar) pone a trabajar la maquina (animacion y sonido); al terminar, el cabello sale en la bandeja.
   2. Se agarra con un pellizco y se suelta sobre la cabeza: si queda cerca, se coloca
      solo (ajuste automatico). Mientras se acerca, la cabeza se ilumina.
   3. Tocar el cabello puesto lo retira y queda suelto en la mano; soltarlo sobre el
      bote lo descarta. Si se suelta en otro sitio, vuelve a la bandeja.
   El color del cabello (muestras redondas, en el mismo tablero) repinta el puesto y el que esta en la bandeja.
   Retirar lo puesto no funciona mientras se sostiene otro objeto (ver interactionBusy). */
import {
  Color,
  createSystem,
  GrabSystem,
  Grabbed,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
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
import { interactionBusy, registerDropHandler } from '../../interaction/carryable-system.js';
import { renderPortrait } from '../../checkout/portrait.js';
import { CATEGORIES } from '../../data/categories.js';
import { modelFrame, modelScale } from '../../core/layout.js';
import { ANCHORS } from '../../factory/anchors.js';
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
import { avatarScale } from '../../systems/belt-system.js';
import { C } from '../../ui/theme.js';
import { addItem, canvasPlane, drawCheck, drawSwatch, fitText, roundRectPath, text } from '../../ui/world-ui.js';
import { createBin } from './hair-props.scene-asset.js';

const STATION = 1;
const SLOT = 2; // slot de la banda de esta estacion
const TRAY_UP = 0.05; // el cabello flota un poco sobre la bandeja
const PRODUCE_SECONDS = 2.4;
const GROW_SECONDS = 0.5;
const HEAD_SNAP = 0.24; // metros del origen del cabello al centro de la cabeza
const BIN_SNAP = 0.17;
const ZONE_RADIUS = 0.1;

const easeOutBack = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;

/** Tablero de la maquina: gris con borde rojo, junto al tambor y de frente al usuario (punto del modelo [x, y, altura del centro]). */
const BOARD_AT = [23.5, 32, 14.5];
const BOARD = {
  width: 0.44,
  height: 0.42,
  titleY: 0.18,
  cols: 4,
  card: [0.09, 0.108],
  pitch: [0.097, 0.115],
  top: 0.095,
  swatch: 0.046,
  swatchPitch: 0.049,
  swatchPerRow: 8,
  swatchTop: -0.115,
};
const STYLES = CATEGORIES[1].groups[0].options; // sin cabello + 7 estilos
const HEAD_VIEW = { y: 1.5, z: 2.3 }; // encuadre del mini avatar: la cabeza
const PORTRAIT_SIZE = 256;
const HAIR_COLORS = CATEGORIES[1].groups[1].options;

/** Tarjeta de un estilo: mini avatar con ese cabello y su nombre; la elegida lleva contorno rojo y chulo. */
function drawStyleCard(option) {
  return (ctx, w, h, state) => {
    ctx.clearRect(0, 0, w, h);
    const pad = 8;
    ctx.save();
    ctx.shadowColor = 'rgba(94, 77, 71, 0.25)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = state.hovered ? '#fff' : C.paper;
    roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 4, 30);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = state.selected ? 8 : 4;
    ctx.strokeStyle = state.selected ? C.red : C.yellowSoft;
    roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 4, 30);
    ctx.stroke();
    const box = w * 0.8;
    if (state.image) {
      ctx.drawImage(state.image, (w - box) / 2, pad + 6, box, box);
    } else if (option.id === 'none') {
      ctx.strokeStyle = C.muted;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(w / 2, pad + 6 + box / 2, box * 0.3, 0, Math.PI * 2);
      ctx.moveTo(w / 2 - box * 0.21, pad + 6 + box / 2 + box * 0.21);
      ctx.lineTo(w / 2 + box * 0.21, pad + 6 + box / 2 - box * 0.21);
      ctx.stroke();
    }
    fitText(ctx, option.name, w / 2, h - pad - 28, w * 0.84, { size: h * 0.12, weight: 800, color: C.ink });
    if (state.selected) drawCheck(ctx, w - pad - 20, pad + 24, 20);
  };
}

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
    this.panels = null; // { board, cards[], swatches[] }
    this.queue = []; // estilos cuyo mini avatar falta por dibujar (uno por cuadro)
    this.portraitColor = '';
    this.frame = 0;
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
        this.panels = null;
      }),
      this.queries.avatars.subscribe('qualify', (entity) => {
        this.avatar = entity.object3D?.userData.avatar ?? null;
      }),
      this.queries.avatars.subscribe('disqualify', () => {
        this.avatar = null;
      }),
      this.queries.zonePressed.subscribe('qualify', () => this.removeWorn()),
      selection.subscribe((value) => this.onSelection(value)),
      phase.subscribe(() => this.refreshPanels()),
      beltMoving.subscribe(() => this.refreshPanels()),
      categoryIndex.subscribe(() => this.refreshPanels()),
    );
  }

  active() {
    return phase.peek() === Phase.Customizing && categoryIndex.peek() === STATION && !beltMoving.peek();
  }

  build(factory) {
    this.factory = factory;
    const l = layout.peek();

    // La maquina es la del modelo: la cupula se sacude y las tijeras giran mientras fabrica
    const nodes = factory.object3D?.userData.parts?.nodes ?? {};
    const machine = new Group();
    machine.name = 'HairMachineRig';
    machine.userData.parts = { body: nodes.maquina, spinner: nodes.tijeras };
    const machineEntity = this.world.createTransformEntity(machine, { parent: factory });
    machineEntity.addComponent(FactoryPart);
    machineEntity.addComponent(HairMachine);

    const bin = createBin();
    placeAtAnchor(bin, l, ANCHORS.hairBin, 0, 0, 0, SLOT);
    this.buildPanels(factory);
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

  /** Tablero de la maquina (gris con borde rojo, como el de la piel): estilos con mini avatar y colores en un solo panel. */
  buildPanels(factory) {
    const l = layout.peek();
    const group = new Group();
    group.name = 'HairBoard';
    const frame = canvasPlane(BOARD.width, BOARD.height, 1300, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const pad = 8;
      ctx.save();
      ctx.shadowColor = 'rgba(40, 30, 30, 0.35)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#C9CBD0';
      roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 4, 34);
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 16;
      ctx.strokeStyle = '#D8031A'; // Rojo miniso
      roundRectPath(ctx, pad + 8, pad + 8, w - pad * 2 - 16, h - pad * 2 - 20, 28);
      ctx.stroke();
      text(ctx, 'Estilo y color de cabello', w / 2, h * (0.5 - BOARD.titleY / BOARD.height), {
        size: h * 0.052,
        weight: 800,
        color: '#2B2B30',
      });
    });
    frame.mesh.name = 'ui-back';
    group.add(frame.mesh);
    placeAtAnchor(group, l, BOARD_AT, 0, 0, 0, SLOT);

    // Poste que sujeta el tablero a la base de la maquina
    const postHeight = (BOARD_AT[2] - 8.4) * modelScale(l) - BOARD.height / 2;
    if (postHeight > 0.01) {
      const post = new Mesh(
        new CylinderGeometry(0.012, 0.012, postHeight, 12),
        new MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5, metalness: 0 }),
      );
      post.position.set(0, -BOARD.height / 2 - postHeight / 2, -0.012);
      post.name = 'HairBoardPost';
      group.add(post);
    }

    const entity = this.world.createTransformEntity(group, { parent: factory });
    entity.addComponent(FactoryPart);
    const cards = STYLES.map((option, i) => {
      const col = i % BOARD.cols;
      const row = Math.floor(i / BOARD.cols);
      const item = addItem(this.world, entity, {
        x: (col - (BOARD.cols - 1) / 2) * BOARD.pitch[0],
        y: BOARD.top - row * BOARD.pitch[1],
        width: BOARD.card[0],
        height: BOARD.card[1],
        pxPerMeter: 1300,
        name: `style-${option.id}`,
        draw: drawStyleCard(option),
        onPress: () => select('hair', option.id),
      });
      item.mesh.userData.silent = true;
      return { item, id: option.id };
    });
    const swatches = HAIR_COLORS.map((color, i) => {
      const col = i % BOARD.swatchPerRow;
      const row = Math.floor(i / BOARD.swatchPerRow);
      const item = addItem(this.world, entity, {
        x: (col - (BOARD.swatchPerRow - 1) / 2) * BOARD.swatchPitch,
        y: BOARD.swatchTop - row * BOARD.swatchPitch,
        width: BOARD.swatch,
        height: BOARD.swatch,
        pxPerMeter: 1300,
        name: `hair-color-${color.id}`,
        draw: (ctx, w, h, state) => drawSwatch(ctx, w, h, color.id, !!state.selected),
        onPress: () => select('hairColor', color.id),
      });
      item.mesh.userData.silent = true;
      return { item, id: color.id };
    });
    this.panels = { board: group, cards, swatches };
    this.queuePortraits();
    this.refreshPanels();
  }

  /** Pone en cola los mini avatares: uno por cuadro, para no frenar la escena. */
  queuePortraits() {
    this.portraitColor = selection.peek().hairColor;
    this.queue = STYLES.filter((o) => o.id !== 'none').map((o) => o.id);
  }

  drawNextPortrait() {
    const id = this.queue.shift();
    const card = this.panels?.cards.find((c) => c.id === id);
    if (!card) return;
    const config = { ...avatarConfig.peek(), hair: id, hairColor: this.portraitColor, accHead: 'none', companion: 'none' };
    const url = renderPortrait(this.renderer, config, PORTRAIT_SIZE, HEAD_VIEW);
    const image = new Image();
    image.onload = () => card.item.redraw({ image });
    image.src = url;
  }

  refreshPanels() {
    if (!this.panels) return;
    const show = this.active();
    const board = this.panels.board;
    board.visible = show;
    board.scale.setScalar(show ? 1 : 0.0001);
    const chosen = selection.peek();
    for (const { item, id } of this.panels.cards) item.redraw({ selected: id === chosen.hair });
    for (const { item, id } of this.panels.swatches) item.redraw({ selected: id === chosen.hairColor });
  }

  onSelection(value) {
    const previous = this.lastSelection;
    this.lastSelection = { ...value };
    if (value.hairColor !== previous.hairColor) {
      this.recolor(value.hairColor);
      this.queuePortraits();
    }
    this.refreshPanels();
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
    const home = modelFrame(l, ANCHORS.hairTray, 0, 0, TRAY_UP, SLOT);
    const root = new Group();
    root.name = 'HairProp';
    root.add(buildPart(`cabello-${style}`, { ...avatarConfig.peek(), hair: style }));
    root.scale.setScalar(fromHead ? avatarScale() : 0.0001);
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
    if (!this.active() || style === 'none' || interactionBusy()) return;
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
      const { body, spinner } = parts;
      if (body && parts.baseZ === undefined) parts.baseZ = body.rotation.z;
      if (!machine.getValue(HairMachine, 'producing')) {
        if (body) body.rotation.z = parts.baseZ;
        continue;
      }
      const timer = machine.getValue(HairMachine, 'timer') + delta;
      machine.setValue(HairMachine, 'timer', timer);
      if (body) body.rotation.z = parts.baseZ + Math.sin(time * 38) * 0.012;
      if (spinner) spinner.rotation.y += delta * 9;
      if (timer >= PRODUCE_SECONDS) {
        machine.setValue(HairMachine, 'producing', false);
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
      object.scale.setScalar(Math.max(avatarScale() * easeOutBack(k), 0.0001));
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
    if (this.queue.length && this.panels && this.frame++ % 5 === 0) this.drawNextPortrait();
    this.updateMachines(delta, time);
    this.updateProps(delta);
    this.updateZone();
  }
}
