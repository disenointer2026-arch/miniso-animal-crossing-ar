/* Confeti de la compra satisfactoria: dos "canones" a los lados del panel lanzan rectangulos y triangulos de
   los colores del sistema visual; suben, se frenan y caen girando. Se dibuja con dos InstancedMesh (una llamada
   de dibujo cada uno) y no reserva memoria por cuadro. Las posiciones se piden al marco del usuario
   (src/finale/frame.js), asi que siempre sale delante de quien mira. */
import {
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Shape,
  ShapeGeometry,
  Vector3,
} from '@iwsdk/core';
import { FactoryPart } from '../components.js';
import { frame, framePoint } from '../finale/frame.js';
import { C } from '../ui/theme.js';

const PALETTE = [C.red, C.yellow, C.leaf, C.blue, C.redHalo, C.turquoise, C.yellowSoft];
const GRAVITY = 2.3; // m/s2 hacia abajo
const TERMINAL = 0.42; // velocidad maxima de caida (el confeti flota)
const FLOOR_BELOW_HEAD = 1.5; // al bajar tanto respecto a la cabeza, la pieza desaparece

function triangleGeometry() {
  const shape = new Shape();
  shape.moveTo(0, 0.017);
  shape.lineTo(-0.015, -0.011);
  shape.lineTo(0.015, -0.011);
  shape.closePath();
  return new ShapeGeometry(shape);
}

export class Confetti {
  constructor(world, perKind = 55) {
    this.count = perKind * 2;
    this.perKind = perKind;
    this.active = false;
    this.group = new Group();
    this.group.name = 'Confetti';
    const material = new MeshBasicMaterial({ side: DoubleSide, toneMapped: false });
    this.meshes = [
      new InstancedMesh(new PlaneGeometry(0.02, 0.03), material, perKind),
      new InstancedMesh(triangleGeometry(), material, perKind),
    ];
    const color = new Color();
    this.meshes.forEach((mesh) => {
      mesh.frustumCulled = false;
      for (let i = 0; i < perKind; i++) mesh.setColorAt(i, color.set(PALETTE[(i * 3) % PALETTE.length]));
      mesh.instanceColor.needsUpdate = true;
      this.group.add(mesh);
    });
    const n = this.count;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.rot = new Float32Array(n * 3);
    this.spin = new Float32Array(n * 3);
    this.delay = new Float32Array(n);
    this.age = new Float32Array(n);
    this.alive = new Uint8Array(n);
    this.dummy = new Object3D();
    this.point = new Vector3();
    this.floor = 0;
    this.entity = world.createTransformEntity(this.group);
    this.entity.addComponent(FactoryPart);
    this.group.visible = false;
  }

  /** Lanza el confeti desde los dos lados del panel, delante del usuario. */
  start() {
    const rand = (a, b) => a + Math.random() * (b - a);
    this.floor = frame.head.y - FLOOR_BELOW_HEAD;
    for (let i = 0; i < this.count; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      framePoint(this.point, side * rand(0.4, 0.55), rand(0.7, 0.9), rand(-0.5, -0.35));
      this.pos.set([this.point.x, this.point.y, this.point.z], i * 3);
      // Hacia arriba y un poco hacia el centro (derecha/adelante del marco del usuario)
      const toCenter = -side * rand(0.2, 0.9);
      const up = rand(1.4, 2.6);
      const forward = rand(-0.15, 0.15);
      this.vel[i * 3] = frame.right.x * toCenter + frame.forward.x * forward;
      this.vel[i * 3 + 1] = up;
      this.vel[i * 3 + 2] = frame.right.z * toCenter + frame.forward.z * forward;
      this.rot.set([rand(0, 6), rand(0, 6), rand(0, 6)], i * 3);
      this.spin.set([rand(-8, 8), rand(-8, 8), rand(-8, 8)], i * 3);
      this.delay[i] = rand(0, 0.9);
      this.age[i] = 0;
      this.alive[i] = 1;
    }
    this.active = true;
    this.group.visible = true;
  }

  stop() {
    this.active = false;
    this.group.visible = false;
    this.alive.fill(0);
  }

  update(delta) {
    if (!this.active) return;
    let any = false;
    const d = Math.min(delta, 0.05);
    for (let i = 0; i < this.count; i++) {
      const mesh = this.meshes[i < this.perKind ? 0 : 1];
      const slot = i % this.perKind;
      const dummy = this.dummy;
      if (!this.alive[i]) {
        dummy.scale.setScalar(0.0001);
        dummy.position.set(0, -50, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(slot, dummy.matrix);
        continue;
      }
      this.age[i] += d;
      if (this.age[i] >= this.delay[i]) {
        const k = i * 3;
        this.vel[k + 1] = Math.max(this.vel[k + 1] - GRAVITY * d, -TERMINAL);
        // El aire frena el lanzamiento y la pieza se mece un poco al caer
        const sway = Math.sin(this.age[i] * 3 + i) * 0.12;
        this.pos[k] += (this.vel[k] * 0.985 + sway) * d;
        this.pos[k + 1] += this.vel[k + 1] * d;
        this.pos[k + 2] += this.vel[k + 2] * d;
        this.vel[k] *= 0.985;
        this.vel[k + 2] *= 0.985;
        this.rot[k] += this.spin[k] * d;
        this.rot[k + 1] += this.spin[k + 1] * d;
        this.rot[k + 2] += this.spin[k + 2] * d;
        if (this.pos[k + 1] < this.floor) this.alive[i] = 0;
      }
      any = true;
      const k = i * 3;
      const shown = this.age[i] >= this.delay[i];
      dummy.position.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]);
      dummy.rotation.set(this.rot[k], this.rot[k + 1], this.rot[k + 2]);
      dummy.scale.setScalar(shown ? 1 : 0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(slot, dummy.matrix);
    }
    this.meshes.forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
    if (!any) this.stop();
  }
}
