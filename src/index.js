/* MINISO x Animal Crossing - experiencia de realidad mixta para Meta Quest 3.
   La configuracion (AR, manos, funciones) vive en iwsdk.config.json; aqui solo se
   crea el mundo y se registran los sistemas, en el orden del recorrido:

   WelcomeSystem    bienvenida y entrada a la sesion
   HintSystem       indicacion breve que sigue la mirada
   PlacementSystem  reconoce la superficie y coloca la maquina
   ConveyorSystem   la banda trae al personaje (solo al inicio)
   PanelsSystem     instrucciones y panel de la categoria activa
   NavigationSystem botones anterior / siguiente (icono + nombre)
   ToolSystem       herramientas agarrables que vuelven a su sitio
   AvatarSystem     animacion de reposo del personaje */
import { World } from '@iwsdk/core';
import projectOptions from 'virtual:iwsdk-project';
import { AvatarSystem } from './systems/avatar-system.js';
import { ConveyorSystem } from './systems/conveyor-system.js';
import { HintSystem } from './systems/hint-system.js';
import { NavigationSystem } from './systems/navigation-system.js';
import { PanelsSystem } from './systems/panels-system.js';
import { PlacementSystem } from './systems/placement-system.js';
import { ToolSystem } from './systems/tool-system.js';
import { WelcomeSystem } from './systems/welcome-system.js';

World.create(document.getElementById('scene-container'), projectOptions).then(
  (world) => {
    world.registerSystem(WelcomeSystem);
    world.registerSystem(HintSystem);
    world.registerSystem(PlacementSystem, { priority: 5 });
    world.registerSystem(ConveyorSystem, { priority: 10 });
    world.registerSystem(PanelsSystem, { priority: 30 });
    world.registerSystem(NavigationSystem, { priority: 12 });
    world.registerSystem(ToolSystem, { priority: 14 });
    world.registerSystem(AvatarSystem, { priority: 20 });
  },
);
