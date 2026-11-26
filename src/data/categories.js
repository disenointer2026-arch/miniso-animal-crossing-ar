/* Las 8 categorias de personalizacion, en el orden obligatorio del recorrido.
   Opciones y paletas iguales a la pagina original (src/data/avatarOptions.js).

   Cada categoria tiene uno o varios GRUPOS; cada grupo controla una clave del avatar:
     type 'colors'  -> muestras de color (id = color hexadecimal)
     type 'options' -> piezas con nombre
   tool: herramienta fisica con la que se aplica el cambio (version 3). */

export const SKIN_TONES = [
  { id: '#FFDCC6', name: 'Porcelana' },
  { id: '#FFD8B5', name: 'Marfil' },
  { id: '#FFCCAB', name: 'Durazno' },
  { id: '#FFC08A', name: 'Albaricoque' },
  { id: '#FFAF7D', name: 'Miel' },
  { id: '#E18D60', name: 'Canela' },
  { id: '#C6815D', name: 'Caramelo' },
  { id: '#AF735C', name: 'Cacao' },
  { id: '#FBF8F0', name: 'Nube' },
  { id: '#A9C48F', name: 'Hoja' },
  { id: '#8EC5F2', name: 'Cielo' },
  { id: '#A89CF6', name: 'Lavanda' },
];

export const HAIR_COLORS = [
  { id: '#3F3B33', name: 'Negro' },
  { id: '#5A3932', name: 'Castaño' },
  { id: '#814142', name: 'Caoba' },
  { id: '#C05333', name: 'Cobrizo' },
  { id: '#F2CF37', name: 'Dorado' },
  { id: '#D2CA7F', name: 'Rubio' },
  { id: '#959092', name: 'Gris' },
  { id: '#CECCBA', name: 'Platino' },
  { id: '#448AD7', name: 'Azul' },
  { id: '#9CB8C5', name: 'Azul grisáceo' },
  { id: '#858840', name: 'Oliva' },
  { id: '#66C7B4', name: 'Turquesa' },
  { id: '#EB5352', name: 'Rojo' },
  { id: '#F58454', name: 'Naranja' },
  { id: '#DA98D0', name: 'Lila' },
  { id: '#F89FAD', name: 'Rosa' },
];

export const EYE_COLORS = [
  { id: '#616972', name: 'Pizarra' },
  { id: '#9C7657', name: 'Café' },
  { id: '#49ACB2', name: 'Turquesa' },
  { id: '#8FA17B', name: 'Musgo' },
];

