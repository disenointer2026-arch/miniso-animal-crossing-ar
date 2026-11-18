/* Componentes ECS propios. Modulo sin sistemas ni DOM: el editor tambien lo importa. */
import { createComponent, defineComponents, Types } from '@iwsdk/core';

/** La fabrica en anillo ya colocada alrededor del usuario. */
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
export const CategoryPanel = createComponent('CategoryPanel', {});

/** Boton espacial de navegacion de una estacion: -1 = anterior, +1 = siguiente. */
export const NavButton = createComponent('NavButton', {
  direction: { type: Types.Int8, default: 1 },
  station: { type: Types.Int8, default: 0 },
});

export default defineComponents([
  Factory,
  FactoryPart,
  AvatarFigure,
  InstructionsPanel,
  CategoryPanel,
  NavButton,
]);
