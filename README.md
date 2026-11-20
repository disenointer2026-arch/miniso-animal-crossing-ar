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

## Estado: versión 5 (correcciones de la prueba en el Quest 3)

La versión 5 aplica las correcciones del equipo tras probar en el visor y la **guía de sistema visual** de la Entrega #3
(paleta, Nunito, radios de 12 a 40 px, sombras cálidas, botón píldora roja, fondos crema con triángulos).

| Cambio | Dónde |
|---|---|
| **Fábrica más grande** (1 unidad del modelo = 3,4 cm): el personaje y los botones ya no atraviesan el modelo | `src/core/layout.js` (`MODEL.scale`) |
| **Hay que caminar:** cada estación tiene su **punto de pie**. En el piso aparece un círculo con huellas, una columna de luz y una flecha que apunta hacia él; al llegar se pone verde con un chulo. Un aviso invita a caminar si estás lejos | `src/systems/stand-system.js`, `MODEL.stands` |
| **Todo de frente:** los marcos de las estaciones miran al punto de pie, así que los paneles y el personaje quedan de cara al usuario. «Ajustes» va arriba y al frente | `layout.js`, `settings-system.js` |
| **Zonas de colocación más amplias** (hasta ~28 cm) y zonas táctiles más grandes | cada sistema de estación |
| **No se quita lo puesto** mientras se sostiene otro objeto (ni 0,9 s después de soltarlo) | `src/interaction/carryable-system.js` (`interactionBusy`) |
| **Colisión de la ropa exacta:** las piezas con huesos se «hornean» a mallas estáticas, así que la caja de colisión coincide con lo que se ve (antes se agarraban por encima de la prenda) | `catalog-station-system.js` (`bakeSkinned`) |
| Interfaz espacial **dibujada en lienzos** con tildes y la paleta de la guía | `src/ui/` |

**Estaciones** (sin paneles flotantes: se maneja con los objetos del modelo)

| Estación | Cómo se juega | Dónde |
|---|---|---|
| **1 · Piel** | Pantalla crema de muestras redondas sobre el nodo `pantalla` del modelo. Elegir un tono hace caer una lata. **El aerosol se activa pulsando la válvula** (el botón de arriba) con la punta del índice (articulación `index-finger-tip` de WebXR Hand Input); con controles, el gatillo de la mano que sostiene la lata. Si la boquilla apunta al personaje, su color se mezcla con el de la lata | `src/stations/skin/` |
| **2 · Cabello** | Dos paneles crema sobre la máquina: **estilos** (tarjetas con mini avatar) y **colores**. Elegir un estilo pone a trabajar la máquina y el cabello sale en la bandeja; se agarra y se suelta sobre la cabeza. Tocar lo puesto lo retira; el bote lo descarta | `src/stations/hair/` |
| **3 · Rostro** | **El libro de stickers se agarra con una mano y se abre**: cuatro páginas (ojos, color de ojos, boca, nariz) con flechas. Con la otra mano se saca un sticker y se lleva a la cara. Soltar el libro lo cierra y vuelve a su sitio | `src/stations/catalog/` |
| **4 · Ropa** | Las prendas del grupo activo están en las **baldas del armario**. **Tres botones** en los bloques de al lado cambian entre camisetas, pantalones y zapatos. Se conserva la cadera blanca del avatar base | `catalog-station-system.js` |
| **5 · Charms y accesorios** | **Seis cajas cerradas** (tres sobre la mesa y tres abajo) con el icono de su charm: bolsa de dinero, guitarra, moneda / tulipán, nota musical, regalo. **Se agarran con una mano y se abren**; con la otra se saca el charm. Al soltarla se cierra y vuelve a su sitio. Los accesorios flotan en dos filas sobre las cajas, al fondo de la mesa | `catalog-station-system.js`, `catalog-objects.js` |

