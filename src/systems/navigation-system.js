/* Navegacion entre estaciones: cada estacion tiene dos botones espaciales en el
   borde interior de la plataforma (anterior / siguiente). Solo se ven los de la
   estacion activa. Cada boton muestra el icono y el nombre de la estacion a la que
   lleva (mismos iconos de la pagina original); al pulsarlo, la banda lleva al
   personaje hasta alli. Se accionan con el dedo (PokeInteractable) o con rayo +
   pellizco. Quedan paralelos al borde de la banda (no girados hacia el usuario) y con el dedo hay que MANTENER
   la presion un momento: un roce no cambia de estacion. */
import {
  CanvasTexture,
  createSystem,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PokeInteractable,
  Pressed,
  RayInteractable,
  Shape,
  SRGBColorSpace,
  Matrix4,
  Vector3,
} from '@iwsdk/core';
import { Factory, FactoryPart, NavButton } from '../components.js';
import { SLOT, STATION_COUNT, beltTangent, modelPoint, slotPose, standPoint, stationSlot } from '../core/layout.js';
import { interactionBusy } from '../interaction/carryable-system.js';
import { fingerDistanceToObject, handsTracked } from '../interaction/finger.js';
import { sfx } from '../audio/sfx.js';
import { CATEGORIES } from '../data/categories.js';
import { beltMoving, beltRequest, categoryIndex, layout, phase, Phase, stepCategory } from '../state.js';

/** Posicion de los botones: hacia el usuario (radial < 0), separados a cada lado. */
const NAV = { inward: 0.09, up: 0.01, offset: 0.095, tilt: 0.45 };
/** Botones ya colocados a mano sobre el borde del modelo, uno a uno. `at` = centro del boton en coordenadas del modelo
    [x, y, z]; `facing` = giro en Y (0 = el frente mira al sur del modelo, hacia el usuario); sin inclinacion.
    Estacion 1: sobre el borde del frente de la banda recta (x 1,7 a 10,1; y 5,6 a 7,0; cara superior en z 7,12); el
    boton mide 4,7 de ancho, asi que su centro queda en x 7,8 para no pasar del final del tramo recto. */
const NAV_SPOTS = {
  0: { next: { at: [7.8, 6.3, 7.12], facing: 0 } },
  // Estacion 2: sobre el borde de la plataforma del cabello (cara superior z 7,12, borde en x 26,55; la plataforma va de y 23,85 a
  // 38,2), CENTRADOS en ella (y = 31) y separados 6,2 unidades (los botones miden 4,7: quedan 5 cm entre uno y otro), mirando al
  // este (el usuario esta al este de la estacion); "siguiente" a su derecha (norte) y "anterior" a su izquierda (sur)
  1: {
    next: { at: [25.75, 34.1, 7.12], facing: Math.PI / 2 },
    prev: { at: [25.75, 27.9, 7.12], facing: Math.PI / 2 },
  },
  // Estacion 3: sobre el borde del lado del usuario de la banda recta de la derecha (x 46; el borde esta a unos 2,6 unidades de
  // su centro, cara superior z 7,12), mirando al oeste. El usuario esta justo al oeste de la parada, asi que le quedan de frente;
  // viendo hacia el este, "siguiente" queda a su derecha (sur) y "anterior" a su izquierda (norte).
  2: {
    next: { at: [43.4, 12.2, 7.12], facing: -Math.PI / 2 },
    prev: { at: [43.4, 17.8, 7.12], facing: -Math.PI / 2 },
  },
  // Estacion 4: sobre el borde del lado del usuario de la banda recta de abajo (y -21,6; el borde esta a unas 2,5 unidades de su
  // centro, cara superior z 7,12), mirando al norte. El usuario esta justo al norte de la parada; mirando al sur, "siguiente"
  // queda a su derecha (oeste) y "anterior" a su izquierda (este).
  3: {
    next: { at: [27.2, -19.1, 7.12], facing: Math.PI },
    prev: { at: [32.8, -19.1, 7.12], facing: Math.PI },
  },
  // Estacion 5: igual que la 4, sobre el borde de la banda recta de abajo (y -21,6), mirando al norte; "siguiente" (terminar) a la
  // derecha del usuario (oeste) y "anterior" a su izquierda (este).
  4: {
    next: { at: [-0.8, -19.1, 7.12], facing: Math.PI },
    prev: { at: [4.8, -19.1, 7.12], facing: Math.PI },
  },
};
/** La reja (malla negra) del borde de la plataforma queda entre el usuario y los botones: se le abre una ventana donde van,
    para que ninguna barra de la malla tape las caras. Caja en coordenadas del modelo [[x, y, z] minimo, [x, y, z] maximo]. */
