/* Final de la experiencia, despues de la caja de regalo. Todo aparece al frente del usuario, de frente:
   Choose   "¡Tu avatar esta listo!": pedir el producto, crear la tarjeta Amiibo o seguir editando
   Order    pedido simulado (order-ui.js) con teclado completo de letras y numeros
   Confirm  compra satisfactoria
   Card     editor de la tarjeta (nombre con el teclado, cumpleanos, fondo) con la tarjeta en 3D; compartir (simulado)
   Thanks   cierre y posibilidad de crear otro avatar
   Los paneles se colocan respecto al marco del usuario (src/finale/frame.js) y la caja con la
   figura se aparta a un lado con la senal "showcase". */
import { createSystem, RayInteractable } from '@iwsdk/core';
import { sfx } from '../audio/sfx.js';
import { FactoryPart } from '../components.js';
import { CARD, PRODUCT, SOCIALS, cop, formatField } from '../data/shop.js';
import { framePoint, frameYaw } from '../finale/frame.js';
import { showcase } from '../finale/finale-system.js';
import { avatarConfig, phase, Phase, resetExperience } from '../state.js';
import { createCardView } from './card-view.js';
import { createDialog } from './dialog-ui.js';
import { KeyboardUI } from './keyboard-ui.js';
import { cardProfile, focusField, lastOrder, orderDraft, patchProfile } from './checkout-state.js';
import { OrderUI } from './order-ui.js';
import { renderPortrait } from './portrait.js';

/** Escala de cada panel UIKitML. */
const PANEL_SCALE = { 'order-panel': 0.105, 'keyboard-panel': 0.1, 'card-panel': 0.11 };
const EDGE = '#FDD885';
const RED = '#FF0000';

/** Donde se muestran la caja y la figura segun la fase: a un lado, sin tapar los paneles del centro. */
const SHOWCASE = {
  [Phase.Choose]: { right: -0.62, forward: 0.7, scale: 1, visible: true },
  [Phase.Order]: { right: -0.72, forward: 0.8, scale: 0.7, visible: true },
  [Phase.Confirm]: { right: -0.62, forward: 0.7, scale: 1, visible: true },
  [Phase.Card]: { right: -0.62, forward: 0.7, scale: 1, visible: false },
  [Phase.Thanks]: { right: -0.62, forward: 0.7, scale: 1, visible: true },
};

export class CheckoutSystem extends createSystem({}) {
  init() {
    this.panels = null;
    this.loading = false;
    this.shareOpen = false;
    this.socialIndex = 0;
    this.shareNote = '';
    this.portrait = null;
    this.cardEntity = null;
    this.order = null;
    this.cardBound = false;

    const refresh = () => this.refresh();
    this.cleanupFuncs.push(
      phase.subscribe((value) => {
        if (value === Phase.Welcome) this.reset();
        if (value === Phase.Finishing) this.ensurePanels();
        if (value === Phase.Card) this.makePortrait();
        if (value !== Phase.Card) this.shareOpen = false;
        if (value !== Phase.Order && value !== Phase.Card) focusField.value = null;
        this.refresh();
      }),
      orderDraft.subscribe(refresh),
      focusField.subscribe(refresh),
      cardProfile.subscribe(refresh),
      lastOrder.subscribe(refresh),
    );
    if (import.meta.env.DEV && window.__miniso) {
      Object.assign(window.__miniso, { checkout: this, orderDraft, focusField, lastOrder, cardProfile });
    }
  }

  reset() {
    this.panels = null;
    this.order = null;
    this.cardEntity = null;
    this.cardBound = false;
    this.portrait = null;
    this.loading = false;
  }

