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
dedo sí se pueden probar con manos emuladas. En modo desarrollo `window.__miniso.standPos` da el punto del mundo
del círculo de la estación activa y `window.__miniso.spray` el estado de la válvula (distancia de cada índice).
Con **controles** (sin manos) el gatillo de la mano que sostiene la lata hace de dedo sobre la válvula.

## 2. Meta Quest 3

1. Publicar (GitHub Actions publica al fusionar a `main`): https://disenointer2026-arch.github.io/miniso-animal-crossing-ar/
2. Abrir esa URL en el navegador del Quest, con **seguimiento de manos activado** y sin controles en las manos.
3. Pulsar **Entrar en RA** y aceptar los permisos de espacio.
4. Despejar unos **2,5 × 2,5 m** alrededor: la fábrica es más grande y **hay que caminar** hasta el círculo del piso de cada
   estación. Recargar la página tras cada publicación para no ver la versión anterior.

## 3. Lista de verificación

Marcar con el resultado en el visor (el emulador ya cubrió la columna «Emulador»).

| Qué comprobar | Cómo | Emulador | Quest 3 |
|---|---|---|---|
| Reconocimiento del piso | Mirar alrededor: aparece «Piso reconocido» | ✔ | ☐ |
| Aviso de mueble cercano | Con una mesa a menos de 1 m aparece el aviso | ✔ | ☐ |
| Calibración con la mano | Mano a la altura cómoda (codo a 90°) y pellizco; una cinta verde muestra el recorrido de la banda y la sigue | ✔ | ☐ |
| Altura de la plataforma | La banda queda a la altura de la cintura, sin levantar ni encoger los brazos | — | ☐ |
| Escala de la fábrica | El personaje y los botones no atraviesan la fábrica; todo se alcanza desde el círculo | ✔ | ☐ |
| **Círculo del piso** | En cada estación aparece un círculo con huellas y una flecha; al pararse en él se pone verde con un chulo y el aviso desaparece | ✔ | ☐ |
| Pantallas de frente | Todas las pantallas flotantes (Ajustes, instrucciones, paneles de la estación, cierre) quedan de frente, sin ladearse | ✔ | ☐ |
| Ajustes | Panel arriba y al frente; altura ±2 cm, volúmenes, recalibrar (conserva el avatar) | ✔ | ☐ |
| Fábrica y banda | El avatar sale del edificio MINISO y para en la estación 1, mirando al usuario | ✔ | ☐ |
| Estación 1 · piel | Elegir un tono en la pantalla del modelo; agarrar la lata; **pulsar la válvula con la punta del índice** apuntando al personaje | ✔ (la válvula se detecta con el índice emulado y el personaje se pinta con el gatillo; no se ensayó el índice + puntería juntos) | ☐ |
| Estación 2 · cabello | Paneles crema sobre la máquina (estilo con mini avatar y color); fabricar, agarrar, colocar en la cabeza, retirar tocando, descartar en el bote | ✔ (paneles y colocar; retirar y bote sin repetir esta ronda) | ☐ |
| Estación 3 · rostro | **Agarrar el libro con una mano** (se abre); sacar un sticker con la otra y llevarlo a la cara; flechas del libro; colores de ojos | ✔ (abrir, sacar y colocar un sticker; flechas y colores de ojos sin probar) | ☐ |
| Estación 4 · ropa | Prendas en las baldas; tres botones (camisetas, pantalones, zapatos); vestir y desvestir; la cadera blanca se conserva | ✔ (vestir una prenda y pulsar el botón de pantalones con el dedo, desde el frente) | ☐ |
| Estación 5 · charms | **Agarrar una de las seis cajas** (se abre) y sacar el charm con la otra mano; accesorios en la vitrina, derechos | ✔ (caja y charm con manos; las gafas de sol se agarran, se colocan y los accesorios se ven derechos sobre las cajas) | ☐ |
| Zona de colocación | Los objetos se colocan solos aunque se suelten a ~25 cm del lugar | ✔ (cabello, sticker, prenda y charm) | ☐ |
| No quitar lo puesto | Con un objeto en la mano (o recién soltado) tocar otra parte del personaje no la retira | ✔ (con una caja en la mano, tocar las gafas puestas no las quita; sin objeto en la mano, sí) | ☐ |
| Navegación adelante/atrás | Botones de cada estación; **lo elegido se conserva** | ✔ | ☐ |
| Terminar avatar | Caja de regalo, viaje al frente y figura final | ✔ (lanzado desde el estado) | ☐ |
| «¡Tu avatar está listo!» | Panel crema: título, «Esta es tu obra maestra…», *Pedir mi producto* y *Crear tarjeta Amiibo*, y «← Seguir editando» (también la X) | ☐ | ☐ |
| Pedido simulado | Tres pasos; nombre, apellido, correo, teléfono y dirección con el **teclado de letras**; confirmación con número | ✔ (paso «Tus datos» y teclado con tildes; pago sin repetir) | ☐ |
| **Compra satisfactoria** | Hoja, **N.º guía de pedido**, «Rastrea desde… www.miniso.com», confeti; *Crear tarjeta Amiibo*; **«Salir de la experiencia»** cierra la sesión de RA | ☐ | ☐ |
| Tarjeta Amiibo | Retrato, **nombre con el teclado**, cumpleaños y fondo; sin esquinas negras | ✔ | ☐ |
| **Comparte tu tarjeta** | Modal de la web con la **tarjeta detrás**; **Descargar imagen**, **Compartir desde el dispositivo** y **Copiar enlace** funcionan; las redes sociales solo muestran «Simulación…»; X cierra | ☐ | ☐ |
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
