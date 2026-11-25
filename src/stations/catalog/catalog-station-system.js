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
  BoxGeometry,
  Matrix4,
  createSystem,
  Grabbed,
  GrabSystem,
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
import { beginExternalHold, endExternalHold, interactionBusy, registerDropHandler } from '../../interaction/carryable-system.js';
import { jointWorld } from '../../interaction/hand-joints.js';
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
import { BOOK_COVER_WIDTH, flattenPages, pageTop } from './book-surface.js';
import { createSticker } from './catalog-props.scene-asset.js';
import {
  CATALOGS,
  CHARMS,
  CHEST_NODES,
  CLOTHES,
  FACE,
  FACE_TABS,
  FURNITURE,
  bookSlot,
  closetSlot,
  stickerTexture,
} from './catalog-config.js';

const SLOT_OF = { [FACE]: 3, [CLOTHES]: 4, [CHARMS]: 5 }; // slot de la banda de cada estacion
const CHARM_SCALE = 1.6; // los charms se ven mas grandes (x escala del muñeco) al salir de la caja
const SNAP = { head: 0.26, body: 0.28, feet: 0.24 }; // metros del objeto al lugar donde va
const GROW_SECONDS = 0.35;
const STICKER_LIFT = 0.002; // los stickers van pegados a la pagina (apenas separados para que no se crucen con la hoja)
const CHEST_ICON_Y = 1.22; // alto del icono sobre la tapa, en unidades de la caja (la tapa cerrada llega a 1,19)
// Interior de la caja (unidades de la caja; el modelo mide 2 de ancho): el suelo interior esta en -0,43 y las paredes
// llegan a 1,08. El charm se ajusta para caber con holgura, apoyado sobre el suelo, sin tocar paredes ni solapas.
const CHEST_FLOOR = -0.43;
const CHARM_FIT = { width: 1.55, height: 1.4, rest: 0.02 }; // espacio util (ancho x fondo, alto) y separacion del suelo: llena la caja y asoma hasta cerca de la boca

/** Si alguna pieza sale al reves en el mueble, se corrige aqui: rotacion [x, y, z] en radianes por "clave/id". */
const DISPLAY_FIX = {};

const noRaycast = () => {};
// Agarre propio del charm de una caja abierta (seguimiento de manos): pellizco = pulgar e indice a menos de PINCH_CLOSE; se suelta al
// separarlos mas de PINCH_OPEN. El charm se toma si el punto de pellizco esta a menos de CHARM_REACH de su centro.
const PINCH_CLOSE = 0.036; // generoso: basta con acercar pulgar e indice, sin apretar con precision
const PINCH_OPEN = 0.045;
const CHARM_REACH = 0.14; // del punto de pellizco al centro del charm
const CHARM_EDGE = 0.05; // o a su zona de agarre (la caja que lo envuelve): cualquiera de las dos basta
const charmGrabGeometry = new BoxGeometry(1, 1, 1);
const charmGrabMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

/** Pestaña divisoria de carpeta: borde de arriba redondeado, del color de su categoria; la elegida va viva y con el rotulo oscuro,
    las demas palidas. */
