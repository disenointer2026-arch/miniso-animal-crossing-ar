# MINISO × Animal Crossing — fábrica de personajes en realidad mixta (Meta Quest 3)

Prototipo académico (Diseño Interactivo): una fábrica que rodea al usuario (el modelo `FABRICA.blend` del equipo), con una
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

## Estado: versión 3 completa (fases A a E)

| Hecho | Dónde |
|---|---|
| Reconocimiento del **piso** (Scene Understanding) y aviso si hay un mueble cerca | `src/systems/calibration-system.js` |
| **Calibración con la mano**: altura sobre el piso y alcance desde la cabeza (codo a ~90°); no se supone ninguna estatura | `calibration-system.js`, `src/core/layout.js` |
| **Modelo de la fábrica** (`FABRICA.blend` → `public/models/fabrica/fabrica.glb`) con el usuario en el centro de su recorrido, anclado | `src/factory/factory-model.js`, `src/core/layout.js` |
| Banda circular: el avatar sale del portal y viaja entre estaciones | `src/systems/belt-system.js` |
| Avatar base blanco, sin cabello, rostro, ropa ni accesorios | `src/data/avatar-defaults.js` (`BASE_AVATAR`) |
| 5 estaciones (piel, cabello, rostro, ropa, charms) con las opciones de la web original | `src/data/categories.js` |
| Panel de la estación activa y botones anterior / siguiente en cada estación | `panels-system.js`, `navigation-system.js` |
| La personalización se conserva al avanzar y retroceder (estado único) | `src/state.js` |

**Fase B (estaciones 1 y 2).** Elegir una opción en el panel pone en marcha la estación; el avatar
cambia con los objetos, no con el panel.

| Estación | Cómo se juega | Dónde |
|---|---|---|
| **1 · Piel** | Elegir un tono hace caer una lata del dispensador. Se agarra con un pellizco; **pellizcando con la otra mano** se acciona el aerosol (partículas y sonido) y, si la boquilla apunta al personaje, su color se mezcla poco a poco con el de la lata. Se puede repetir con otro tono | `src/stations/skin/` |
| **2 · Cabello** | Elegir un estilo pone a trabajar la máquina (animación y sonido) y el cabello sale en la bandeja. Se agarra y se suelta sobre la cabeza: si queda cerca se coloca solo (la cabeza se ilumina). **Tocar con el dedo** el cabello puesto lo retira; soltarlo sobre el **bote** lo descarta. El color del cabello repinta el puesto y el de la bandeja | `src/stations/hair/` |

**Fase C (estaciones 3 a 5)** comparten un mismo mecanismo (`src/stations/catalog/`) con un mueble distinto. Cada
pestaña del panel muestra sus objetos en el mueble; se agarran con un pellizco y se sueltan sobre el personaje
(si quedan cerca se colocan solos). **Tocar con el dedo** lo puesto lo retira. El objeto elegido en el panel late
para encontrarlo.

| Estación | Mueble y objetos | Detalles |
|---|---|---|
| **3 · Rostro** | Libro de stickers (ojos, boca, nariz). Dos flechas del libro, o las pestañas del panel, pasan de página | Los stickers vuelven al libro (hay de sobra). Se retira cada rasgo tocándolo. El color de ojos se elige en el panel |
| **4 · Ropa** | Armario con las prendas de la pestaña (superior, inferior, zapatos) | La prenda puesta sale del armario y vuelve a su estante al retirarla. El overol tapa la camiseta |
| **5 · Charms y accesorios** | Caja con los charms o los accesorios de cabeza | Los charms flotan junto al personaje; gorra y sombrero ocultan el pelo; balaca, moño, flor y audífonos se ajustan como en la web |

**Fase D (final).** Tras la estación 5, el botón «siguiente» pasa a ser **«Terminar avatar»**:

1. La banda lleva al personaje a la caja de regalo, que está abierta; el personaje salta dentro, la tapa se cierra y la fábrica se desvanece en destellos (`src/finale/`).
2. La caja viaja al frente del usuario, girando, y se abre: sale la figura final, que gira sola (se puede girar con la mano).
3. Panel **«¿Qué desea hacer?»** con tres salidas (`src/checkout/`):
   - **Pedir mi producto:** pedido simulado en tres pasos (producto, datos, pago) con los textos y reglas de validación de la web. Los datos personales vienen de ejemplo y el teléfono y el pago se editan con un **teclado numérico virtual**. Termina en «¡Tu pedido está listo!» con número de pedido.
   - **Crear tarjeta Amiibo:** la tarjeta se ve en 3D con el retrato real del avatar (se dibuja una copia fuera de pantalla) y los cinco fondos de la web. Nombre (de una lista) y cumpleaños se eligen con flechas. «Compartir» es simulado, como en la web.
   - **Seguir editando:** la fábrica vuelve y el personaje regresa a la estación 5 con todo lo elegido.
4. «Finalizar» lleva a un cierre con «Crear otro avatar», que reinicia todo.

La tarjeta es un coleccionable digital conceptual inspirado en el formato de las tarjetas Amiibo; no es un producto oficial de Nintendo.

**Fase E (ajustes y cierre del prototipo).**

- **Música de fondo** en bucle (`public/audio/ambiente.mp3`, de la web original, solo uso académico) y efectos sintetizados, con **volúmenes independientes**.
- **Panel de ajustes** que sigue la mirada abajo a la izquierda mientras se personaliza: altura de la fábrica (±2 cm por pulsación, hasta ±15 cm), volumen de música y de efectos, y **Recalibrar con la mano** (se vuelve a medir; la fábrica se rehace y el personaje conserva todo lo elegido y regresa a su estación). Está en `src/systems/settings-system.js`.
- Materiales de la fábrica compartidos por color.
- **Guía de pruebas** con lista de verificación y plan de evidencias en `docs/PRUEBAS.md`.

