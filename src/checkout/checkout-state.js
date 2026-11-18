/* Estado del pedido y de la tarjeta (simulados). Se reinicia al volver a la bienvenida. */
import { signal } from '@iwsdk/core';
import { BANKS, EXAMPLE_CUSTOMER, EXAMPLE_PAYMENT, NAMES } from '../data/shop.js';
import { phase, Phase } from '../state.js';

const freshDraft = () => ({
  step: 0, // 0 producto, 1 datos, 2 pago
  qty: 1,
  session: false, // sesion MINISO simulada
  customer: { ...EXAMPLE_CUSTOMER },
  payment: 'card',
  bank: BANKS[0],
  card: { ...EXAMPLE_PAYMENT },
  nequi: EXAMPLE_CUSTOMER.phone,
});
const freshProfile = () => ({ name: NAMES[0], day: 0, month: -1, theme: 'hoja' });

export const orderDraft = signal(freshDraft());
export const lastOrder = signal(null);
export const cardProfile = signal(freshProfile());
/** Campo numerico que recibe los digitos del teclado (null = ninguno). */
export const focusField = signal(null);

export function patchDraft(patch) {
  orderDraft.value = { ...orderDraft.peek(), ...patch };
}
export function patchProfile(patch) {
  cardProfile.value = { ...cardProfile.peek(), ...patch };
}

phase.subscribe((value) => {
  if (value !== Phase.Welcome) return;
  orderDraft.value = freshDraft();
  lastOrder.value = null;
  cardProfile.value = freshProfile();
  focusField.value = null;
});
