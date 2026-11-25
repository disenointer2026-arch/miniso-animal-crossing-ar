/* Avatar modular (adaptado de src/three/Avatar.js de la pagina original).
   Usa los mismos modelos .glb: cuerpo con huesos, cabeza enganchada al hueso
   "cabeza", ropa unida a los huesos del cuerpo, ojos pintados sobre la malla de la
   cabeza y boca pegada sobre la cara.

   Version 1: construye el personaje predeterminado. Las piezas quedan en
   this.parts por "slot" para que las mecanicas de personalizacion las reemplacen. */
import {
  AssetManager,
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  NoColorSpace,
  PlaneGeometry,
  Quaternion,
  RepeatWrapping,
  Skeleton,
  SRGBColorSpace,
  Vector3,
} from '@iwsdk/core';
import {
  EYE_CROP,
  EYE_MAPS,
  BASE_CLOTHES_COLOR,
  HEAD_FIT,
  MODEL,
  MOUTH,
  NOSE_ORANGE,
} from '../data/avatar-defaults.js';
import {
  ACCESSORY_FIT,
  CHARM_FIT,
  CHARM_SHOWCASE,
  HIDES_HAIR,
  HIDES_SHIRT,
} from '../data/avatar-fit.js';

const publicAssetUrl = (filePath) =>
  `${import.meta.env.BASE_URL}${filePath.replace(/^\/+/u, '')}`;

/** Material con nombre "skin", "hair"... toma el color elegido para ese rol. */
const ROLE_TO_KEY = { skin: 'skin', hair: 'hairColor' };

/** Aspecto de plastico de la pagina original (rugosidad y rayones del equipo). */
const PLASTIC = { scratches: 0.8, roughness: 0.72 };

let plasticMaps = null;
function plasticTextures() {
  if (plasticMaps) return plasticMaps;
  const prepare = (key) => {
    const source = AssetManager.getTexture(key);
    if (!source) return null;
    const t = source.clone();
    t.flipY = false; // mismas UV que las texturas de los .glb
    t.wrapS = t.wrapT = RepeatWrapping;
    t.colorSpace = NoColorSpace; // datos, no color
    t.needsUpdate = true;
    return t;
  };
  plasticMaps = {
    roughness: prepare('plastico-rugosidad'),
    normal: prepare('plastico-rayones'),
  };
  return plasticMaps;
}

const _color = new Color();

function roleColor(hex, shade = 1) {
  const c = new Color(hex);
  if (shade < 1) c.multiplyScalar(shade);
  return c;
}

/** Profundidad de la cara del modelo en (x, y), interpolando su cuadricula. */
function faceDepth(x, y) {
  const { x0, y0, step, rows } = MODEL.face;
  const cols = rows[0].length;
  const fx = Math.min(Math.max((x - x0) / step, 0), cols - 1.001);
  const fy = Math.min(Math.max((y - y0) / step, 0), rows.length - 1.001);
  const i = Math.floor(fx);
  const j = Math.floor(fy);
  const tx = fx - i;
  const ty = fy - j;
  const a = rows[j][i] + (rows[j][i + 1] - rows[j][i]) * tx;
  const b = rows[j + 1][i] + (rows[j + 1][i + 1] - rows[j + 1][i]) * tx;
  return a + (b - a) * ty;
}

/** Punto sobre la cara, en el espacio de la cabeza (metros del modelo).
    x, y en medidas "procedurales" (las de la pagina); lift lo separa de la piel. */
function onFace(x, y, lift, target) {
  const [fx, fy] = HEAD_FIT;
  const X = x * fx;
  const Y = y * fy;
  const e = 0.01;
  const dzx = (faceDepth(X + e, Y) - faceDepth(X - e, Y)) / (2 * e);
  const dzy = (faceDepth(X, Y + e) - faceDepth(X, Y - e)) / (2 * e);
  const len = Math.hypot(dzx, dzy, 1);
  return target.set(
    X - (dzx / len) * lift,
    Y - (dzy / len) * lift,
    faceDepth(X, Y) + lift / len,
  );
}

/** Dibuja un SVG en una textura (el navegador lo rasteriza a buena resolucion). */
const loading = new Set(); // dibujos SVG en descarga (boca): quien dibuja fuera de pantalla espera a texturesReady()
/** Promesa que se cumple cuando todos los dibujos pendientes de los avatares ya estan en su textura. */
export function texturesReady() {
  return Promise.all([...loading]);
}

const rasters = new Map(); // url -> lienzo ya dibujado: la boca se pinta al instante en cualquier avatar nuevo (tarjeta, retratos)

