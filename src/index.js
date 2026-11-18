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
   AvatarSystem       animacion de reposo del personaje */
import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { AvatarSystem } from './systems/avatar-system.js';
import { BeltSystem } from './systems/belt-system.js';
import { CalibrationSystem } from './systems/calibration-system.js';
import { HintSystem } from './systems/hint-system.js';
import { NavigationSystem } from './systems/navigation-system.js';
import { PanelsSystem } from './systems/panels-system.js';
import { WelcomeSystem } from './systems/welcome-system.js';

World.create(document.getElementById('scene-container'), projectOptions).then(
  (world) => {
    world.registerSystem(WelcomeSystem);
    world.registerSystem(HintSystem);
    world.registerSystem(CalibrationSystem, { priority: 5 });
    world.registerSystem(BeltSystem, { priority: 10 });
    world.registerSystem(PanelsSystem, { priority: 30 });
    world.registerSystem(NavigationSystem, { priority: 12 });
    world.registerSystem(AvatarSystem, { priority: 20 });
  },
);
