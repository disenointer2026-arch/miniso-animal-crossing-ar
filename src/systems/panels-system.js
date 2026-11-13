/* Paneles espaciales de la maquina (UIKitML):
   - Instrucciones: aparecen cuando llega el personaje; al cerrarlas empieza la
     primera categoria.
   - Categoria: muestra la categoria activa, sus grupos y opciones. Elegir una
     opcion la deja seleccionada; la herramienta de la categoria la aplica. */
import { createSystem, RayInteractable } from '@iwsdk/core';
import {
  CategoryPanel,
  InstructionsPanel,
  Machine,
  MachinePart,
} from '../components.js';
import { CATEGORIES, MAX_OPTIONS, plain } from '../data/categories.js';
import {
  categoryIndex,
  currentCategory,
  currentGroup,
  groupIndex,
  phase,
  Phase,
  select,
  selection,
} from '../state.js';

/** Posicion de los paneles respecto a la maquina: detras y arriba del personaje. */
const PANEL_POSITION = [0, 0.52, -0.2];
const PANEL_TILT = -0.2;
const PANEL_SCALE = 0.1;

const CREAM = '#fff6e6';
const RED = '#e60012';
const GREEN = '#8cc37a';
const BROWN = '#5f4c45';

export class PanelsSystem extends createSystem({
  machines: { required: [Machine] },
  instructions: { required: [InstructionsPanel] },
  categories: { required: [CategoryPanel] },
}) {
  init() {
    this.cleanupFuncs.push(
      this.queries.machines.subscribe('qualify', (machine) => {
        this.buildInstructions(machine);
        this.buildCategoryPanel(machine);
      }),
      phase.subscribe(() => this.refreshVisibility()),
      categoryIndex.subscribe(() => this.refreshCategory()),
      groupIndex.subscribe(() => this.refreshCategory()),
      selection.subscribe(() => this.refreshCategory()),
    );
  }

  async place(assetId, machine, tag) {
    const panel = await this.world.assets.instantiate(assetId);
    if (!machine.active) return null;
    panel.position.fromArray(PANEL_POSITION);
    panel.rotation.x = PANEL_TILT;
    panel.scale.setScalar(PANEL_SCALE);
    panel.visible = false;
    const entity = this.world.createTransformEntity(panel, { parent: machine });
    entity.addComponent(RayInteractable);
    entity.addComponent(MachinePart);
    entity.addComponent(tag);
    return panel;
  }

  async buildInstructions(machine) {
    const panel = await this.place('instructions-panel', machine, InstructionsPanel);
    if (!panel) return;
    panel.getElementById('close-button')?.addEventListener('click', () => {
      if (phase.peek() === Phase.Instructions) phase.value = Phase.Customizing;
    });
    this.refreshVisibility();
  }

  async buildCategoryPanel(machine) {
    const panel = await this.place('category-panel', machine, CategoryPanel);
    if (!panel) return;
    const ui = {
      step: panel.getElementById('step'),
      title: panel.getElementById('title'),
      help: panel.getElementById('help'),
      chosen: panel.getElementById('chosen'),
      tabs: [0, 1, 2].map((i) => panel.getElementById(`tab-${i}`)),
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
    for (const entity of this.queries.categories.entities) {
      if (entity.object3D) entity.object3D.visible = value === Phase.Customizing;
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
        text: `PASO ${categoryIndex.peek() + 1} DE ${CATEGORIES.length}`,
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
