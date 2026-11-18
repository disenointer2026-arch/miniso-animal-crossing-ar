/* Reconocimiento del espacio y calibracion ergonomica. Reemplaza la colocacion
   sobre mesa: la fabrica rodea al usuario y se mide desde el PISO.

   Fase Space:       Scene Understanding (XRPlane) busca el piso y avisa si hay un
                     mueble cerca. Con el piso reconocido, un pellizco continua.
   Fase Calibrating: el usuario pone la mano donde trabajaria comodo (codo a ~90
                     grados) y pellizca. La altura se mide desde el piso y el
                     alcance desde la cabeza; no se supone ninguna estatura.
   Al confirmar se crea la fabrica (anclada con XRAnchor) centrada en el usuario. */
import {
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  XRAnchor,
  XRPlane,
  createSystem,
} from '@iwsdk/core';
import { LIMITS, BODY, SLOT, clamp, slotAngle } from '../core/layout.js';
import { Factory } from '../components.js';
import { createFactory } from '../scene-assets/factory.scene-asset.js';
import { arcStrip } from '../scene-assets/lib/arc-geometry.js';
import { hint, layout as layoutState, phase, Phase } from '../state.js';

const SPACE_TIMEOUT = 6; // segundos sin reconocer piso antes de permitir seguir
const PINCH_GUARD = 0.7; // el pellizco que pulso "Comenzar" no cuenta
const REACH_MARGIN = 0.08; // la banda queda un poco mas alla de la mano en reposo
const OBSTACLE_RADIUS = 1.0;
const PREVIEW_RADIUS = 0.55;

const HINTS = {
  searching: 'Mira a tu alrededor para que el visor reconozca el piso',
  floor: 'Piso reconocido. Pellizca para continuar',
  obstacle: 'Hay un mueble cerca. Despeja unos 2 metros y pellizca para continuar',
  timeout: 'No pude reconocer el piso: usare el nivel del visor. Pellizca para continuar',
  calibrate: 'Pon la mano a la altura donde trabajarias comodo, con el codo a 90 grados, y pellizca',
};

