/* Guia de posicion: el usuario tiene que estar de pie, de frente, en la estacion que trabaja.
   En el piso, frente a la estacion activa, aparece un circulo con huellas y una columna de luz;
   si el usuario esta lejos tambien aparece una flecha en el piso que apunta hacia el circulo y un
   aviso breve. Al llegar, el circulo se pone verde con un chulo y la guia se retira.
   Mientras no se personaliza (bienvenida, calibracion, cierre) no se muestra nada. */
import {
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3,
  createSystem,
} from '@iwsdk/core';
import { Factory, FactoryPart } from '../components.js';
import { MODEL, STAND_RADIUS, modelPoint, standPoint, stationSlot } from '../core/layout.js';
import { plain } from '../data/categories.js';
import { beltMoving, categoryIndex, hint, layout, phase, Phase } from '../state.js';
import { C } from '../ui/theme.js';
import { canvasPlane, drawCheck } from '../ui/world-ui.js';

const DISC = 0.34; // radio del circulo (m)
const ARROW_DISTANCE = 0.55; // la flecha se muestra si el usuario esta mas lejos que esto
const HINT_TEXT = 'Camina hasta el circulo del piso: asi quedas de frente a la estacion';

function drawFoot(ctx, x, y, s, mirror) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(mirror ? -s : s, s);
  ctx.beginPath();
  ctx.ellipse(0, 18, 20, 34, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const [tx, ty, tr] of [[-14, -26, 7], [-4, -32, 7], [6, -33, 6.5], [15, -29, 6], [22, -21, 5.5]]) {
    ctx.beginPath();
    ctx.arc(tx - 2, ty, tr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Decal del circulo: crema con triangulos, anillo y huellas que apuntan "hacia arriba" del lienzo. */
function discCanvas() {
  return canvasPlane(DISC * 2, DISC * 2, 700, (ctx, w, h, state) => {
    ctx.clearRect(0, 0, w, h);
    const ready = !!state.ready;
    ctx.fillStyle = ready ? 'rgba(204, 236, 193, 0.92)' : 'rgba(250, 246, 212, 0.92)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.47, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = w * 0.035;
    ctx.strokeStyle = ready ? C.leaf : C.red;
    ctx.stroke();
    ctx.lineWidth = w * 0.012;
    ctx.strokeStyle = C.yellowSoft;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.4, 0, Math.PI * 2);
    ctx.stroke();
    if (ready) {
      drawCheck(ctx, w / 2, h / 2, w * 0.2);
      return;
    }
    ctx.fillStyle = C.ink2;
    drawFoot(ctx, w * 0.39, h * 0.52, w / 520, false);
    drawFoot(ctx, w * 0.61, h * 0.52, w / 520, true);
    // Flecha hacia la estacion (arriba del lienzo)
    ctx.fillStyle = C.red;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.07);
    ctx.lineTo(w * 0.57, h * 0.2);
    ctx.lineTo(w * 0.43, h * 0.2);
    ctx.closePath();
    ctx.fill();
  });
}