const NAV_WINDOWS = [{ node: 'reja', box: [[24.9, 25.2, 7.05], [27.0, 36.8, 8.8]] }];
/** Con el dedo: se hunde y se mantiene este tiempo para activar. Con rayo + pellizco (o controles) basta un toque. */
const POKE_HOLD = 2.0; // segundos que hay que mantener el dedo presionado para cambiar de estacion
const FINGER_NEAR = 0.04; // el dedo esta tan cerca del boton: es un toque con el dedo, no un rayo
/** Despues de la ultima estacion, "siguiente" pasa a ser el boton de terminar. */
const FINISH = { label: 'Terminar avatar', icon: 'boton-llavero.svg', tag: 'LISTO' };
const targetFor = (direction) => CATEGORIES[categoryIndex.peek() + direction] ?? (direction > 0 ? FINISH : null);

const WIDTH = 0.16;
const DEPTH = 0.055;
const HEIGHT = 0.02;
const TEX_W = 512;
const TEX_H = 176;
const COOLDOWN_SECONDS = 0.9;
const CLICK_MAX = 0.7; // un pellizco mas largo que esto ya no es un clic

const THEME = {
  [-1]: { face: '#FFF6E6', cap: 0xfff6e6, tag: 'ANTERIOR' },
  1: { face: '#F9C623', cap: 0xf5ba00, tag: 'SIGUIENTE' },
};

const publicAssetUrl = (filePath) =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

/** Iconos de categoria (SVG de la pagina), cargados una sola vez. */
const iconCache = new Map();
function loadIcon(file, onReady) {
  let image = iconCache.get(file);
  if (!image) {
    image = new Image();
    image.src = publicAssetUrl(`images/ui/${file}`);
    iconCache.set(file, image);
  }
  if (image.complete && image.naturalWidth > 0) return image;
  image.addEventListener('load', onReady, { once: true });
  return null;
}

function keycapGeometry() {
  const w = WIDTH / 2;
  const d = DEPTH / 2;
  const r = d * 0.9;
  const shape = new Shape();
  shape.moveTo(-w + r, -d);
  shape.lineTo(w - r, -d);
  shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r);
  shape.quadraticCurveTo(w, d, w - r, d);
  shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r);
  shape.lineTo(-w, -d + r);
  shape.quadraticCurveTo(-w, -d, -w + r, -d);
  const geometry = new ExtrudeGeometry(shape, {
    depth: HEIGHT - 0.006,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 3,
    curveSegments: 10,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0.003, 0);
  return geometry;
}

