/* Sistema visual del proyecto (Entrega #3, laminas "Superficie": color, tipografia y guia de estilo).
   Cada color tiene un rol fijo: rojo para acciones, verde para estados y hoja, crema para fondos y
   amarillo para pestanas. Una sola familia tipografica (Nunito, pesos 400 a 900). Radios 12 / 18 / 28 /
   40 px, sombras suaves y calidas (nunca negras), movimiento suave y corto. */

export const C = {
  // Marca MINISO
  red: '#FF0000', // botones principales y chulos
  redBrand: '#E60012', // acentos, enlaces, numeros
  redHalo: '#F87171', // halo del hover
  redDark: '#B8000E', // sombra de botones
  // Animal Crossing
  leaf: '#5DBC41', // hoja, charm, sello
  leafSoft: '#9FD28A', // apoyos y contornos
  leafPale: '#CCECC1', // estado "Disponible"
  forest: '#2F5D46', // texto sobre verde
  // Fondos
  cream: '#F6F4CA', // estudio y portada
  panel: '#FAF6D4', // panel de opciones
  triangles: '#F3E8AC', // patron de fondo
  paper: '#FFFBF2', // fondo general
  // Texto
  ink: '#3A2E28', // texto principal
  ink2: '#6B5C52', // texto secundario
  field: '#5E4D47', // titulo de campo
  muted: '#8B806F', // etiquetas auxiliares
  // Interfaz
  yellow: '#F5BA00', // botones de categoria
  yellowSoft: '#FDD885', // contornos del estudio
  turquoise: '#C1E2DD', // categoria de ropa
  blue: '#3D90D2', // rotulo de ropa
  // Luces 3D
  skyWarm: '#FFF1DC',
  grassBounce: '#C8C08F',
  sun: '#FFE0BA',
  fill: '#FFE9D2',
};

/** Color como entero para los materiales de Three.js. */
export const num = (hex) => parseInt(hex.slice(1), 16);

/** Radios de esquina de la guia, en px de lienzo. */
export const RADIUS = { s: 12, m: 18, l: 28, xl: 40 };

/** Familia tipografica de los lienzos y de los paneles UIKitML (se carga en src/ui/world-ui.js). */
export const FONT_FAMILY = 'Nunito, "Segoe UI", system-ui, sans-serif';
