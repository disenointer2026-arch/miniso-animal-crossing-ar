/* El libro de stickers de la estacion de rostro (cerrado y abierto), dibujado con lienzos. Las cajas de charms y el armario
   son del modelo de la fabrica (ver catalog-station-system.js). Unidades en metros, +Z mira al usuario, +Y arriba. */
import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from '@iwsdk/core';
import { C, num } from '../../ui/theme.js';
import { canvasPlane, drawPanelBackground, fitText, roundRectPath, text } from '../../ui/world-ui.js';

const matte = (color) => new MeshStandardMaterial({ color, roughness: 0.55, metalness: 0 });

function part(name, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(x, y, z);
  return mesh;
}

// ---------- Libro de stickers ----------
export const BOOK = { closed: [0.15, 0.2], open: [0.31, 0.21], thickness: 0.022 };

/** Libro: tapa roja cerrada (con rotulo) y, al abrirlo, dos paginas crema con patron. Gira a lo largo de su
    eje Y. group.userData.setOpen(bool) alterna entre los dos y group.userData.setPage(titulo) rotula la pagina. */
export function createBook() {
  const group = new Group();
  group.name = 'StickerBook';

  // Cerrado
  const closed = new Group();
  closed.name = 'BookClosed';
  closed.add(part('Cover', new BoxGeometry(BOOK.closed[0], BOOK.thickness, BOOK.closed[1]), matte(num(C.redBrand)), 0, BOOK.thickness / 2, 0));
  closed.add(part('Pages', new BoxGeometry(BOOK.closed[0] - 0.012, BOOK.thickness - 0.008, BOOK.closed[1] - 0.012), matte(num(C.paper)), 0.004, BOOK.thickness / 2, 0));
  const label = canvasPlane(0.11, 0.11, 900, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = C.panel;
    roundRectPath(ctx, 6, 6, w - 12, h - 12, w * 0.2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = C.yellowSoft;
    ctx.stroke();
    ctx.fillStyle = C.leaf;
    ctx.beginPath();
    ctx.ellipse(w / 2, h * 0.36, w * 0.13, h * 0.18, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, 'Stickers', w / 2, h * 0.7, { size: h * 0.17, color: C.ink });
    text(ctx, 'Agarralo', w / 2, h * 0.86, { size: h * 0.09, weight: 700, color: C.ink2 });
  });
  label.mesh.rotation.x = -Math.PI / 2;
  label.mesh.position.set(0, BOOK.thickness + 0.0015, 0.005);
  closed.add(label.mesh);
  group.add(closed);

  // Abierto: base roja y dos paginas
  const open = new Group();
  open.name = 'BookOpen';
  open.add(part('OpenCover', new BoxGeometry(BOOK.open[0], 0.01, BOOK.open[1]), matte(num(C.redBrand)), 0, 0.005, 0));
  const spread = canvasPlane(BOOK.open[0] - 0.014, BOOK.open[1] - 0.014, 1500, (ctx, w, h, state) => {
    drawPanelBackground(ctx, w, h, { radius: 36, fill: C.paper, edge: C.yellowSoft });
    ctx.strokeStyle = 'rgba(94, 77, 71, 0.25)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.08);
    ctx.lineTo(w / 2, h * 0.92);
    ctx.stroke();
    fitText(ctx, state.title ?? '', w / 2, h * 0.09, w * 0.6, { size: h * 0.075, color: C.ink });
    text(ctx, state.hint ?? '', w / 2, h * 0.93, { size: h * 0.04, weight: 700, color: C.muted });
    if (state.dots) {
      for (let i = 0; i < state.dots.total; i++) {
        ctx.fillStyle = i === state.dots.current ? C.red : C.yellowSoft;
        ctx.beginPath();
        ctx.arc(w / 2 + (i - (state.dots.total - 1) / 2) * w * 0.035, h * 0.83, h * 0.014, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  spread.mesh.rotation.x = -Math.PI / 2;
  spread.mesh.position.set(0, 0.0105, 0);
  open.add(spread.mesh);
  open.visible = false;
  group.add(open);

  group.userData.closed = closed;
  group.userData.open = open;
  group.userData.spread = spread;
  group.userData.setOpen = (value) => {
    closed.visible = !value;
    open.visible = value;
  };
  return group;
}
