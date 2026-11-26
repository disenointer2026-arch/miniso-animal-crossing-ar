# Créditos y licencias

Prototipo académico de Diseño Interactivo (Universidad Autónoma de Occidente). Colaboración **ficticia**: no tiene relación comercial con
MINISO ni con Nintendo. Las marcas MINISO, Animal Crossing y Amiibo pertenecen a sus titulares y se usan solo con fines educativos.

## Equipo
Laura Rotavista · Santiago Calle · Joshua Murcia

## Código y herramientas
| Componente | Licencia / fuente |
|---|---|
| Meta Immersive Web SDK (IWSDK) 1.1.0-rc.2 y IWER | Licencia del paquete `@iwsdk/core` (npm) |
| Three.js | MIT |
| @pmndrs/uikit (UIKitML) | MIT |
| Vite | MIT |

## Tipografía
- **Nunito** (Nunito Project Authors) — SIL Open Font License 1.1. Texto de la licencia en `public/fonts/Nunito-OFL.txt`.

## Modelos 3D y arte 2D (propios del equipo)
| Recurso | Fuente editable | Uso |
|---|---|---|
| Fábrica | `docs/fuentes/fabrica/FABRICA.blend` + texturas PNG; exportado con `tools/blender/export_fabrica.py` → `public/models/fabrica/fabrica.glb` | Escenario |
| Lata de aerosol | `docs/fuentes/lata/` (12 pieles UV) → `public/models/lata/` | Estación 1 |
| Bolsa MINISO | `docs/fuentes/bolsa/Bolsa_miniso.blend` → `public/models/bolsa/` | Cierre |
| Paneles del cierre | `docs/fuentes/paneles/paneles-exp-meta.svg / .pdf` | Pedido y tarjeta |
| Avatar, íconos, stickers, ropa y charms | Reutilizados de la página web original del equipo ([Interactivo](https://disenointer2026-arch.github.io/Interactivo/)) | Personaje y estaciones |

## Audio
| Archivo | Origen | Estado |
|---|---|---|
| `public/audio/ambiente.mp3` | Música de la página web original del equipo | Solo uso académico; **reemplazar por una pista libre de derechos** antes de cualquier uso fuera del proyecto |
| `public/audio/boton.mp3`, `public/audio/confirmar.mp3` | Efectos de la página web original del equipo | Solo uso académico; confirmar la licencia o reemplazar |
| Aerosol, máquina, golpes | Sintetizados con Web Audio (`src/audio/sfx.js`) | Propios |

## Tarjeta Amiibo
Coleccionable digital conceptual inspirado en el formato de las tarjetas Amiibo; no es un producto oficial de Nintendo.