function drawFolderTab(ctx, w, h, tab, selected, hovered) {
  ctx.clearRect(0, 0, w, h);
  const r = h * 0.34;
  ctx.save();
  ctx.shadowColor = 'rgba(94, 77, 71, 0.3)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = selected ? tab.color : hovered ? '#F4EEDA' : '#E6DFC8';
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 8, [r, r, 0, 0]);
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = selected ? 6 : 3;
  ctx.strokeStyle = selected ? C.red : C.yellowSoft;
  ctx.beginPath();
  ctx.roundRect(8, 8, w - 16, h - 8, [r, r, 0, 0]);
  ctx.stroke();
  text(ctx, tab.label, w / 2, h * 0.58, { size: h * 0.36, weight: 800, color: selected ? C.ink : C.muted });
}
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
    this.bookGrab = [];
    this.grab = this.world.getSystem(GrabSystem);
    this.handsTracked = false;
    this.graspBox = new Box3();
    this.charmHold = null; // { entity, side }: charm tomado con el agarre propio
    this.pinchA = new Vector3();
    this.pinchB = new Vector3();
    this.pinchPoint = new Vector3();
    if (import.meta.env.DEV && window.__miniso) window.__miniso.catalog = this; // solo desarrollo: para comprobar el libro en el emulador
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
    this.axisX = new Vector3();
    this.axisY = new Vector3();
    this.axisZ = new Vector3();
    this.basis = new Matrix4();
    this.bookQuaternion = new Quaternion();

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
      vertical, con una hoja a cada lado) y se escala para que abierto mida BOOK_COVER_WIDTH (0,36 m). Se agarra con una mano.
      Sus paginas llevan los stickers (alineados y planos sobre la hoja), las muestras de color de ojos y, arriba, tres pestañas
      (Ojos, Boca, Nariz) como las de una carpeta (ver book-surface.js y FACE_TABS). */
  buildBook(factory, l) {
    const node = factory.object3D.userData.parts?.nodes?.libro_ojos;
    if (!node) {
      console.warn('[libro] No hay un nodo "libro_ojos" en la fabrica');
      return;
    }
    const book = new Group();
    book.name = 'StickerBook';
    node.removeFromParent();
    node.visible = true;
    flattenPages(node); // hojas planas: el contenido queda derecho y asentado
    node.position.set(0, 0, 0);
    node.quaternion.identity();
    node.scale.set(1, 1, 1);
    node.updateMatrixWorld(true);
    // Se mide el libro tal como llega (la escala del nodo puede venir horneada en su geometria) y se escala a su medida final
    const box = new Box3().setFromObject(node);
    const measured = box.getSize(new Vector3()).z; // el largo de la cubierta (z local)
    const scale = BOOK_COVER_WIDTH / measured;
    node.rotation.set(0, Math.PI / 2, 0); // el lomo del modelo va a lo largo de x: gira 90 grados para que quede vertical
    node.scale.setScalar(scale);
    node.position.set(0, -box.min.y * scale, 0); // el fondo de la cubierta queda en y = 0
    book.add(node);
    this.bookNode = node;
    // Zonas de agarre invisibles en el MARCO exterior del libro (fuera de las hojas, donde estan los stickers): el libro es una cascara
    // delgada y con el pellizco costaba acertarla. Cuatro tiras de 6 cm de alto alrededor de las hojas (que miden 0,32 x 0,235 m).
    this.bookGrab = [];
    for (const [w, d, x, z] of [
      [0.07, 0.34, -0.2, 0], // izquierda
      [0.07, 0.34, 0.2, 0], // derecha
      [0.46, 0.07, 0, -0.16], // arriba (lejos)
      [0.46, 0.07, 0, 0.16], // abajo (cerca)
    ]) {
      const zone = new Mesh(charmGrabGeometry, charmGrabMaterial);
      zone.name = 'BookGrabZone';
      zone.scale.set(w, 0.06, d);
      zone.position.set(x, 0.03, z);
      book.add(zone);
      this.bookGrab.push(zone);
    }
    const home = modelFrame(l, FURNITURE.book, 0, 0, 0, SLOT_OF[FACE]);
    book.position.set(home.x, home.y, home.z);
    book.rotation.y = home.rotY;
    const entity = this.world.createTransformEntity(book, { parent: factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(StickerBook);
    entity.addComponent(Carryable, { kind: 'book', home: [home.x, home.y, home.z], homeYaw: home.rotY });
    entity.addComponent(OneHandGrabbable); // se mueve y gira libremente con la mano

    // Todo lo impreso va plano sobre la hoja (paralelo a ella), a la altura de su superficie en ese punto
    const onPage = (item, x, z, half, lift = 0.002) => {
      item.mesh.rotation.x = -Math.PI / 2;
      item.mesh.position.set(x, pageTop(x, z, half) + lift, z);
      item.mesh.userData.silent = false;
      return item;
    };
    const swatches = EYE_COLORS.map((color, i) => {
      const [x, z] = bookSlot({ kind: 'swatch' }, i);
      const item = addItem(this.world, entity, {
        width: 0.036,
        height: 0.036,
        pxPerMeter: 1600,
        name: `eye-color-${color.id}`,
        draw: (ctx, w, h, state) => drawSwatch(ctx, w, h, color.id, !!state.selected),
        onPress: () => select('eyeColor', color.id),
      });
      item.mesh.userData.silent = true;
      return { item: onPage(item, x, z, 0.02), id: color.id };
    });

    // Pestañas divisorias: salen por el borde de arriba (el lejano) del libro, inclinadas hacia el usuario para verse y tocarse
    const tabY = pageTop(0, -0.117, 0.01) - 0.004;
    const tabs = FACE_TABS.map((tab, i) => {
      const item = addItem(this.world, entity, {
        width: 0.092,
        height: 0.05,
        pxPerMeter: 1400,
        name: `book-tab-${tab.label}`,
        draw: (ctx, w, h, state) => drawFolderTab(ctx, w, h, tab, !!state.selected, !!state.hovered),
        onPress: () => this.setTab(i),
      });
      item.mesh.position.set((i - 1) * 0.105, tabY + 0.022, -0.128);
      item.mesh.rotation.x = -0.75; // la parte de arriba se inclina hacia atras: la cara mira hacia arriba y al usuario
      item.mesh.userData.silent = false;
      item.mesh.userData.reach = 0.012; // solo responde al dedo que la toca, no a un sticker agarrado cerca
      item.mesh.userData.noPinch = true; // y no a una mano que esta pellizcando
      return { item, index: i };
    });
    this.bookUi = { entity, swatches, tabs };
    this.refreshBookUi();
  }

  /** Cambia de pestaña (Ojos, Boca, Nariz): los stickers de la pagina pasan a ser los de esa categoria. */
  setTab(index) {
    if (!this.bookOpen() || groupIndex.peek() === FACE_TABS[index].group) return;
    groupIndex.value = FACE_TABS[index].group;
    sfx.select();
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
    const parts = [];
    this.bookNode?.traverse((object) => object.isMesh && parts.push(object));
    for (const object of [...parts, ...(this.bookGrab ?? [])]) {
      object.userData.rayCast ??= object.raycast;
      object.raycast = held ? noRaycast : object.userData.rayCast;
    }
  }

  /** El libro del modelo esta siempre abierto: sus paginas se ven (con los stickers) mientras la estacion esta activa. */
  bookOpen() {
    return this.activeStation() === FACE && this.bookUi !== null;
  }

  /** Pestaña activa (indice en FACE_TABS) segun el grupo de stickers que muestra el libro. */
  activeTab() {
    const found = FACE_TABS.findIndex((tab) => tab.group === groupIndex.peek());
    return found < 0 ? 0 : found;
  }

  refreshBookUi() {
    const ui = this.bookUi;
    if (!ui) return;
    const open = this.bookOpen();
    const tab = this.activeTab();
    for (const { item, index } of ui.tabs) {
      item.setShown(open);
      item.redraw({ selected: index === tab });
    }
    // Las muestras de color de ojos solo se ven en la pestaña "Ojos"
    const chosen = selection.peek().eyeColor;
    for (const { item, id } of ui.swatches) {
      item.setShown(open && tab === 0);
      item.redraw({ selected: id === chosen });
    }
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
      group = catalog.groups[FACE_TABS[this.activeTab()].group]; // los stickers de la pestaña activa
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
    this.refreshBookUi();
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
      // Plano y alineado con el libro, a la altura de la hoja en ese punto
      anchor = { object: book, local: new Vector3(bx, pageTop(bx, bz, 0.03) + STICKER_LIFT, bz), keep: true };
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
    // Zona de agarre invisible un poco mayor que el charm (al menos 6 cm de lado en el mundo): se alcanza sin precision y la
    // caja, que ya no se puede apuntar mientras esta abierta, no la tapa
    const reach = Math.max(1.8, 0.09 / (Math.max(size.x, size.y, size.z) * base));
    const grab = new Mesh(charmGrabGeometry, charmGrabMaterial);
    grab.name = 'GrabZone';
    grab.scale.set(size.x * reach, size.y * reach, size.z * reach);
    root.add(grab);
    this.placeAnchored(root); // ya en su sitio dentro de la caja desde el primer cuadro
    const entity = this.world.createTransformEntity(root, { parent: this.factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(CatalogItem, { key: 'companion', itemId: id, target: 'body', kind: 'part' });
    entity.addComponent(Carryable, { kind: 'catalog', locked: true });
    if (!this.handsTracked) entity.addComponent(OneHandGrabbable); // con manos se toma con el agarre propio (updateCharmHold)
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
      if (anchor?.object && !this.queries.held.entities.has(entity) && entity !== this.charmHold?.entity) this.placeAnchored(object);
    }
  }

  /** Coloca un objeto anclado (sticker en su pagina, charm en su caja) en su sitio segun la posicion ACTUAL de su ancla: se
      refresca la matriz de la caja o el libro antes, para que el charm vaya siempre dentro y no un cuadro por detras. */
  placeAnchored(object) {
    const anchor = object.userData.anchor;
    const factoryObject = this.factory?.object3D;
    if (!anchor?.object || !factoryObject) return;
    factoryObject.updateWorldMatrix(true, false);
    anchor.object.updateWorldMatrix(true, false);
    factoryObject.getWorldQuaternion(this.factoryQuaternion).invert();
    this.point.copy(anchor.local);
    anchor.object.localToWorld(this.point);
    factoryObject.worldToLocal(this.point);
    object.position.copy(this.point);
    anchor.object.getWorldQuaternion(this.quaternion).premultiply(this.factoryQuaternion);
    object.quaternion.copy(this.quaternion);
  }

  /** Mientras se sostiene, el libro se muestra DERECHO y de frente a la cabeza (como una tableta): su cara de arriba mira al usuario y
      su borde de arriba (el de las pestañas) apunta hacia arriba, sin importar como gire la muñeca. La posicion sigue a la mano.
      Al soltarlo se queda flotando donde esta (ver RETURN_DELAY en carryable-system.js) para pasarlo a la otra mano. */
  updateHeldBook(delta) {
    const held = this.queries.heldBooks.entities.values().next().value;
    const book = held?.object3D;
    const factoryObject = this.factory?.object3D;
    if (!book || !factoryObject) return;
    book.getWorldPosition(this.point);
    this.player.head.getWorldPosition(this.other);
    this.axisY.subVectors(this.other, this.point).normalize(); // la cara de arriba del libro mira a la cabeza
    this.axisZ.set(0, 1, 0);
    this.axisZ.addScaledVector(this.axisY, -this.axisZ.dot(this.axisY)); // el "arriba" del mundo visto desde el libro
    if (this.axisZ.lengthSq() < 1e-4) return; // mirando exactamente de arriba: se conserva la orientacion
    this.axisZ.normalize().negate(); // +Z del libro = hacia abajo; su borde de arriba (-Z) apunta hacia arriba
    this.axisX.crossVectors(this.axisY, this.axisZ);
    this.basis.makeBasis(this.axisX, this.axisY, this.axisZ);
    this.bookQuaternion.setFromRotationMatrix(this.basis);
    factoryObject.getWorldQuaternion(this.factoryQuaternion).invert();
    this.bookQuaternion.premultiply(this.factoryQuaternion);
    book.quaternion.slerp(this.bookQuaternion, 1 - Math.exp(-14 * delta));
  }

  /** Distancia entre pulgar e indice de una mano (la deja en this.pinchPoint el punto medio); null si esa mano no esta seguida. */
  readPinch(side) {
    if (!jointWorld(this.renderer, this.player, side, 'thumb-tip', this.pinchA)) return null;
    if (!jointWorld(this.renderer, this.player, side, 'index-finger-tip', this.pinchB)) return null;
    this.pinchPoint.copy(this.pinchA).add(this.pinchB).multiplyScalar(0.5);
    return this.pinchA.distanceTo(this.pinchB);
  }

  /** Charm de una caja abierta con el seguimiento de manos: el sistema de agarre del SDK fallaba con objetos que viajan dentro de una caja
      sostenida (tomaba una caja vecina o nada). Aqui el charm se toma por la posicion del pellizco de la mano LIBRE: sigue al punto
      medio entre pulgar e indice y se suelta al separarlos (si queda cerca del personaje se coloca; si no, vuelve a su caja). */
  updateCharmHold() {
    const factoryObject = this.factory?.object3D;
    this.handsTracked =
      jointWorld(this.renderer, this.player, 'right', 'wrist', this.pinchA) || jointWorld(this.renderer, this.player, 'left', 'wrist', this.pinchA);
    if (!factoryObject) return;
    if (this.charmHold) {
      const { entity, side } = this.charmHold;
      const object = entity.object3D;
      const distance = this.readPinch(side);
      if (!entity.active || !object || distance === null || distance > PINCH_OPEN) {
        this.charmHold = null;
        endExternalHold();
        if (entity.active) this.onDrop(entity);
        return;
      }
      this.other.copy(this.pinchPoint);
      factoryObject.worldToLocal(this.other);
      object.position.copy(this.other);
      return;
    }
    if (!this.handsTracked) return;
    for (const chestEntity of this.queries.heldChests.entities) {
      const charm = chestEntity.object3D?.userData.charm;
      if (!charm?.active || !charm.object3D) continue;
      const holder = this.grab.getHolderHand(chestEntity);
      for (const side of ['right', 'left']) {
        if (side === holder) continue; // la mano que sostiene la caja no la toma
        const distance = this.readPinch(side);
        if (distance === null || distance > PINCH_CLOSE) continue;
        charm.object3D.getWorldPosition(this.point);
        this.graspBox.setFromObject(charm.object3D);
        if (this.pinchPoint.distanceTo(this.point) > CHARM_REACH && this.graspBox.distanceToPoint(this.pinchPoint) > CHARM_EDGE) continue;
        this.charmHold = { entity: charm, side };
        beginExternalHold();
        sfx.select();
        return;
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
    const anyHeld = this.queries.heldChests.entities.size > 0; // con una caja en la mano, las demas no se pueden tomar por error
    for (const chestEntity of this.queries.chests.entities) {
      const chest = chestEntity.object3D;
      if (!chest) continue;
      let held = this.queries.heldChests.entities.has(chestEntity);
      // Agarre fantasma: la caja figura como agarrada pero ninguna mano la tiene (p. ej. otra mano la "tomo" y soltó): se libera
      if (held && !this.grab.getHolderHand(chestEntity)) {
        this.grab.forceRelease(chestEntity);
        held = false;
      }
      // Sin limite de altura: la caja sostenida sigue a la mano libremente en cualquier direccion
      const data = chest.userData;
      const target = held && active ? 1 : 0;
      // Abierta y en la mano, la caja deja de ser un objetivo de agarre: su malla ocupa el mismo volumen que el charm de
      // dentro y la otra mano "agarraba" la caja (ya sostenida) en lugar del charm. Al soltarla vuelve a ser agarrable.
      this.setChestPickable(chest, !(data.open > 0.05 || data.charm || (anyHeld && !held)));
      // El agarre cercano del SDK no respeta el apuntado desactivado: con una caja en la mano, a las demas se les quita el agarre
      const grabbable = !(anyHeld && !held);
      if (grabbable && !chestEntity.hasComponent(OneHandGrabbable)) {
        chestEntity.addComponent(OneHandGrabbable, { rotateMin: [0, -Infinity, 0], rotateMax: [0, Infinity, 0] });
      } else if (!grabbable && chestEntity.hasComponent(OneHandGrabbable)) {
        chestEntity.removeComponent(OneHandGrabbable);
      }
      const previous = data.open;
      data.open += (target - data.open) * Math.min(1, delta * 9);
      if (Math.abs(data.open - target) < 0.004) data.open = target;
      for (const mesh of data.meshes) mesh.morphTargetInfluences[0] = data.open; // 0 = solapas cerradas, 1 = abiertas
      if (data.icon) data.icon.mesh.visible = data.open < 0.45;
      if (previous < 0.1 && data.open >= 0.1 && target === 1) sfx.thunk();

      const id = chestEntity.getValue(ChestBox, 'charm');
      if (held && active && !data.charm && data.open >= 0.3 && avatarConfig.peek().companion !== id) {
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
    this.updateCharmHold();
    this.updateChests(delta);
    this.updateItems(delta, time);
    this.updateZones();
  }
}
