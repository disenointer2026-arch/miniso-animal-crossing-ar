/* Estado compartido de la experiencia. Los sistemas lo leen y lo cambian;
   ninguno guarda una copia propia. */
import { signal } from '@iwsdk/core';
import { BASE_AVATAR } from './data/avatar-defaults.js';
import { DEFAULT_LAYOUT } from './core/layout.js';
import { CATEGORIES } from './data/categories.js';

/** Fases del recorrido, en orden. */
export const Phase = {
  Welcome: 'welcome', // panel de bienvenida
  Space: 'space', // (sin uso) reconocimiento del piso: se quito, el piso se toma del nivel del visor
  Calibrating: 'calibrating', // la mano marca la altura y el alcance comodos
  Arriving: 'arriving', // el personaje sale del portal hacia la estacion 1
  Instructions: 'instructions', // panel de instrucciones
  Customizing: 'customizing', // personalizacion por estaciones
  Finishing: 'finishing', // el avatar entra en la caja de regalo, que viaja al frente
  Choose: 'choose', // que desea hacer: pedido o tarjeta
  Order: 'order', // pedido simulado (producto, datos, pago)
  Confirm: 'confirm', // compra satisfactoria
  Card: 'card', // tarjeta Amiibo
  Thanks: 'thanks', // cierre
};

export const phase = signal(Phase.Welcome);

/** Medidas de la fabrica tras la calibracion (ver src/core/layout.js). */
export const layout = signal({ ...DEFAULT_LAYOUT });

/** Pide a la banda que lleve al personaje a un slot: { slot }. Un objeto nuevo en cada pedido. */
export const beltRequest = signal(null);

/** Las instrucciones ya se mostraron (al recalibrar no se repiten). */
export const instructionsSeen = signal(false);

/** Ajuste fino de la altura de la fabrica sobre la calibrada, en metros. */
export const heightOffset = signal(0);

/** La banda esta llevando al personaje de una estacion a otra. */
export const beltMoving = signal(false);

/** Indicacion breve que acompana al usuario ('' = oculta). */
export const hint = signal('');

/** Estacion activa (indice en CATEGORIES: 0 piel ... 4 charms). */
export const categoryIndex = signal(0);

/** Grupo activo dentro de la categoria (p. ej. Superior / Inferior / Zapatos). */
export const groupIndex = signal(0);

/** Lo que el personaje tiene aplicado. Se conserva al cambiar de categoria. */
export const avatarConfig = signal({ ...BASE_AVATAR });

/** Lo elegido en el panel para cada clave. La herramienta de la categoria lo
    aplica al personaje (version 3); hasta entonces solo queda seleccionado. */
export const selection = signal({ ...BASE_AVATAR });

/** Cambia lo que tiene puesto el personaje: es la fuente de verdad. AvatarSystem lo
    refleja en el modelo, y la tarjeta y el pedido lo leen de aqui. */
export function setAvatar(patch) {
  avatarConfig.value = { ...avatarConfig.peek(), ...patch };
}

export function currentCategory() {
  return CATEGORIES[categoryIndex.peek()];
}

export function currentGroup() {
  const category = currentCategory();
  return category.groups[Math.min(groupIndex.peek(), category.groups.length - 1)];
}

/** Avanza (+1) o retrocede (-1) de categoria, sin salirse de los extremos. */
export function stepCategory(direction) {
  const next = categoryIndex.peek() + direction;
  if (next < 0 || next >= CATEGORIES.length) return false;
  groupIndex.value = 0;
  categoryIndex.value = next;
  return true;
}

export function select(key, id) {
  selection.value = { ...selection.peek(), [key]: id };
}

/** Vuelve al inicio del recorrido (al salir de la sesion). */
export function resetExperience() {
  hint.value = '';
  categoryIndex.value = 0;
  groupIndex.value = 0;
  avatarConfig.value = { ...BASE_AVATAR };
  selection.value = { ...BASE_AVATAR };
  layout.value = { ...DEFAULT_LAYOUT };
  beltMoving.value = false;
  instructionsSeen.value = false;
  heightOffset.value = 0;
  phase.value = Phase.Welcome;
}
