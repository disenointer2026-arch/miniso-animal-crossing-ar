/* Ajustes (panel UIKitML fijo, arriba y de frente al usuario; se coloca al empezar a personalizar y no sigue la mirada):
   - Altura: sube o baja toda la fabrica unos centimetros sobre la calibrada.
   - Musica y efectos: volumenes independientes.
   - Reposicionar la fabrica: vuelve a ubicarla con la mano (lugar, altura y giro); la fabrica se rehace y el
     personaje conserva todo lo elegido (avatarConfig) y regresa a su estacion. */
import { createSystem, PokeInteractable, RayInteractable, Vector3 } from '@iwsdk/core';
import { sfx } from '../audio/sfx.js';
import { touchOnly } from '../interaction/finger.js';
import { Factory, FactoryPart } from '../components.js';
import { heightOffset, layout, phase, Phase, repositioning } from '../state.js';

const HEIGHT_STEP = 0.02;
const HEIGHT_LIMIT = 0.15;
const VOLUME_STEP = 0.1;
const PANEL_SCALE = 0.07;
const PANEL_DISTANCE = 0.8; // metros al frente de la cabeza, en horizontal
const PANEL_RISE = 0.2; // y un poco por encima de los ojos: se alcanza con el rayo sin estirarse

export class SettingsSystem extends createSystem({
  factories: { required: [Factory] },
  parts: { required: [FactoryPart] },
}) {
  init() {
    this.open = false;
    this.placed = false;
    this.spot = new Vector3();
    this.dir = new Vector3();
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
      phase.subscribe((value) => {
        if (value !== Phase.Customizing) this.placed = false; // se recoloca al volver a personalizar (p. ej. tras reposicionar la fabrica)
        this.refresh();
      }),
      heightOffset.subscribe(() => {
        this.applyHeight();
        this.refresh();
      }),
    );
  }

  bind() {
    const on = (id, handler) =>
      this.panel.getElementById(id)?.addEventListener('pointerdown', touchOnly(() => this.panel, () => {
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

  /** Coloca el panel UNA vez al frente del usuario (al empezar a personalizar) y lo deja fijo: ya no persigue la mirada. */
  place() {
    if (!this.panel) return;
    const head = this.player.head;
    head.getWorldPosition(this.spot);
    head.getWorldDirection(this.dir); // hacia donde mira (la camara mira a -Z)
    this.dir.y = 0;
    if (this.dir.lengthSq() < 0.05) return; // mirando casi vertical: se conserva donde estaba
    this.dir.normalize();
    this.panel.position.set(this.spot.x + this.dir.x * PANEL_DISTANCE, this.spot.y + PANEL_RISE, this.spot.z + this.dir.z * PANEL_DISTANCE);
    this.panel.lookAt(this.spot.x, this.panel.position.y, this.spot.z); // un Object3D (no camara) apunta su +Z al objetivo: de frente al usuario
    this.placed = true;
  }

  applyHeight() {
    const object = this.factory?.object3D;
    if (object) object.position.y = layout.peek().floorY + heightOffset.peek();
  }

  /** Retira la fabrica y vuelve a medir con la mano; el avatar se conserva en avatarConfig. */
  recalibrate() {
    repositioning.value = true; // la fabrica nueva recibe al avatar ya en su estacion
    for (const part of Array.from(this.queries.parts.entities)) part.dispose();
    for (const factory of Array.from(this.queries.factories.entities)) factory.dispose();
    phase.value = Phase.Calibrating;
  }

  refresh() {
    if (!this.panel) return;
    const showing = phase.peek() === Phase.Customizing;
    if (showing && !this.placed) this.place();
    this.panel.visible = showing && this.placed;
    const set = (id, props) => this.panel.getElementById(id)?.setProperties(props);
    set('body', { display: this.open ? 'flex' : 'none' });
    set('toggle', { text: this.open ? 'Cerrar ajustes' : 'Ajustes' });
    const offset = Math.round(heightOffset.peek() * 100);
    set('h-out', { text: `${offset > 0 ? '+' : ''}${offset} cm` });
    set('m-out', { text: `${Math.round(sfx.getVolume('music') * 100)}%` });
    set('e-out', { text: `${Math.round(sfx.getVolume('sfx') * 100)}%` });
  }
}
