/* Estaciones 3 (rostro), 4 (ropa) y 5 (charms y accesorios): mismo mecanismo con un
   mueble distinto (libro de stickers, armario, caja). Cada pestana del panel muestra
   sus objetos en el mueble:
   - Se agarran con un pellizco y se sueltan sobre el personaje: si quedan cerca, se
     colocan solos (ajuste automatico). Los stickers vuelven al libro (hay de sobra);
     las prendas y accesorios salen del mueble mientras estan puestos.
   - Tocar con el dedo lo puesto lo retira (la prenda vuelve a su sitio del mueble).
   - En el libro, las flechas (o las pestanas del panel) pasan de pagina.
   - El objeto elegido en el panel late para encontrarlo. El color de ojos se aplica directo.
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
  RayInteractable,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { sfx } from '../../audio/sfx.js';
import { buildPart } from '../../avatar/avatar.js';
import {
  AvatarFigure,
  AvatarZone,
  Carryable,
  CatalogItem,
  Factory,
  FactoryPart,
  PageArrow,
} from '../../components.js';
import { modelFrame } from '../../core/layout.js';
import { MODEL } from '../../data/avatar-defaults.js';
import { registerDropHandler } from '../../interaction/carryable-system.js';
import { ANCHORS } from '../../factory/anchors.js';
import { placeAtAnchor } from '../../scene-assets/lib/frame.js';
import {
  avatarConfig,
  beltMoving,
  categoryIndex,
  groupIndex,
  layout,
  phase,
  Phase,
  selection,
  setAvatar,
} from '../../state.js';
import { AVATAR_HEIGHT } from '../../systems/belt-system.js';
import { CATALOGS, CHARMS, CLOTHES, FACE, slotOf, stickerTexture } from './catalog-config.js';
import { createPageArrow, createSticker, createStickerBook } from './catalog-props.scene-asset.js';

/** Punto del modelo donde se exhiben los objetos de cada estacion. El armario y el estante son
    del modelo; solo el libro de stickers es un objeto aparte (mas grande que los del modelo). */
const SHELF_ANCHOR = { [FACE]: ANCHORS.faceBook, [CLOTHES]: ANCHORS.clothesTop, [CHARMS]: ANCHORS.charmsShelf };
const PROP_SCALE = AVATAR_HEIGHT / MODEL.height;
const SNAP = { head: 0.14, body: 0.16, feet: 0.14 }; // metros del objeto al lugar donde va
const GROW_SECONDS = 0.35;
const ARROW_COOLDOWN = 0.45;
const ARROW_TANGENT = 0.15;

const easeOutBack = (k) => 1 + 2.7 * (k - 1) ** 3 + 1.7 * (k - 1) ** 2;

