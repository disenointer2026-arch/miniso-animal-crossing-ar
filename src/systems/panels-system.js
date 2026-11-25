/* Panel de instrucciones (UIKitML): aparece al confirmar la posicion de la maquinaria, antes de que empiece la
   experiencia. Mientras esta abierto, el entorno se oscurece con una capa negra semitransparente alrededor del
   usuario (la fabrica sigue visible, atenuada), el panel acompana la mirada y nada se puede usar todavia.
   Al cerrarlo la capa se retira, vuelven los colores y el personaje sale hacia la estacion 1. Las estaciones no
   tienen panel propio: cada una se maneja con los objetos de su mueble (ver src/stations). */
import {
  BackSide,
  createSystem,
  Mesh,
  MeshBasicMaterial,
  PokeInteractable,
  RayInteractable,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { sfx } from '../audio/sfx.js';
import { touchOnly } from '../interaction/finger.js';
import { FactoryPart, InstructionsPanel } from '../components.js';
import { instructionsSeen, phase, Phase } from '../state.js';

const PANEL_DISTANCE = 0.45; // metros desde los ojos: dentro de los 42-46 cm que Meta recomienda para lo que se toca con el indice
const PANEL_SCALE = 0.047; // se ve del mismo tamano que a 0,95 m
const MAX_PITCH = 0.45; // limite de la componente vertical de la mirada (el panel no sube ni baja de mas)
const FOLLOW_ANGLE = 0.7; // radianes (unos 40 grados) que puede apartar la vista antes de que el panel la siga
const FOLLOW = 5; // rapidez con que el panel alcanza la mirada (1/s)
const DIM_OPACITY = 0.55; // oscurecimiento: negro con baja opacidad, nunca opaco
const DIM_FADE = 5; // rapidez del fundido (1/s)
const DIM_RADIUS = 8;
const OVERLAY_ORDER = 2000; // la capa se dibuja encima de todo y el panel encima de la capa

export class PanelsSystem extends createSystem({
  instructions: { required: [InstructionsPanel] },
}) {
  init() {
    this.eye = new Vector3();
    this.look = new Vector3();
    this.target = new Vector3();
    this.off = new Vector3();
    this.following = false;
    this.raiseTimer = 0;
    // El panel se dibuja sobre la capa oscura: por encima en el orden y sin prueba de profundidad.
    // UIKit crea y reordena sus mallas poco a poco, asi que se repite mientras esta abierto.
    this.raise = (object) => {
      if (!object.isMesh) return;
      if (object.renderOrder < OVERLAY_ORDER + 10) object.renderOrder += OVERLAY_ORDER + 10;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (material.depthTest) material.depthTest = false;
    };
    this.snap = true; // al abrirse, el panel aparece directo frente a la mirada
    this.panel = null;
    this.building = false;
    this.dim = new Mesh(
      new SphereGeometry(DIM_RADIUS, 24, 16),
      new MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0,
        side: BackSide,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.dim.name = 'InstructionsDim';
    this.dim.renderOrder = OVERLAY_ORDER;
    this.dim.visible = false;
    this.dim.frustumCulled = false;
    this.world.scene.add(this.dim);
    this.cleanupFuncs.push(
      () => {
        this.dim.removeFromParent();
        this.dim.geometry.dispose();
        this.dim.material.dispose();
      },
      phase.subscribe((value) => {
        if (value === Phase.Instructions) this.open();
        else this.refreshVisibility();
      }),
    );
  }

  async open() {
    this.snap = true;
    if (!this.panel && !this.building) {
      this.building = true;
      await this.buildInstructions();
      this.building = false;
    }
    this.refreshVisibility();
  }

  async buildInstructions() {
    const panel = await this.world.assets.instantiate('instructions-panel');
    panel.scale.setScalar(PANEL_SCALE);
    panel.visible = false;
    const entity = this.world.createTransformEntity(panel);
    entity.addComponent(RayInteractable);
    entity.addComponent(PokeInteractable);
    entity.addComponent(FactoryPart); // se retira junto con la fabrica al salir de la sesion
    entity.addComponent(InstructionsPanel);
    this.panel = panel;
    panel.getElementById('close-button')?.addEventListener(
      'pointerdown',
      touchOnly(() => panel, () => {
        if (phase.peek() === Phase.Instructions) {
          sfx.ding();
          instructionsSeen.value = true;
          phase.value = Phase.Arriving; // la experiencia empieza aqui
        }
      }, { remote: true }), // seleccion a distancia: rayo + pellizco
    );
  }

  refreshVisibility() {
    if (this.panel && !this.panel.parent) this.panel = null; // se retiro con la fabrica
    if (this.panel) this.panel.visible = phase.peek() === Phase.Instructions;
  }

  update(delta) {
    const showing = phase.peek() === Phase.Instructions;
    // Capa oscura: sigue la cabeza y se funde al abrir y al cerrar
    const material = this.dim.material;
    const goal = showing ? DIM_OPACITY : 0;
    material.opacity += (goal - material.opacity) * Math.min(1, delta * DIM_FADE);
    if (!showing && material.opacity < 0.01) material.opacity = 0;
    this.dim.visible = material.opacity > 0;
    if (!this.dim.visible && !showing) return;

    const camera = this.world.camera;
    camera.getWorldPosition(this.eye);
    this.dim.position.copy(this.eye);
    if (!showing || !this.panel?.visible) return;
    this.raiseTimer -= delta;
    if (this.raiseTimer <= 0) {
      this.raiseTimer = 0.25;
      this.panel.traverse(this.raise);
    }

    // El panel queda frente a la mirada, a una distancia comoda, y siempre de cara al usuario
    camera.getWorldDirection(this.look);
    this.look.y = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.look.y));
    this.look.normalize();
    this.target.copy(this.eye).addScaledVector(this.look, PANEL_DISTANCE);
    if (this.snap) {
      this.panel.position.copy(this.target);
      this.snap = false;
      this.following = false;
    } else {
      // Queda quieto (para poder presionar su boton con el dedo) y solo sigue a la mirada si el usuario se voltea lejos de el
      this.off.copy(this.panel.position).sub(this.eye).normalize();
      const angle = this.off.angleTo(this.look);
      if (angle > FOLLOW_ANGLE) this.following = true;
      else if (angle < 0.12) this.following = false;
      if (this.following) this.panel.position.lerp(this.target, Math.min(1, delta * FOLLOW));
    }
    this.panel.lookAt(this.eye);
  }
}
