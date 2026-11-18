# MINISO × Animal Crossing — fábrica de personajes en realidad mixta (Meta Quest 3)

Prototipo académico (Diseño Interactivo): una fábrica en anillo que rodea al usuario, con una
banda transportadora y cinco estaciones donde se personaliza un avatar con las manos. Proyecto
independiente de la [página web original](https://disenointer2026-arch.github.io/Interactivo/);
reutiliza sus modelos, textos y texturas (copias en `public/`, nunca los originales).

- **Dispositivo:** Meta Quest 3, solo seguimiento de manos (sin controles).
- **Tecnología:** WebXR · Meta IWSDK 1.1.0-rc.2 · Three.js · IWER (emulador) · ECS · UIKitML.
- **URL pública:** https://disenointer2026-arch.github.io/miniso-animal-crossing-ar/
- **Versión anterior (máquina sobre una mesa):** commit `63b4cd8` en `main` (etiqueta local `v2-prototipo-mesa`).

## Ejecutar

Requiere Node 20.19+, 22.12+ o 24+.

```bash
npm install
npm run dev      # servidor + emulador IWER (Quest 3 en una sala de prueba)
npm run build    # versión para publicar, en dist/
```

Pruebas en el visor: publicar (GitHub Actions lo hace al fusionar a `main`), abrir la URL en el
navegador de la Quest, pulsar **Entrar en RA** y aceptar los permisos de espacio.

## Estado: versión 3, fase A (espacio, fábrica y banda)

| Hecho | Dónde |
|---|---|
| Reconocimiento del **piso** (Scene Understanding) y aviso si hay un mueble cerca | `src/systems/calibration-system.js` |
| **Calibración con la mano**: altura sobre el piso y alcance desde la cabeza (codo a ~90°); no se supone ninguna estatura | `calibration-system.js`, `src/core/layout.js` |
| Fábrica en anillo (placeholder procedural) centrada en el usuario y anclada | `src/scene-assets/factory.scene-asset.js` |
| Banda circular: el avatar sale del portal y viaja entre estaciones | `src/systems/belt-system.js` |
| Avatar base blanco, sin cabello, rostro, ropa ni accesorios | `src/data/avatar-defaults.js` (`BASE_AVATAR`) |
| 5 estaciones (piel, cabello, rostro, ropa, charms) con las opciones de la web original | `src/data/categories.js` |
| Panel de la estación activa y botones anterior / siguiente en cada estación | `panels-system.js`, `navigation-system.js` |
| La personalización se conserva al avanzar y retroceder (estado único) | `src/state.js` |

Elegir una opción en el panel la deja **seleccionada**; todavía no cambia al avatar: lo harán los
objetos de cada estación en las fases B y C.

Capturas del emulador: `docs/capturas/v3/`.

### Cómo se mide el espacio

1. **Piso:** el origen vertical es el piso (`local-floor`); si el visor entrega un plano `floor`, se usa su altura.
2. **Mano:** la altura de la banda es la de la mano al pellizcar (limitada a 0,70–1,25 m) y su
   radio, la distancia horizontal cabeza–mano + 8 cm (limitado a 0,50–0,68 m).
3. **Orientación:** el anillo se gira hacia donde mira el usuario al confirmar.

El visor no detecta la cintura: por eso se calibra con la mano. Parámetros en `src/core/layout.js`.

### Funciones de IWSDK en uso

| Función | Uso |
|---|---|
| Spatial UI (UIKitML) | Bienvenida, indicaciones, instrucciones y panel de estación |
| Scene Understanding | Planos detectados (`XRPlane`) para el piso y muebles cercanos; ancla (`XRAnchor`) |
| Built-in Interactions | Rayo + pellizco y toque con el dedo (`PokeInteractable`) |
| External Assets | Modelos `.glb`, texturas y paneles registrados en `src/assets.js` |
| Grabbing | Activado; lo usan los objetos de las fases B y C |

Desactivados a propósito: física (Havok) y detección de mallas, para cuidar el rendimiento.

### Pendiente

- **B:** estación 1 (latas de aerosol) y estación 2 (máquina de cabello, basurero).
- **C:** estaciones 3 a 5 (libro de stickers, perchero, caja de charms).
- **D:** secuencia de la caja de regalo, pedido simulado (teclado numérico) y tarjeta Amiibo.
- **E:** audio (efectos sintetizados con Web Audio), ajuste fino de altura y distancia, optimización, pruebas en el visor.

### Limitaciones conocidas

- La fuente de los paneles no incluye tildes ni «¡»: los paneles van sin tildes (los botones 3D sí las muestran).
- La calibración se hace una vez por sesión; no hay aún un ajuste fino posterior.
- Probado solo en el emulador IWER (sin GPU, a pocos fotogramas por segundo); falta la prueba en el Quest 3.
- Audio: `public/audio/ambiente.mp3` viene de la web original y se usa solo con fines académicos
  (los derechos son de sus titulares). Debe reemplazarse por una pista libre de derechos antes de cualquier uso fuera del proyecto.
