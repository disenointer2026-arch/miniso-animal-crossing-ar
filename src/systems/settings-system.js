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
const FOLLOW_DISTANCE = 0.3; // metros que puede alejarse el usuario antes de que el panel lo siga
const FOLLOW_ANGLE = 0.6; // radianes (unos 35 grados) que puede girar antes de que el panel lo siga
const PANEL_RISE = 0.2; // y un poco por encima de los ojos: se alcanza con el rayo sin estirarse

export class SettingsSystem extends createSystem({
  factories: { required: [Factory] },
  parts: { required: [FactoryPart] },
}) {
  init() {
    this.open = false;
    this.placed = false;
    this.spot = new Vector3();
    this.goal = new Vector3();
    this.goalYaw = 0;
    this.following = false;
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

  /** Punto y giro donde debe estar el panel: PANEL_DISTANCE al frente (solo en horizontal, sin contar si miras arriba o abajo) y
      PANEL_RISE sobre los ojos. Devuelve false si la mirada es casi vertical (no hay un "frente" fiable). */
  target() {
    const head = this.player.head;
    head.getWorldPosition(this.spot);
    head.getWorldDirection(this.dir); // hacia donde mira (la camara mira a -Z)
    this.dir.y = 0;
    if (this.dir.lengthSq() < 0.05) return false;
    this.dir.normalize();
    this.goal.set(this.spot.x + this.dir.x * PANEL_DISTANCE, this.spot.y + PANEL_RISE, this.spot.z + this.dir.z * PANEL_DISTANCE);
    this.goalYaw = Math.atan2(this.spot.x - this.goal.x, this.spot.z - this.goal.z); // el +Z del panel mira a la cabeza
    return true;
  }

  /** Coloca el panel de golpe al empezar a personalizar. */
  place() {
    if (!this.panel || !this.target()) return;
    this.panel.position.copy(this.goal);
    this.panel.rotation.set(0, this.goalYaw, 0);
    this.placed = true;
    this.following = false;
  }

  /** Acompana al usuario por el espacio: si se aleja o gira mas de la tolerancia, el panel lo alcanza suavemente. Mirar arriba o abajo
      no lo mueve (solo cuenta la posicion y el giro horizontal), asi siempre esta "arriba" y a la vista sin perseguir la cabeza. */
  follow(delta) {
    if (!this.placed || !this.panel.visible || !this.target()) return;
    const off = Math.hypot(this.goal.x - this.panel.position.x, this.goal.z - this.panel.position.z);
    const yawOff = Math.abs(Math.atan2(Math.sin(this.goalYaw - this.panel.rotation.y), Math.cos(this.goalYaw - this.panel.rotation.y)));
    if (off > FOLLOW_DISTANCE || yawOff > FOLLOW_ANGLE || Math.abs(this.goal.y - this.panel.position.y) > 0.12) this.following = true;
    if (!this.following) return;
    const k = 1 - Math.exp(-3 * delta);
    this.panel.position.lerp(this.goal, k);
    const diff = Math.atan2(Math.sin(this.goalYaw - this.panel.rotation.y), Math.cos(this.goalYaw - this.panel.rotation.y));
    this.panel.rotation.set(0, this.panel.rotation.y + diff * k, 0);
    if (this.panel.position.distanceTo(this.goal) < 0.02 && Math.abs(diff) < 0.04) this.following = false;
  }

  update(delta) {
    if (!this.panel) return;
    // Si al empezar a personalizar se miraba casi vertical (p. ej. hacia la fabrica en el piso), no habia un "frente" fiable y el panel
    // quedaba oculto para siempre: se reintenta cada cuadro hasta que se pueda colocar.
    if (!this.placed && phase.peek() === Phase.Customizing) this.refresh();
    this.follow(delta);
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
