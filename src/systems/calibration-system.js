/* Ubicacion manual de la fabrica (calibracion ergonomica). La fabrica rodea al usuario y se mide desde el
   PISO, que es el nivel del visor (sin reconocimiento de suelo: fallaba).

   Fase Calibrating: el usuario pone la mano donde trabajaria comodo (codo a ~90
                     grados) y pellizca. La altura se mide desde el piso y el
                     alcance desde la cabeza; no se supone ninguna estatura.
   Al confirmar se crea la fabrica (anclada con XRAnchor) centrada en el usuario. */
import {
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  XRAnchor,
  createSystem,
} from '@iwsdk/core';
import { DEFAULT_LAYOUT, LIMITS, MODEL, clamp, modelPoint, modelScale } from '../core/layout.js';
import { Factory } from '../components.js';
import { createFactory } from '../factory/factory-model.js';
import { heightOffset, hint, instructionsSeen, layout as layoutState, phase, Phase } from '../state.js';

const PINCH_GUARD = 0.7; // el pellizco que pulso "Comenzar" no cuenta
const REACH_MARGIN = 0.08; // la banda queda un poco mas alla de la mano en reposo
const PREVIEW_WIDTH = 0.09; // ancho de la cinta que muestra el recorrido de la banda

/** Cinta plana (cara hacia arriba) a lo largo del recorrido de la banda, en metros locales. */
function pathRibbon(width) {
  const points = MODEL.path.map(([x, y]) => modelPoint(DEFAULT_LAYOUT, x, y, MODEL.beltTop));
  const position = [];
  const index = [];
  points.forEach((p, i) => {
    const a = points[Math.max(i - 1, 0)];
    const b = points[Math.min(i + 1, points.length - 1)];
    const length = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const nx = (-(b.z - a.z) / length) * (width / 2); // normal en el plano
    const nz = ((b.x - a.x) / length) * (width / 2);
    position.push(p.x - nx, 0, p.z - nz, p.x + nx, 0, p.z + nz);
    if (i > 0) {
      const k = (i - 1) * 2;
      index.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  });
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(position, 3));
  geometry.setIndex(index);
  return geometry;
}

const HINTS = {
  calibrate: 'Pon la mano a la altura donde trabajarías cómodo, con el codo a 90 grados, y pellizca para ubicar la fábrica',
};

export class CalibrationSystem extends createSystem({}) {
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

    // Solo en desarrollo: crea la fabrica al instante (altura 0,95 m, alcance 0,55 m) sin recorrer el espacio y la calibracion
    if (import.meta.env.DEV && window.__miniso) {
      window.__miniso.quickStart = () => {
        this.readHead();
        this.floorY = 0;
        this.confirm(0.95, 0.55);
      };
    }

    this.cleanupFuncs.push(
      phase.subscribe((value) => {
        this.elapsed = 0;
        if (value === Phase.Calibrating) {
          this.floorY = 0; // sin reconocimiento de suelo: el piso es el nivel del visor (espacio de referencia local-floor)
          this.startPreview();
        }
        else this.stopPreview();
        if (value !== Phase.Calibrating) this.setHint('');
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
    const make = (width, color, opacity) =>
      new Mesh(
        pathRibbon(width),
        new MeshBasicMaterial({ color, transparent: true, opacity, side: DoubleSide, depthWrite: false }),
      );
    group.add(make(PREVIEW_WIDTH * 2.2, 0xfff6e6, 0.35));
    group.add(make(PREVIEW_WIDTH, 0x8cc37a, 0.75));
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

  update(delta) {
    const value = phase.peek();
    if (value !== Phase.Calibrating) return;
    this.elapsed += delta;
    this.readHead();
    const pinch = this.elapsed > PINCH_GUARD ? this.pinchHand() : null;

    // Calibrating: la vista previa sigue a la mano derecha (o a la izquierda)
    const hand = pinch ?? (this.hasHand('right') ? 'right' : 'left');
    if (!this.measure(hand)) return;
    const { height, beltRadius } = this;
    const preview = this.preview?.object3D;
    if (preview) {
      // El tamano sigue al alcance de la mano, igual que la fabrica final
      const s = modelScale({ beltRadius }) / modelScale(DEFAULT_LAYOUT);
      preview.position.set(this.head.x, this.floorY + height, this.head.z);
      preview.rotation.y = this.yaw + MODEL.yaw;
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
    factory.rotation.y = values.yaw + MODEL.yaw;
    layoutState.value = values;
    heightOffset.value = 0;
    const entity = this.world.createTransformEntity(factory);
    entity.addComponent(Factory);
    entity.addComponent(XRAnchor);
    // Primera vez: instrucciones antes de empezar; al recalibrar no se repiten
    phase.value = instructionsSeen.peek() ? Phase.Arriving : Phase.Instructions;
  }
}