**Cierre.** Tras la estación 5, «Terminar avatar» lleva al personaje a la caja de regalo (la caja de regalo se rehará y se aplicará en una sesión
posterior). Todo aparece al frente del usuario:

1. **«¡Tu avatar está listo!»**: panel crema con tres tarjetas (*Pedir mi producto*, *Crear tarjeta Amiibo*, *Seguir editando*); sin campo de nombre ni resumen.
2. **Pedir mi producto:** pedido simulado en tres pasos. Nombre, apellido, correo, teléfono, dirección y datos de pago se llenan con un **teclado completo** (letras con tilde y ñ, números y signos).
3. **Tarjeta Amiibo:** el nombre se escribe con el mismo teclado; cumpleaños y fondo se eligen con botones. La tarjeta es un plano transparente (sin esquinas negras).
4. «Finalizar» lleva al cierre con «Crear otro avatar».

La tarjeta es un coleccionable digital conceptual inspirado en el formato de las tarjetas Amiibo; no es un producto oficial de Nintendo.

**Versiones anteriores.** La fase A (espacio y calibración), B (estaciones 1 y 2), C (3 a 5), D (cierre) y E (ajustes y guía de pruebas) siguen
vigentes; la V5 cambia cómo se manejan las estaciones. Música de fondo en bucle (`public/audio/ambiente.mp3`, de la web original, solo uso
académico) y efectos sintetizados (`src/audio/sfx.js`) con volúmenes independientes. `avatarConfig` (en `src/state.js`) es la fuente de verdad.

Capturas del emulador de esta versión: `docs/capturas/v5/` (las anteriores, en `v3` y `v4`).

### Pruebas en el emulador

`npm run dev` abre el emulador IWER. En modo desarrollo el estado compartido queda en
`window.__miniso` (no existe en la versión publicada) para poder saltar entre estaciones al probar.

### Cómo se mide el espacio

1. **Piso:** el origen vertical es el piso (`local-floor`); si el visor entrega un plano `floor`, se usa su altura.
2. **Mano:** la altura de la banda es la de la mano al pellizcar (limitada a 0,70–1,25 m). El alcance
   (distancia horizontal cabeza–mano + 8 cm, entre 0,50 y 0,68 m) cambia el tamaño de la fábrica entre un 92 % y un 108 %.
3. **Orientación:** la fábrica se gira hacia donde mira el usuario al confirmar (con la estación 1 al frente-izquierda).

El visor no detecta la cintura: por eso se calibra con la mano. Parámetros en `src/core/layout.js`.

### El modelo de la fábrica

`docs/fuentes/FABRICA.blend` es el modelo del equipo: una banda en «S» que sale del edificio MINISO y pasa por las
estaciones de color, cabello, ojos-boca, ropa y charms. Se convierte con `tools/blender/export_fabrica.py` a
`public/models/fabrica/fabrica.glb` (38 mil triángulos). Cómo se aplicó:

- **Escala y colocación:** 1 unidad del modelo = 3,4 cm (la fábrica ocupa unos 2,1 × 2,5 m). El usuario calibra en el centro del
  recorrido y la banda queda a la altura calibrada; de ahí **camina** a un punto de pie por estación (`MODEL.stands`, a ~45 cm de la banda).
  Los números están en `src/core/layout.js` (`MODEL`).
- **Avatar de 20 cm:** la máquina de cabello del modelo cuelga sobre la banda, así que el personaje tiene que caber debajo.
- **Colores:** el `.blend` no traía materiales; el script de exportación asigna un color por pieza.
- **Banda:** el avatar sigue la línea central de la banda (`MODEL.path`) y se detiene en las paradas de `MODEL.stops`.
- **Objetos funcionales:** las latas y el cabello se colocan en los puntos de `src/factory/anchors.js`; el libro, las baldas del armario, los
  botones, las cajas y la vitrina en `FURNITURE` de `src/stations/catalog/catalog-config.js`. Los dos libros pequeños y las cuatro cajas de
  cartón del estante del modelo no se dibujan: los sustituyen el libro de stickers y las seis cajas de charms.
