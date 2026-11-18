/* Contenido del pedido y de la tarjeta, portado de la pagina original (src/data/content.js).
   Todo es simulado: no se cobra nada ni se envia ningun dato. */

export const PRODUCT = {
  id: 'figure',
  name: 'Figura',
  detail:
    'Una figura de tu avatar con el charm que se selecciono, incluye una cadena para uso como llavero y una base de acrilico para su uso como figura coleccionable. Mide 17 cm de alto con la base, que tiene 10 cm de diametro.',
  price: 89900,
  days: '7 a 10 dias habiles',
};

export const SHIPPING = { cost: 9900, freeFrom: 150000 };
export const CITIES = ['Cali', 'Bogotá', 'Medellín', 'Barranquilla', 'Pereira', 'Cartagena'];
export const BANKS = ['Bancolombia', 'Banco de Bogotá', 'Davivienda', 'BBVA', 'Banco de Occidente', 'Nequi'];
export const PAYMENTS = [
  { id: 'card', label: 'Tarjeta', sub: 'Credito o debito' },
  { id: 'pse', label: 'PSE', sub: 'Debito desde tu banco' },
  { id: 'nequi', label: 'Nequi', sub: 'Pago con tu celular' },
];

/** Datos de ejemplo: el teclado del visor es solo numerico, asi que el resto viene relleno. */
export const EXAMPLE_CUSTOMER = {
  name: 'Valentina',
  lastName: 'Gómez',
  email: 'valentina@correo.com',
  phone: '3001234567',
  city: 'Cali',
  address: 'Calle 5 # 38-20, San Fernando',
};
export const EXAMPLE_PAYMENT = { ccNumber: '4242424242424242', ccExp: '0829', ccCvc: '123' };

/** Nombres para la tarjeta (los de los testimonios de la web); el primero es el de por defecto. */
export const NAMES = ['Tu avatar', 'Valentina', 'Andrés', 'Mariana', 'Samuel', 'Lucía', 'Tomás'];
export const SOCIALS = ['Instagram', 'Facebook', 'X', 'WhatsApp'];

export const CARD = {
  months: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  monthDays: [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
  themes: [
    { id: 'hoja', name: 'Hoja', svg: 'images/tarjetas/hoja.svg', accent: '#6A7E37' },
    { id: 'cereza', name: 'Cereza', svg: 'images/tarjetas/cereza.svg', accent: '#E62F82' },
    { id: 'oceano', name: 'Océano', svg: 'images/tarjetas/oceano.svg', accent: '#04BCE0' },
    { id: 'sol', name: 'Sol', svg: 'images/tarjetas/sol.svg', accent: '#F08C00' },
    { id: 'fosil', name: 'Fósil', svg: 'images/tarjetas/fosil.svg', accent: '#9F7976' },
  ],
};

/** Peso colombiano, con puntos de miles (sin Intl, para no depender del idioma del visor). */
export const cop = (n) => `$ ${String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Reglas de validacion de los campos numericos (las mismas de la web). */
export const RULES = {
  phone: (v) => v.length >= 7,
  ccNumber: (v) => v.length >= 15,
  ccExp: (v) => /^(0[1-9]|1[0-2])\d{2}$/.test(v),
  ccCvc: (v) => /^\d{3,4}$/.test(v),
  nequi: (v) => v.length === 10,
};
export const MAX_DIGITS = { phone: 10, ccNumber: 16, ccExp: 4, ccCvc: 4, nequi: 10 };
export const FIELD_LABELS = {
  phone: 'Telefono',
  ccNumber: 'Numero de tarjeta',
  ccExp: 'Vence (MM/AA)',
  ccCvc: 'CVC',
  nequi: 'Celular Nequi',
};

export function formatField(key, digits) {
  if (key === 'ccNumber') return digits.replace(/(\d{4})(?=\d)/g, '$1 ') || '-';
  if (key === 'ccExp') return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits || '-';
  return digits || '-';
}