- **Objetos agarrables** (`src/interaction/carryable-system.js`): si se sueltan lejos de todo, vuelven solos a su sitio, así que nunca se pierden.
- **Sonido** (`src/audio/sfx.js`): efectos sintetizados con Web Audio, sin archivos ni derechos de autor. Dos buses de volumen (efectos y música). Se desbloquea al pulsar «Comenzar».
- **Estado único:** `avatarConfig` (en `src/state.js`) es la fuente de verdad; `AvatarSystem` lo refleja en el modelo.

Capturas del emulador: `docs/capturas/v3/` (fase A), `v3b/` (fase B) y `v3c/` (fase C).

### Pruebas en el emulador

`npm run dev` abre el emulador IWER. En modo desarrollo el estado compartido queda en
`window.__miniso` (no existe en la versión publicada) para poder saltar entre estaciones al probar.

### Cómo se mide el espacio

1. **Piso:** el origen vertical es el piso (`local-floor`); si el visor entrega un plano `floor`, se usa su altura.
2. **Mano:** la altura de la banda es la de la mano al pellizcar (limitada a 0,70–1,25 m). El alcance
   (distancia horizontal cabeza–mano + 8 cm, entre 0,50 y 0,68 m) cambia el tamaño de la fábrica entre un 90 % y un 115 %.
3. **Orientación:** la fábrica se gira hacia donde mira el usuario al confirmar (con la estación 1 al frente-izquierda).

El visor no detecta la cintura: por eso se calibra con la mano. Parámetros en `src/core/layout.js`.

### El modelo de la fábrica

`docs/fuentes/FABRICA.blend` es el modelo del equipo: una banda en «S» que sale del edificio MINISO y pasa por las
estaciones de color, cabello, ojos-boca, ropa y charms. Se convierte con `tools/blender/export_fabrica.py` a
`public/models/fabrica/fabrica.glb` (38 mil triángulos). Cómo se aplicó:

- **Escala y colocación:** 1 unidad del modelo = 2,5 cm. El usuario queda en el punto del recorrido que equilibra la distancia a las cinco
  estaciones (40–60 cm) y la banda a la altura calibrada. Los números están en `src/core/layout.js` (`MODEL`).
- **Avatar de 18 cm:** la máquina de cabello del modelo cuelga sobre la banda, así que el personaje tiene que caber debajo.
- **Colores:** el `.blend` no traía materiales; el script de exportación asigna un color por pieza.
- **Banda:** el avatar sigue la línea central de la banda (`MODEL.path`) y se detiene en las paradas de `MODEL.stops`.
- **Objetos funcionales:** latas, cabellos, stickers, prendas y charms se colocan en los puntos de `src/factory/anchors.js` (bandeja junto a los
  dispensadores, bandeja y bote del cabello, parte superior del armario, estante de charms). Los dos libros pequeños y las dos cajas de arriba del
  estante del modelo no se dibujan: los sustituyen el libro de stickers (más grande) y los charms.
- **Animación:** al fabricar cabello, la cúpula se sacude y las tijeras del modelo giran.
- **Para cambiar el modelo:** editar el `.blend`, volver a exportar y, si se mueve algo, ajustar `MODEL` y `ANCHORS` mirándolo en el emulador.

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

- **Prueba en el Quest 3** con la lista de `docs/PRUEBAS.md`, y las evidencias en primera y tercera persona.
- Reemplazar la música por una pista libre de derechos.
- Medir los fotogramas por segundo en el visor y optimizar si hace falta (ver el apartado de rendimiento de la guía).

### Limitaciones conocidas

- La fuente de los paneles no incluye tildes ni «¡»: los paneles van sin tildes (los botones 3D sí las muestran).
- El ajuste fino cambia la altura; la distancia se corrige recalibrando con la mano.
- Probado solo en el emulador IWER (sin GPU, a pocos fotogramas por segundo); falta la prueba en el Quest 3.
  En el emulador los clics de rayo sobre botones son irregulares; los gestos de agarrar, rociar,
  soltar y tocar con el dedo se verificaron con manos emuladas. Los sonidos no se pudieron escuchar (sin audio en el contenedor).
- Pedido y tarjeta: los datos personales son de ejemplo y el nombre de la tarjeta se elige de una lista, porque el visor no tiene teclado de letras. No se descarga ni se comparte nada de verdad.
- No probado con manos: pulsar los botones de los paneles finales (se probó la lógica de cada paso desde el estado compartido y el cierre con el botón «Terminar avatar» tocado con el dedo) ni girar la figura final con la mano.
- No probado aún: tocar las flechas del libro con el dedo (el cambio de página sí se probó desde las pestañas), los stickers de boca y nariz, ni retirar charms o accesorios tocándolos.
- Gorra y sombrero ocultan el pelo entero (la web lo recorta bajo el borde).
- El juego carga ahora todos los modelos del avatar al inicio (~6 MB).
- El rociado exige pellizcar con la mano libre: si esa mano también está cerca de otro objeto agarrable podría agarrarlo.
- Audio: `public/audio/ambiente.mp3` viene de la web original y se usa solo con fines académicos
  (los derechos son de sus titulares). Debe reemplazarse por una pista libre de derechos antes de cualquier uso fuera del proyecto.
