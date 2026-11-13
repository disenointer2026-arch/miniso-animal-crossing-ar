/* Reconocimiento de la superficie y colocacion de la maquina.
   - Environment Raycast: una reticula sigue el rayo de la mano derecha sobre las
     superficies reales (hit-test de WebXR).
   - Scene Understanding: si el punto cae sobre un plano horizontal detectado
     (XRPlane), se informa que la mesa fue reconocida.
   - Un pellizco con cualquier mano confirma. La maquina queda anclada (XRAnchor). */
import {
  CircleGeometry,
  createSystem,
  EnvironmentRaycastTarget,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RaycastSpace,
  RingGeometry,
  Vector3,
  XRAnchor,
  XRPlane,
} from '@iwsdk/core';
import { Avatar } from '../avatar/avatar.js';
import { AvatarFigure, Machine, MachinePart, PlacementReticle } from '../components.js';
import { DEFAULT_AVATAR, MODEL } from '../data/avatar-defaults.js';
import { createMachine, MACHINE } from '../scene-assets/machine.scene-asset.js';
import { hint, phase, Phase } from '../state.js';

/** Altura del personaje sobre la banda, en metros. */
export const AVATAR_HEIGHT = 0.25;

const COLOR_VALID = 0x3e9b26;
const COLOR_SEARCHING = 0xf5ba00;

const HINTS = {
  searching: 'Busca una superficie plana para comenzar',
  surface: 'Superficie detectada. Pellizca para colocar la maquina',
  table: 'Mesa reconocida. Pellizca para colocar la maquina',
};

const UP = new Vector3(0, 1, 0);

