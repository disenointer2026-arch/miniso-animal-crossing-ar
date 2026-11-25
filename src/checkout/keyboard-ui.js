/* Teclado virtual completo (letras, numeros, signos y tildes) del panel keyboard.uikitml. Escribe en el campo
   activo (focusField): los del pedido (nombre, apellido, correo, telefono, direccion, pago) y el nombre de la
   tarjeta. Los campos numericos solo admiten digitos; los de nombre y direccion ponen en mayuscula cada
   palabra; "Mayus" mayuscula la siguiente letra. */
import { sfx } from '../audio/sfx.js';
import { touchOnly } from '../interaction/finger.js';
import { FIELD_LABELS, FIELD_META } from '../data/shop.js';
import { focusField } from './checkout-state.js';

const ROWS = ['1234567890', 'qwertyuiop', 'asdfghjklñ', 'zxcvbnm.@-', "áéíóúü_,'/"];
export const KEY_CHARS = ROWS.join('').split('');

export class KeyboardUI {
  /** adapter: { get(key) -> texto, set(key, texto), format(key, texto) -> texto mostrado } */
  constructor(panel, adapter) {
    this.panel = panel;
    this.adapter = adapter;
    this.shift = false;
    this.fresh = true; // al abrir un campo, lo primero que se teclea reemplaza el valor de ejemplo
    this.cache = new Map();
    this.bind();
    focusField.subscribe(() => {
      this.fresh = true;
    });
  }

  el(id) {
    if (!this.cache.has(id)) this.cache.set(id, this.panel.getElementById(id));
    return this.cache.get(id);
  }

  on(id, handler) {
    this.el(id)?.addEventListener(
      'pointerdown',
      touchOnly(() => this.panel, () => {
        sfx.select();
        handler();
      }),
    );
  }

  bind() {
    KEY_CHARS.forEach((char, i) => this.on(`kb-${i}`, () => this.type(char)));
    this.on('kb-space', () => this.type(' '));
    this.on('kb-back', () => this.backspace());
    this.on('kb-shift', () => {
      this.shift = !this.shift;
      this.refresh();
    });
    this.on('kb-ok', () => {
      focusField.value = null;
    });
  }

  /** Esta por empezar una palabra (el campo esta vacio o acaba en espacio)? */
  startsWord(value) {
    return value === '' || value.endsWith(' ');
  }

  upper(key, value) {
    const meta = FIELD_META[key];
    return this.shift || (meta?.cap === 'words' && this.startsWord(value));
  }

  type(char) {
    const key = focusField.peek();
    const meta = FIELD_META[key];
    if (!key || !meta) return;
    if (meta.digits && !/\d/.test(char)) return;
    const value = this.fresh ? '' : this.adapter.get(key);
    this.fresh = false;
    const next = char.length === 1 && this.upper(key, value) ? char.toLocaleUpperCase('es') : char;
    this.shift = false;
    this.adapter.set(key, (value + next).slice(0, meta.max));
    this.refresh();
  }

  backspace() {
    const key = focusField.peek();
    if (!key) return;
    this.adapter.set(key, this.fresh ? '' : this.adapter.get(key).slice(0, -1));
    this.fresh = false;
    this.refresh();
  }

  /** Rotula las teclas (mayusculas si toca) y muestra el campo que se esta llenando. */
  refresh() {
    const key = focusField.peek();
    const value = key ? this.adapter.get(key) : '';
    const caps = key ? this.upper(key, value) : false;
    KEY_CHARS.forEach((char, i) => {
      this.el(`kb-${i}`)?.setProperties({ text: caps ? char.toLocaleUpperCase('es') : char });
    });
    this.el('kb-shift')?.setProperties({ backgroundColor: this.shift ? '#F5BA00' : '#FDD885' });
    if (key) {
      this.el('kp-label')?.setProperties({ text: FIELD_LABELS[key] ?? '' });
      this.el('kp-value')?.setProperties({ text: `${this.adapter.format(key, value)}|` });
    }
  }
}
