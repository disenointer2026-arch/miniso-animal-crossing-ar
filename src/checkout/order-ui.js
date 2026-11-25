/* Pedido simulado en el visor: producto, datos y pago (mismo flujo y textos que la web).
   - Los datos personales vienen de ejemplo y se pueden cambiar: el campo tocado (nombre, apellido,
     correo, telefono, direccion, datos de pago) recibe lo que se escribe en el teclado completo.
   - Nada se envia a ningun servidor. Al finalizar queda guardado en lastOrder. */
import { sfx } from '../audio/sfx.js';
import { touchOnly } from '../interaction/finger.js';
import {
  BANKS,
  CITIES,
  FIELD_LABELS,
  MAX_DIGITS,
  PAYMENTS,
  PRODUCT,
  RULES,
  SHIPPING,
  cop,
  formatField,
  hashString,
} from '../data/shop.js';
import { Phase, phase } from '../state.js';
import { cardProfile, focusField, lastOrder, orderDraft, patchDraft } from './checkout-state.js';

const EDGE = '#FDD885'; // contorno de los elementos (amarillo suave de la guia)
const GREEN = '#5DBC41';
const PILL = '#FFFBF2';
const FOCUS = '#FF0000';
const FIELD_KEYS = ['name', 'lastName', 'email', 'phone', 'address', 'ccNumber', 'ccExp', 'ccCvc', 'nequi'];
const CUSTOMER_KEYS = ['name', 'lastName', 'email', 'phone', 'address'];

const cycle = (list, value, step) => list[(list.indexOf(value) + step + list.length) % list.length];

export class OrderUI {
  constructor(orderPanel) {
    this.order = orderPanel;
    this.cache = new Map();
    this.bind();
  }

  el(panel, id) {
    if (!this.cache.has(id)) this.cache.set(id, panel.getElementById(id));
    return this.cache.get(id);
  }

  /** Texto del panel de pedido. Con tildes: los campos de texto usan Nunito completa. */
  text(id, value) {
    this.el(this.order, id)?.setProperties({ text: String(value) });
  }

  on(id, handler) {
    this.el(this.order, id)?.addEventListener(
      'pointerdown',
      touchOnly(() => this.order, () => {
        sfx.select();
        handler();
      }),
    );
  }

  totals(qty) {
    const subtotal = PRODUCT.price * qty;
    const shipping = subtotal >= SHIPPING.freeFrom ? 0 : SHIPPING.cost;
    return { subtotal, shipping, total: subtotal + shipping };
  }

  getField(key) {
    const d = orderDraft.peek();
    if (CUSTOMER_KEYS.includes(key)) return d.customer[key];
    if (key === 'nequi') return d.nequi;
    return d.card[key];
  }

  setField(key, value) {
    const d = orderDraft.peek();
    if (CUSTOMER_KEYS.includes(key)) patchDraft({ customer: { ...d.customer, [key]: value } });
    else if (key === 'nequi') patchDraft({ nequi: value });
    else patchDraft({ card: { ...d.card, [key]: value } });
  }

  bind() {
    const draft = () => orderDraft.peek();
    this.on('q-minus', () => patchDraft({ qty: Math.max(1, draft().qty - 1) }));
    this.on('q-plus', () => patchDraft({ qty: Math.min(5, draft().qty + 1) }));
    this.on('login', () => patchDraft({ session: !draft().session }));
    this.on('c-prev', () => patchDraft({ customer: { ...draft().customer, city: cycle(CITIES, draft().customer.city, -1) } }));
    this.on('c-next', () => patchDraft({ customer: { ...draft().customer, city: cycle(CITIES, draft().customer.city, 1) } }));
    this.on('b-prev', () => patchDraft({ bank: cycle(BANKS, draft().bank, -1) }));
    this.on('b-next', () => patchDraft({ bank: cycle(BANKS, draft().bank, 1) }));
    for (const method of PAYMENTS) this.on(`m-${method.id}`, () => patchDraft({ payment: method.id }));
    for (const key of FIELD_KEYS) {
      this.on(`f-${key}`, () => {
        focusField.value = key;
      });
    }
    this.on('back', () => this.back());
    this.on('next', () => this.next());
  }

  error(message) {
    this.text('err', message || ' ');
  }

  back() {
    const step = orderDraft.peek().step;
    focusField.value = null;
    this.error('');
    if (step > 0) patchDraft({ step: step - 1 });
    else phase.value = Phase.Choose;
  }