/** Dibuja la cara del boton: icono + etiqueta + nombre de la categoria destino. */
function drawFace(button) {
  const { canvas, texture, direction } = button.userData;
  const target = targetFor(direction);
  const ctx = canvas.getContext('2d');
  const theme = THEME[direction];
  ctx.clearRect(0, 0, TEX_W, TEX_H);
  ctx.fillStyle = theme.face;
  ctx.beginPath();
  ctx.roundRect(0, 0, TEX_W, TEX_H, TEX_H / 2);
  ctx.fill();
  if (!target) {
    texture.needsUpdate = true;
    return;
  }

  // Icono dentro de un circulo blanco (a la izquierda en "siguiente", igual en "anterior")
  const cx = 92;
  const cy = TEX_H / 2;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(cx, cy, 66, 0, Math.PI * 2);
  ctx.fill();
  const icon = loadIcon(target.icon, () => drawFace(button));
  if (icon) {
    const size = 92;
    const ratio = icon.naturalWidth / icon.naturalHeight;
    const iw = ratio >= 1 ? size : size * ratio;
    const ih = ratio >= 1 ? size / ratio : size;
    // Los SVG son siluetas sin color (la pagina los tine con CSS): se tinen aqui
    const tint = button.userData.tint;
    const tctx = tint.getContext('2d');
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, tint.width, tint.height);
    tctx.drawImage(icon, (tint.width - iw) / 2, (tint.height - ih) / 2, iw, ih);
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = '#5F4C45';
    tctx.fillRect(0, 0, tint.width, tint.height);
    ctx.drawImage(tint, cx - tint.width / 2, cy - tint.height / 2);
  }

  // Etiqueta pequena y nombre de la categoria (el canvas si dibuja tildes)
  const font = 'Nunito, "Segoe UI", Roboto, system-ui, sans-serif';
  ctx.fillStyle = '#5F4C45';
  ctx.textBaseline = 'middle';
  ctx.font = `800 28px ${font}`;
  const tag = target.tag ?? theme.tag;
  ctx.fillText(direction < 0 ? `‹ ${tag}` : `${tag} ›`, 176, 40);
  const words = target.label.split(' ');
  const lines = [];
  ctx.font = `800 44px ${font}`;
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last && ctx.measureText(`${last} ${word}`).width < 318) {
      lines[lines.length - 1] = `${last} ${word}`;
    } else {
      lines.push(word);
    }
  }
  const two = lines.length > 1;
  // El nombre se reduce hasta caber en el ancho disponible
  let size = two ? 44 : 58;
  ctx.font = `800 ${size}px ${font}`;
  while (size > 26 && lines.slice(0, 2).some((line) => ctx.measureText(line).width > 316)) {
    size -= 2;
    ctx.font = `800 ${size}px ${font}`;
  }
  lines.slice(0, 2).forEach((line, i) => {
    ctx.fillText(line, 176, two ? 88 + i * 46 : 108);
  });
  texture.needsUpdate = true;
}

