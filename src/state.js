/* Estado compartido de la experiencia. Los sistemas lo leen y lo cambian;
   ninguno guarda una copia propia. */
import { signal } from '@iwsdk/core';
import { DEFAULT_AVATAR } from './data/avatar-defaults.js';
import { CATEGORIES } from './data/categories.js';

/** Fases del recorrido, en orden. */
export const Phase = {
  Welcome: 'welcome', // panel de bienvenida
  Placing: 'placing', // buscando la superficie
  Arriving: 'arriving', // la banda trae al personaje
  Instructions: 'instructions', // panel de instrucciones
  Customizing: 'customizing', // personalizacion por categorias
};

export const phase = signal(Phase.Welcome);

/** Indicacion breve que acompana al usuario ('' = oculta). */
export const hint = signal('');

/** Categoria activa (indice en CATEGORIES). */
export const categoryIndex = signal(0);

/** Grupo activo dentro de la categoria (p. ej. Superior / Inferior / Zapatos). */
export const groupIndex = signal(0);

/** Lo que el personaje tiene aplicado. Se conserva al cambiar de categoria. */
export const avatarConfig = signal({ ...DEFAULT_AVATAR });

/** Lo elegido en el panel para cada clave. La herramienta de la categoria lo
    aplica al personaje (version 3); hasta entonces solo queda seleccionado. */
export const selection = signal({ ...DEFAULT_AVATAR });

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
  avatarConfig.value = { ...DEFAULT_AVATAR };
  selection.value = { ...DEFAULT_AVATAR };
  phase.value = Phase.Welcome;
}
