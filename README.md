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

## Cómo se usa (solo con las manos)

1. Abrir la URL pública en el navegador del Quest 3 (seguimiento de manos activado, sin controles) y pulsar **Entrar en RA**; aceptar los permisos de espacio.
2. **Calibrar:** poner la mano a la altura cómoda y pellizcar. La fábrica queda a esa altura y orientada hacia donde miras. Si hace falta moverla, **Ajustes → Reposicionar la fábrica** (conserva el avatar y no repite el viaje de la banda).
3. **Caminar** hasta el círculo del piso de cada estación (se pone verde al llegar).
4. **Agarrar:** acercar la mano al objeto y **pellizcar**; al **abrir los dedos se suelta**. Soltado sobre el personaje, el objeto se coloca solo.
5. **Tocar botones** con la punta del índice (cualquiera de las dos manos). Los botones del borde de la banda piden **mantener el dedo 3 segundos** para evitar toques sin querer. Los paneles también se manejan a distancia con rayo + pellizco.
6. **Ajustes** va arriba y al frente, y sigue al usuario en horizontal sin subir si levanta la cabeza (altura ±2 cm, volumen de música y efectos, reposicionar).

**Estaciones**

| Estación | Cómo se juega | Dónde |
|---|---|---|
| **1 · Piel** | Pantalla de muestras de color sobre el modelo; elegir un tono hace caer una lata. Se agarra con el pellizco y **el aerosol se activa pulsando la válvula con el índice**. Al abrir la mano se suelta la lata. El color rociado se conserva | `src/stations/skin/` |
| **2 · Cabello** | Paneles de estilos y colores (toque directo con el dedo); la máquina fabrica el cabello, se agarra y se suelta sobre la cabeza | `src/stations/hair/` |
| **3 · Rostro** | **Libro de stickers** que se agarra con una mano, se mueve y gira libremente; pestañas para cambiar de página; tres opciones de ojos, cuatro colores, boca y nariz. Con la otra mano se saca un sticker y se lleva a la cara | `src/stations/catalog/` |
| **4 · Ropa** | Prendas en las baldas del armario; tres botones cambian entre camisetas, pantalones y zapatos | `catalog-station-system.js` |
| **5 · Charms y accesorios** | Seis cajas cerradas con el icono de su charm; se agarran, se abren y con la otra mano se saca el charm. Los accesorios flotan sobre las cajas | `catalog-station-system.js`, `catalog-objects.js` |

**Cierre.** Tras la estación 5, «Terminar avatar» lleva al personaje a la bolsa MINISO (`src/finale/`), que se orienta hacia el usuario. Después:

1. **«¡Tu avatar está listo!»:** *Pedir mi producto* o *Crear tarjeta Amiibo*, y «← Seguir editando».
2. **Pedido simulado** en tres pasos con un teclado completo (tildes y ñ); no se envía nada ni se cobra.
3. **«Compra satisfactoria»:** número de guía, confeti y **Salir de la experiencia**.
4. **Tarjeta Amiibo:** nombre (teclado), cumpleaños y fondo; el panel solo deja **Compartir** (rojo) y **Volver a mi avatar**.
5. **Compartir:** descargar imagen, compartir desde el dispositivo y copiar enlace funcionan según el navegador; Instagram, Facebook, X y WhatsApp son simulados.

La tarjeta es un coleccionable digital conceptual inspirado en el formato de las tarjetas Amiibo; no es un producto oficial de Nintendo.

`avatarConfig` (en `src/state.js`) es la fuente de verdad del personaje. Música de fondo en bucle y efectos con volúmenes independientes (ver `CREDITOS.md`).

Capturas: `docs/capturas/` (versiones v1 a v5 y finales en `docs/capturas/entrega/`).

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

### Sistemas de IWSDK aplicados

Configuración en `iwsdk.config.json` (modo `ar`, manos, anclas, planos, hit-test) y sistemas registrados en `src/index.js`.