- **Animación:** al fabricar cabello, la cúpula se sacude y las tijeras del modelo giran.
- **Para cambiar el modelo:** editar el `.blend`, volver a exportar y, si se mueve algo, ajustar `MODEL` y `ANCHORS` mirándolo en el emulador.

### Funciones de IWSDK en uso

| Función | Uso |
|---|---|
| Spatial UI (UIKitML) | Bienvenida, indicaciones, instrucciones, ajustes, pedido, teclado y editor de tarjeta (Nunito) |
| Interfaz en lienzos | Pantallas y paneles de las estaciones y el diálogo de cierre (`src/ui/`) |
| Scene Understanding | Planos detectados (`XRPlane`) para el piso y muebles cercanos; ancla (`XRAnchor`) |
| Built-in Interactions | Rayo + pellizco y toque con el dedo (`PokeInteractable`) |
| External Assets | Modelos `.glb`, texturas y paneles registrados en `src/assets.js` |
| Grabbing | Activado; latas, cabello, stickers, prendas, charms, libro y cajas |

Desactivados a propósito: física (Havok) y detección de mallas, para cuidar el rendimiento.

### Pendiente

- **Prueba en el Quest 3** con la lista de `docs/PRUEBAS.md`, y las evidencias en primera y tercera persona.
- Reemplazar el modelo de la fábrica (versión nueva del equipo) y rehacer la caja de regalo.
- Reemplazar la música por una pista libre de derechos.
- Medir los fotogramas por segundo en el visor y optimizar si hace falta (ver el apartado de rendimiento de la guía).

### Limitaciones conocidas

- **No probado en el Quest 3 todavía** con esta versión: las pruebas se hicieron en el emulador IWER (sin GPU, a pocos fotogramas por segundo).
  Lo que depende del tamaño real, de la luz o de los gestos reales de la mano hay que verlo en el visor (ver `docs/PRUEBAS.md`).
- **Spray con manos:** se agarra la lata con el pellizco y la válvula se pulsa con el índice (de cualquiera de las dos manos). Si la lata se sostiene con la
  mano que la pinza, el índice de esa mano queda en el cuerpo de la lata, no en la válvula; para pulsarla usa la otra mano o toma la lata por abajo.
  Si hay dudas en el visor, ajustar `PRESS_RADIUS` en `skin-station-system.js`.
- **Posiciones del modelo:** los botones del armario, las baldas, las cajas y la vitrina están colocados según el modelo actual; cuando se reemplace
  el modelo (viene una versión nueva) hay que reajustar `MODEL`, `ANCHORS` y `FURNITURE`. La **caja de regalo** del final se rehará y se aplicará después.
- **Accesorios y charms «al revés»:** no se pudo reproducir en el emulador (se ven derechos). **Los accesorios todavía no se confirmó que se agarren y se coloquen** (en la prueba con manos, gafas de sol no quedaron puestas): revisarlo primero en el visor. Si salen al revés, corregir con `DISPLAY_FIX`
  en `catalog-station-system.js` (rotación por pieza).
- Los paneles UIKitML (pedido, teclado, tarjeta) cargan Nunito desde `public/fonts/` (licencia OFL); los demás usan la Nunito integrada, sin tildes.
- El ajuste fino cambia la altura; la distancia se corrige recalibrando con la mano.
- Pedido y tarjeta: todo es simulado; no se descarga ni se comparte nada de verdad.
- Gorra y sombrero ocultan el pelo entero (la web lo recorta bajo el borde).
- El juego carga todos los modelos del avatar al inicio (~6 MB).
- Audio: `public/audio/ambiente.mp3` viene de la web original y se usa solo con fines académicos
  (los derechos son de sus titulares). Debe reemplazarse por una pista libre de derechos antes de cualquier uso fuera del proyecto.
