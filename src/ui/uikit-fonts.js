/* El cargador de fuentes TTF de UIKit genera solo el alfabeto basico (sin tildes, enie ni signos de apertura) y un
   atlas de 512 x 512. Los paneles con Nunito propia (teclado, pedido, tarjeta) necesitan tildes y enie, asi que se
   amplia el juego de caracteres y el atlas. Se importa antes de crear el mundo. */
import { TTFLoader } from '@pmndrs/uikit';

const CHARSET =
  " \tABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?.,;:'\"()-[]{}@#$%&*+=/\\<>_" +
  'áéíóúüñÁÉÍÓÚÜÑ¡¿·°|';

const original = TTFLoader.prototype.loadAsync;
TTFLoader.prototype.loadAsync = function loadAsync(input, onProgress) {
  const items = Array.isArray(input) ? input : [input];
  const wide = items.map((item) =>
    typeof item === 'string' ? { url: item, charset: CHARSET, textureSize: [1024, 1024] } : item,
  );
  return original.call(this, wide, onProgress);
};