| Sistema / función de IWSDK | Qué hace aquí |
|---|---|
| **Seguimiento de manos** (`handTracking`) | Única entrada: pellizco para agarrar, índice para tocar y pulsar la válvula; se lee en cada fotograma de XR |
| **Grabbing** (`OneHandGrabbable`) | Latas, cabello, stickers, prendas, charms, cajas y libro; el sistema propio `CarryableSystem` añade soltar al abrir la mano y colocar el objeto en su zona |
| **Spatial UI (UIKitML)** | Bienvenida, instrucciones, ajustes, pedido, teclado y tarjeta (`public/ui/*.uikitml`, fuente Nunito); interfaz de estaciones dibujada en lienzos (`src/ui/`) |
| **Built-in Interactions** (`PokeInteractable`, `RayInteractable`) | Toque con el dedo y rayo + pellizco en paneles |
| **Scene Understanding** (`planeDetection`, `XRPlane`) | Reconoce el piso y muebles cercanos para ubicar la fábrica |
| **Anclas** (`XRAnchor`) | Fija la fábrica al espacio real tras calibrar |
| **Hit-test / environmentRaycast** | Activados; la colocación final usa la mano del usuario |
| **External Assets** | Modelos `.glb`, texturas y paneles registrados en `src/assets.js` |
| **ECS propio** | Sistemas de banda, navegación, estaciones, calibración, ajustes, pedido y cierre (`src/systems/`, `src/stations/`, `src/checkout/`, `src/finale/`) |

**No usados a propósito:** física (Havok), locomoción, detección de mallas, oclusión por profundidad y acceso a cámara; así se cuida el rendimiento del Quest 3.

### Pendiente

- Medir los fotogramas por segundo, las llamadas de dibujo y el tiempo de carga en el visor (ver `docs/PRUEBAS.md`, apartado 4) y anotar las cifras.
- Pruebas con personas ajenas al equipo y registro de incomodidades (ver `docs/PRUEBAS.md`, apartado 5).

### Limitaciones conocidas

- Las correcciones más recientes (libro y pestañas, orientación de la bolsa, reposicionar sin repetir el viaje, soltar al abrir la mano) se verifican en el visor por el equipo; el emulador IWER no reproduce los gestos reales de la mano (ver `docs/PRUEBAS.md`).
- **Spray con manos:** se agarra la lata con el pellizco y la válvula se pulsa con el índice (de cualquiera de las dos manos). Si la lata se sostiene con la
  mano que la pinza, el índice de esa mano queda en el cuerpo de la lata, no en la válvula; para pulsarla usa la otra mano o toma la lata por abajo.
  Si hay dudas en el visor, ajustar `PRESS_RADIUS` en `skin-station-system.js`.
- **Posiciones del modelo:** los botones del armario, las baldas, las cajas y la vitrina están colocados según el modelo actual; cuando se reemplace
  el modelo (viene una versión nueva) hay que reajustar `MODEL`, `ANCHORS` y `FURNITURE`. La **caja de regalo** del final se rehará y se aplicará después.
- **Accesorios y charms «al revés»:** no se pudo reproducir en el emulador: se ven derechos, se agarran y se colocan (gafas de sol y charms probados con manos).
  Si en el visor siguen saliendo al revés, corregir con `DISPLAY_FIX` en `catalog-station-system.js` (rotación por pieza).
- **Sin probar todavía:** las flechas del libro y los colores de ojos, el bote del cabello, el pedido hasta la confirmación y «compartir», y el índice + la puntería del spray a la vez.
- Los paneles UIKitML (pedido, teclado, tarjeta) cargan Nunito desde `public/fonts/` (licencia OFL); los demás usan la Nunito integrada, sin tildes.
- El ajuste fino cambia la altura; la distancia se corrige recalibrando con la mano.
- Pedido y tarjeta: el pedido y las redes sociales son simulados. **Descargar imagen, Compartir desde el dispositivo y Copiar enlace sí funcionan**, pero dependen del navegador: el del Quest puede no ofrecer el menú de compartir ni el portapapeles dentro de una sesión de RA (en ese caso el panel lo dice y ofrece descargar o ver el enlace).
- Gorra y sombrero ocultan el pelo entero (la web lo recorta bajo el borde).
- El juego carga todos los modelos del avatar al inicio (~6 MB).
- Audio: música y efectos vienen de la web original y se usan solo con fines académicos; detalles y licencias en `CREDITOS.md`.
