/* Estaciones 3 (rostro), 4 (ropa) y 5 (charms y accesorios). Sin paneles: todo se hace con los
   objetos del mueble, siempre de frente al usuario.
   - Rostro: el LIBRO de stickers se agarra con una mano y se abre (ojos, color de ojos, boca, nariz; las
     flechas del libro pasan de pagina). Con la otra mano se saca un sticker y se suelta sobre la cara.
   - Ropa: las prendas del grupo activo estan en las baldas del armario; tres botones en los bloques de
     al lado cambian entre camisetas, pantalones y zapatos.
   - Charms: seis cajas cerradas con el icono de su charm. Al agarrar una con una mano se abre y de ella
     se saca el charm. Los accesorios estan en una vitrina al fondo de la mesa.
   - Los objetos se sueltan sobre el personaje: si quedan cerca (radio generoso) se colocan solos.
   - Tocar con el dedo lo puesto lo retira, pero NO mientras se sostiene otro objeto (interactionBusy).
   Lo puesto vive en avatarConfig; el mueble se calcula a partir de ahi. */
import {
  Box3,
  createSystem,
  Grabbed,
  Group,
  Mesh,
  MeshBasicMaterial,
  OneHandGrabbable,
  PokeInteractable,
  Pressed,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { sfx } from '../../audio/sfx.js';
import { buildPart } from '../../avatar/avatar.js';
import { renderObjectIcon } from '../../checkout/portrait.js';
import {
  AvatarFigure,
  AvatarZone,
  Carryable,
  CatalogItem,
  ChestBox,
  Factory,
  FactoryPart,
  StickerBook,
} from '../../components.js';
import { modelFrame, modelScale } from '../../core/layout.js';
import { EYE_COLORS } from '../../data/categories.js';
import { MODEL } from '../../data/avatar-defaults.js';
import { interactionBusy, registerDropHandler } from '../../interaction/carryable-system.js';
import {
  avatarConfig,
  beltMoving,
  categoryIndex,
  groupIndex,
  layout,
  phase,
  Phase,
  select,
  selection,
  setAvatar,
} from '../../state.js';
import { AVATAR_HEIGHT } from '../../systems/belt-system.js';
import { C } from '../../ui/theme.js';
import { addItem, drawPill, drawSwatch, fitText, roundRectPath } from '../../ui/world-ui.js';
import { BOOK, CHEST, createBook, createChest } from './catalog-objects.js';
import { createSticker } from './catalog-props.scene-asset.js';
import {
  CATALOGS,
  CHARMS,
  CHEST_LAYOUT,
  CLOTHES,
  FACE,
  FURNITURE,
  bookSlot,
  stickerTexture,
  wardrobeSlot,
} from './catalog-config.js';

const SLOT_OF = { [FACE]: 3, [CLOTHES]: 4, [CHARMS]: 5 }; // slot de la banda de cada estacion
const PROP_SCALE = AVATAR_HEIGHT / MODEL.height;
const CHARM_SCALE = PROP_SCALE * 1.6; // los charms se ven mas grandes al salir de la caja
const ACCESSORY_SCALE = PROP_SCALE * 0.9;
const SNAP = { head: 0.26, body: 0.28, feet: 0.24 }; // metros del objeto al lugar donde va
const GROW_SECONDS = 0.35;
const PAGE_COOLDOWN = 0.35;
const CHEST_OPEN = 2.1; // radianes de la tapa abierta (pasa de la vertical: queda recostada atras)
const STICKER_LIFT = 0.075; // los stickers flotan sobre la pagina: lejos de la tapa, para poder agarrarlos con la otra mano
const CHARM_LIFT = 0.17; // el charm flota bien arriba de la caja abierta (lejos de la tapa) para sacarlo con la otra mano

/** Si alguna pieza sale al reves en el mueble, se corrige aqui: rotacion [x, y, z] en radianes por "clave/id". */
const DISPLAY_FIX = {};

const easeOutBack = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;

/** Pasa las mallas con huesos a mallas normales (con la pose de reposo ya aplicada): asi la caja de
    colision del objeto coincide EXACTAMENTE con lo que se ve (con huesos, la caja se calculaba en otra pose
    y el objeto se agarraba por encima de la geometria). */
function bakeSkinned(root) {
  root.updateWorldMatrix(true, true);
  const skinned = [];
  root.traverse((o) => {
    if (o.isSkinnedMesh) skinned.push(o);
  });
  const v = new Vector3();
  for (const mesh of skinned) {
    mesh.skeleton.update();
    const geometry = mesh.geometry.clone();
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      mesh.getVertexPosition(i, v);
      position.setXYZ(i, v.x, v.y, v.z);
    }
    position.needsUpdate = true;
    geometry.deleteAttribute('skinIndex');
    geometry.deleteAttribute('skinWeight');
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    const solid = new Mesh(geometry, mesh.material);
    solid.name = mesh.name;
    solid.position.copy(mesh.position);
    solid.quaternion.copy(mesh.quaternion);
    solid.scale.copy(mesh.scale);
    mesh.parent.add(solid);
    mesh.removeFromParent();
  }
}

