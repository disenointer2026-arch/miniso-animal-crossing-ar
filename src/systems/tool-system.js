/* Herramientas agarrables (Grabbing de IWSDK: OneHandGrabbable + pellizco de la mano).
   - Cada categoria muestra solo sus herramientas.
   - Si una herramienta se suelta, vuelve sola a su sitio: asi nunca se pierde.
   Version 2: se pueden agarrar, mover y soltar. Su efecto sobre el personaje
   (pintar, cortar) llega en la version 3. */
import {
  Color,
  createSystem,
  Grabbed,
  OneHandGrabbable,
  Quaternion,
  Vector3,
} from '@iwsdk/core';
import { Machine, MachinePart, Tool } from '../components.js';
import { MACHINE } from '../scene-assets/machine.scene-asset.js';
import {
  createBrush,
  createPaintPot,
  createScissors,
} from '../scene-assets/tools.scene-asset.js';
import {
  categoryIndex,
  currentCategory,
  phase,
  Phase,
  selection,
} from '../state.js';

/** Segundos que una herramienta suelta espera antes de volver a su sitio. */
const RETURN_DELAY = 1.2;

/** Que objetos acompanan a cada herramienta de categoria. */
const KINDS_BY_TOOL = {
  brush: ['brush', 'pot'],
  scissors: ['scissors'],
};

export class ToolSystem extends createSystem({
  machines: { required: [Machine] },
  tools: { required: [Tool] },
  held: { required: [Tool, Grabbed] },
}) {
  init() {
    this.color = new Color();
    this.homePosition = new Vector3();
    this.homeQuaternion = new Quaternion();

    this.cleanupFuncs.push(
      this.queries.machines.subscribe('qualify', (machine) => this.createTools(machine)),
      this.queries.held.subscribe('qualify', (entity) => {
        entity.setValue(Tool, 'atHome', false);
      }),
      this.queries.held.subscribe('disqualify', (entity) => {
        if (entity.active) entity.setValue(Tool, 'idleTime', 0);
      }),
      phase.subscribe(() => this.refresh()),
      categoryIndex.subscribe(() => this.refresh()),
      selection.subscribe(() => this.refreshPaint()),
    );
  }

  createTools(machine) {
    const x = MACHINE.tools.x;
    const y = MACHINE.beltTop;
    this.addTool(machine, createBrush(), 'brush', [x - 0.03, y + 0.02, 0.06], true);
    this.addTool(machine, createPaintPot(), 'pot', [x + 0.04, y, -0.04], false);
    this.addTool(machine, createScissors(), 'scissors', [x, y + 0.015, 0.03], true);
    this.refresh();
    this.refreshPaint();
  }

  addTool(machine, object, kind, position, grabbable) {
    object.position.fromArray(position);
    object.userData.home = {
      position: object.position.clone(),
      quaternion: object.quaternion.clone(),
    };
    object.userData.shown = 0;
    object.scale.setScalar(0.0001);
    const entity = this.world.createTransformEntity(object, { parent: machine });
    entity.addComponent(Tool, { kind });
    entity.addComponent(MachinePart);
    if (grabbable) entity.addComponent(OneHandGrabbable, { rotate: true, translate: true });
  }

  /** Herramientas visibles segun la categoria activa. */
  refresh() {
    const customizing = phase.peek() === Phase.Customizing;
    const kinds = customizing ? KINDS_BY_TOOL[currentCategory().tool] || [] : [];
    for (const entity of this.queries.tools.entities) {
      const object = entity.object3D;
      if (object) object.userData.wanted = kinds.includes(entity.getValue(Tool, 'kind'));
    }
    this.refreshPaint();
  }

  /** El bote muestra el color elegido en el panel para la categoria actual. */
  refreshPaint() {
    const category = currentCategory();
    if (category.tool !== 'brush') return;
    const hex = selection.peek()[category.groups[0].key];
    for (const entity of this.queries.tools.entities) {
      const paint = entity.object3D?.userData.paint;
      if (paint && hex) paint.color.set(hex);
    }
  }

  update(delta) {
    for (const entity of this.queries.tools.entities) {
      const object = entity.object3D;
      if (!object) continue;
      const data = object.userData;

      // Aparece / desaparece con una transicion suave de escala
      const goal = data.wanted ? 1 : 0;
      if (data.shown !== goal) {
        data.shown += Math.sign(goal - data.shown) * Math.min(Math.abs(goal - data.shown), delta * 5);
        const k = data.shown;
        object.scale.setScalar(Math.max(k * k * (3 - 2 * k), 0.0001));
        object.visible = data.shown > 0.001;
      }

      if (entity.hasComponent(Grabbed) || entity.getValue(Tool, 'atHome')) continue;

      // Suelta: espera un momento y regresa a su sitio
      const idle = entity.getValue(Tool, 'idleTime') + delta;
      entity.setValue(Tool, 'idleTime', idle);
      if (idle < RETURN_DELAY && data.wanted) continue;
      const k = Math.min(1, delta * 8);
      object.position.lerp(data.home.position, k);
      object.quaternion.slerp(data.home.quaternion, k);
      if (object.position.distanceToSquared(data.home.position) < 1e-6) {
        object.position.copy(data.home.position);
        object.quaternion.copy(data.home.quaternion);
        entity.setValue(Tool, 'atHome', true);
      }
    }
  }
}
