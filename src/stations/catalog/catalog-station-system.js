/* Estaciones 3 (rostro), 4 (ropa y accesorios) y 5 (charms). Sin paneles: todo se hace con los objetos del modelo,
   siempre de frente al usuario.
   - Rostro: el LIBRO de stickers se agarra con una mano y se abre (ojos, color de ojos, boca, nariz; las
     flechas del libro pasan de pagina). Con la otra mano se saca un sticker y se suelta sobre la cara.
   - Ropa y accesorios: los objetos del grupo activo estan en las baldas del armario del modelo, donde el equipo puso
     las camisas de referencia; los cuatro botones del modelo (camisetas, pantalones, zapatos, accesorios) cambian el grupo.
   - Charms: las seis cajas del modelo, cerradas y con el icono de su charm. Al agarrar una con una mano se
     abren las solapas y de ella se saca el charm.
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
import { addModelButton } from '../../factory/model-nodes.js';
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
import { avatarHeight, avatarScale } from '../../systems/belt-system.js';
import { C } from '../../ui/theme.js';
import { addItem, canvasPlane, drawPill, drawSwatch, text } from '../../ui/world-ui.js';
import { pageSurface } from './book-surface.js';
import { createSticker } from './catalog-props.scene-asset.js';
import {
  CATALOGS,
  CHARMS,
  CHEST_NODES,
  CLOTHES,
  FACE,
  FURNITURE,
  bookSlot,
  closetSlot,
  stickerTexture,
} from './catalog-config.js';

const SLOT_OF = { [FACE]: 3, [CLOTHES]: 4, [CHARMS]: 5 }; // slot de la banda de cada estacion
const CHARM_SCALE = 1.6; // los charms se ven mas grandes (x escala del muñeco) al salir de la caja
const SNAP = { head: 0.26, body: 0.28, feet: 0.24 }; // metros del objeto al lugar donde va
const GROW_SECONDS = 0.35;
const PAGE_COOLDOWN = 0.35;
const STICKER_LIFT = 0.003; // los stickers van pegados a la pagina (apenas separados para que no se crucen con la hoja)
const BOOK_EXTRA = 1.7; // el libro del modelo se agranda para que las paginas alberguen los stickers (queda de ~0,32 x 0,24 m)
const Z_AXIS = new Vector3(0, 0, 1);
const Y_AXIS = new Vector3(0, 1, 0);
const CHEST_ICON_Y = 1.22; // alto del icono sobre la tapa, en unidades de la caja (la tapa cerrada llega a 1,19)
// Interior de la caja (unidades de la caja; el modelo mide 2 de ancho): el suelo interior esta en -0,43 y las paredes
// llegan a 1,08. El charm se ajusta para caber con holgura, apoyado sobre el suelo, sin tocar paredes ni solapas.
const CHEST_FLOOR = -0.43;
const CHARM_FIT = { width: 1.55, height: 1.4, rest: 0.02 }; // espacio util (ancho x fondo, alto) y separacion del suelo: llena la caja y asoma hasta cerca de la boca

/** Si alguna pieza sale al reves en el mueble, se corrige aqui: rotacion [x, y, z] en radianes por "clave/id". */
const DISPLAY_FIX = {};

