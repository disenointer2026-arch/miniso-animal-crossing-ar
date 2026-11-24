/* Final de la experiencia, despues de la caja de regalo. Todo aparece al frente del usuario, de frente:
   Choose   "¡Tu avatar esta listo!": pedir el producto, crear la tarjeta Amiibo o seguir editando
   Order    pedido simulado (order-ui.js) con teclado completo de letras y numeros
   Confirm  "Compra satisfactoria": numero de guia, confeti, crear tarjeta o salir de la experiencia
   Card     editor de la tarjeta (nombre con el teclado, cumpleanos, fondo) con la tarjeta en 3D; "Comparte tu
            tarjeta" (la tarjeta queda detras): descargar la imagen, compartir desde el dispositivo y copiar el
            enlace funcionan de verdad; las redes sociales son simuladas
   Thanks   cierre y posibilidad de crear otro avatar
   Los paneles se colocan respecto al marco del usuario (src/finale/frame.js) y la caja con la
   figura se aparta a un lado con la senal "showcase". */
import { createSystem, RayInteractable } from '@iwsdk/core';
import { sfx } from '../audio/sfx.js';
import { FactoryPart } from '../components.js';
import { CARD, formatField } from '../data/shop.js';
import { framePoint, frameYaw } from '../finale/frame.js';
import { showcase } from '../finale/finale-system.js';
import { avatarConfig, phase, Phase, resetExperience } from '../state.js';
import { drawCard } from './card-renderer.js';
import { createCardView } from './card-view.js';
import { Confetti } from './confetti.js';
import { createDialog } from './dialog-ui.js';
import { KeyboardUI } from './keyboard-ui.js';
import { createAvatarReadyPanel, createPurchasePanel } from './design-panels.js';
import { createSharePanel } from './sheets-ui.js';
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
    this.lastPhase = null;
    this.portrait = null;
    this.confetti = null;
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
        // El confeti se lanza al entrar a la compra satisfactoria
        if (value === Phase.Confirm && this.lastPhase !== Phase.Confirm) {
          this.confetti?.start();
          sfx.ding();
        }
        if (value !== Phase.Confirm) this.confetti?.stop();
        this.lastPhase = value;
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
    this.confetti = null;
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
    try {
      await this.buildPanels();
    } catch (error) {
      console.error('[cierre] No se pudieron crear los paneles:', error);
      this.loading = false;
    }
  }

  async buildPanels() {
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
    this.panels = {
      dialog: createDialog(this.world),
      choose: createAvatarReadyPanel(this.world, {
        order: () => (phase.value = Phase.Order),
        card: () => (phase.value = Phase.Card),
        back: () => (phase.value = Phase.Customizing),
      }),
      confirm: createPurchasePanel(this.world, {
        card: () => (phase.value = Phase.Card),
        exit: () => this.exitExperience(),
      }),
      share: createSharePanel(this.world, {
        download: () => this.downloadCard(),
        device: () => this.shareFromDevice(),
        social: (kind) => this.shareSimulated(kind),
        copy: () => this.copyLink(),
        close: () => this.closeShare(),
      }),
      order,
      keyboard,
      card,
    };
    this.confetti = new Confetti(this.world);
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

  // ---------- Cierre ----------
  /** Dialogo generico: solo queda el agradecimiento final. */
  dialogFor() {
    return {
      kicker: '¡GRACIAS!',
      title: 'Tu avatar ya existe',
      body:
        'Gracias por crear tu avatar MINISO x Animal Crossing. Prototipo académico de Diseño Interactivo: colaboración ficticia sin relación comercial con MINISO ni con Nintendo.',
      buttons: [{ label: 'Crear otro avatar', run: () => resetExperience() }],
    };
  }

  /** "Salir de la experiencia": termina la sesion de realidad aumentada (la bienvenida reinicia todo). */
  exitExperience() {
    try {
      this.world.exitXR();
    } catch (error) {
      console.warn('[cierre] No se pudo cerrar la sesion XR:', error);
      resetExperience();
    }
  }

  closeShare() {
    this.shareOpen = false;
    this.panels?.share.setStatus('');
    this.refresh();
  }

  // ---------- Compartir la tarjeta ----------
  /** Opciones para dibujar la tarjeta con los datos actuales. */
  cardOptions() {
    const p = cardProfile.peek();
    const birthday =
      p.day > 0 && p.month >= 0 ? `${String(p.day).padStart(2, '0')}/${String(p.month + 1).padStart(2, '0')}` : '';
    return { portrait: this.portrait, name: p.name, birthday, theme: p.theme, avatar: avatarConfig.peek() };
  }

  async cardBlob() {
    const canvas = await drawCard(this.cardOptions());
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No se pudo crear la imagen');
    return blob;
  }

  cardFileName() {
    const name = cardProfile.peek().name || 'avatar';
    const slug = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `tarjeta-amiibo-${slug || 'avatar'}.png`;
  }

  shareUrl() {
    return `${location.origin}${location.pathname}`;
  }

  /** Descarga de verdad la imagen de la tarjeta (PNG) en el navegador del visor o del computador. */
  async downloadCard() {
    const status = this.panels.share.setStatus;
    try {
      const blob = await this.cardBlob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = this.cardFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 15000);
      status('Imagen descargada: búscala en las descargas del navegador.', 'ok');
    } catch (error) {
      console.warn('[tarjeta] No se pudo descargar la imagen:', error);
      status('No se pudo descargar la imagen en este navegador.', 'error');
    }
  }

  /** Menu de compartir del dispositivo (Web Share API), con la imagen si el navegador la admite. */
  async shareFromDevice() {
    const status = this.panels.share.setStatus;
    if (!navigator.share) {
      status('Este navegador no permite compartir desde aquí. Usa «Descargar imagen» o «Copiar enlace».', 'info');
      return;
    }
    try {
      const data = {
        title: 'Mi tarjeta Amiibo · MINISO × Animal Crossing',
        text: `Mira el avatar de ${cardProfile.peek().name || 'mi avatar'}`,
        url: this.shareUrl(),
      };
      try {
        const file = new File([await this.cardBlob()], this.cardFileName(), { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) data.files = [file];
      } catch {
        /* sin imagen: se comparte solo el enlace */
      }
      await navigator.share(data);
      status('Listo: se abrió el menú de compartir.', 'ok');
    } catch (error) {
      if (error?.name === 'AbortError') status('Cancelaste el envío.', 'info');
      else status('No se pudo abrir el menú de compartir en este dispositivo.', 'error');
    }
  }

  /** Copia el enlace de la experiencia; si el navegador no lo permite, lo muestra para copiarlo a mano. */
  async copyLink() {
    const status = this.panels.share.setStatus;
    const url = this.shareUrl();
    try {
      await navigator.clipboard.writeText(url);
      status('Enlace copiado.', 'ok');
      return;
    } catch {
      /* se prueba el metodo antiguo */
    }
    try {
      const area = document.createElement('textarea');
      area.value = url;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const done = document.execCommand('copy');
      area.remove();
      if (done) {
        status('Enlace copiado.', 'ok');
        return;
      }
    } catch {
      /* sin portapapeles */
    }
    status(`No se pudo copiar. Enlace: ${url.replace(/^https?:\/\//, '')}`, 'error');
  }

  /** Las redes sociales son una simulacion: no se publica nada. */
  shareSimulated(kind) {
    this.panels.share.setStatus(`Simulación: tu tarjeta quedó lista para ${kind}. No se publicó nada.`, 'info');
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
      this.panels.share.setStatus('');
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
    this.cardMesh.userData.redraw(this.cardOptions());
  }

  // ---------- Colocacion y visibilidad ----------
  place(object, right, forward, up = -0.02) {
    framePoint(object.position, right, forward, up);
    object.rotation.set(0, frameYaw(), 0);
  }

  refresh() {
    if (!this.panels) return;
    const value = phase.peek();
    const { dialog, choose, confirm, share, order, keyboard, card } = this.panels;
    const sharing = value === Phase.Card && this.shareOpen;
    dialog.setVisible(value === Phase.Thanks);
    choose.setVisible(value === Phase.Choose);
    confirm.setVisible(value === Phase.Confirm);
    share.setVisible(sharing);
    order.visible = value === Phase.Order;
    keyboard.visible = (value === Phase.Order || value === Phase.Card) && !sharing && focusField.peek() !== null;
    card.visible = value === Phase.Card && !sharing;
    if (this.cardMesh) this.cardMesh.visible = value === Phase.Card;

    if (value === Phase.Thanks) {
      dialog.set(this.dialogFor());
      this.place(dialog.group, 0, 0.85, -0.05);
    }
    if (value === Phase.Choose) this.place(choose.group, 0, 0.85, -0.03);
    if (value === Phase.Confirm) {
      const placed = lastOrder.peek();
      confirm.set({ number: placed?.number });
      this.place(confirm.group, 0, 0.85, -0.03);
    }
    if (value === Phase.Order) {
      this.order.refresh();
      this.place(order, 0, 0.9, 0.12);
    }
    if (value === Phase.Card) {
      if (sharing) {
        // La tarjeta queda por detras del panel de compartir: mas grande y mas lejos, asoma arriba y abajo
        this.place(share.group, 0, 0.78, -0.03);
        if (this.cardMesh) {
          this.place(this.cardMesh, 0, 0.95, -0.03);
          this.cardMesh.scale.setScalar(2.3);
        }
      } else {
        this.place(card, 0.24, 0.85, -0.02);
        if (this.cardMesh) {
          this.place(this.cardMesh, -0.4, 0.82, 0);
          this.cardMesh.scale.setScalar(1);
        }
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

  update(delta) {
    this.confetti?.update(delta);
  }
}
