/* Catalogo de recursos (External Assets). Se evalua dos veces (app y editor):
   debe ser determinista y sin efectos secundarios. */
import { AssetType, defineAssets } from '@iwsdk/core';
import { createMachine } from './scene-assets/machine.scene-asset.js';

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
  // Maquina (modelo procedural nuevo)
  machine: createMachine(),

  // Personaje de la pagina original (copias en public/models/avatar)
  'avatar-cuerpo': glb('avatar/cuerpo', 'Cuerpo'),
  'avatar-cabeza': glb('avatar/cabeza', 'Cabeza'),
  'cabello-corto': glb('avatar/cabello/corto', 'Cabello corto'),
  'nariz-triangle': glb('avatar/nariz/triangular', 'Nariz triangular'),
  'ropa-camisa': glb('avatar/ropa/camisa', 'Camiseta manzana'),
  'ropa-short': glb('avatar/ropa/short', 'Short'),
  'zapatos-zapatos': glb('avatar/zapatos/zapatos', 'Zapatos negros'),

  // Ojos predeterminados (mapas UV en tres capas)
  'ojos-4-base': texture('images/ojos/4-base.png'),
  'ojos-4-iris': texture('images/ojos/4-iris.png'),
  'ojos-4-lineas': texture('images/ojos/4-lineas.png'),

  // Acabado de plastico del equipo
  'plastico-rugosidad': texture('textures/plastico/rugosidad.jpg'),
  'plastico-rayones': texture('textures/plastico/rayones.jpg'),

  // Paneles espaciales (UIKitML)
  'welcome-panel': uikitml('welcome.uikitml', 'Bienvenida'),
  'hint-panel': uikitml('hint.uikitml', 'Indicacion'),
  'instructions-panel': uikitml('instructions.uikitml', 'Instrucciones'),
  'category-panel': uikitml('category.uikitml', 'Categoria'),
});