/** Flecha plana para el piso (apunta hacia arriba del lienzo). */
function arrowCanvas() {
  return canvasPlane(0.2, 0.3, 500, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255, 0, 0, 0.85)';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 8;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(w / 2, 6);
    ctx.lineTo(w - 8, h * 0.52);
    ctx.lineTo(w * 0.68, h * 0.52);
    ctx.lineTo(w * 0.68, h - 8);
    ctx.lineTo(w * 0.32, h - 8);
    ctx.lineTo(w * 0.32, h * 0.52);
    ctx.lineTo(8, h * 0.52);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

export class StandSystem extends createSystem({
  factories: { required: [Factory] },
}) {
  init() {
    this.factory = null;
    this.group = null;
    this.beam = null;
    this.disc = null;
    this.arrow = null;
    this.ready = false;
    this.slot = -1;
    this.hinted = false;
    this.head = new Vector3();
    this.point = { x: 0, y: 0, z: 0 };
    this.color = new Color();
    this.cleanupFuncs.push(
      this.queries.factories.subscribe('qualify', (factory) => this.build(factory)),
      this.queries.factories.subscribe('disqualify', () => {
        this.group = null;
        this.factory = null;
        this.setHint(false);
      }),
    );
  }

  build(factory) {
    this.factory = factory;
    const group = new Group();
    group.name = 'StandMarker';
    this.disc = discCanvas();
    this.disc.mesh.rotation.x = -Math.PI / 2;
    this.disc.mesh.position.y = 0.004;
    group.add(this.disc.mesh);

    this.beamMaterial = new MeshBasicMaterial({
      color: C.redHalo,
      transparent: true,
      opacity: 0.14,
      side: DoubleSide,
      depthWrite: false,
    });
    this.beam = new Mesh(new CylinderGeometry(DISC * 0.92, DISC * 0.92, 1.5, 40, 1, true), this.beamMaterial);
    this.beam.position.y = 0.75;
    group.add(this.beam);

    this.arrow = arrowCanvas();
    this.arrow.mesh.rotation.order = 'YXZ';
    this.arrow.mesh.visible = false;

    const entity = this.world.createTransformEntity(group, { parent: factory });
    entity.addComponent(FactoryPart);
    const arrowEntity = this.world.createTransformEntity(this.arrow.mesh, { parent: factory });
    arrowEntity.addComponent(FactoryPart);
    this.group = group;
    group.visible = false;
  }

  /** Estacion cuyo circulo se muestra; -1 si ninguna. */
  activeSlot() {
    const value = phase.peek();
    if (value === Phase.Customizing) return stationSlot(categoryIndex.peek());
    if (value === Phase.Arriving || value === Phase.Instructions) return stationSlot(0);
    return -1;
  }

  setHint(on) {
    if (on === this.hinted) return;
    this.hinted = on;
    if (on) {
      if (hint.peek() === '') hint.value = plain(HINT_TEXT);
      else this.hinted = false;
    } else if (hint.peek() === plain(HINT_TEXT)) {
      hint.value = '';
    }
  }

  update(delta, time) {
    const group = this.group;
    const factory = this.factory?.object3D;
    if (!group || !factory) return;
    const slot = this.activeSlot();
    group.visible = slot >= 0;
    if (slot < 0) {
      this.arrow.mesh.visible = false;
      this.setHint(false);
      return;
    }

    // Circulo frente a la estacion, con las huellas mirando hacia la banda
    const stand = standPoint(layout.peek(), slot, this.point);
    if (slot !== this.slot) {
      this.slot = slot;
      const [sx, sy] = MODEL.stops[slot];
      const stop = modelPoint(layout.peek(), sx, sy, MODEL.beltTop);
      group.position.set(stand.x, 0, stand.z);
      group.rotation.y = Math.atan2(-(stop.x - stand.x), -(stop.z - stand.z));
      this.ready = false;
      this.disc.redraw({ ready: false });
    }

    // Distancia del usuario al circulo, en el plano del piso
    this.player.head.getWorldPosition(this.head);
    factory.worldToLocal(this.head);
    const dx = stand.x - this.head.x;
    const dz = stand.z - this.head.z;
    const distance = Math.hypot(dx, dz);
    const near = distance < STAND_RADIUS;
    if (import.meta.env.DEV && window.__miniso) {
      // Solo en desarrollo: donde esta el circulo en el mundo (para colocar al usuario en las pruebas)
      const world = group.getWorldPosition(this.head.clone());
      window.__miniso.standPos = [world.x, world.y, world.z];
    }
    if (near !== this.ready) {
      this.ready = near;
      this.disc.redraw({ ready: near });
    }

    const pulse = 1 + 0.05 * Math.sin(time * 4);
    this.disc.mesh.scale.setScalar(near ? 1 : pulse);
    this.color.set(near ? C.leaf : C.redHalo);
    this.beamMaterial.color.lerp(this.color, Math.min(1, delta * 8));
    this.beamMaterial.opacity = near ? 0.06 : 0.14 + 0.05 * Math.sin(time * 3);
    this.beam.scale.set(1, near ? 0.35 : 1, 1);
    this.beam.position.y = near ? 0.26 : 0.75;

    // Flecha en el piso, delante del usuario, hacia el circulo
    const showArrow = !near && distance > ARROW_DISTANCE && !beltMoving.peek();
    this.arrow.mesh.visible = showArrow;
    if (showArrow) {
      const step = Math.min(0.55, distance * 0.5);
      this.arrow.mesh.position.set(this.head.x + (dx / distance) * step, 0.006, this.head.z + (dz / distance) * step);
      this.arrow.mesh.rotation.set(-Math.PI / 2, Math.atan2(-dx, -dz), 0);
    }
    this.setHint(!near && distance > ARROW_DISTANCE && phase.peek() === Phase.Customizing);
  }
}