  async ensurePanels() {
    if (this.panels || this.loading) return;
    this.loading = true;
    const make = async (id) => {
      const panel = await this.world.assets.instantiate(id);
      panel.scale.setScalar(PANEL_SCALE[id]);
      panel.visible = false;
      const entity = this.world.createTransformEntity(panel);
      entity.addComponent(RayInteractable);
      entity.addComponent(FactoryPart);
      return panel;
    };
    const [order, keyboard, card] = await Promise.all([make('order-panel'), make('keyboard-panel'), make('card-panel')]);
    if (phase.peek() === Phase.Welcome) return; // se salio de la sesion mientras cargaba
    this.panels = { dialog: createDialog(this.world), order, keyboard, card };
    this.order = new OrderUI(order);
    this.keyboard = new KeyboardUI(keyboard, {
      get: (key) => (key === 'cardName' ? cardProfile.peek().name : this.order.getField(key)),
      set: (key, value) => (key === 'cardName' ? patchProfile({ name: value }) : this.order.setField(key, value)),
      format: (key, value) => (key === 'cardName' ? value : formatField(key, value === '' ? '' : value).replace(/^-$/, '')),
    });
    this.buildCard();
    this.bindCardEditor();
    this.loading = false;
    this.refresh();
  }

  buildCard() {
    const mesh = createCardView();
    mesh.visible = false;
    this.cardEntity = this.world.createTransformEntity(mesh);
    this.cardEntity.addComponent(FactoryPart);
    this.cardMesh = mesh;
  }

  makePortrait() {
    try {
      this.portrait = renderPortrait(this.world.renderer, avatarConfig.peek());
    } catch (error) {
      console.warn('[tarjeta] No se pudo dibujar el retrato del avatar:', error);
      this.portrait = null;
    }
  }

  // ---------- Dialogo ----------
  dialogFor(value) {
    const order = lastOrder.peek();
    if (value === Phase.Choose) {
      return {
        title: '¡Tu avatar está listo!',
        body: 'Sé cuánto trabajo requiere crear tu propio estilo. ¡Lo estás haciendo increíble!',
        buttons: [
          { label: 'Pedir mi producto', sub: 'Figura con cadena y base de acrílico', run: () => (phase.value = Phase.Order) },
          { label: 'Crear tarjeta Amiibo', sub: 'Coleccionable digital para compartir', run: () => (phase.value = Phase.Card) },
          { label: 'Seguir editando', back: true, run: () => (phase.value = Phase.Customizing) },
        ],
      };
    }
    if (value === Phase.Confirm && order) {
      return {
        kicker: 'COMPRA SATISFACTORIA',
        title: '¡Tu pedido está listo!',
        body:
          `Te enviamos (de mentira) la confirmación a ${order.email}.\n` +
          `Pedido ${order.number}\n` +
          `${PRODUCT.name} x ${order.qty} de ${order.avatarName}\n` +
          `Entrega a domicilio en ${order.city}. Tiempo estimado: ${PRODUCT.days}.\n` +
          `Pago: ${order.payment} - Total ${cop(order.total)}`,
        buttons: [
          { label: 'Crear tarjeta Amiibo', sub: 'Tu coleccionable digital', run: () => (phase.value = Phase.Card) },
          { label: 'Finalizar', sub: 'Volver al inicio', run: () => (phase.value = Phase.Thanks) },
        ],
      };
    }
    if (value === Phase.Card && this.shareOpen) {
      const social = SOCIALS[this.socialIndex % SOCIALS.length];
      return {
        kicker: 'LISTA PARA COMPARTIR',
        title: 'Comparte tu tarjeta',
        body: this.shareNote || 'Descárgala como imagen o elige una red. Es una simulación: no se publicará nada.',
        buttons: [
          { label: 'Descargar imagen', run: () => this.share('Simulación: imagen descargada. No se guardó nada.') },
          {
            label: 'Redes sociales (simulado)',
            sub: `Siguiente: ${social}`,
            run: () => {
              this.share(`Simulación: tu tarjeta quedó lista para ${social}. No se publicó nada.`);
              this.socialIndex += 1;
            },
          },
          { label: 'Cerrar', back: true, run: () => ((this.shareOpen = false), this.refresh()) },
        ],
      };
    }
    return {
      kicker: '¡GRACIAS!',
      title: 'Tu avatar ya existe',
      body:
        'Gracias por crear tu avatar MINISO x Animal Crossing. Prototipo académico de Diseño Interactivo: colaboración ficticia sin relación comercial con MINISO ni con Nintendo.',
      buttons: [{ label: 'Crear otro avatar', run: () => resetExperience() }],
    };
  }

  share(note) {
    this.shareNote = note;
    this.refresh();
  }