export class CalibrationSystem extends createSystem({
  planes: { required: [XRPlane] },
}) {
  init() {
    this.head = new Vector3();
    this.hand = new Vector3();
    this.point = new Vector3();
    this.forward = new Vector3();
    this.quaternion = new Quaternion();
    this.yaw = 0;
    this.floorY = 0;
    this.height = 0.95;
    this.beltRadius = 0.52;
    this.elapsed = 0;
    this.preview = null;
    this.currentHint = '';

    this.cleanupFuncs.push(
      phase.subscribe((value) => {
        this.elapsed = 0;
        if (value === Phase.Calibrating) this.startPreview();
        else this.stopPreview();
        if (value !== Phase.Space && value !== Phase.Calibrating) this.setHint('');
      }),
    );
  }

  setHint(text) {
    if (this.currentHint === text) return;
    this.currentHint = text;
    hint.value = text;
  }

  startPreview() {
    if (this.preview) return;
    const group = new Group();
    group.name = 'calibration-preview';
    const make = (r0, r1, color, opacity) =>
      new Mesh(
        arcStrip(
          r0,
          r1,
          slotAngle(SLOT.portal) - 0.3,
          slotAngle(SLOT.giftBox) + 0.3,
          0,
        ),
        new MeshBasicMaterial({
          color,
          transparent: true,
          opacity,
          side: DoubleSide,
          depthWrite: false,
        }),
      );
    const p = PREVIEW_RADIUS;
    group.add(make(p - BODY.inner, p + BODY.outer, 0xfff6e6, 0.35));
    group.add(make(p - BODY.beltHalf, p + BODY.beltHalf, 0x8cc37a, 0.7));
    this.preview = this.world.createTransformEntity(group);
    this.setHint(HINTS.calibrate);
  }

  stopPreview() {
    this.preview?.dispose();
    this.preview = null;
  }

  pinchHand() {
    const xr = this.input.xr;
    if (xr.getSelectState('right').start) return 'right';
    if (xr.getSelectState('left').start) return 'left';
    return null;
  }

  readHead() {
    const head = this.player.head;
    head.getWorldPosition(this.head);
    head.getWorldQuaternion(this.quaternion);
    this.forward.set(0, 0, -1).applyQuaternion(this.quaternion);
    // Con la mirada casi vertical el giro no es fiable: se conserva el anterior
    if (Math.hypot(this.forward.x, this.forward.z) > 0.25) {
      this.yaw = Math.atan2(-this.forward.x, -this.forward.z);
    }
  }

  /** Busca el piso entre los planos horizontales y los muebles cercanos. */
  scanPlanes() {
    let floor = null;
    let obstacle = false;
    for (const entity of this.queries.planes.entities) {
      const plane = entity.getValue(XRPlane, '_plane');
      const object = entity.object3D;
      if (!plane || !object || plane.orientation !== 'horizontal') continue;
      object.getWorldPosition(this.point);
      const y = this.point.y;
      const isFloor =
        plane.semanticLabel === 'floor' || (!plane.semanticLabel && y < 0.25);
      if (isFloor) {
        if (floor === null || y < floor) floor = y;
      } else if (y > 0.25 && y < 1.5) {
        const dx = this.point.x - this.head.x;
        const dz = this.point.z - this.head.z;
        if (Math.hypot(dx, dz) < OBSTACLE_RADIUS) obstacle = true;
      }
    }
    return { floor, obstacle };
  }

  update(delta) {
    const value = phase.peek();
    if (value !== Phase.Space && value !== Phase.Calibrating) return;
    this.elapsed += delta;
    this.readHead();
    const pinch = this.elapsed > PINCH_GUARD ? this.pinchHand() : null;

    if (value === Phase.Space) {
      const { floor, obstacle } = this.scanPlanes();
      const found = floor !== null;
      const ready = found || this.elapsed > SPACE_TIMEOUT;
      this.setHint(
        !ready ? HINTS.searching : !found ? HINTS.timeout : obstacle ? HINTS.obstacle : HINTS.floor,
      );
      if (pinch && ready) {
        this.floorY = found ? floor : 0;
        phase.value = Phase.Calibrating;
      }
      return;
    }

    // Calibrating: la vista previa sigue a la mano derecha (o a la izquierda)
    const hand = pinch ?? (this.hasHand('right') ? 'right' : 'left');
    if (!this.measure(hand)) return;
    const { height, beltRadius } = this;
    const preview = this.preview?.object3D;
    if (preview) {
      const s = beltRadius / PREVIEW_RADIUS;
      preview.position.set(this.head.x, this.floorY + height, this.head.z);
      preview.rotation.y = this.yaw;
      preview.scale.set(s, 1, s);
    }
    if (pinch) this.confirm(height, beltRadius);
  }

  hasHand(side) {
    const space = this.player.gripSpaces[side];
    return !!space && space.visible !== false;
  }

  /** Altura sobre el piso y alcance (distancia horizontal a la cabeza) de la mano.
      Escribe en this.height / this.beltRadius; false si la mano no existe. */
  measure(side) {
    const space = this.player.gripSpaces[side];
    if (!space) return false;
    space.getWorldPosition(this.hand);
    this.height = clamp(this.hand.y - this.floorY, LIMITS.height);
    this.beltRadius = clamp(
      Math.hypot(this.hand.x - this.head.x, this.hand.z - this.head.z) + REACH_MARGIN,
      LIMITS.beltRadius,
    );
    return true;
  }

  confirm(height, beltRadius) {
    const values = {
      x: this.head.x,
      z: this.head.z,
      yaw: this.yaw,
      floorY: this.floorY,
      height,
      beltRadius,
    };
    const factory = createFactory(values);
    factory.position.set(values.x, values.floorY, values.z);
    factory.rotation.y = values.yaw;
    layoutState.value = values;
    const entity = this.world.createTransformEntity(factory);
    entity.addComponent(Factory);
    entity.addComponent(XRAnchor);
    phase.value = Phase.Arriving;
  }
}
