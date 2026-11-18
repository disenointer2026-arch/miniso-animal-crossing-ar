/* Catalogo de recursos (External Assets). Se evalua dos veces (app y editor):
   debe ser determinista y sin efectos secundarios. */
import { AssetType, defineAssets } from '@iwsdk/core';
import { createFactory } from './scene-assets/factory.scene-asset.js';

const publicAssetUrl = (filePath) =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

const glb = (file, name) => ({
  url: publicAssetUrl(`models/${file}.glb`),
  type: AssetType.GLTF,
  name,
  priority: 'critical',
});

const texture = (file) => ({
  url: publicAssetUrl(file),
  type: AssetType.Texture,
  priority: 'critical',
});

const uikitml = (fileName, name) => ({
  url: publicAssetUrl(`ui/${fileName}`),
  type: AssetType.UIKitML,
  name,
});

export default defineAssets({
  // Fabrica en anillo (modelo procedural placeholder; en la app se crea ya medida)
  factory: createFactory(),

  // Personaje de la pagina original (copias en public/models/avatar)
  'avatar-cuerpo': glb('avatar/cuerpo', 'Cuerpo'),
  'avatar-cabeza': glb('avatar/cabeza', 'Cabeza'),
  // Estilos de cabello de la estacion 2 (ids = opciones de src/data/categories.js)
  ...Object.fromEntries(
    ['corto', 'flequillo', 'picos', 'ondas', 'afro', 'colitas', 'largo'].map((id) => [
      `cabello-${id}`,
      glb(`avatar/cabello/${id}`, `Cabello ${id}`),
    ]),
  ),
  // Rostro (estacion 3): narices (id de la opcion -> archivo)
  ...Object.fromEntries(
    [['triangle', 'triangular'], ['dot', 'redonda'], ['button', 'cuadrada']].map(([id, file]) => [
      `nariz-${id}`,
      glb(`avatar/nariz/${file}`, `Nariz ${id}`),
    ]),
  ),
  // Ropa y zapatos (estacion 4)
  ...Object.fromEntries(
    [
      ...['camisa', 'camisa-2', 'manga-larga', 'chaqueta', 'chaqueta-2', 'vestido'].map((id) => [`ropa-${id}`, `ropa/${id}`]),
      ...['jean', 'short', 'falda', 'overol'].map((id) => [`ropa-${id}`, `ropa/${id}`]),
      ...['zapatos', 'zapatos-2', 'botas', 'sandalias'].map((id) => [`zapatos-${id}`, `zapatos/${id}`]),
      // Accesorios de cabeza (estacion 5)
      ...['gorra', 'sombrero', 'balaca', 'mono', 'flor', 'audifonos', 'gafas', 'gafas-redondas', 'gafas-sol'].map((id) => [
        `accesorio-${id}`,
        `accesorios/${id}`,
      ]),
      // Charms (estacion 5)
      ...['bolsa-dinero', 'guitarra', 'moneda', 'nota-musical', 'regalo', 'tulipan'].map((id) => [`charm-${id}`, `llaveros/${id}`]),
    ].map(([key, file]) => [key, glb(`avatar/${file}`, key)]),
  ),
  // Imagenes de los stickers del libro (las mismas de los botones de la pagina original)
  ...Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`sticker-ojos-${n}`, texture(`images/ui/botones-ojos-0${n}.png`)]),
  ),
  'sticker-boca-smile': texture('images/ui/botones_nariz_boca_sonrisa-04.png'),
  'sticker-boca-cat': texture('images/ui/botones_nariz_boca_gato-05.png'),
  'sticker-boca-teeth': texture('images/ui/botones_nariz_boca_dientes-06.png'),
  'sticker-nariz-triangle': texture('images/ui/botones_nariz_boca_triangular-01.png'),
  'sticker-nariz-dot': texture('images/ui/botones_nariz_boca_redonda-02.png'),
  'sticker-nariz-button': texture('images/ui/botones_nariz_boca_cuadrada-03.png'),

  // Ojos (mapas UV en tres capas por estilo)
  ...Object.fromEntries(
    [1, 2, 3, 4, 5, 6, 7, 8].flatMap((n) =>
      ['base', 'iris', 'lineas'].map((layer) => [`ojos-${n}-${layer}`, texture(`images/ojos/${n}-${layer}.png`)]),
    ),
  ),

  // Acabado de plastico del equipo
  'plastico-rugosidad': texture('textures/plastico/rugosidad.jpg'),
  'plastico-rayones': texture('textures/plastico/rayones.jpg'),

  // Paneles espaciales (UIKitML)
  'welcome-panel': uikitml('welcome.uikitml', 'Bienvenida'),
  'hint-panel': uikitml('hint.uikitml', 'Indicacion'),
  'instructions-panel': uikitml('instructions.uikitml', 'Instrucciones'),
  'category-panel': uikitml('category.uikitml', 'Categoria'),
  'dialog-panel': uikitml('dialog.uikitml', 'Dialogo'),
  'order-panel': uikitml('order.uikitml', 'Pedido'),
  'keypad-panel': uikitml('keypad.uikitml', 'Teclado numerico'),
  'card-panel': uikitml('card.uikitml', 'Editor de tarjeta'),
  'settings-panel': uikitml('settings.uikitml', 'Ajustes'),
});
