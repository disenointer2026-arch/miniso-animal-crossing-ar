/* Panel de instrucciones (UIKitML) de la fabrica: aparece cuando el personaje llega a la estacion 1 y
   queda de frente al usuario, sobre la estacion; al cerrarlo empieza la personalizacion. Las estaciones ya
   no tienen panel propio: cada una se maneja con los objetos de su mueble (ver src/stations). */
import { createSystem, RayInteractable } from '@iwsdk/core';
import { Factory, FactoryPart, InstructionsPanel } from '../components.js';
import { slotPose, stationSlot } from '../core/layout.js';
import { instructionsSeen, layout, phase, Phase } from '../state.js';

/** Respecto a la estacion 1: un poco detras de la banda (+ hacia afuera) y arriba del personaje. */
const PANEL_RADIAL = 0.3;
const PANEL_UP = 0.5;
const PANEL_SCALE = 0.1;

export class PanelsSystem extends createSystem({
  factories: { required: [Factory] },
  instructions: { required: [InstructionsPanel] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.factories.subscribe('qualify', (factory) => this.buildInstructions(factory)),
      phase.subscribe(() => this.refreshVisibility()),
    );
  }

  /** Coloca el panel de frente al usuario (mira a su punto de pie), de modo que nunca queda ladeado. */
  orient(panel) {
    const pose = slotPose(layout.peek(), stationSlot(0), PANEL_RADIAL, PANEL_UP);
    panel.position.set(pose.x, pose.y, pose.z);
    panel.rotation.set(0, pose.rotY, 0);
  }

  async buildInstructions(factory) {
    const panel = await this.world.assets.instantiate('instructions-panel');
    if (!factory.active) return;
    this.orient(panel);
    panel.scale.setScalar(PANEL_SCALE);
    panel.visible = false;
    const entity = this.world.createTransformEntity(panel, { parent: factory });
    entity.addComponent(RayInteractable);
    entity.addComponent(FactoryPart);
    entity.addComponent(InstructionsPanel);
    panel.getElementById('close-button')?.addEventListener('click', () => {
      if (phase.peek() === Phase.Instructions) {
        instructionsSeen.value = true;
        phase.value = Phase.Customizing;
      }
    });
    this.refreshVisibility();
  }

  refreshVisibility() {
    const show = phase.peek() === Phase.Instructions;
    for (const entity of this.queries.instructions.entities) {
      if (entity.object3D) entity.object3D.visible = show;
    }
  }
}