const noRaycast = () => {};
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
    this.bookUi = null; // { prev, next, swatches[], label }
    this.bookUnit = 0.1; // metros por unidad local del libro del modelo
    this.bookNode = null;
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
        this.bookNode = null;
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
    this.buildCloset(factory);
    this.buildChests(factory);
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

  /** El libro de stickers es el libro "libro_ojos" del modelo: se saca del modelo, se pone de frente al usuario (el lomo queda
      vertical, con una hoja a cada lado) y se agranda un poco. Se agarra con una mano. Sus paginas llevan los stickers pegados,
      las muestras de color y las flechas, todo apoyado sobre la superficie de la hoja (ver book-surface.js). */
  buildBook(factory, l) {
    const node = factory.object3D.userData.parts?.nodes?.libro_ojos;
    if (!node) {
      console.warn('[libro] No hay un nodo "libro_ojos" en la fabrica');
      return;
    }
    const unit = node.scale.x * BOOK_EXTRA * modelScale(l); // metros por unidad local del nodo
    this.bookUnit = unit;
    const book = new Group();
    book.name = 'StickerBook';
    node.removeFromParent();
    node.visible = true;
    node.quaternion.identity();
    node.rotation.set(0, Math.PI / 2, 0); // el lomo del modelo va a lo largo de x: gira 90 grados para que quede vertical
    node.scale.setScalar(unit);
    node.position.set(0, 0.265 * unit, 0); // el fondo de la cubierta queda en y = 0
    book.add(node);
    this.bookNode = node;
    const home = modelFrame(l, FURNITURE.book, 0, 0, 0, SLOT_OF[FACE]);
    book.position.set(home.x, home.y, home.z);
    book.rotation.y = home.rotY;
    const entity = this.world.createTransformEntity(book, { parent: factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(StickerBook);
    entity.addComponent(Carryable, { kind: 'book', home: [home.x, home.y, home.z], homeYaw: home.rotY });
    entity.addComponent(OneHandGrabbable);

    // Titulo de la pagina, flechas y muestras de color: pegados a las hojas (inclinados con ellas)
    const onPage = (item, x, z, lift = 0.003) => {
      const surface = pageSurface(unit, x, z);
      item.mesh.position.set(x, surface.y + lift, z);
      item.mesh.quaternion.setFromUnitVectors(Z_AXIS, surface.normal); // la imagen mira hacia arriba y su "arriba" queda hacia el lomo de atras
      item.mesh.userData.silent = false;
      return item;
    };
    const arrow = (direction) =>
      onPage(
        addItem(this.world, entity, {
          width: 0.045,
          height: 0.028,
          pxPerMeter: 1400,
          name: direction < 0 ? 'page-prev' : 'page-next',
          draw: (ctx, w, h, state) => drawPill(ctx, w, h, direction < 0 ? '‹' : '›', { hovered: !!state.hovered, size: h * 0.62 }),
          onPress: () => this.turnPage(direction),
        }),
        direction * 0.12,
        0.088,
      );
    const swatches = EYE_COLORS.map((color, i) => {
      const [x, z] = bookSlot({ kind: 'swatch' }, i, EYE_COLORS.length);
      const item = addItem(this.world, entity, {
        width: 0.04,
        height: 0.04,
        pxPerMeter: 1400,
        name: `eye-color-${color.id}`,
        draw: (ctx, w, h, state) => drawSwatch(ctx, w, h, color.id, !!state.selected),
        onPress: () => select('eyeColor', color.id),
      });
      item.mesh.userData.silent = true;
      return { item: onPage(item, x, z), id: color.id };
    });
    const label = addItem(this.world, entity, {
      width: 0.2,
      height: 0.03,
      pxPerMeter: 1400,
      name: 'page-title',
      draw: (ctx, w, h, state) => {
        ctx.clearRect(0, 0, w, h);
        text(ctx, state.title ?? '', w / 2, h * 0.42, { size: h * 0.62, weight: 800, color: C.ink });
        if (state.dots) {
          for (let i = 0; i < state.dots.total; i++) {
            ctx.fillStyle = i === state.dots.current ? C.red : C.yellowSoft;
            ctx.beginPath();
            ctx.arc(w / 2 + (i - (state.dots.total - 1) / 2) * h * 0.34, h * 0.9, h * 0.1, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      },
    });
    label.mesh.userData.silent = true;
    label.mesh.userData.noPress = true; // solo es una rotulacion
    onPage(label, 0, -0.088);
    this.bookUi = { entity, prev: arrow(-1), next: arrow(1), swatches, label };
    this.refreshBookUi();
  }

  /** Los cuatro botones del modelo (camisa, pantalon, zapatos, accesorios) cambian el grupo del armario. */
  buildCloset(factory) {
    const catalog = CATALOGS[CLOTHES];
    catalog.groups.forEach((group, i) => {
      const button = addModelButton(this.world, factory, group.button, {
        slot: SLOT_OF[CLOTHES],
        depth: 0.007,
        onPress: () => {
          groupIndex.value = i;
        },
      });
      if (button) this.closetButtons.push({ button, index: i });
    });
  }

  /** Las seis cajas del modelo: cada una guarda un charm. Salen del modelo para poder agarrarse; las solapas estan
      cerradas (forma base) y se abren al agarrarlas (morph target "abierta"). */
  buildChests(factory) {
    const root = factory.object3D;
    const nodes = root.userData.parts.nodes;
    for (const [nodeName, charm] of Object.entries(CHEST_NODES)) {
      const node = nodes[nodeName];
      if (!node) continue;
      root.attach(node); // sale del modelo y queda en la fabrica, en el mismo sitio
      const meshes = [];
      node.traverse((object) => {
        if (object.isMesh && object.morphTargetInfluences?.length) meshes.push(object);
      });
      // Icono del charm sobre la tapa (se ve cerrada; se oculta al abrirse)
      const icon = canvasPlane(1.6, 1.6, 280, (ctx, w, h, state) => {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = C.panel;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w * 0.48, 0, Math.PI * 2);
        ctx.fill();
        ctx.lineWidth = 7;
        ctx.strokeStyle = C.yellowSoft;
        ctx.stroke();
        if (state.image) ctx.drawImage(state.image, w * 0.12, h * 0.12, w * 0.76, h * 0.76);
      });
      icon.mesh.rotation.x = -Math.PI / 2;
      icon.mesh.position.set(0, CHEST_ICON_Y, 0);
      icon.mesh.renderOrder = 13;
      node.add(icon.mesh);
      node.userData.meshes = meshes;
      node.userData.open = 0;
      node.userData.icon = icon;
      const entity = this.world.createTransformEntity(node, { parent: factory });
      entity.addComponent(FactoryPart);
      entity.addComponent(ChestBox, { charm });
      entity.addComponent(Carryable, {
        kind: 'chest',
        home: [node.position.x, node.position.y, node.position.z],
        homeYaw: node.rotation.y,
      });
      // La caja solo gira alrededor de la vertical: nunca se inclina (ni se hunde en la balda ni derrama el charm)
      entity.addComponent(OneHandGrabbable, { rotateMin: [0, -Infinity, 0], rotateMax: [0, Infinity, 0] });
      node.userData.homeY = node.position.y; // altura de reposo: el fondo de la caja queda justo sobre la balda
      this.pendingIcons.push({ id: charm, node });
    }
  }

  /** Dibuja el icono de un charm (una caja por cuadro: el render del modelo es lo que mas cuesta). */
  drawNextIcon() {
    const { id, node } = this.pendingIcons.shift();
    const model = makePart(CATALOGS[CHARMS].groups[0], id);
    if (!model) return;
    const url = renderObjectIcon(this.renderer, model, 256);
    const image = new Image();
    image.onload = () => node.userData.icon?.redraw({ image });
    image.src = url;
  }

  // ---------- Libro ----------
  onBookHeld(held) {
    if (held) sfx.select();
    // En la mano, el libro deja de ser un objetivo de agarre (como las cajas abiertas): la otra mano alcanza los stickers de
    // sus paginas en vez de "agarrar" el libro, que ya esta sostenido
    this.bookNode?.traverse((object) => {
      if (!object.isMesh) return;
      object.userData.rayCast ??= object.raycast;
      object.raycast = held ? noRaycast : object.userData.rayCast;
    });
  }

  /** El libro del modelo esta siempre abierto: sus paginas se ven (con los stickers) mientras la estacion esta activa. */
  bookOpen() {
    return this.activeStation() === FACE && this.bookUi !== null;
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
    ui.label.setShown(open);
    ui.label.redraw({ title: group.label, dots: { total: CATALOGS[FACE].groups.length, current: page } });
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
    }
    if (group) {
      // Cada objeto tiene su sitio fijo en el mueble (su lugar en la lista); lo que se lleva puesto deja el hueco
      const ids = group.ids.filter((id) => group.kind === 'sticker' || config[group.apply] !== id);
      ids.forEach((id, index) =>
        wanted.set(`${group.apply}/${id}`, { group, index: group.kind === 'sticker' ? index : group.ids.indexOf(id), count: ids.length }),
      );
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
    for (const { button, index } of this.closetButtons) {
      button.setShown(show);
      button.setSelected(show && index === active);
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
      const book = this.queries.books.entities.values().next().value?.object3D;
      if (!book) return;
      root.add(createSticker(stickerTexture[group.apply](id)));
      // Pegado a la hoja: sobre su superficie en ese punto y con su inclinacion
      const [bx, bz] = bookSlot(group, index, count);
      const surface = pageSurface(this.bookUnit, bx, bz);
      anchor = {
        object: book,
        local: new Vector3(bx, surface.y + STICKER_LIFT, bz),
        tilt: new Quaternion().setFromUnitVectors(Y_AXIS, surface.normal),
        keep: true,
      };
    } else {
      const model = makePart(group, id);
      if (!model) return;
      root.add(model);
      // Armario: el sitio sale de las camisas de referencia del modelo; lo pequeño se apoya en la balda
      const small = group.small || group.apply === 'shoes';
      home = modelFrame(l, closetSlot(index, small), 0, 0, 0, SLOT_OF[CLOTHES]);
      base = avatarScale();
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

  /** El charm de una caja abierta: se queda DENTRO, apoyado en el fondo y a la vista por la boca abierta; se saca con la otra mano.
      Su tamano se ajusta al interior de la caja para que no toque las paredes ni se salga. */
  spawnCharm(chestEntity) {
    const id = chestEntity.getValue(ChestBox, 'charm');
    const group = CATALOGS[CHARMS].groups[0];
    const model = makePart(group, id);
    if (!model) return null;
    const chest = chestEntity.object3D;
    const root = new Group();
    root.name = `Item/companion/${id}`;
    root.add(model);

    // Medidas del charm (el modelo ya viene centrado en el origen) y de la caja, en metros de la fabrica
    const size = new Box3().setFromObject(root).getSize(new Vector3());
    const unit = chest.scale.x; // metros por unidad de la caja
    const fit = unit * Math.min(CHARM_FIT.width / size.x, CHARM_FIT.width / size.z, CHARM_FIT.height / size.y);
    const base = fit; // el mayor tamano que cabe en la caja
    const halfHeight = (size.y * base) / unit / 2; // en unidades de la caja
    root.userData.base = base;
    root.userData.grow = 0;
    root.userData.anchor = {
      object: chest,
      local: new Vector3(0, CHEST_FLOOR + CHARM_FIT.rest + halfHeight, 0),
      chest: chestEntity,
    };
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
    out.y += target === 'feet' ? 0.03 : avatarHeight() * 0.5;
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
        k = object.userData.anchor?.chest ? 1 - (1 - t) ** 3 : easeOutBack(t); // el de la caja no rebasa su tamano
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
        factoryObject.worldToLocal(this.point);
        object.position.copy(this.point);
        anchor.object.getWorldQuaternion(this.quaternion).premultiply(this.factoryQuaternion);
        if (anchor.tilt) this.quaternion.multiply(anchor.tilt); // la inclinacion de la hoja en ese punto
        object.quaternion.copy(this.quaternion);
      }
    }
  }

  /** Activa o desactiva el apuntado (rayo, dedo y agarre cercano) sobre las mallas de la caja. */
  setChestPickable(chest, pickable) {
    if (chest.userData.pickable === pickable) return;
    chest.userData.pickable = pickable;
    chest.traverse((object) => {
      if (!object.isMesh) return;
      object.userData.rayCast ??= object.raycast;
      object.raycast = pickable ? object.userData.rayCast : noRaycast;
    });
  }

  /** Las cajas se abren al agarrarlas (una mano) y se cierran al soltarlas; el charm sale de la caja abierta. */
  updateChests(delta) {
    const active = this.activeStation() === CHARMS;
    for (const chestEntity of this.queries.chests.entities) {
      const chest = chestEntity.object3D;
      if (!chest) continue;
      const held = this.queries.heldChests.entities.has(chestEntity);
      // Colision con la balda: sostenida, la caja no baja de su altura de reposo (su fondo no atraviesa la balda)
      if (held && chest.position.y < chest.userData.homeY) chest.position.y = chest.userData.homeY;
      const data = chest.userData;
      const target = held && active ? 1 : 0;
      // Abierta y en la mano, la caja deja de ser un objetivo de agarre: su malla ocupa el mismo volumen que el charm de
      // dentro y la otra mano "agarraba" la caja (ya sostenida) en lugar del charm. Al soltarla vuelve a ser agarrable.
      this.setChestPickable(chest, !(held && data.open > 0.05));
      const previous = data.open;
      data.open += (target - data.open) * Math.min(1, delta * 9);
      if (Math.abs(data.open - target) < 0.004) data.open = target;
      for (const mesh of data.meshes) mesh.morphTargetInfluences[0] = data.open; // 0 = solapas cerradas, 1 = abiertas
      if (data.icon) data.icon.mesh.visible = data.open < 0.45;
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
