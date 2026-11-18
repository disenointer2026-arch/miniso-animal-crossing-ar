/* Paneles espaciales de la fabrica (UIKitML), siempre detras de la estacion activa:
   - Instrucciones: aparecen cuando llega el personaje a la estacion 1; al cerrarlas
     empieza la personalizacion.
   - Estacion: muestra la estacion activa, sus grupos y opciones. Elegir una opcion
     la deja seleccionada (en la fase B la aplican los objetos de cada estacion).
   Se ocultan mientras la banda lleva al personaje a otra estacion. */
import { createSystem, RayInteractable } from '@iwsdk/core';
import {
  CategoryPanel,
  Factory,
  FactoryPart,
  InstructionsPanel,
} from '../components.js';
import { slotPose, stationSlot } from '../core/layout.js';
import { CATEGORIES, MAX_OPTIONS, plain } from '../data/categories.js';
import {
  beltMoving,
  categoryIndex,
  currentCategory,
  currentGroup,
  groupIndex,
  layout,
  phase,
  Phase,
  select,
  selection,
} from '../state.js';

/** Respecto a la estacion: detras de la banda (+ hacia afuera) y arriba del personaje. */
const PANEL_RADIAL = 0.3;
const PANEL_UP = 0.42;
const PANEL_TILT = -0.3;
const PANEL_SCALE = 0.1;

const CREAM = '#fff6e6';
const RED = '#e60012';
const GREEN = '#8cc37a';
const BROWN = '#5f4c45';

export class PanelsSystem extends createSystem({
  factories: { required: [Factory] },
  instructions: { required: [InstructionsPanel] },
  categories: { required: [CategoryPanel] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.factories.subscribe('qualify', (factory) => {
        this.buildInstructions(factory);
        this.buildCategoryPanel(factory);
      }),
      phase.subscribe(() => this.refreshVisibility()),
      beltMoving.subscribe(() => this.refreshVisibility()),
      categoryIndex.subscribe(() => {
        this.orientPanels();
        this.refreshCategory();
      }),
      groupIndex.subscribe(() => this.refreshCategory()),
      selection.subscribe(() => this.refreshCategory()),
    );
  }

  /** Coloca un panel detras de la estacion activa, mirando al usuario. */
  orient(panel) {
    const pose = slotPose(layout.peek(), stationSlot(categoryIndex.peek()), PANEL_RADIAL, PANEL_UP);
    panel.position.set(pose.x, pose.y, pose.z);
    panel.rotation.order = 'YXZ';
    panel.rotation.set(PANEL_TILT, pose.rotY, 0);
  }

  orientPanels() {
    for (const entity of this.queries.instructions.entities) {
      if (entity.object3D) this.orient(entity.object3D);
    }
    for (const entity of this.queries.categories.entities) {
      if (entity.object3D) this.orient(entity.object3D);
    }
  }

  async place(assetId, factory, tag) {
    const panel = await this.world.assets.instantiate(assetId);
    if (!factory.active) return null;
    this.orient(panel);
    panel.scale.setScalar(PANEL_SCALE);
    panel.visible = false;
    const entity = this.world.createTransformEntity(panel, { parent: factory });
    entity.addComponent(RayInteractable);
    entity.addComponent(FactoryPart);
    entity.addComponent(tag);
    return panel;
  }

  async buildInstructions(factory) {
    const panel = await this.place('instructions-panel', factory, InstructionsPanel);
    if (!panel) return;
    panel.getElementById('close-button')?.addEventListener('click', () => {
      if (phase.peek() === Phase.Instructions) phase.value = Phase.Customizing;
    });
    this.refreshVisibility();
  }

  async buildCategoryPanel(factory) {
    const panel = await this.place('category-panel', factory, CategoryPanel);
    if (!panel) return;
    const ui = {
      step: panel.getElementById('step'),
      title: panel.getElementById('title'),
      help: panel.getElementById('help'),
      chosen: panel.getElementById('chosen'),
      tabs: [0, 1, 2, 3].map((i) => panel.getElementById(`tab-${i}`)),
      chips: Array.from({ length: MAX_OPTIONS }, (_, i) => panel.getElementById(`opt-${i}`)),
    };
    panel.userData.ui = ui;
    ui.tabs.forEach((tab, i) =>
      tab?.addEventListener('click', () => {
        if (i < currentCategory().groups.length) groupIndex.value = i;
      }),
    );
    ui.chips.forEach((chip, i) =>
      chip?.addEventListener('click', () => {
        const group = currentGroup();
        const option = group.options[i];
        if (option) select(group.key, option.id);
      }),
    );
    this.refreshVisibility();
    this.refreshCategory();
  }

  refreshVisibility() {
    const value = phase.peek();
    for (const entity of this.queries.instructions.entities) {
      if (entity.object3D) entity.object3D.visible = value === Phase.Instructions;
    }
    const showStation = value === Phase.Customizing && !beltMoving.peek();
    for (const entity of this.queries.categories.entities) {
      if (entity.object3D) entity.object3D.visible = showStation;
    }
  }

  refreshCategory() {
    const category = currentCategory();
    const group = currentGroup();
    const activeGroup = category.groups.indexOf(group);
    const chosenId = selection.peek()[group.key];

    for (const entity of this.queries.categories.entities) {
      const ui = entity.object3D?.userData.ui;
      if (!ui) continue;
      ui.step?.setProperties({
        text: `ESTACION ${categoryIndex.peek() + 1} DE ${CATEGORIES.length}`,
      });
      ui.title?.setProperties({ text: plain(category.label) });
      ui.help?.setProperties({ text: plain(category.help) });

      ui.tabs.forEach((tab, i) => {
        const tabGroup = category.groups[i];
        const show = category.groups.length > 1 && !!tabGroup;
        tab?.setProperties({
          display: show ? 'flex' : 'none',
          text: tabGroup ? plain(tabGroup.label) : '-',
          backgroundColor: i === activeGroup ? GREEN : CREAM,
          color: i === activeGroup ? '#ffffff' : BROWN,
        });
      });

      ui.chips.forEach((chip, i) => {
        const option = group.options[i];
        if (!option) {
          chip?.setProperties({ display: 'none' });
          return;
        }
        const isColor = group.type === 'colors';
        const background = isColor ? option.id : CREAM;
        chip?.setProperties({
          display: 'flex',
          text: isColor ? ' ' : plain(option.name),
          backgroundColor: background,
          borderColor: option.id === chosenId ? RED : background,
        });
      });

      const chosen = group.options.find((o) => o.id === chosenId);
      ui.chosen?.setProperties({
        text: `Elegido: ${chosen ? plain(chosen.name) : '-'}`,
      });
    }
  }
}