function rasterize(url, width, height) {
  const key = `${url}|${width}x${height}`;
  const cached = rasters.get(key);
  if (cached) return cached;
  const entry = { canvas: document.createElement('canvas'), ready: null, loaded: false };
  entry.canvas.width = width;
  entry.canvas.height = height;
  const image = new Image();
  entry.ready = new Promise((resolve) => {
    image.onload = () => {
      entry.canvas.getContext('2d').drawImage(image, 0, 0, width, height);
      entry.loaded = true;
      resolve();
    };
    image.onerror = () => {
      console.warn(`[avatar] No se pudo cargar ${url}`);
      rasters.delete(key); // se reintenta en el siguiente avatar
      resolve();
    };
  });
  image.src = url;
  rasters.set(key, entry);
  return entry;
}

/** Descarga y dibuja todas las bocas desde el inicio, para que ningun avatar nuevo dependa de una carga pendiente. */
export function preloadMouths() {
  for (const file of Object.values(MOUTH.files)) {
    if (file) rasterize(publicAssetUrl(`images/bocas/${file}.svg`), 512, 220);
  }
}

function svgTexture(url, width, height) {
  const entry = rasterize(url, width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const paint = () => {
    canvas.getContext('2d').drawImage(entry.canvas, 0, 0);
    texture.needsUpdate = true;
  };
  if (entry.loaded) {
    paint();
    return texture;
  }
  const done = entry.ready.then(() => {
    if (entry.loaded) paint();
  });
  loading.add(done);
  done.then(() => loading.delete(done));
  return texture;
}

/** Prendas inferiores que sustituyen al boxer base (la falda no: deja las piernas al aire y el boxer sigue debajo). */
const COVERS_BASE_BOTTOM = new Set(['jean', 'short', 'overol']);

const _q = new Quaternion();
const _v = new Vector3();

export class Avatar {
  constructor(config) {
    this.config = { ...config };
    this.root = new Group();
    this.root.name = 'avatar';
    this.headGroup = new Group();
    this.headGroup.name = 'avatar-head';
    this.headGroup.position.set(0, MODEL.headY, 0);
    this.root.add(this.headGroup);
    this.parts = {};
    this.roleMaterials = { skin: [], hair: [] };
    this.bones = null;
    this.rest = {};
    this.headMesh = null;
  }

  /** Construye el personaje completo con la configuracion actual. */
  build() {
    this._setBody();
    this._setHead();
    this._setModelPart('hair', `cabello-${this.config.hair}`, this.headGroup);
    this._setModelPart('nose', `nariz-${this.config.nose}`, this.headGroup, NOSE_ORANGE);
    this._setEyes();
    this._setMouth();
    this._setModelPart('shirt', `ropa-${this.config.shirt}`, this.root);
    this._setModelPart('pants', `ropa-${this.config.pants}`, this.root);
    this._setModelPart('shoes', `zapatos-${this.config.shoes}`, this.root);
    this._setAccessory(this.config.accHead);
    this._setCharm(this.config.companion);
    this._applyHides();
    this._keepBaseClothes();
    this._collectRoles();
    return this;
  }

  /** Ropa base permanente: la camisa viene en el cuerpo (material "ropa") y el boxer es la pieza "short" en un color liso
      (el cuerpo no tiene malla entre las piernas y el torso, y sin el boxer esa zona queda vacia). Ninguna de las dos se
      oculta ni se quita nunca; las prendas que se pongan van encima. Aqui se garantiza que existan, esten visibles y con su
      color, al construir y tras cada cambio de prendas. */
  _keepBaseClothes() {
    const body = this.parts.body;
    if (!body) return;
    body.visible = true;
    body.traverse((o) => {
      if (!o.isMesh) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const material of materials) {
        if (!material || !(material.name || '').toLowerCase().includes('ropa')) continue;
        material.visible = true;
        material.color.set(BASE_CLOTHES_COLOR);
        material.userData.baseClothes = true;
      }
      if (materials.some((m) => m?.userData?.baseClothes)) o.visible = true;
    });
    if (!this.parts.baseBottom) this._setBaseBottom();
    // El boxer base va siempre que no haya otra prenda inferior que lo reemplace: un pantalon o un short elegidos ocupan
    // su lugar (y su geometria se atravesaria con la del boxer); bajo una falda el boxer sigue puesto.
    if (this.parts.baseBottom) this.parts.baseBottom.visible = !COVERS_BASE_BOTTOM.has(this.config.pants);
  }

  /** El boxer base: la pieza "short" lisa, con polygonOffset para quedar detras de cualquier prenda que se superponga. */
  _setBaseBottom() {
    this._setModelPart('baseBottom', 'ropa-short', this.root);
    const part = this.parts.baseBottom;
    if (!part) return;
    part.name = 'baseBottom';
    part.traverse((o) => {
      if (!o.isMesh) return;
      const materials = Array.isArray(o.material) ? o.material : [o.material];
      for (const material of materials) {
        material.map = null;
        material.color.set(BASE_CLOTHES_COLOR);
        material.polygonOffset = true;
        material.polygonOffsetFactor = 2;
        material.polygonOffsetUnits = 2;
        material.userData.baseClothes = true;
        material.needsUpdate = true;
      }
    });
  }

  /** Guarda los materiales de cada rol (piel, cabello) para repintarlos sin recorrer el arbol. */
  _collectRoles() {
    this.roleMaterials.skin.length = 0;
    this.roleMaterials.hair.length = 0;
    this.root.traverse((o) => {
      const role = o.isMesh && o.material?.userData?.role;
      if (role && this.roleMaterials[role]) this.roleMaterials[role].push(o.material);
    });
  }

  /** Pinta todas las piezas de un rol con un Color. No cambia la configuracion
      ni reserva memoria: sirve para mezclar el color mientras se rocia. */
  setRoleColor(role, color) {
    for (const material of this.roleMaterials[role]) {
      material.color.copy(color);
      const shade = material.userData.shade;
      if (shade < 1) material.color.multiplyScalar(shade);
    }
  }

  /** Cambia el estilo del cabello puesto ('none' lo retira). */
  setHair(id) {
    this.config.hair = id;
    this._setModelPart('hair', `cabello-${id}`, this.headGroup);
    this._refreshAccessory();
    this._collectRoles();
  }

  /** Accesorio de cabeza: pieza .glb centrada en la cabeza, con el ajuste de la web original
      (la balaca y el audifono cambian con el afro; la flor y el mono quedan sobre el pelo). */
  _setAccessory(id) {
    this.config.accHead = id;
    this._setModelPart('accHead', `accesorio-${id}`, this.headGroup);
    this._refreshAccessory();
  }

  _refreshAccessory() {
    const obj = this.parts.accHead;
    const base = ACCESSORY_FIT[this.config.accHead];
    if (obj) {
      const fit = { ...base, ...(base?.byHair?.[this.config.hair]) };
      obj.rotation.fromArray(fit.rotation || [0, 0, 0]);
      const scale = fit.scale ?? 1;
      if (Array.isArray(scale)) obj.scale.fromArray(scale);
      else obj.scale.setScalar(scale);
    }
    if (this.parts.hair) this.parts.hair.visible = !HIDES_HAIR.has(this.config.accHead);
  }

  /** Charm: queda junto al personaje, mas grande y flotando (el tulipan se queda en el suelo). */
  _setCharm(id) {
    this.config.companion = id;
    this._setModelPart('companion', `charm-${id}`, this.root);
    const obj = this.parts.companion;
    const fit = CHARM_FIT[id];
    if (!obj || !fit) return;
    obj.position.fromArray(fit.position);
    obj.rotation.fromArray(fit.rotation);
    obj.scale.setScalar(fit.scale * CHARM_SHOWCASE.scale);
    obj.position.x += CHARM_SHOWCASE.right;
    const grounded = CHARM_SHOWCASE.grounded.includes(id);
    if (!grounded) {
      obj.position.y += CHARM_SHOWCASE.lift - fit.down;
      obj.position.z -= fit.back;
    }
    obj.userData.bob = !grounded;
    obj.userData.baseY = obj.position.y;
  }

  /** El overol tapa la camiseta para que los modelos no se atraviesen. */
  _applyHides() {
    if (this.parts.shirt) this.parts.shirt.visible = !HIDES_SHIRT.has(this.config.pants);
  }

  /** Pone en la configuracion lo que cambio en el estado compartido. Solo toca las piezas
      que cambiaron. */
  sync(next) {
    const c = this.config;
    if (next.skin !== c.skin) {
      c.skin = next.skin;
      this.setRoleColor('skin', _color.set(next.skin));
    }
    if (next.hairColor !== c.hairColor) {
      c.hairColor = next.hairColor;
      this.setRoleColor('hair', _color.set(next.hairColor));
    }
    if (next.hair !== c.hair) this.setHair(next.hair);
    if (next.eyes !== c.eyes || next.eyeColor !== c.eyeColor) {
      c.eyes = next.eyes;
      c.eyeColor = next.eyeColor;
      this._setEyes();
    }
    if (next.mouth !== c.mouth) {
      c.mouth = next.mouth;
      this._setMouth();
    }
    if (next.nose !== c.nose) {
      c.nose = next.nose;
      this._setModelPart('nose', `nariz-${next.nose}`, this.headGroup, NOSE_ORANGE);
    }
    for (const [slot, prefix] of [['shirt', 'ropa'], ['pants', 'ropa'], ['shoes', 'zapatos']]) {
      if (next[slot] === c[slot]) continue;
      c[slot] = next[slot];
      this._setModelPart(slot, `${prefix}-${next[slot]}`, this.root);
    }
    if (next.accHead !== c.accHead) this._setAccessory(next.accHead);
    if (next.companion !== c.companion) this._setCharm(next.companion);
    this._applyHides();
    this._keepBaseClothes();
    this._collectRoles();
  }

  /** Clona un modelo del catalogo y prepara sus materiales (plastico + color por rol). */
  _model(key, fixedColor) {
    const gltf = AssetManager.getGLTF(key);
    if (!gltf) {
      console.warn(`[avatar] Falta el modelo "${key}" en src/assets.js`);
      return null;
    }
    const maps = plasticTextures();
    const obj = gltf.scene;
    obj.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      // Material propio: el del catalogo se comparte entre copias
      const material = o.material.clone();
      material.metalness = 0;
      material.roughness = PLASTIC.roughness;
      if (maps.roughness) material.roughnessMap = maps.roughness;
      if (maps.normal) {
        material.normalMap = maps.normal;
        material.normalScale.set(PLASTIC.scratches, PLASTIC.scratches);
      }
      const name = (material.name || '').toLowerCase();
      const role = Object.keys(ROLE_TO_KEY).find((r) => name.includes(r));
      if (fixedColor) {
        material.color.set(fixedColor);
      } else if (role) {
        // "skin_shade0.9" = color de piel un 10 % mas oscuro
        const shade = parseFloat((name.match(/shade([\d.]+)/) || [])[1]) || 1;
        material.color.copy(roleColor(this.config[ROLE_TO_KEY[role]], shade));
        material.userData.role = role;
        material.userData.shade = shade;
      }
      o.material = material;
      o.frustumCulled = false; // mallas con huesos: su caja no sigue la pose
    });
    return obj;
  }

  _swap(slot, obj, parent) {
    const old = this.parts[slot];
    if (old) old.removeFromParent();
    if (!obj) {
      delete this.parts[slot];
      return;
    }
    obj.name = slot;
    this.parts[slot] = obj;
    parent.add(obj);
  }

  _setBody() {
    const body = this._model('avatar-cuerpo');
    if (!body) return;
    this._swap('body', body, this.root);
    this.bones = {};
    body.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
    });
    const head = this.bones.cabeza;
    if (!head) {
      this.bones = null;
      return;
    }
    // La cabeza (con pelo, ojos y accesorios) sigue al hueso "cabeza"
    this.root.updateMatrixWorld(true);
    head.attach(this.headGroup);
    // Pose de reposo y ejes de giro de cada hueso, para la animacion
    // (el personaje se construye antes de colocarlo: su raiz aun no esta girada)
    this.root.updateMatrixWorld(true);
    for (const bone of Object.values(this.bones)) {
      const inverse = bone.getWorldQuaternion(new Quaternion()).invert();
      this.rest[bone.name] = {
        q: bone.quaternion.clone(),
        x: new Vector3(1, 0, 0).applyQuaternion(inverse), // asentir
        z: new Vector3(0, 0, 1).applyQuaternion(inverse), // inclinar a los lados
      };
    }
  }

  _setHead() {
    const head = this._model('avatar-cabeza');
    if (!head) return;
    this._swap('head', head, this.headGroup);
    head.traverse((o) => {
      if (o.isMesh && !this.headMesh && o.name.toLowerCase().includes('cabeza')) {
        this.headMesh = o;
      }
    });
  }

  /** Pieza .glb. Si trae huesos (ropa, zapatos), se une a los del cuerpo. */
  _setModelPart(slot, key, parent, fixedColor) {
    const id = key.split('-').slice(1).join('-');
    if (!id || id === 'none') {
      this._swap(slot, null, parent);
      return;
    }
    const obj = this._model(key, fixedColor);
    this._swap(slot, obj, parent);
    if (!obj || !this.bones) return;
    obj.traverse((m) => {
      if (!m.isSkinnedMesh) return;
      const bones = m.skeleton.bones.map((b) => this.bones[b.name]);
      if (bones.every(Boolean)) {
        m.bind(new Skeleton(bones, m.skeleton.boneInverses), m.bindMatrix);
      }
    });
  }

  /** Ojos: tres capas pintadas sobre la malla de la cabeza
      (blanco + contorno -> iris con el color elegido -> lineas encima). */
  _setEyes() {
    const n = EYE_MAPS[this.config.eyes];
    if (!this.headMesh || !n) {
      this._disposeEyes();
      this._swap('eyes', null, this.headGroup);
      return;
    }
    const group = new Group();
    const colors = ['#FFFFFF', this.config.eyeColor, '#FFFFFF'];
    ['base', 'iris', 'lineas'].forEach((layer, i) => {
      const source = AssetManager.getTexture(`ojos-${n}-${layer}`);
      if (!source) {
        console.warn(`[avatar] Falta la textura ojos-${n}-${layer}`);
        return;
      }
      const map = source.clone();
      map.colorSpace = SRGBColorSpace;
      map.flipY = false; // las UV del .glb tienen el origen arriba
      map.wrapS = map.wrapT = ClampToEdgeWrapping;
      map.repeat.set(1 / EYE_CROP.w, 1 / EYE_CROP.h);
      map.offset.set(-EYE_CROP.x / EYE_CROP.w, -EYE_CROP.y / EYE_CROP.h);
      map.needsUpdate = true;
      const material = new MeshBasicMaterial({
        color: colors[i],
        map,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -1 - i,
        polygonOffsetUnits: -4 - i,
      });
      if (i === 1) material.userData.role = 'eye';
      const mesh = new Mesh(this.headMesh.geometry, material);
      mesh.position.copy(this.headMesh.position);
      mesh.quaternion.copy(this.headMesh.quaternion);
      mesh.scale.copy(this.headMesh.scale);
      mesh.renderOrder = 1 + i;
      group.add(mesh);
    });
    this._disposeEyes();
    this._swap('eyes', group, this.headMesh.parent);
  }

  /** Las capas de ojos tienen texturas propias: se liberan al cambiarlas. */
  _disposeEyes() {
    this.parts.eyes?.traverse((o) => {
      o.material?.map?.dispose();
      o.material?.dispose();
    });
  }

  /** Boca: el dibujo del diseno, curvado sobre la cara. */
  _setMouth() {
    const file = MOUTH.files[this.config.mouth];
    if (!file) {
      this._swap('mouth', null, this.headGroup);
      return;
    }
    const geometry = new PlaneGeometry(MOUTH.width, MOUTH.height, 14, 6);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      onFace(position.getX(i), MOUTH.y + position.getY(i), 0.008, _v);
      position.setXYZ(i, _v.x, _v.y, _v.z);
    }
    geometry.computeBoundingSphere();
    const material = new MeshBasicMaterial({
      map: svgTexture(publicAssetUrl(`images/bocas/${file}.svg`), 512, 220),
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    });
    const mesh = new Mesh(geometry, material);
    mesh.renderOrder = 4;
    this._swap('mouth', mesh, this.headGroup);
  }

  /** Gira un hueso desde su reposo: nod alrededor de x, tilt alrededor de z. */
  _pose(name, nod, tilt) {
    const bone = this.bones[name];
    const rest = this.rest[name];
    if (!bone || !rest) return;
    bone.quaternion
      .copy(rest.q)
      .multiply(_q.setFromAxisAngle(rest.x, nod))
      .multiply(_q.setFromAxisAngle(rest.z, tilt));
  }

  /** Animacion de reposo: respira el torso, los brazos se mecen y la cabeza se ladea. */
  update(t) {
    const charm = this.parts.companion;
    if (charm?.userData.bob) charm.position.y = charm.userData.baseY + Math.sin(t * 1.8) * 0.03;
    if (!this.bones) return;
    this._pose('torso', Math.sin(t * 2.1) * 0.012, 0);
    this._pose('brazoL', 0, Math.sin(t * 1.6) * 0.07);
    this._pose('brazoD', 0, -Math.sin(t * 1.6 + 0.5) * 0.07);
    this._pose('cabeza', Math.sin(t * 0.7) * 0.03, Math.sin(t * 0.9) * 0.05);
  }
}

/** Pieza suelta del catalogo (p. ej. un cabello) lista para llevarla en la mano:
    mismo plastico y color por rol que en el personaje. */
export function buildPart(key, config) {
  return new Avatar(config)._model(key);
}

/** Repinta los materiales de un rol en una pieza suelta. */
export function recolorRole(object, role, color) {
  object.traverse((o) => {
    if (!o.isMesh || o.material?.userData?.role !== role) return;
    o.material.color.copy(color);
    const shade = o.material.userData.shade;
    if (shade < 1) o.material.color.multiplyScalar(shade);
  });
}
