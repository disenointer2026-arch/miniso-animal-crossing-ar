/* MINISO x Animal Crossing - fabrica de personajes en realidad mixta para Meta Quest 3.
   La configuracion (AR, manos, funciones) vive en iwsdk.config.json; aqui solo se
   crea el mundo y se registran los sistemas, en el orden del recorrido:

   WelcomeSystem      bienvenida y entrada a la sesion
   HintSystem         indicacion breve que sigue la mirada
   CalibrationSystem  reconoce el piso, mide altura y alcance con la mano y crea
                      la fabrica en anillo alrededor del usuario
   BeltSystem         el personaje sale del portal y viaja por la banda entre estaciones
   PanelsSystem       instrucciones y panel de la estacion activa
   NavigationSystem   botones anterior / siguiente de cada estacion
   AvatarSystem       animacion de reposo y refleja avatarConfig en el modelo
   CarryableSystem    objetos agarrables: vuelven solos a su sitio al soltarlos
   SkinStationSystem  estacion 1: latas de aerosol y pintura de la piel
   HairStationSystem  estacion 2: maquina de cabello, colocar, retirar y descartar
   CatalogStationSystem estaciones 3 a 5: libro de stickers, armario y caja de charms
   FinaleSystem       cierre: caja de regalo, viaje al frente y figura final
   CheckoutSystem     que desea hacer, pedido simulado, tarjeta Amiibo y cierre */
import { World } from '@iwsdk/core';
import * as state from './state.js';
import projectOptions from 'virtual:iwsdk-project';
import { AvatarSystem } from './systems/avatar-system.js';
import { BeltSystem } from './systems/belt-system.js';
import { CalibrationSystem } from './systems/calibration-system.js';
import { HintSystem } from './systems/hint-system.js';
import { NavigationSystem } from './systems/navigation-system.js';
import { PanelsSystem } from './systems/panels-system.js';
import { WelcomeSystem } from './systems/welcome-system.js';
import { CheckoutSystem } from './checkout/checkout-system.js';
import { FinaleSystem } from './finale/finale-system.js';
import { CarryableSystem } from './interaction/carryable-system.js';
import { CatalogStationSystem } from './stations/catalog/catalog-station-system.js';
import { HairStationSystem } from './stations/hair/hair-station-system.js';
import { SkinStationSystem } from './stations/skin/skin-station-system.js';

World.create(document.getElementById('scene-container'), projectOptions).then(
  (world) => {
    world.registerSystem(WelcomeSystem);
    world.registerSystem(HintSystem);
    world.registerSystem(CalibrationSystem, { priority: 5 });
    world.registerSystem(BeltSystem, { priority: 10 });
    world.registerSystem(PanelsSystem, { priority: 30 });
    world.registerSystem(NavigationSystem, { priority: 12 });
    world.registerSystem(AvatarSystem, { priority: 20 });
    world.registerSystem(CarryableSystem, { priority: 14 });
    world.registerSystem(SkinStationSystem, { priority: 16 });
    world.registerSystem(HairStationSystem, { priority: 16 });
    world.registerSystem(CatalogStationSystem, { priority: 16 });
    world.registerSystem(FinaleSystem, { priority: 18 });
    world.registerSystem(CheckoutSystem, { priority: 32 });
  },
);

// Solo en desarrollo: el estado compartido queda a mano para las pruebas del emulador.
if (import.meta.env.DEV) window.__miniso = { ...state };