const LEGACY = [
  {
    id: 'skin',
    label: 'Color de piel',
    icon: 'boton-tonodepiel.svg',
    tool: 'brush',
    help: 'Elige un tono. Moja el pincel en el bote y pinta el cuerpo',
    groups: [{ key: 'skin', label: 'Tono', type: 'colors', options: SKIN_TONES }],
  },
  {
    id: 'hair',
    label: 'Cabello',
    icon: 'boton-cabello.svg',
    tool: 'scissors',
    help: 'Elige un corte. Toma las tijeras y pásalas por el cabello',
    groups: [
      {
        key: 'hair',
        label: 'Corte',
        type: 'options',
        options: [
          { id: 'none', name: 'Sin cabello' },
          { id: 'corto', name: 'Corto' },
          { id: 'flequillo', name: 'Flequillo' },
          { id: 'picos', name: 'Picos' },
          { id: 'ondas', name: 'Ondas' },
          { id: 'afro', name: 'Afro' },
          { id: 'colitas', name: 'Colitas' },
          { id: 'largo', name: 'Largo' },
        ],
      },
    ],
  },
  {
    id: 'hairColor',
    label: 'Color de cabello',
    icon: 'boton-tonodepiel.svg',
    tool: 'brush',
    help: 'Elige un color. Moja el pincel en el bote y pinta el cabello',
    groups: [{ key: 'hairColor', label: 'Color', type: 'colors', options: HAIR_COLORS }],
  },
  {
    id: 'eyes',
    label: 'Ojos',
    icon: 'boton-ojos.svg',
    tool: 'sticker',
    help: 'Elige forma y color. Toma el sticker y llévalo al rostro',
    groups: [
      {
        key: 'eyes',
        label: 'Forma',
        type: 'options',
        options: [
          { id: 'lashes', name: 'Con pestaña' },
          { id: 'soft', name: 'Suaves' },
          { id: 'brow', name: 'Con ceja' },
        ],
      },
      { key: 'eyeColor', label: 'Color', type: 'colors', options: EYE_COLORS },
    ],
  },
  {
    id: 'mouth',
    label: 'Boca',
    icon: 'boton-narizboca.svg',
    tool: 'sticker',
    help: 'Elige una boca. Toma el sticker y llévalo al rostro',
    groups: [
      {
        key: 'mouth',
        label: 'Boca',
        type: 'options',
        options: [
          { id: 'smile', name: 'Sonrisa' },
          { id: 'cat', name: 'Gato' },
          { id: 'teeth', name: 'Dientes' },
        ],
      },
    ],
  },
  {
    id: 'nose',
    label: 'Nariz',
    icon: 'boton-narizboca.svg',
    tool: 'sticker',
    help: 'Elige una nariz. Toma el sticker y llévalo al rostro',
    groups: [
      {
        key: 'nose',
        label: 'Nariz',
        type: 'options',
        options: [
          { id: 'triangle', name: 'Triangular' },
          { id: 'dot', name: 'Redonda' },
          { id: 'button', name: 'Cuadrada' },
        ],
      },
    ],
  },
  {
    id: 'clothes',
    label: 'Ropa',
    icon: 'boton-ropa.svg',
    tool: 'rack',
    help: 'Toma una prenda del perchero y llévala al personaje',
    groups: [
      {
        key: 'shirt',
        label: 'Superior',
        type: 'options',
        options: [
          { id: 'camisa', name: 'Camiseta manzana' },
          { id: 'camisa-2', name: 'Camiseta estrella' },
          { id: 'manga-larga', name: 'Manga larga' },
          { id: 'chaqueta', name: 'Chaqueta negra' },
          { id: 'chaqueta-2', name: 'Chaqueta de jean' },
          { id: 'vestido', name: 'Vestido' },
        ],
      },
      {
        key: 'pants',
        label: 'Inferior',
        type: 'options',
        options: [
          { id: 'jean', name: 'Jean' },
          { id: 'short', name: 'Short' },
          { id: 'falda', name: 'Falda' },
          { id: 'overol', name: 'Overol' },
        ],
      },
      {
        key: 'shoes',
        label: 'Zapatos',
        type: 'options',
        options: [
          { id: 'zapatos', name: 'Zapatos negros' },
          { id: 'zapatos-2', name: 'Zapatos azules' },
          { id: 'botas', name: 'Botas' },
          { id: 'sandalias', name: 'Sandalias' },
        ],
      },
    ],
  },
  {
    id: 'charms',
    label: 'Charms y accesorios',
    icon: 'boton-llavero.svg',
    tool: 'box',
    help: 'Toma un charm o accesorio de la caja y llévalo al personaje',
    groups: [
      {
        key: 'companion',
        label: 'Charms',
        type: 'options',
        options: [
          { id: 'none', name: 'Ninguno' },
          { id: 'bolsa-dinero', name: 'Bolsa de dinero' },
          { id: 'guitarra', name: 'Guitarra' },
          { id: 'moneda', name: 'Moneda' },
          { id: 'nota-musical', name: 'Nota musical' },
          { id: 'regalo', name: 'Regalo' },
          { id: 'tulipan', name: 'Tulipán' },
        ],
      },
      {
        key: 'accHead',
        label: 'Accesorios',
        type: 'options',
        options: [
          { id: 'none', name: 'Ninguno' },
          { id: 'gorra', name: 'Gorra' },
          { id: 'sombrero', name: 'Sombrero' },
          { id: 'balaca', name: 'Balaca' },
          { id: 'mono', name: 'Moño' },
          { id: 'flor', name: 'Flor' },
          { id: 'audifonos', name: 'Audífonos' },
          { id: 'gafas', name: 'Gafas' },
          { id: 'gafas-redondas', name: 'Gafas redondas' },
          { id: 'gafas-sol', name: 'Gafas de sol' },
        ],
      },
    ],
  },
];

/** Las 5 estaciones de la fabrica, en el orden del recorrido. Reutilizan los grupos
    de opciones de la pagina original; solo cambia como se agrupan. */
const byId = Object.fromEntries(LEGACY.map((c) => [c.id, c]));
/** parts: [id de la categoria original, nombre nuevo del grupo (opcional), clave del grupo (opcional: solo ese)]. */
const station = (id, label, icon, help, parts) => ({
  id,
  label,
  icon,
  help,
  groups: parts.flatMap(([from, label, key]) =>
    byId[from].groups.filter((g) => !key || g.key === key).map((g) => ({ ...g, label: label ?? g.label })),
  ),
});

export const CATEGORIES = [
  station('skin', 'Color de piel', 'boton-tonodepiel.svg', 'Elige un tono para tu personaje', [['skin']]),
  station('hair', 'Cabello', 'boton-cabello.svg', 'Elige un estilo y su color', [['hair', 'Estilo'], ['hairColor', 'Color']]),
  station('face', 'Rostro', 'boton-ojos.svg', 'Elige ojos, boca y nariz', [['eyes'], ['mouth'], ['nose']]),
  // El armario del modelo trae cuatro botones: camisetas, pantalones, zapatos y accesorios
  station('clothes', 'Ropa y accesorios', 'boton-ropa.svg', 'Elige la ropa, los zapatos y los accesorios', [
    ['clothes'],
    ['charms', 'Accesorios', 'accHead'],
  ]),
  // Las seis cajas del modelo: cada una guarda un charm
  station('charms', 'Charms', 'boton-llavero.svg', 'Saca un charm de su caja', [['charms', 'Charms', 'companion']]),
];

/** Maximo de opciones por grupo: el panel reserva esta cantidad de casillas. */
const FACE_LABELS = ['Ojos', 'Color de ojos', 'Boca', 'Nariz'];
CATEGORIES[2].groups.forEach((g, i) => {
  g.label = FACE_LABELS[i];
});

export const MAX_OPTIONS = 16;

/** La fuente de los paneles UIKitML no trae tildes ni enie: se quitan al mostrar. */
export function plain(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[¡¿]/g, '');
}
