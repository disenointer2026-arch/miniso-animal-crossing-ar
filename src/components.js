/* Componentes ECS propios. Modulo sin sistemas ni DOM: el editor tambien lo importa. */
import { createComponent, defineComponents, Types } from '@iwsdk/core';

/** Reticula que marca donde se colocara la maquina. */
export const PlacementReticle = createComponent('PlacementReticle', {
  valid: { type: Types.Boolean, default: false },
});

/** La maquina ya colocada sobre la superficie. */
export const Machine = createComponent('Machine', {
  /** Segundos transcurridos de la animacion de llegada */
  arrivalTime: { type: Types.Float32, default: 0 },
  arrived: { type: Types.Boolean, default: false },
});

/** El personaje que se personaliza. */
export const AvatarFigure = createComponent('AvatarFigure', {});

/** Todo lo que pertenece a la maquina (se retira con ella al salir de la sesion). */
export const MachinePart = createComponent('MachinePart', {});

export const InstructionsPanel = createComponent('InstructionsPanel', {});
export const CategoryPanel = createComponent('CategoryPanel', {});

/** Boton espacial de navegacion: -1 = categoria anterior, +1 = siguiente. */
export const NavButton = createComponent('NavButton', {
  direction: { type: Types.Int8, default: 1 },
});

/** Herramienta u objeto de una categoria (pincel, bote, tijeras...). */
export const Tool = createComponent('Tool', {
  kind: { type: Types.String, default: '' },
  /** Segundos desde que se solto; al pasar el limite vuelve a su sitio */
  idleTime: { type: Types.Float32, default: 0 },
  atHome: { type: Types.Boolean, default: true },
});

export default defineComponents([
  PlacementReticle,
  Machine,
  AvatarFigure,
  MachinePart,
  InstructionsPanel,
  CategoryPanel,
  NavButton,
  Tool,
]);