const box = new Box3();
const center = new Vector3();

/** Pieza del avatar lista para tenerla en la mano: estatica, centrada y con su correccion de orientacion. */
function makePart(group, id) {
  const model = buildPart(`${group.prefix}-${id}`, avatarConfig.peek());
  if (!model) return null;
  bakeSkinned(model);
  model.updateMatrixWorld(true);
  box.setFromObject(model).getCenter(center);
  model.position.sub(center);
  const pivot = new Group();
  pivot.add(model);
  const fix = DISPLAY_FIX[`${group.apply}/${id}`];
  if (fix) pivot.rotation.set(fix[0], fix[1], fix[2]);
  return pivot;
}

/** Dibujo de un boton de camiseta / pantalon / zapato (trazo redondeado de la guia). */
function drawGarment(ctx, kind, cx, cy, s, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.07;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 0) {
    ctx.moveTo(-s * 0.18, -s * 0.34);
    ctx.lineTo(-s * 0.5, -s * 0.2);
    ctx.lineTo(-s * 0.4, s * 0.02);
    ctx.lineTo(-s * 0.26, -s * 0.04);
    ctx.lineTo(-s * 0.26, s * 0.38);
    ctx.lineTo(s * 0.26, s * 0.38);
    ctx.lineTo(s * 0.26, -s * 0.04);
    ctx.lineTo(s * 0.4, s * 0.02);
    ctx.lineTo(s * 0.5, -s * 0.2);
    ctx.lineTo(s * 0.18, -s * 0.34);
    ctx.quadraticCurveTo(0, -s * 0.2, -s * 0.18, -s * 0.34);
  } else if (kind === 1) {
    ctx.moveTo(-s * 0.28, -s * 0.38);
    ctx.lineTo(s * 0.28, -s * 0.38);
    ctx.lineTo(s * 0.32, s * 0.42);
    ctx.lineTo(s * 0.04, s * 0.42);
    ctx.lineTo(0, -s * 0.06);
    ctx.lineTo(-s * 0.04, s * 0.42);
    ctx.lineTo(-s * 0.32, s * 0.42);
  } else {
    ctx.moveTo(-s * 0.42, -s * 0.16);
    ctx.lineTo(-s * 0.1, -s * 0.16);
    ctx.quadraticCurveTo(s * 0.0, s * 0.08, s * 0.34, s * 0.12);
    ctx.quadraticCurveTo(s * 0.5, s * 0.16, s * 0.46, s * 0.32);
    ctx.lineTo(-s * 0.42, s * 0.32);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

/** Boton de pestana del armario: icono + nombre; el grupo activo lleva contorno rojo y chulo. */
function drawClosetButton(kind, label) {
  return (ctx, w, h, state) => {
    ctx.clearRect(0, 0, w, h);
    const pad = 8;
    ctx.save();
    ctx.shadowColor = 'rgba(94, 77, 71, 0.3)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = state.selected ? C.paper : C.yellow;
    roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 4, h * 0.28);
    ctx.fill();
    ctx.restore();
    ctx.lineWidth = state.selected ? 9 : 4;
    ctx.strokeStyle = state.selected ? C.red : C.yellowSoft;
    roundRectPath(ctx, pad, pad, w - pad * 2, h - pad * 2 - 4, h * 0.28);
    ctx.stroke();
    drawGarment(ctx, kind, w * 0.2, h * 0.5, h * 0.62, C.ink);
    fitText(ctx, label, w * 0.6, h * 0.5, w * 0.56, { size: h * 0.24, color: C.ink });
  };
}

