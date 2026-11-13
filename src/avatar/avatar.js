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
  HEAD_FIT,
  MODEL,
  MOUTH,
  NOSE_ORANGE,
} from '../data/avatar-defaults.js';

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
function svgTexture(url, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const image = new Image();
  image.onload = () => {
    canvas.getContext('2d').drawImage(image, 0, 0, width, height);
    texture.needsUpdate = true;
  };
  image.onerror = () => console.warn(`[avatar] No se pudo cargar ${url}`);
  image.src = url;
  return texture;
}

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
    return this;
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
    if (!this.headMesh) return;
    const n = EYE_MAPS[this.config.eyes];
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
    this._swap('eyes', group, this.headMesh.parent);
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
    if (!this.bones) return;
    this._pose('torso', Math.sin(t * 2.1) * 0.012, 0);
    this._pose('brazoL', 0, Math.sin(t * 1.6) * 0.07);
    this._pose('brazoD', 0, -Math.sin(t * 1.6 + 0.5) * 0.07);
    this._pose('cabeza', Math.sin(t * 0.7) * 0.03, Math.sin(t * 0.9) * 0.05);
  }
}