export class CatalogStationSystem extends createSystem({
  factories: { required: [Factory] },
  items: { required: [CatalogItem, Carryable] },
  held: { required: [CatalogItem, Grabbed] },
  zonesPressed: { required: [AvatarZone, Pressed] },
  arrowsPressed: { required: [PageArrow, Pressed] },
  avatars: { required: [AvatarFigure] },
}) {
  init() {
    this.factory = null;
    this.avatar = null;
    this.zones = [];
    this.cooldown = 0;
    this.box = new Box3();
    this.center = new Vector3();
    this.point = new Vector3();
    this.other = new Vector3();
    this.lastEyeColor = selection.peek().eyeColor;
    this.zoneMaterial = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
    this.zoneGeometry = new SphereGeometry(1, 12, 8);

    const refresh = () => this.refresh();
    this.cleanupFuncs.push(
      registerDropHandler('catalog', (entity) => this.onDrop(entity)),
      this.queries.factories.subscribe('qualify', (factory) => this.build(factory)),
      this.queries.factories.subscribe('disqualify', () => {
        this.factory = null;
        this.zones = [];
      }),
      this.queries.avatars.subscribe('qualify', (entity) => {
        this.avatar = entity.object3D?.userData.avatar ?? null;
      }),
      this.queries.avatars.subscribe('disqualify', () => {
        this.avatar = null;
      }),
      this.queries.zonesPressed.subscribe('qualify', (entity) => this.removeWorn(entity)),
      this.queries.arrowsPressed.subscribe('qualify', (entity) => this.turnPage(entity)),
      selection.subscribe((value) => {
        if (value.eyeColor !== this.lastEyeColor) {
          this.lastEyeColor = value.eyeColor;
          setAvatar({ eyeColor: value.eyeColor });
        }
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

  build(factory) {
    this.factory = factory;
    const l = layout.peek();
    for (const [station, catalog] of Object.entries(CATALOGS)) {
      const index = Number(station);
      if (index === FACE) {
        const book = createStickerBook();
        placeAtAnchor(book, l, ANCHORS.faceBook);
        this.world.createTransformEntity(book, { parent: factory }).addComponent(FactoryPart);
      }

      // Zonas tocables sobre el personaje para retirar lo puesto
      for (const def of catalog.zones) {
        const mesh = new Mesh(this.zoneGeometry, this.zoneMaterial);
        mesh.name = `Zone/${def.key}`;
        mesh.scale.setScalar(0.0001);
        const entity = this.world.createTransformEntity(mesh, { parent: factory });
        entity.addComponent(FactoryPart);
        entity.addComponent(AvatarZone, { slot: def.key });
        entity.addComponent(PokeInteractable);
        this.zones.push({ entity, mesh, def, station: index });
      }
    }
    // Flechas del libro de stickers
    for (const direction of [-1, 1]) {
      const arrow = createPageArrow(direction);
      placeAtAnchor(arrow, l, ANCHORS.faceBook, direction * ARROW_TANGENT);
      const entity = this.world.createTransformEntity(arrow, { parent: factory });
      entity.addComponent(FactoryPart);
      entity.addComponent(PageArrow, { direction });
      entity.addComponent(PokeInteractable);
      entity.addComponent(RayInteractable);
    }
  }

  /** Deja en el mueble exactamente los objetos de la pestana activa (menos lo que esta puesto). */
  refresh() {
    if (!this.factory) return;
    const station = this.activeStation();
    const catalog = CATALOGS[station];
    const group = catalog
      ? catalog.groups[Math.min(groupIndex.peek(), catalog.groups.length - 1)]
      : null;
    const config = avatarConfig.peek();
    const wanted = new Map();
    if (group) {
      group.ids.forEach((id, index) => {
        if (group.kind === 'sticker' || config[group.apply] !== id) {
          wanted.set(`${group.apply}/${id}`, index);
        }
      });
    }
    const have = new Set();
    for (const entity of Array.from(this.queries.items.entities)) {
      const key = `${entity.getValue(CatalogItem, 'key')}/${entity.getValue(CatalogItem, 'itemId')}`;
      if (wanted.has(key)) {
        have.add(key);
      } else if (!this.queries.held.entities.has(entity)) {
        entity.dispose(); // un objeto agarrado se retira al soltarlo (ver onDrop)
      }
    }
    if (!group) return;
    wanted.forEach((index, key) => {
      if (!have.has(key)) this.spawn(station, group, index, key.slice(key.indexOf('/') + 1));
    });
  }

  spawn(station, group, index, id) {
    const catalog = CATALOGS[station];
    const [tangent, radial, up] = slotOf(catalog.furniture, index, group.ids.length);
    const home = modelFrame(layout.peek(), SHELF_ANCHOR[station], tangent, radial, up);
    const root = new Group();
    root.name = `Item/${group.apply}/${id}`;
    let base = 1;
    if (group.kind === 'sticker') {
      root.add(createSticker(stickerTexture[group.apply](id)));
    } else {
      const model = buildPart(`${group.prefix}-${id}`, avatarConfig.peek());
      if (!model) return;
      // El origen de las piezas esta en los pies o en la cabeza: se centra para agarrarla bien
      this.box.setFromObject(model).getCenter(this.center);
      model.position.sub(this.center);
      root.add(model);
      base = PROP_SCALE;
    }
    root.userData.base = base;
    root.userData.grow = 0;
    root.scale.setScalar(0.0001);
    root.position.set(home.x, home.y, home.z);
    root.rotation.y = home.rotY;
    const entity = this.world.createTransformEntity(root, { parent: this.factory });
    entity.addComponent(FactoryPart);
    entity.addComponent(CatalogItem, {
      key: group.apply,
      itemId: id,
      target: group.target,
      kind: group.kind,
    });
    entity.addComponent(Carryable, {
      kind: 'catalog',
      locked: true,
      home: [home.x, home.y, home.z],
      homeYaw: home.rotY,
    });
    entity.addComponent(OneHandGrabbable);
  }

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
      this.refresh();
      return;
    }
    const key = entity.getValue(CatalogItem, 'key');
    const patch = { [key]: entity.getValue(CatalogItem, 'itemId') };
    // El overol tapa la camiseta: ponerse una camiseta cambia el overol por el short
    if (key === 'shirt' && avatarConfig.peek().pants === 'overol') patch.pants = 'short';
    if (entity.getValue(CatalogItem, 'kind') === 'sticker') {
      const home = entity.getVectorView(Carryable, 'home');
      object.position.set(home[0], home[1], home[2]); // el sticker vuelve al libro
      object.rotation.set(0, entity.getValue(Carryable, 'homeYaw'), 0);
    } else {
      entity.dispose(); // la prenda o el accesorio pasa del mueble al personaje
    }
    setAvatar(patch); // refresh() ajusta el mueble: la pieza que se quito vuelve a su estante
    sfx.ding();
  }

  removeWorn(entity) {
    const zone = this.zones.find((z) => z.entity === entity);
    if (!zone || this.activeStation() !== zone.station) return;
    if (avatarConfig.peek()[zone.def.key] === 'none') return;
    setAvatar({ [zone.def.key]: 'none' });
    sfx.select();
  }

  turnPage(entity) {
    if (this.activeStation() !== FACE || this.cooldown > 0) return;
    const last = CATALOGS[FACE].groups.length - 1;
    const next = groupIndex.peek() + entity.getValue(PageArrow, 'direction');
    if (next < 0 || next > last) return;
    groupIndex.value = next;
    this.cooldown = ARROW_COOLDOWN;
    sfx.select();
  }

  updateItems(delta, time) {
    const chosen = selection.peek();
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
          entity.setValue(Carryable, 'locked', false);
        }
      } else if (chosen[entity.getValue(CatalogItem, 'key')] === entity.getValue(CatalogItem, 'itemId')) {
        k = 1.12 + 0.1 * Math.sin(time * 5); // el elegido en el panel late
      }
      object.scale.setScalar(Math.max(object.userData.base * k, 0.0001));
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
    this.updateItems(delta, time);
    this.updateZones();
  }
}