export class CatalogStationSystem extends createSystem({
  factories: { required: [Factory] },
  items: { required: [CatalogItem, Carryable] },
  held: { required: [CatalogItem, Grabbed] },
  chests: { required: [ChestBox] },
  heldChests: { required: [ChestBox, Grabbed] },
  books: { required: [StickerBook] },
  heldBooks: { required: [StickerBook, Grabbed] },
  zonesPressed: { required: [AvatarZone, Pressed] },
  avatars: { required: [AvatarFigure] },
}) {
  init() {
    this.factory = null;
    this.avatar = null;
    this.zones = [];
    this.cooldown = 0;
    this.bookUi = null; // { prev, next, swatches[] }
    this.closetButtons = [];
    this.pendingIcons = [];
    this.frame = 0;
    this.lastEyeColor = selection.peek().eyeColor;
    this.zoneMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.zoneGeometry = new SphereGeometry(1, 12, 8);
    this.point = new Vector3();
    this.other = new Vector3();
    this.quaternion = new Quaternion();
    this.factoryQuaternion = new Quaternion();

    const refresh = () => this.refresh();
    this.cleanupFuncs.push(
      registerDropHandler('catalog', (entity) => this.onDrop(entity)),
      this.queries.factories.subscribe('qualify', (factory) => this.build(factory)),
      this.queries.factories.subscribe('disqualify', () => {
        this.factory = null;
        this.zones = [];
        this.bookUi = null;
        this.closetButtons = [];
        this.pendingIcons = [];
      }),
      this.queries.avatars.subscribe('qualify', (entity) => {
        this.avatar = entity.object3D?.userData.avatar ?? null;
      }),
      this.queries.avatars.subscribe('disqualify', () => {
        this.avatar = null;
      }),
      this.queries.zonesPressed.subscribe('qualify', (entity) => this.removeWorn(entity)),
      this.queries.heldBooks.subscribe('qualify', () => this.onBookHeld(true)),
      this.queries.heldBooks.subscribe('disqualify', () => this.onBookHeld(false)),
      selection.subscribe((value) => {
        if (value.eyeColor !== this.lastEyeColor) {
          this.lastEyeColor = value.eyeColor;
          setAvatar({ eyeColor: value.eyeColor });
        }
        this.refreshBookUi();
      }),
      phase.subscribe(refresh),
      beltMoving.subscribe(refresh),
      categoryIndex.subscribe(refresh),
      groupIndex.subscribe(refresh),
      avatarConfig.subscribe(refresh),
      () => {
        this.zoneMaterial.dispose();
        this.zoneGeometry.dispose();
      },
    );
  }

  /** Estacion con catalogo que esta lista para usarse (el personaje ya llego); si no, -1. */
  activeStation() {
    if (phase.peek() !== Phase.Customizing || beltMoving.peek()) return -1;
    return CATALOGS[categoryIndex.peek()] ? categoryIndex.peek() : -1;
  }

  // ---------- Construccion ----------
  build(factory) {
    this.factory = factory;
    const l = layout.peek();
    this.buildBook(factory, l);
    this.buildCloset(factory, l);
    this.buildChests(factory, l);
    for (const [station, catalog] of Object.entries(CATALOGS)) {
      // Zonas tocables sobre el personaje para retirar lo puesto
      for (const def of catalog.zones) {
        const mesh = new Mesh(this.zoneGeometry, this.zoneMaterial);
        mesh.name = `Zone/${def.key}`;
        mesh.scale.setScalar(0.0001);
        const entity = this.world.createTransformEntity(mesh, { parent: factory });
        entity.addComponent(FactoryPart);
        entity.addComponent(AvatarZone, { slot: def.key });
        entity.addComponent(PokeInteractable);
        this.zones.push({ entity, mesh, def, station: Number(station) });
      }
    }
    this.refresh();
  }

  /** Libro de stickers sobre el mueble del modelo: se agarra con una mano y se abre. */
  buildBook(factory, l) {
    const book = createBook();
    const home = modelFrame(l, FURNITURE.book, 0, 0, 0, SLOT_OF[FACE]);
    book.position.set(home.x, home.y, home.z);
    book.rotation.y = home.rotY;
    const entity = this.world.createTransformEntity(book, { parent: factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(StickerBook);
    entity.addComponent(Carryable, { kind: 'book', home: [home.x, home.y, home.z], homeYaw: home.rotY });
    entity.addComponent(OneHandGrabbable);

    // Flechas y muestras de color: hijas del libro, planas sobre las paginas
    const flat = (item, x, z) => {
      item.mesh.rotation.x = -Math.PI / 2;
      item.mesh.position.set(x, 0.014, z);
      item.mesh.userData.silent = false;
      return item;
    };
    const arrow = (direction) =>
      flat(
        addItem(this.world, entity, {
          width: 0.05,
          height: 0.032,
          pxPerMeter: 1400,
          name: direction < 0 ? 'page-prev' : 'page-next',
          draw: (ctx, w, h, state) => drawPill(ctx, w, h, direction < 0 ? '‹' : '›', { hovered: !!state.hovered, size: h * 0.62 }),
          onPress: () => this.turnPage(direction),
        }),
        direction * 0.1,
        BOOK.open[1] / 2 - 0.028,
      );
    const swatches = EYE_COLORS.map((color, i) => {
      const [x, z] = bookSlot({ kind: 'swatch' }, i, EYE_COLORS.length);
      const item = addItem(this.world, entity, {
        width: 0.044,
        height: 0.044,
        pxPerMeter: 1400,
        name: `eye-color-${color.id}`,
        draw: (ctx, w, h, state) => drawSwatch(ctx, w, h, color.id, !!state.selected),
        onPress: () => select('eyeColor', color.id),
      });
      item.mesh.userData.silent = true;
      return { item: flat(item, x, z), id: color.id };
    });
    this.bookUi = { entity, prev: arrow(-1), next: arrow(1), swatches };
    this.refreshBookUi();
  }

  /** Tres botones en los bloques tipo cajon que estan junto al armario. */
  buildCloset(factory, l) {
    const catalog = CATALOGS[CLOTHES];
    catalog.groups.forEach((group, i) => {
      const home = modelFrame(l, FURNITURE.closetButtons, 0, 0, (1 - i) * 0.094, SLOT_OF[CLOTHES]);
      const parent = new Group();
      parent.position.set(home.x, home.y, home.z);
      parent.rotation.y = home.rotY;
      const entity = this.world.createTransformEntity(parent, { parent: factory });
      entity.addComponent(FactoryPart);
      const item = addItem(this.world, entity, {
        z: 0.012,
        width: 0.15,
        height: 0.08,
        pxPerMeter: 1200,
        name: `closet-button-${group.apply}`,
        draw: drawClosetButton(i, group.label),
        onPress: () => {
          groupIndex.value = i;
        },
      });
      item.mesh.userData.silent = true;
      this.closetButtons.push({ item, parent, index: i });
    });
  }

  /** Seis cajas cerradas: tres arriba (sobre la mesa) y tres abajo; cada una con el icono de su charm. */
  buildChests(factory, l) {
    const { x, yTop, yBottom, zTop, zBottom } = FURNITURE.boxes;
    const group = CATALOGS[CHARMS].groups[0];
    for (const [id, row, col] of CHEST_LAYOUT) {
      const option = group.ids.includes(id) ? id : null;
      if (!option) continue;
      const label = this.charmName(id);
      const chest = createChest(label);
      const home = modelFrame(l, [x[col], row === 0 ? yTop : yBottom, row === 0 ? zTop : zBottom], 0, 0, 0, SLOT_OF[CHARMS]);
      chest.position.set(home.x, home.y, home.z);
      chest.rotation.y = home.rotY;
      const entity = this.world.createTransformEntity(chest, { parent: factory });
      entity.addComponent(FactoryPart);
      entity.addComponent(ChestBox, { charm: id });
      entity.addComponent(Carryable, { kind: 'chest', home: [home.x, home.y, home.z], homeYaw: home.rotY });
      entity.addComponent(OneHandGrabbable);
      this.pendingIcons.push({ id, chest });
    }
  }

  charmName(id) {
    return {
      'bolsa-dinero': 'Bolsa de dinero',
      guitarra: 'Guitarra',
      moneda: 'Moneda',
      tulipan: 'Tulipán',
      'nota-musical': 'Nota musical',
      regalo: 'Regalo',
    }[id];
  }

  /** Dibuja el icono de un charm (una caja por cuadro: el render del modelo es lo que mas cuesta). */
  drawNextIcon() {
    const { id, chest } = this.pendingIcons.shift();
    const model = makePart(CATALOGS[CHARMS].groups[0], id);
    if (!model) return;
    const url = renderObjectIcon(this.renderer, model, 256);
    const image = new Image();
    image.onload = () => chest.userData.icon.redraw({ image });
    image.src = url;
  }

  // ---------- Libro ----------
  onBookHeld(open) {
    const book = this.queries.books.entities.values().next().value?.object3D;
    book?.userData.setOpen(open);
    if (open) sfx.select();
    this.refreshBookUi();
    this.refresh();
  }

  bookOpen() {
    return this.queries.heldBooks.entities.size > 0 && this.activeStation() === FACE;
  }

  turnPage(direction) {
    if (this.cooldown > 0 || !this.bookOpen()) return;
    const next = groupIndex.peek() + direction;
    if (next < 0 || next >= CATALOGS[FACE].groups.length) return;
    groupIndex.value = next;
    this.cooldown = PAGE_COOLDOWN;
  }

  refreshBookUi() {
    const ui = this.bookUi;
    if (!ui) return;
    const open = this.bookOpen();
    const page = Math.min(groupIndex.peek(), CATALOGS[FACE].groups.length - 1);
    const group = CATALOGS[FACE].groups[page];
    ui.prev.setShown(open && page > 0);
    ui.next.setShown(open && page < CATALOGS[FACE].groups.length - 1);
    const chosen = selection.peek().eyeColor;
    for (const { item, id } of ui.swatches) {
      item.setShown(open && group.kind === 'swatch');
      item.redraw({ selected: id === chosen });
    }
    const book = this.queries.books.entities.values().next().value?.object3D;
    book?.userData.spread.redraw({
      title: group.label,
      hint: group.kind === 'sticker' ? 'Saca un sticker con la otra mano y llevalo a la cara' : 'Toca un color',
      dots: { total: CATALOGS[FACE].groups.length, current: page },
    });
  }

  // ---------- Objetos del mueble ----------
  /** Deja en cada mueble exactamente los objetos que corresponden ahora (menos lo que esta puesto). */
  refresh() {
    if (!this.factory) return;
    const station = this.activeStation();
    const catalog = CATALOGS[station];
    const config = avatarConfig.peek();
    const wanted = new Map(); // clave -> { group, index, count }
    let group = null;
    if (station === FACE && this.bookOpen()) {
      group = catalog.groups[Math.min(groupIndex.peek(), catalog.groups.length - 1)];
      if (group.kind !== 'sticker') group = null;
    } else if (station === CLOTHES) {
      group = catalog.groups[Math.min(groupIndex.peek(), catalog.groups.length - 1)];
    } else if (station === CHARMS) {
      group = catalog.groups[1]; // accesorios (los charms salen de las cajas)
    }
    if (group) {
      const ids = group.ids.filter((id) => group.kind === 'sticker' || config[group.apply] !== id);
      ids.forEach((id, index) => wanted.set(`${group.apply}/${id}`, { group, index, count: ids.length }));
    }
    const have = new Set();
    for (const entity of Array.from(this.queries.items.entities)) {
      const object = entity.object3D;
      if (object?.userData.anchor?.chest) continue; // los charms de las cajas los gestiona updateChests
      const key = `${entity.getValue(CatalogItem, 'key')}/${entity.getValue(CatalogItem, 'itemId')}`;
      if (wanted.has(key)) {
        have.add(key);
      } else if (!this.queries.held.entities.has(entity)) {
        entity.dispose(); // un objeto agarrado se retira al soltarlo (ver onDrop)
      }
    }
    wanted.forEach((info, key) => {
      if (!have.has(key)) this.spawn(station, info.group, info.index, info.count, key.slice(key.indexOf('/') + 1));
    });
    this.refreshClosetButtons();
  }

  refreshClosetButtons() {
    const show = this.activeStation() === CLOTHES;
    const active = Math.min(groupIndex.peek(), CATALOGS[CLOTHES].groups.length - 1);
    for (const { item, parent, index } of this.closetButtons) {
      parent.visible = show;
      parent.scale.setScalar(show ? 1 : 0.0001);
      item.redraw({ selected: index === active });
    }
  }

  /** Crea el objeto de un grupo en su sitio del mueble (libro, balda o vitrina). */
  spawn(station, group, index, count, id) {
    const l = layout.peek();
    const root = new Group();
    root.name = `Item/${group.apply}/${id}`;
    const patch = { key: group.apply, itemId: id, target: group.target, kind: group.kind };
    let base = 1;
    let home = { x: 0, y: 0, z: 0, rotY: 0 };
    let anchor = null;
    if (group.kind === 'sticker') {
      root.add(createSticker(stickerTexture[group.apply](id)));
      const book = this.queries.books.entities.values().next().value?.object3D;
      const [bx, bz] = bookSlot(group, index, count);
      anchor = { object: book, local: new Vector3(bx, STICKER_LIFT, bz), keep: true };
    } else {
      const model = makePart(group, id);
      if (!model) return;
      root.add(model);
      if (station === CLOTHES) {
        const s = modelScale(l);
        const [t, r, u] = wardrobeSlot(index, 3 * s);
        home = modelFrame(l, FURNITURE.wardrobe, t, r, u, SLOT_OF[CLOTHES]);
        base = PROP_SCALE * 0.85;
      } else {
        // Dos filas escalonadas: pares delante, impares detras y corridos media casilla
        const { x, y, z } = FURNITURE.accessories;
        const row = index % 2;
        const cols = Math.ceil(count / 2);
        const pitch = (x[1] - x[0]) / Math.max(cols - 0.5, 1);
        const mx = x[0] + pitch * (Math.floor(index / 2) + row * 0.5);
        home = modelFrame(l, [mx, y[row], z], 0, 0, 0.04, SLOT_OF[CHARMS]);
        base = ACCESSORY_SCALE;
      }
    }
    root.userData.base = base;
    root.userData.grow = 0;
    root.userData.anchor = anchor;
    root.scale.setScalar(0.0001);
    root.position.set(home.x, home.y, home.z);
    root.rotation.y = home.rotY;
    const entity = this.world.createTransformEntity(root, { parent: this.factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(CatalogItem, patch);
    entity.addComponent(Carryable, {
      kind: 'catalog',
      locked: true,
      home: [home.x, home.y, home.z],
      homeYaw: home.rotY,
    });
    entity.addComponent(OneHandGrabbable);
  }

  /** El charm de una caja abierta: flota sobre ella y se saca con la otra mano. */
  spawnCharm(chestEntity) {
    const id = chestEntity.getValue(ChestBox, 'charm');
    const group = CATALOGS[CHARMS].groups[0];
    const model = makePart(group, id);
    if (!model) return null;
    const root = new Group();
    root.name = `Item/companion/${id}`;
    root.add(model);
    root.userData.base = CHARM_SCALE;
    root.userData.grow = 0;
    root.userData.anchor = { object: chestEntity.object3D, local: new Vector3(0, CHEST.height + CHARM_LIFT, CHEST.depth * 0.25), chest: chestEntity };
    root.scale.setScalar(0.0001);
    const entity = this.world.createTransformEntity(root, { parent: this.factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(CatalogItem, { key: 'companion', itemId: id, target: 'body', kind: 'part' });
    entity.addComponent(Carryable, { kind: 'catalog', locked: true });
    entity.addComponent(OneHandGrabbable);
    return entity;
  }

  // ---------- Colocar y retirar ----------
  /** Punto del personaje donde se suelta cada tipo de objeto. */
  targetPoint(target, out) {
    if (target === 'head') return this.avatar.headGroup.getWorldPosition(out);
    this.avatar.root.getWorldPosition(out);
    out.y += target === 'feet' ? 0.03 : AVATAR_HEIGHT * 0.5;
    return out;
  }

  /** Al soltar: cerca del personaje se coloca; si no, vuelve solo a su sitio. */
  onDrop(entity) {
    const object = entity.object3D;
    if (!object || !this.avatar) return;
    const target = entity.getValue(CatalogItem, 'target');
    object.getWorldPosition(this.other);
    if (this.other.distanceTo(this.targetPoint(target, this.point)) > SNAP[target]) {
      if (!object.userData.anchor) this.refresh(); // los del libro y las cajas se reenganchan solos
      return;
    }
    const key = entity.getValue(CatalogItem, 'key');
    const patch = { [key]: entity.getValue(CatalogItem, 'itemId') };
    // El overol tapa la camiseta: ponerse una camiseta cambia el overol por el short
    if (key === 'shirt' && avatarConfig.peek().pants === 'overol') patch.pants = 'short';
    if (!object.userData.anchor?.keep) entity.dispose(); // la prenda, el accesorio o el charm pasa al personaje
    setAvatar(patch); // refresh() ajusta el mueble: la pieza que se quito vuelve a su sitio
    sfx.ding();
  }

  removeWorn(entity) {
    const zone = this.zones.find((z) => z.entity === entity);
    if (!zone || this.activeStation() !== zone.station || interactionBusy()) return;
    if (avatarConfig.peek()[zone.def.key] === 'none') return;
    setAvatar({ [zone.def.key]: 'none' });
    sfx.select();
  }

  // ---------- Cuadro a cuadro ----------
  updateItems(delta, time) {
    const factoryObject = this.factory?.object3D;
    if (!factoryObject) return;
    factoryObject.getWorldQuaternion(this.factoryQuaternion).invert();
    for (const entity of this.queries.items.entities) {
      const object = entity.object3D;
      if (!object) continue;
      let k = 1;
      if (object.userData.grow !== undefined) {
        object.userData.grow += delta;
        const t = Math.min(object.userData.grow / GROW_SECONDS, 1);
        k = easeOutBack(t);
        if (t >= 1) {
          delete object.userData.grow;
          if (!object.userData.anchor) entity.setValue(Carryable, 'locked', false);
        }
      }
      object.scale.setScalar(Math.max(object.userData.base * k, 0.0001));
      // Los stickers y los charms siguen a su libro o caja (si nadie los sostiene)
      const anchor = object.userData.anchor;
      if (anchor?.object && !this.queries.held.entities.has(entity)) {
        this.point.copy(anchor.local);
        anchor.object.localToWorld(this.point);
        if (anchor.chest) this.point.y += Math.sin(time * 2.4) * 0.006;
        factoryObject.worldToLocal(this.point);
        object.position.copy(this.point);
        anchor.object.getWorldQuaternion(this.quaternion).premultiply(this.factoryQuaternion);
        object.quaternion.copy(this.quaternion);
      }
    }
  }

  /** Las cajas se abren al agarrarlas (una mano) y se cierran al soltarlas; el charm sale de la caja abierta. */
  updateChests(delta) {
    const active = this.activeStation() === CHARMS;
    for (const chestEntity of this.queries.chests.entities) {
      const chest = chestEntity.object3D;
      if (!chest) continue;
      const held = this.queries.heldChests.entities.has(chestEntity);
      const target = held && active ? 1 : 0;
      const data = chest.userData;
      const previous = data.open;
      data.open += (target - data.open) * Math.min(1, delta * 9);
      if (Math.abs(data.open - target) < 0.004) data.open = target;
      data.lid.rotation.x = -data.open * CHEST_OPEN;
      if (previous < 0.1 && data.open >= 0.1 && target === 1) sfx.thunk();

      const id = chestEntity.getValue(ChestBox, 'charm');
      if (held && active && !data.charm && avatarConfig.peek().companion !== id) {
        data.charm = this.spawnCharm(chestEntity);
      }
      if (data.charm && !data.charm.active) data.charm = null; // se coloco en el personaje
      // Al soltar la caja y cerrarse, el charm vuelve dentro (salvo que alguien lo tenga en la mano)
      if (data.charm && !held && data.open < 0.05 && !this.queries.held.entities.has(data.charm)) {
        data.charm.dispose();
        data.charm = null;
      }
    }
  }

  /** Cada zona sigue a su parte del personaje y solo existe si hay algo puesto ahi. */
  updateZones() {
    const factoryObject = this.factory?.object3D;
    if (!this.avatar || !factoryObject) return;
    const station = this.activeStation();
    const config = avatarConfig.peek();
    for (const zone of this.zones) {
      const show = station === zone.station && config[zone.def.key] !== 'none';
      zone.mesh.scale.setScalar(show ? zone.def.radius : 0.0001);
      if (!show) continue;
      const { space, at } = zone.def;
      this.point.fromArray(at);
      if (space === 'head') this.avatar.headGroup.localToWorld(this.point);
      else if (space === 'root') this.avatar.root.localToWorld(this.point);
      else this.avatar.parts.companion?.getWorldPosition(this.point);
      zone.mesh.position.copy(factoryObject.worldToLocal(this.point));
    }
  }

  update(delta, time) {
    if (this.cooldown > 0) this.cooldown -= delta;
    if (this.pendingIcons.length && this.frame++ % 6 === 0) this.drawNextIcon();
    this.updateItems(delta, time);
    this.updateChests(delta);
    this.updateZones();
  }
}
