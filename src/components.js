/* Componentes ECS propios. Modulo sin sistemas ni DOM: el editor tambien lo importa. */
import { createComponent, defineComponents, Types } from '@iwsdk/core';

/** La fabrica (modelo FABRICA.blend) ya colocada alrededor del usuario. */
export const Factory = createComponent('Factory', {});

/** Todo lo que pertenece a la fabrica (se retira con ella al salir de la sesion). */
export const FactoryPart = createComponent('FactoryPart', {});

/** El personaje que se personaliza y su recorrido por la banda.
    Los angulos son radianes sobre el arco (ver src/core/layout.js). */
export const AvatarFigure = createComponent('AvatarFigure', {
  angle: { type: Types.Float32, default: 0 },
  from: { type: Types.Float32, default: 0 },
  to: { type: Types.Float32, default: 0 },
  elapsed: { type: Types.Float32, default: 0 },
  duration: { type: Types.Float32, default: 2 },
  moving: { type: Types.Boolean, default: false },
  /** Primera marcha: el personaje aparece en el portal */
  entering: { type: Types.Boolean, default: true },
});

export const InstructionsPanel = createComponent('InstructionsPanel', {});

/** Boton espacial de navegacion de una estacion: -1 = anterior, +1 = siguiente. */
export const NavButton = createComponent('NavButton', {
  direction: { type: Types.Int8, default: 1 },
  station: { type: Types.Int8, default: 0 },
});

/** Objeto que se agarra con la mano y vuelve solo a su sitio si se suelta lejos.
    home: posicion de reposo en coordenadas de la fabrica; locked: lo mueve una animacion. */
export const Carryable = createComponent('Carryable', {
  kind: { type: Types.String, default: '' },
  idle: { type: Types.Float32, default: 0 },
  locked: { type: Types.Boolean, default: false },
  home: { type: Types.Vec3, default: [0, 0, 0] },
  homeYaw: { type: Types.Float32, default: 0 },
});

/** Lata de aerosol de la estacion 1; color = tono de piel que pinta. */
export const SprayCan = createComponent('SprayCan', {
  color: { type: Types.String, default: '#ffffff' },
});

/** Cabello fabricado, suelto en la mano o en la bandeja. */
export const HairProp = createComponent('HairProp', {
  style: { type: Types.String, default: 'corto' },
});

/** Maquina de cabello de la estacion 2. */
export const HairMachine = createComponent('HairMachine', {
  producing: { type: Types.Boolean, default: false },
  timer: { type: Types.Float32, default: 0 },
  style: { type: Types.String, default: 'corto' },
});

/** Zona tocable sobre el personaje (p. ej. la cabeza: tocar retira el cabello). */
export const AvatarZone = createComponent('AvatarZone', {
  slot: { type: Types.String, default: 'hair' },
});

/** Objeto de un catalogo (sticker, prenda, accesorio, charm). key = parte del avatar que
    cambia; target = donde hay que soltarlo (head | body | feet); kind: sticker | part. */
export const CatalogItem = createComponent('CatalogItem', {
  key: { type: Types.String, default: '' },
  itemId: { type: Types.String, default: '' },
  target: { type: Types.String, default: 'body' },
  kind: { type: Types.String, default: 'part' },
});

/** Elemento pulsable de la interfaz espacial dibujada en lienzos (src/ui/world-ui.js). */
export const UiItem = createComponent('UiItem', {});

/** Caja de charms: se agarra con una mano, se abre al agarrarla y de ella se saca el charm. */
export const ChestBox = createComponent('ChestBox', {
  charm: { type: Types.String, default: '' },
});

/** Libro de stickers de la estacion de rostro: se agarra para elegir. */
export const StickerBook = createComponent('StickerBook', {});

/** Boton fisico de pestana del armario (camisetas, pantalones, zapatos). */
export const ClosetButton = createComponent('ClosetButton', {
  group: { type: Types.Int8, default: 0 },
});

export default defineComponents([
  Factory,
  FactoryPart,
  AvatarFigure,
  InstructionsPanel,
  NavButton,
  Carryable,
  SprayCan,
  HairProp,
  HairMachine,
  AvatarZone,
  CatalogItem,
  UiItem,
  ChestBox,
  StickerBook,
  ClosetButton,
]);
