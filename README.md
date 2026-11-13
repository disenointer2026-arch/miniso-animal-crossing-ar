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

## Estado: versión 2 (interfaz e interacción)

| Hecho | Dónde |
|---|---|
| **V1** Bienvenida, reconocimiento de superficie, máquina anclada, avatar predeterminado y llegada por la banda | `src/systems/welcome-system.js`, `placement-system.js`, `conveyor-system.js`, `src/avatar/avatar.js` |
| **V2** Panel de instrucciones; al cerrarlo empieza la categoría 1 | `public/ui/instructions.uikitml`, `src/systems/panels-system.js` |
| **V2** Panel de categoría: paso, nombre, ayuda, grupos y opciones (colores o nombres) | `public/ui/category.uikitml`, `src/data/categories.js` |
| **V2** Botones espaciales anterior / siguiente con icono y nombre de la categoría destino; se accionan con el dedo o con rayo + pellizco | `src/systems/navigation-system.js` |
| **V2** Pincel, bote y tijeras: aparecen según la categoría, se agarran con un pellizco y vuelven solos a su sitio | `src/systems/tool-system.js`, `src/scene-assets/tools.scene-asset.js` |

En V2 elegir una opción la deja **seleccionada** (y el bote toma ese color), pero todavía
no cambia al personaje: eso lo hacen las herramientas en la versión 3.

Capturas del emulador: `docs/capturas/v1/` y `docs/capturas/v2/`.

### Funciones de IWSDK en uso

| Función | Uso |
|---|---|
| Spatial UI (UIKitML) | Panel de bienvenida e indicación que sigue la mirada |
| Scene Understanding | Planos detectados (`XRPlane`) para reconocer la mesa; ancla (`XRAnchor`) |
| Environment Raycast | Retícula que sigue el rayo de la mano sobre superficies reales |
| Built-in Interactions | Rayo + pellizco sobre paneles y botones; toque con el dedo (`PokeInteractable`) |
| External Assets | Modelos `.glb` y texturas registrados en `src/assets.js` |
| Grabbing | Herramientas con `OneHandGrabbable` (pellizco de la mano) |
| Physics | Activado; se evalúa en la versión 3 |

### Pendiente

- V3: pincel, tijeras, stickers, perchero y caja de accesorios.
- V4: palanca, animación de fabricación, presentación final con giro.
- V5: tarjeta digital y solicitud del producto (simulada).
- V6: optimización, GitHub Pages y prueba en el visor.

### Limitaciones conocidas

- La fuente de los paneles no incluye tildes ni «¡»: los paneles van sin tildes (los botones 3D sí las muestran). Solución prevista: generar la fuente desde un TTF.
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