export class NavigationSystem extends createSystem({
  factories: { required: [Factory] },
  buttons: { required: [NavButton] },
  pressed: { required: [NavButton, Pressed] },
}) {
  init() {
    this.cooldown = 0;
    if (import.meta.env.DEV && window.__miniso) window.__miniso.nav = this; // solo desarrollo: para comprobar los botones en el emulador
    this.held = new Map(); // boton -> segundos que lleva presionado con el dedo
    this.clicks = new Map(); // boton -> { t, cancelled }: clic de rayo + pellizco en curso
    this.center = new Vector3();
    this.capGeometry = keycapGeometry();
    this.faceGeometry = new PlaneGeometry(WIDTH * 0.94, WIDTH * 0.94 * (TEX_H / TEX_W)).rotateX(-Math.PI / 2);

    this.cleanupFuncs.push(
      this.queries.factories.subscribe('qualify', (factory) => {
        for (let station = 0; station < STATION_COUNT; station++) {
          this.createButton(factory, station, -1);
          this.createButton(factory, station, 1);
        }
        this.openWindows(factory);
        this.refresh();
      }),
      beltMoving.subscribe(() => this.refresh()),
      this.queries.pressed.subscribe('qualify', (entity) => this.onPressed(entity)),
      this.queries.pressed.subscribe('disqualify', (entity) => this.onReleased(entity)),
      categoryIndex.subscribe(() => this.refresh()),
      phase.subscribe(() => this.refresh()),
      () => {
        this.capGeometry.dispose();
        this.faceGeometry.dispose();
      },
    );
  }

  createButton(factory, station, direction) {
    const l = layout.peek();
    const spot = NAV_SPOTS[station]?.[direction > 0 ? 'next' : 'prev'];
    if (spot) {
      this.createButtonAt(factory, station, direction, spot);
      return;
    }
    const slot = stationSlot(station);
    const stop = slotPose(l, slot, 0, NAV.up); // la parada del personaje sobre la banda
    const stand = standPoint(l, slot);
    // El boton queda PARALELO al borde de la banda: su ancho va a lo largo de la banda y su frente, perpendicular a ella,
    // hacia el lado del usuario (no girado hacia el punto de pie)
    const t = beltTangent(slot, { x: 0, z: 0 });
    let nx = -t.z;
    let nz = t.x;
    if (nx * (stand.x - stop.x) + nz * (stand.z - stop.z) < 0) {
      nx = -nx;
      nz = -nz;
    }
    const rotY = Math.atan2(nx, nz); // +Z del boton = hacia el usuario
    const rx = Math.cos(rotY); // su derecha (mirando hacia afuera) = a lo largo de la banda
    const rz = -Math.sin(rotY);
    const dx = direction * NAV.offset;
    this.buildButton(factory, station, direction, {
      x: stop.x + nx * NAV.inward + rx * dx,
      y: stop.y,
      z: stop.z + nz * NAV.inward + rz * dx,
      rotY,
      tilt: NAV.tilt,
    });
  }

  /** Abre las ventanas (NAV_WINDOWS): quita de la malla del nodo los triangulos cuyo centro cae DENTRO de la caja (en el plano
      local de la fabrica), de modo que ninguna barra quede entre el usuario y los botones. Se recorta una copia de la geometria
      (la del modelo es compartida) y no depende de planos de recorte del renderizador. */
  openWindows(factory) {
    const l = layout.peek();
    const root = factory.object3D;
    const nodes = root.userData.parts?.nodes ?? {};
    root.updateWorldMatrix(true, true);
    const toRoot = new Matrix4().copy(root.matrixWorld).invert();
    const matrix = new Matrix4();
    const a = new Vector3();
    const b = new Vector3();
    const c = new Vector3();
    for (const { node, box } of NAV_WINDOWS) {
      const lo = modelPoint(l, box[0][0], box[0][1], box[0][2]);
      const hi = modelPoint(l, box[1][0], box[1][1], box[1][2]);
      // En el plano local de la fabrica: x = este, z = -norte, y = arriba (el modelo no tiene giro propio)
      const min = new Vector3(Math.min(lo.x, hi.x), Math.min(lo.y, hi.y), Math.min(lo.z, hi.z));
      const max = new Vector3(Math.max(lo.x, hi.x), Math.max(lo.y, hi.y), Math.max(lo.z, hi.z));
      nodes[node]?.traverse((object) => {
        if (!object.isMesh || !object.geometry?.attributes?.position) return;
        matrix.multiplyMatrices(toRoot, object.matrixWorld);
        const geometry = object.geometry.clone();
        const position = geometry.attributes.position;
        const index = geometry.index ? Array.from(geometry.index.array) : Array.from({ length: position.count }, (_, i) => i);
        const kept = [];
        for (let i = 0; i + 2 < index.length; i += 3) {
          a.fromBufferAttribute(position, index[i]).applyMatrix4(matrix);
          b.fromBufferAttribute(position, index[i + 1]).applyMatrix4(matrix);
          c.fromBufferAttribute(position, index[i + 2]).applyMatrix4(matrix);
          a.add(b).add(c).multiplyScalar(1 / 3); // centro del triangulo
          const inside = a.x > min.x && a.x < max.x && a.y > min.y && a.y < max.y && a.z > min.z && a.z < max.z;
          if (!inside) kept.push(index[i], index[i + 1], index[i + 2]);
        }
        geometry.setIndex(kept);
        object.geometry = geometry;
      });
    }
  }

  /** Boton colocado a mano sobre el borde del modelo (ver NAV_SPOTS): plano, paralelo al borde y de frente al usuario. */
  createButtonAt(factory, station, direction, spot) {
    const p = modelPoint(layout.peek(), spot.at[0], spot.at[1], spot.at[2]);
    this.buildButton(factory, station, direction, { x: p.x, y: p.y, z: p.z, rotY: spot.facing, tilt: 0 });
  }

  buildButton(factory, station, direction, pose) {
    const root = new Group();
    root.name = `${direction < 0 ? 'nav-prev' : 'nav-next'}-${station + 1}`;
    root.position.set(pose.x, pose.y, pose.z);
    root.rotation.order = 'YXZ';
    root.rotation.set(pose.tilt, pose.rotY, 0);

    const cap = new Mesh(
      this.capGeometry,
      new MeshStandardMaterial({ color: THEME[direction].cap, roughness: 0.5 }),
    );
    cap.name = 'cap';
    const canvas = document.createElement('canvas');
    canvas.width = TEX_W;
    canvas.height = TEX_H;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    const face = new Mesh(
      this.faceGeometry,
      new MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }),
    );
    face.position.y = HEIGHT + 0.0006;
    cap.add(face);
    root.add(cap);
    const tint = document.createElement('canvas');
    tint.width = tint.height = 96;
    root.userData = { canvas, texture, direction, cap, tint };

    const entity = this.world.createTransformEntity(root, { parent: factory });
    entity.addComponent(NavButton, { direction, station });
    entity.addComponent(FactoryPart);
    entity.addComponent(RayInteractable);
    entity.addComponent(PokeInteractable);
  }

  /** Solo se ven los botones de la estacion activa, y solo si existe la estacion a
      la que llevan y la banda esta quieta. */
  refresh() {
    const idle = phase.peek() === Phase.Customizing && !beltMoving.peek();
    for (const entity of this.queries.buttons.entities) {
      const button = entity.object3D;
      if (!button) continue;
      const active = entity.getValue(NavButton, 'station') === categoryIndex.peek();
      const target = targetFor(button.userData.direction);
      button.visible = idle && active && !!target;
      // Oculto = sin volumen: no puede tocarse por accidente
      button.scale.setScalar(button.visible ? 1 : 0.0001);
      if (button.visible) drawFace(button);
    }
  }

  /** Verdadero si la punta de un indice esta sobre el boton (lectura de UiSystem de este cuadro). */
  fingerOn(button) {
    return fingerDistanceToObject(button) < FINGER_NEAR;
  }

  onPressed(entity) {
    if (!this.canPress(entity)) return;
    if (handsTracked()) {
      // Con manos solo cuenta presionar con el dedo y mantener: apuntar desde lejos y pellizcar no hace nada
      if (this.fingerOn(entity.object3D)) this.held.set(entity, 0);
      return;
    }
    // Controles: es un CLIC, se activa al SOLTAR si fue un toque corto y no agarro nada
    this.clicks.set(entity, { t: 0, cancelled: false });
  }

  onReleased(entity) {
    this.held.delete(entity);
    const click = this.clicks.get(entity);
    if (!click) return;
    this.clicks.delete(entity);
    if (!click.cancelled && click.t < CLICK_MAX && this.canPress(entity)) this.activate(entity);
  }

  canPress(entity) {
    if (phase.peek() !== Phase.Customizing || this.cooldown > 0 || beltMoving.peek() || interactionBusy()) return false;
    return !!entity.object3D?.visible;
  }

  activate(entity) {
    sfx.ding();
    const direction = entity.getValue(NavButton, 'direction');
    if (stepCategory(direction)) {
      this.cooldown = COOLDOWN_SECONDS;
    } else if (direction > 0 && categoryIndex.peek() === CATEGORIES.length - 1) {
      // Terminar avatar: la banda lleva al personaje a la caja de regalo
      this.cooldown = COOLDOWN_SECONDS;
      phase.value = Phase.Finishing;
      beltRequest.value = { slot: SLOT.giftBox };
    }
  }

  update(delta) {
    if (this.cooldown > 0) this.cooldown -= delta;
    for (const click of this.clicks.values()) {
      click.t += delta;
      if (interactionBusy()) click.cancelled = true; // el pellizco agarro algo (o ya habia algo en la mano): no es un clic
    }
    // El boton se hunde mientras esta presionado
    for (const entity of this.queries.buttons.entities) {
      const cap = entity.object3D?.userData.cap;
      if (!cap) continue;
      // Con el dedo se hunde poco a poco mientras se mantiene (progreso hacia POKE_HOLD)
      let target = entity.hasComponent(Pressed) ? -0.007 : 0;
      if (this.held.has(entity)) {
        const time = this.held.get(entity) + delta;
        if (!this.canPress(entity)) {
          this.held.set(entity, 0);
        } else if (time >= POKE_HOLD) {
          this.held.delete(entity);
          this.activate(entity);
        } else {
          this.held.set(entity, time);
          target = -0.003 - 0.006 * (time / POKE_HOLD);
        }
      }
      cap.position.y += (target - cap.position.y) * Math.min(1, delta * 20);
    }
  }
}
