# MINISO × Animal Crossing — realidad mixta para Meta Quest 3

Prototipo académico (Diseño Interactivo): una máquina virtual sobre una mesa real
donde se personaliza un avatar con las manos. Proyecto independiente de la página
web original; reutiliza sus modelos y texturas.

- **Dispositivo:** Meta Quest 3, solo seguimiento de manos (sin controles).
- **Tecnología:** WebXR · Meta IWSDK 1.1.0-rc.2 · Three.js · IWER (emulador) · ECS · UIKitML.
- **URL pública:** pendiente (se publica en GitHub Pages en la versión 6).

## Ejecutar

Requiere Node 20.19+, 22.12+ o 24+.

```bash
npm install
npm run dev      # servidor + emulador IWER (Quest 3 en una sala de prueba)
npm run build    # versión para publicar, en dist/
```

En el emulador: **Enter XR** → apuntar con la mano al botón **COMENZAR** y pellizcar →
apuntar a la mesa → pellizcar para colocar la máquina.

## Estado: versión 1 (estructura y escena)

| Hecho en V1 | Dónde |
|---|---|
| Proyecto creado con el instalador oficial (AR, JS, agarre, física, entendimiento de escena, raycast) | `iwsdk.config.json` |
| Bienvenida (panel UIKitML) con botón de entrada / COMENZAR | `public/ui/welcome.uikitml`, `src/systems/welcome-system.js` |
| Reconocimiento de superficie: retícula por hit-test + planos detectados; confirma un pellizco | `src/systems/placement-system.js` |
| Máquina (banda, rodillos, arco, indicadores) anclada al espacio | `src/scene-assets/machine.scene-asset.js` |
| Avatar predeterminado con los modelos originales (huesos, ropa, ojos, boca) | `src/avatar/avatar.js`, `public/models/avatar/` |
| Llegada: el avatar sale del arco, la banda lo lleva al centro y queda de frente | `src/systems/conveyor-system.js` |

Capturas del emulador: `docs/capturas/v1/`.

### Funciones de IWSDK en uso

| Función | Uso |
|---|---|
| Spatial UI (UIKitML) | Panel de bienvenida e indicación que sigue la mirada |
| Scene Understanding | Planos detectados (`XRPlane`) para reconocer la mesa; ancla (`XRAnchor`) |
| Environment Raycast | Retícula que sigue el rayo de la mano sobre superficies reales |
| Built-in Interactions | Rayo + pellizco de la mano sobre el botón del panel |
| External Assets | Modelos `.glb` y texturas registrados en `src/assets.js` |
| Grabbing · Physics | Activados; se usan desde la versión 2 y 3 |

### Pendiente

- V2: instrucciones, panel de categorías, botones anterior/siguiente con icono y nombre.
- V3: pincel, tijeras, stickers, perchero y caja de accesorios.
- V4: palanca, animación de fabricación, presentación final con giro.
- V5: tarjeta digital y solicitud del producto (simulada).
- V6: optimización, GitHub Pages y prueba en el visor.

### Limitaciones conocidas

- La fuente de los paneles no incluye tildes ni «¡»: por ahora los textos van sin tildes.
- Probado solo en el emulador IWER. Tamaño real, gestos, luz y profundidad se validan en el visor.

## Estructura

```
iwsdk.config.json        configuración de escena, XR y emulador
src/index.js             crea el mundo y registra los sistemas
src/assets.js            catálogo de modelos, texturas y paneles
src/components.js        componentes ECS propios
src/state.js             fase del recorrido e indicación (señales)
src/systems/             un sistema por responsabilidad
src/avatar/              avatar modular (adaptado de la página original)
src/scene-assets/        modelos procedurales nuevos (la máquina)
src/data/                avatar predeterminado y medidas del modelo
public/models, textures, images, audio   recursos copiados de la página original
public/ui/               paneles UIKitML
public/scenes/           luces y composición base
```