  // ---------- Editor de la tarjeta ----------
  bindCardEditor() {
    const card = this.panels.card;
    const on = (id, fn) =>
      card.getElementById(id)?.addEventListener('click', () => {
        sfx.select();
        fn();
      });
    const profile = () => cardProfile.peek();
    const mod = (n, m) => ((n % m) + m) % m;
    // El nombre se escribe con el teclado: tocar el campo lo abre
    on('f-cardName', () => {
      focusField.value = 'cardName';
    });
    const maxDay = () => (profile().month < 0 ? 31 : CARD.monthDays[profile().month]);
    on('d-minus', () => patchProfile({ day: mod(profile().day - 1, maxDay() + 1) }));
    on('d-plus', () => patchProfile({ day: mod(profile().day + 1, maxDay() + 1) }));
    const setMonth = (month) => {
      const next = Math.min(profile().day, month < 0 ? 31 : CARD.monthDays[month]);
      patchProfile({ month, day: next });
    };
    on('mo-prev', () => setMonth(mod(profile().month + 1 - 1, 13) - 1));
    on('mo-next', () => setMonth(mod(profile().month + 1 + 1, 13) - 1));
    CARD.themes.forEach((theme, i) => on(`th-${i}`, () => patchProfile({ theme: theme.id })));
    on('share', () => {
      this.shareOpen = true;
      this.shareNote = '';
      this.refresh();
    });
    on('finish', () => (phase.value = Phase.Thanks));
    on('back', () => (phase.value = Phase.Choose));
    this.cardBound = true;
  }

  refreshCardEditor() {
    const card = this.panels.card;
    const p = cardProfile.peek();
    const set = (id, props) => card.getElementById(id)?.setProperties(props);
    set('f-cardName', { text: p.name || 'Toca para escribir', borderColor: focusField.peek() === 'cardName' ? RED : EDGE });
    set('d-day', { text: p.day > 0 ? String(p.day) : '--' });
    set('mo-name', { text: p.month >= 0 ? CARD.months[p.month] : '--' });
    CARD.themes.forEach((theme, i) =>
      set(`th-${i}`, { text: theme.name, borderColor: theme.id === p.theme ? RED : EDGE }),
    );
    for (const id of ['d-minus', 'mo-prev']) set(id, { text: '<' });
    set('d-minus', { text: '-' });
    set('d-plus', { text: '+' });
    set('mo-next', { text: '>' });
    if (!this.cardMesh) return;
    const birthday =
      p.day > 0 && p.month >= 0 ? `${String(p.day).padStart(2, '0')}/${String(p.month + 1).padStart(2, '0')}` : '';
    this.cardMesh.userData.redraw({
      portrait: this.portrait,
      name: p.name,
      birthday,
      theme: p.theme,
      avatar: avatarConfig.peek(),
    });
  }

  // ---------- Colocacion y visibilidad ----------
  place(object, right, forward, up = -0.02) {
    framePoint(object.position, right, forward, up);
    object.rotation.set(0, frameYaw(), 0);
  }

  refresh() {
    if (!this.panels) return;
    const value = phase.peek();
    const { dialog, order, keyboard, card } = this.panels;
    const dialogPhase =
      value === Phase.Choose || value === Phase.Confirm || value === Phase.Thanks || (value === Phase.Card && this.shareOpen);
    dialog.setVisible(dialogPhase);
    order.visible = value === Phase.Order;
    keyboard.visible = (value === Phase.Order || value === Phase.Card) && focusField.peek() !== null;
    card.visible = value === Phase.Card && !this.shareOpen;
    if (this.cardMesh) this.cardMesh.visible = value === Phase.Card;

    if (dialogPhase) {
      dialog.set(this.dialogFor(value));
      this.place(dialog.group, 0, 0.85, -0.05);
    }
    if (value === Phase.Order) {
      this.order.refresh();
      this.place(order, 0, 0.9, 0.12);
    }
    if (value === Phase.Card) {
      this.place(card, 0.24, 0.85, -0.02);
      if (this.cardMesh) {
        this.place(this.cardMesh, -0.4, 0.82, 0);
        this.cardMesh.scale.setScalar(1);
      }
      this.refreshCardEditor();
    }
    if (keyboard.visible) {
      this.keyboard.refresh();
      this.place(keyboard, 0, 0.72, -0.58);
    }
    const spec = SHOWCASE[value];
    if (spec) showcase.value = spec;
  }
}
