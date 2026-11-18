# Guía de pruebas — MINISO × Animal Crossing en Meta Quest 3

Las pruebas finales se hacen **en el visor**: el emulador (IWER) no reproduce el tamaño real, los gestos
de la mano, la luz ni la profundidad. Esta guía dice cómo probar en los dos sitios, qué comprobar y cómo
documentarlo.

## 1. Emulador (IWER)

```bash
npm install
npm run dev        # abre un Quest 3 emulado en una sala de prueba
```

Pulsa **Enter XR** y mueve las manos desde el panel del emulador. En modo desarrollo el estado compartido queda en
`window.__miniso` (no existe en la versión publicada): `window.__miniso.stepCategory(1)` cambia de estación,
`window.__miniso.avatarConfig.value` muestra lo que lleva el personaje.

Limitaciones: sin GPU el emulador corre a pocos fotogramas por segundo; los clics de rayo sobre botones son
irregulares (hay que apuntar, esperar el `hover` y pellizcar dos veces). El agarre, el rociado, soltar y tocar con el
dedo sí se pueden probar con manos emuladas.

## 2. Meta Quest 3

1. Publicar (GitHub Actions publica al fusionar a `main`): https://disenointer2026-arch.github.io/miniso-animal-crossing-ar/
2. Abrir esa URL en el navegador del Quest, con **seguimiento de manos activado** y sin controles en las manos.
3. Pulsar **Entrar en RA** y aceptar los permisos de espacio.
4. Despejar unos 2 × 2 m alrededor. Recargar la página tras cada publicación para no ver la versión anterior.

## 3. Lista de verificación

Marcar con el resultado en el visor (el emulador ya cubrió la columna «Emulador»).

| Qué comprobar | Cómo | Emulador | Quest 3 |
|---|---|---|---|
| Reconocimiento del piso | Mirar alrededor: aparece «Piso reconocido» | ✔ | ☐ |
| Aviso de mueble cercano | Con una mesa a menos de 1 m aparece el aviso | ✔ | ☐ |
| Calibración con la mano | Mano a la altura cómoda (codo a 90°) y pellizco; el anillo la sigue | ✔ | ☐ |
| Altura de la plataforma | La banda queda a la altura de la cintura, sin levantar ni encoger los brazos | — | ☐ |
| Distancia | Todo al alcance sin extender del todo los brazos | — | ☐ |
| Fábrica y banda | El avatar sale del portal y para en la estación 1 | ✔ | ☐ |
| Estación 1 · piel | Elegir tono, agarrar la lata, pellizcar con la otra mano y apuntar | ✔ | ☐ |
| Estación 2 · cabello | Fabricar, agarrar, colocar en la cabeza, retirar tocando, descartar en el bote | ✔ | ☐ |
| Estación 3 · rostro | Stickers de ojos, boca y nariz; pasar página; retirar tocando | ✔ (ojos) | ☐ |
| Estación 4 · ropa | Vestir y desvestir; zapatos y parte inferior | ✔ (vestido) | ☐ |
| Estación 5 · charms | Charm y accesorio de cabeza | ✔ | ☐ |
| Navegación adelante/atrás | Botones de cada estación; **lo elegido se conserva** | ✔ | ☐ |
| Terminar avatar | Caja de regalo, viaje al frente y figura final | ✔ | ☐ |
| Pedido simulado | Tres pasos con el teclado numérico; confirmación con número | ✔ (lógica) | ☐ |
| Tarjeta Amiibo | Retrato, nombre, cumpleaños y fondo; compartir (simulado) | ✔ | ☐ |
| Ajustes | Altura ±2 cm, volúmenes, recalibrar (conserva el avatar) | ✔ | ☐ |
| Sonido | Efectos en cada acción y música de fondo | no se oye | ☐ |
| Rendimiento | Sin tirones; objetivo 72 fps | no medible | ☐ |

## 4. Rendimiento

Medido en el emulador a mitad del recorrido (`npx @iwsdk/cli scene render-stats`): 164 llamadas de dibujo,
25 mil triángulos, 296 mallas, 232 materiales. Son cifras moderadas para el Quest 3, pero **los fotogramas por segundo
reales solo se miden en el visor** (por ejemplo con OVR Metrics Tool). Si hay tirones, los candidatos son: reducir las
mallas de la fábrica fusionando la geometría estática, y cargar los modelos del avatar bajo demanda.

## 5. Evidencias para la documentación

Dos perspectivas, con la misma persona y el mismo recorrido:

- **Primera persona (lo que ve quien usa el visor):** captura con el botón Meta del control derecho + gatillo, o desde el menú universal →
  Cámara. También se puede transmitir la vista a un teléfono o computador y grabarla.
- **Tercera persona (cómo interactúa físicamente):** teléfono en trípode que encuadre a la persona, sus manos y, si es posible, la pantalla
  con la transmisión (acción y reacción juntas). Pedir permiso antes de grabar.

Guardar en `docs/evidencias/primera-persona/` y `docs/evidencias/tercera-persona/` con el nombre
`NN-estacion-accion.png|mp4` (por ejemplo `03-estacion-1-rociar.mp4`) y anotar en la tabla de arriba cualquier fallo con
foto: eso es la entrada de la siguiente versión.