export class PlacementSystem extends createSystem({
  reticles: { required: [PlacementReticle, EnvironmentRaycastTarget] },
  planes: { required: [XRPlane] },
}) {
  init() {
    this.position = new Vector3();
    this.headPosition = new Vector3();
    this.normal = new Vector3();
    this.local = new Vector3();
    this.worldQuaternion = new Quaternion();
    this.yawQuaternion = new Quaternion();
    this.currentHint = '';

    this.cleanupFuncs.push(
      phase.subscribe((value) => {
        if (value === Phase.Placing) this.startPlacing();
        else this.stopPlacing();
      }),
    );
  }

  startPlacing() {
    if (this.queries.reticles.entities.size > 0) return;
    const material = new MeshBasicMaterial({
      color: COLOR_SEARCHING,
      transparent: true,
      opacity: 0.9,
      depthTest: false,
    });
    const root = new Group();
    root.name = 'placement-reticle';
    const ring = new Mesh(new RingGeometry(0.035, 0.045, 40).rotateX(-Math.PI / 2), material);
    const dot = new Mesh(new CircleGeometry(0.008, 20).rotateX(-Math.PI / 2), material);
    // Huella de la maquina: muestra cuanto espacio ocupara y hacia donde mira
    const footprint = new Mesh(
      new PlaneGeometry(MACHINE.width, MACHINE.depth).rotateX(-Math.PI / 2),
      new MeshBasicMaterial({
        color: COLOR_SEARCHING,
        transparent: true,
        opacity: 0.25,
        depthTest: false,
      }),
    );
    footprint.name = 'footprint';
    root.add(ring, dot, footprint);
    root.userData.materials = [material, footprint.material];
    root.userData.footprint = footprint;

    const entity = this.world.createTransformEntity(root);
    entity.addComponent(PlacementReticle);
    entity.addComponent(EnvironmentRaycastTarget, {
      space: RaycastSpace.Right,
      maxDistance: 4,
    });
    this.setHint(HINTS.searching);
  }

  stopPlacing() {
    for (const reticle of Array.from(this.queries.reticles.entities)) {
      reticle.dispose();
    }
  }

  setHint(text) {
    if (this.currentHint === text && hint.peek() === text) return;
    this.currentHint = text;
    hint.value = text;
  }

  /** El punto cae sobre una mesa reconocida por el visor (plano horizontal
      detectado que no es el piso)? Usa la etiqueta del plano cuando existe;
      si no, la altura sobre el piso. */
  isOnDetectedTable(point) {
    for (const entity of this.queries.planes.entities) {
      const plane = entity.getValue(XRPlane, '_plane');
      const object = entity.object3D;
      if (!plane || !object || plane.orientation !== 'horizontal') continue;
      const geometry = object.geometry;
      if (!geometry) continue;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      this.local.copy(point);
      object.worldToLocal(this.local);
      const inside =
        Math.abs(this.local.y) < 0.06 &&
        this.local.x > box.min.x - 0.03 &&
        this.local.x < box.max.x + 0.03 &&
        this.local.z > box.min.z - 0.03 &&
        this.local.z < box.max.z + 0.03;
      if (!inside) continue;
      const label = plane.semanticLabel;
      if (label === 'table' || label === 'desk') return true;
      if (label === 'floor' || label === 'ceiling') continue;
      if (point.y > 0.3) return true;
    }
    return false;
  }

  update() {
    if (phase.peek() !== Phase.Placing) return;
    const xr = this.input.xr;
    const pinched =
      xr.getSelectState('right').start || xr.getSelectState('left').start;

    for (const reticle of this.queries.reticles.entities) {
      const object = reticle.object3D;
      if (!object) continue;
      const hit = reticle.getValue(EnvironmentRaycastTarget, 'xrHitTestResult');
      const hasHit = !!hit && object.visible;

      let valid = false;
      let onTable = false;
      let yaw = 0;
      if (hasHit) {
        object.getWorldPosition(this.position);
        object.getWorldQuaternion(this.worldQuaternion);
        this.normal.copy(UP).applyQuaternion(this.worldQuaternion);
        valid = this.normal.y > 0.92; // superficie horizontal
        onTable = valid && this.isOnDetectedTable(this.position);

        // La maquina mira hacia el usuario
        this.player.head.getWorldPosition(this.headPosition);
        yaw = Math.atan2(
          this.headPosition.x - this.position.x,
          this.headPosition.z - this.position.z,
        );
        this.yawQuaternion.setFromAxisAngle(UP, yaw);
        // La huella conserva ese giro aunque la reticula rote con la superficie
        object.userData.footprint.quaternion
          .copy(this.worldQuaternion)
          .invert()
          .multiply(this.yawQuaternion);
      }

      if (reticle.getValue(PlacementReticle, 'valid') !== valid) {
        reticle.setValue(PlacementReticle, 'valid', valid);
      }
      const color = valid ? COLOR_VALID : COLOR_SEARCHING;
      for (const material of object.userData.materials) material.color.setHex(color);
      this.setHint(!valid ? HINTS.searching : onTable ? HINTS.table : HINTS.surface);

      if (valid && pinched) {
        this.placeMachine(this.position, yaw);
        return;
      }
    }
  }

  placeMachine(position, yaw) {
    const machine = createMachine();
    machine.position.copy(position);
    machine.rotation.set(0, yaw, 0);
    const machineEntity = this.world.createTransformEntity(machine);
    machineEntity.addComponent(Machine);
    machineEntity.addComponent(XRAnchor);

    // Personaje predeterminado: espera bajo el arco, al extremo izquierdo
    const avatar = new Avatar(DEFAULT_AVATAR).build();
    const scale = AVATAR_HEIGHT / MODEL.height;
    avatar.root.userData.avatar = avatar;
    avatar.root.userData.baseScale = scale;
    avatar.root.scale.setScalar(0.0001);
    avatar.root.position.set(MACHINE.archX, MACHINE.beltTop, 0);
    const avatarEntity = this.world.createTransformEntity(avatar.root, {
      parent: machineEntity,
    });
    avatarEntity.addComponent(AvatarFigure);
    avatarEntity.addComponent(MachinePart);

    hint.value = '';
    phase.value = Phase.Arriving;
  }
}
