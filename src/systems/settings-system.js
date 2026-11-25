/* Ajustes (panel UIKitML que sigue la mirada, arriba y de frente al usuario, solo mientras se personaliza):
   - Altura: sube o baja toda la fabrica unos centimetros sobre la calibrada.
   - Musica y efectos: volumenes independientes.
   - Recalibrar con la mano: vuelve a medir altura y alcance; la fabrica se rehace y el
     personaje conserva todo lo elegido (avatarConfig) y regresa a su estacion. */
import { createSystem, FollowBehavior, Follower, PokeInteractable, RayInteractable } from '@iwsdk/core';
import { sfx } from '../audio/sfx.js';
import { touchOnly } from '../interaction/finger.js';
import { Factory, FactoryPart } from '../components.js';
import { heightOffset, layout, phase, Phase } from '../state.js';

const HEIGHT_STEP = 0.02;
const HEIGHT_LIMIT = 0.15;
const VOLUME_STEP = 0.1;
const PANEL_SCALE = 0.07;

export class SettingsSystem extends createSystem({
  factories: { required: [Factory] },
  parts: { required: [FactoryPart] },
}) {
  init() {
    this.open = false;
    this.factory = null;
    if (import.meta.env.DEV && window.__miniso) window.__miniso.settings = this;
    this.panel = null;
    this.entity = null;
    let disposed = false;
    this.cleanupFuncs.push(() => {
      disposed = true;
    });

    this.world.assets.instantiate('settings-panel').then((panel) => {
      if (disposed) return;
      this.panel = panel;
      panel.scale.setScalar(PANEL_SCALE);
      panel.visible = false;
      this.entity = this.world.createTransformEntity(panel, { persistent: true });
      this.entity.addComponent(RayInteractable);
      this.entity.addComponent(PokeInteractable);
      this.entity.addComponent(Follower, {
        target: this.player.head,
        offsetPosition: [0, 0.26, -0.7],
        behavior: FollowBehavior.FaceTarget,
        maxAngle: 35,
        tolerance: 0.15,
        speed: 3,
      });
      this.bind();
      this.refresh();
    });

    this.cleanupFuncs.push(
      this.queries.factories.subscribe('qualify', (factory) => {
        this.factory = factory;
        this.applyHeight();
      }),
      this.queries.factories.subscribe('disqualify', () => {
        this.factory = null;
      }),
      phase.subscribe(() => this.refresh()),
      heightOffset.subscribe(() => {
        this.applyHeight();
        this.refresh();
      }),
    );
  }

  bind() {
    const on = (id, handler) =>
      this.panel.getElementById(id)?.addEventListener('click', touchOnly(() => this.panel, () => {
        sfx.select();
        handler();
      }));
    on('toggle', () => {
      this.open = !this.open;
      this.refresh();
    });
    const nudge = (step) => {
      const next = Math.round((heightOffset.peek() + step) * 100) / 100;
      heightOffset.value = Math.min(Math.max(next, -HEIGHT_LIMIT), HEIGHT_LIMIT);
    };
    on('h-minus', () => nudge(-HEIGHT_STEP));
    on('h-plus', () => nudge(HEIGHT_STEP));
    for (const [id, bus] of [['m', 'music'], ['e', 'sfx']]) {
      const change = (step) => {
        sfx.setVolume(bus, Math.round((sfx.getVolume(bus) + step) * 10) / 10);
        this.refresh();
      };
      on(`${id}-minus`, () => change(-VOLUME_STEP));
      on(`${id}-plus`, () => change(VOLUME_STEP));
    }
    on('recal', () => this.recalibrate());
  }

  applyHeight() {
    const object = this.factory?.object3D;
    if (object) object.position.y = layout.peek().floorY + heightOffset.peek();
  }

  /** Retira la fabrica y vuelve a medir con la mano; el avatar se conserva en avatarConfig. */
  recalibrate() {
    for (const part of Array.from(this.queries.parts.entities)) part.dispose();
    for (const factory of Array.from(this.queries.factories.entities)) factory.dispose();
    phase.value = Phase.Calibrating;
  }

  refresh() {
    if (!this.panel) return;
    this.panel.visible = phase.peek() === Phase.Customizing;
    const set = (id, props) => this.panel.getElementById(id)?.setProperties(props);
    set('body', { display: this.open ? 'flex' : 'none' });
    set('toggle', { text: this.open ? 'Cerrar ajustes' : 'Ajustes' });
    const offset = Math.round(heightOffset.peek() * 100);
    set('h-out', { text: `${offset > 0 ? '+' : ''}${offset} cm` });
    set('m-out', { text: `${Math.round(sfx.getVolume('music') * 100)}%` });
    set('e-out', { text: `${Math.round(sfx.getVolume('sfx') * 100)}%` });
  }
}