  next() {
    const d = orderDraft.peek();
    if (d.step === 0) {
      patchDraft({ step: 1 });
    } else if (d.step === 1) {
      if (!RULES.name(d.customer.name)) return this.error('Escribe tu nombre.');
      if (!RULES.lastName(d.customer.lastName)) return this.error('Escribe tu apellido.');
      if (!RULES.email(d.customer.email)) return this.error('Escribe un correo valido (con @).');
      if (!RULES.phone(d.customer.phone)) return this.error('El telefono debe tener al menos 7 digitos.');
      if (!RULES.address(d.customer.address)) return this.error('Escribe tu direccion.');
      focusField.value = null;
      patchDraft({ step: 2 });
    } else {
      if (d.payment === 'card') {
        if (!RULES.ccNumber(d.card.ccNumber)) return this.error('El numero debe tener 15 o 16 digitos.');
        if (!RULES.ccExp(d.card.ccExp)) return this.error('Usa el formato MM/AA (4 digitos).');
        if (!RULES.ccCvc(d.card.ccCvc)) return this.error('El CVC tiene 3 o 4 digitos.');
      } else if (d.payment === 'nequi' && !RULES.nequi(d.nequi)) {
        return this.error('El celular debe tener 10 digitos.');
      }
      focusField.value = null;
      this.finish(d);
    }
    this.error('');
  }

  /** Cierra el pedido simulado: numero, resumen y pantalla de confirmacion. */
  finish(d) {
    const now = Date.now();
    const number = `MXAC-${hashString(now + d.customer.email).toString(36).toUpperCase().slice(0, 6).padStart(6, '0')}`;
    const method = PAYMENTS.find((m) => m.id === d.payment);
    lastOrder.value = {
      number,
      qty: d.qty,
      email: d.customer.email,
      city: d.customer.city,
      address: d.customer.address,
      payment: d.payment === 'pse' ? `PSE - ${d.bank}` : method.label,
      total: this.totals(d.qty).total,
      avatarName: cardProfile.peek().name,
    };
    sfx.ding();
    phase.value = Phase.Confirm;
  }

  /** Vuelca el estado del pedido en el panel (textos, pestanas, campos). */
  refresh() {
    const d = orderDraft.peek();
    const t = this.totals(d.qty);
    for (let i = 0; i < 3; i++) {
      this.el(this.order, `st-${i}`)?.setProperties({
        backgroundColor: i === d.step ? GREEN : PILL,
        color: i === d.step ? '#ffffff' : '#6B5C52',
      });
      this.el(this.order, `s${i}`)?.setProperties({ display: i === d.step ? 'flex' : 'none' });
    }
    const totalsLine = `Subtotal ${cop(t.subtotal)} - Envio ${t.shipping ? cop(t.shipping) : 'Gratis'} - Total ${cop(t.total)}`;

    this.text('p-name', `${PRODUCT.name} de ${cardProfile.peek().name}`);
    this.text('p-detail', PRODUCT.detail);
    this.text('p-avail', `Disponible. Se fabrica bajo pedido a partir de tu avatar. Tiempo estimado: ${PRODUCT.days}.`);
    this.text('p-price', cop(PRODUCT.price));
    this.text('q-minus', '-');
    this.text('q-out', d.qty);
    this.text('q-plus', '+');
    this.text('p-totals', totalsLine);
    this.text('p-totals2', totalsLine);

    this.text('session', d.session ? `Sesion simulada iniciada como ${d.customer.email}` : 'Puedes continuar sin iniciar sesion.');
    this.text('login', d.session ? 'Cerrar sesion MINISO (simulado)' : 'Iniciar sesion MINISO (simulado)');
    this.text('c-name', d.customer.city);
    this.text('b-name', d.bank);
    for (const method of PAYMENTS) {
      this.el(this.order, `m-${method.id}`)?.setProperties({
        borderColor: d.payment === method.id ? FOCUS : EDGE,
      });
      this.el(this.order, `g-${method.id}`)?.setProperties({ display: d.payment === method.id ? 'flex' : 'none' });
    }

    const focus = focusField.peek();
    for (const key of FIELD_KEYS) {
      this.text(`f-${key}`, `${FIELD_LABELS[key]}: ${formatField(key, this.getField(key))}`);
      this.el(this.order, `f-${key}`)?.setProperties({ borderColor: focus === key ? FOCUS : EDGE });
    }
    this.text('back', d.step === 0 ? 'Volver' : 'Atras');
    this.text('next', d.step === 0 ? 'Continuar' : d.step === 1 ? 'Continuar al pago' : `Finalizar pago - ${cop(t.total)}`);
  }
}
