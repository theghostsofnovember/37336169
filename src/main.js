import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { ALPHA1, ALPHA2, COLORTEX } from './assets.js';
import { N, MAX_GUIDES, CARD_TYPES, CardBuilder, newGuide, computeSeg, enforceLengths, genGuide, resamplePolyline, neighbours } from './hair.js';
import { makeProceduralHead, bakeImported, Collider, refreshMaskColors, skin } from './head.js';
import * as PORTRAIT from './portrait.js';
import { makeHairMaterial } from './shader.js';
import { mkTabs, head as h3, note, slider, check, color, select, buttons, refreshUI, onRefresh } from './ui.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cv'), view = $('view'), ring = $('ring'), hint = $('hint');

/* ---------------- state ---------------- */
const P = {
  tool: 'spray', radius: 70, strength: 0.6, symmetry: true, frontOnly: true, maskOnly: false,
  length: 0.95, lift: 0.3, gravity: 0.45, wave: 0.2, extend: true, lenVar: 0.15, density: 5, sweep: 0, layer: 1, layerMix: true, count: 380, minDist: 0.02,
  type: 2, perGuide: 2, width: 0.085, widthVar: 0.25, taper: 0.55, rootW: 0.7, spread: 0.75, fan: 0.35, twist: 0.35, noise: 0.5, layerGap: 0.006, fill: 3, fly: 0.3, segs: 12, vol: 0.55, curve: 0.35, uvVar: 0.5,
  showCards: true, showGuides: true, showHead: true, showMask: true, wire: false, xray: false, showAO: false, centerLift: 0,
  rootColor: '#2a1a12', tipColor: '#7a5435', texAmt: 0.6, origAmt: 0, spec1: '#fff1dd', exp1: 90, sh1: -0.1, spec2: '#b98a5e', exp2: 24, sh2: 0.2, specAmt: 0.8, sss: 0.3, ao: 0.6, aoLen: 0.35, cut: 0.35, rootFade: 0.03, tipFade: 0.25, hashed: false, gradA: 0, gradB: 1,
  exposure: 0.85,
};
const L = { preset: 'studio', keyAz: -40, keyEl: 35, keyI: 2.2, fillAz: 70, fillEl: 10, fillI: 0.5, rimAz: 180, rimEl: 30, rimI: 1.4, ambI: 0.55 };
const SIM = { on: false, wind: 0.4, gravity: 0.8, stiff: 0.35, damp: 0.96, shake: false, t: 0 };
const PRESETS = {
  studio: { bg: 0x1a1d24, key: 0xffffff, fill: 0xcfe0ff, rim: 0xffffff, sky: 0xdde6ff, gnd: 0x3a342f, v: { keyAz: -40, keyEl: 35, keyI: 2.2, fillI: 0.5, rimI: 1.4, ambI: 0.55 } },
  sun: { bg: 0x2b3c52, key: 0xffe7c4, fill: 0x9fc4ff, rim: 0xfff2dd, sky: 0x9cc2ff, gnd: 0x5a4a38, v: { keyAz: -55, keyEl: 50, keyI: 4.2, fillI: 0.5, rimI: 2.2, ambI: 0.6 } },
  shade: { bg: 0x2a3140, key: 0xb9cdee, fill: 0xaecaff, rim: 0xd0e0ff, sky: 0xaec6f0, gnd: 0x39414f, v: { keyAz: -20, keyEl: 55, keyI: 1.0, fillI: 0.7, rimI: 0.8, ambI: 1.0 } },
  portrait: { bg: 0x2a2b2c, key: 0xfff0e2, fill: 0xd6e0ff, rim: 0xffffff, sky: 0xe8e4e0, gnd: 0x4a3c34, v: { keyAz: -18, keyEl: 28, keyI: 2.4, fillAz: 60, fillI: 0.35, rimAz: 160, rimI: 0.9, ambI: 0.55 } },
  indoor: { bg: 0x1d1612, key: 0xffa968, fill: 0x6b78a8, rim: 0x86a2ff, sky: 0x6a5648, gnd: 0x1e1612, v: { keyAz: -65, keyEl: 20, keyI: 2.8, fillI: 0.3, rimI: 1.8, ambI: 0.5 } },
};

/* ---------------- three setup ---------------- */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1d24);
const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
camera.position.set(0.8, 0.5, 6.4);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.3, 0); controls.enableDamping = true; controls.dampingFactor = 0.12;
controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.enabled = true;

const lights = { key: new THREE.DirectionalLight(), fill: new THREE.DirectionalLight(), rim: new THREE.DirectionalLight(), hemi: new THREE.HemisphereLight() };
Object.values(lights).forEach((l) => scene.add(l));
const grid = new THREE.GridHelper(8, 16, 0x3a4050, 0x262a34); grid.position.y = -2.3; scene.add(grid);

const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const atlasCanvas = document.createElement('canvas'); atlasCanvas.width = atlasCanvas.height = 2048;
const atlasTex = new THREE.CanvasTexture(atlasCanvas);
atlasTex.anisotropy = 8; atlasTex.generateMipmaps = true; atlasTex.minFilter = THREE.LinearMipmapLinearFilter;
const colorTex = new THREE.Texture(); colorTex.wrapS = colorTex.wrapT = THREE.RepeatWrapping; colorTex.colorSpace = THREE.SRGBColorSpace; colorTex.anisotropy = 8;
const hairMat = makeHairMaterial(atlasTex, colorTex);
const builder = new CardBuilder();
const hairMesh = new THREE.Mesh(builder.geo, hairMat);
hairMesh.frustumCulled = false; scene.add(hairMesh);

const lineGeo = new THREE.BufferGeometry();
const linePos = new THREE.BufferAttribute(new Float32Array(MAX_GUIDES * (N - 1) * 6), 3).setUsage(THREE.DynamicDrawUsage);
const lineCol = new THREE.BufferAttribute(new Float32Array(MAX_GUIDES * (N - 1) * 6), 3).setUsage(THREE.DynamicDrawUsage);
lineGeo.setAttribute('position', linePos); lineGeo.setAttribute('color', lineCol);
const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthTest: true });
const lines = new THREE.LineSegments(lineGeo, lineMat); lines.frustumCulled = false; lines.renderOrder = 5; scene.add(lines);
const rootGeo = new THREE.BufferGeometry();
const rootPos = new THREE.BufferAttribute(new Float32Array(MAX_GUIDES * 3), 3).setUsage(THREE.DynamicDrawUsage);
rootGeo.setAttribute('position', rootPos);
const rootPts = new THREE.Points(rootGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 3, sizeAttenuation: false, depthTest: true }));
rootPts.frustumCulled = false; rootPts.renderOrder = 6; scene.add(rootPts);

const strokeGeo = new THREE.BufferGeometry();
const strokePos = new THREE.BufferAttribute(new Float32Array(3000 * 3), 3).setUsage(THREE.DynamicDrawUsage);
strokeGeo.setAttribute('position', strokePos); strokeGeo.setDrawRange(0, 0);
const strokeLine = new THREE.Line(strokeGeo, new THREE.LineBasicMaterial({ color: 0x5ac8fa, depthTest: false }));
strokeLine.frustumCulled = false; strokeLine.renderOrder = 10; scene.add(strokeLine);

const headGroup = new THREE.Group(); headGroup.matrixAutoUpdate = false; scene.add(headGroup);
let headMeshes = [], collider = null, headCenter = new THREE.Vector3(), crown = new THREE.Vector3(0, 1, 0);
const ctypes = CARD_TYPES.slice();

/* ---------------- hair groups ---------------- */
// Per-group card settings; the Cards tab edits the active group's copy.
const CARD_KEYS = ['perGuide', 'fill', 'width', 'widthVar', 'taper', 'rootW', 'spread', 'fan', 'twist', 'noise', 'layerGap', 'fly', 'segs', 'vol', 'curve', 'uvVar'];
const pickCard = (src) => Object.fromEntries(CARD_KEYS.map((k) => [k, src[k]]));
const mkGroup = (name, color, o = {}) => ({ name, color, visible: true, lockPhys: false, lockEdit: false, tint: '#ffffff', bright: 1, stiff: 1, ...o, card: { ...pickCard(P), ...(o.card || {}) } });
let groups = [mkGroup('شعر الرأس', '#2ee6a0')];
P.activeGroup = 0; P.activeOnly = true;
const GP = new Proxy({}, {
  get: (_, k) => (groups[P.activeGroup] || groups[0]).card[k],
  set: (_, k, v) => { (groups[P.activeGroup] || groups[0]).card[k] = v; return true; },
});
const AG = new Proxy({}, {
  get: (_, k) => (groups[P.activeGroup] || groups[0])[k],
  set: (_, k, v) => { (groups[P.activeGroup] || groups[0])[k] = v; return true; },
});
const grpOf = (g) => groups[g.group] || groups[0];
const editable = (g) => { const gr = grpOf(g); return gr.visible && !gr.lockEdit && (!P.activeOnly || g.group === P.activeGroup); };
const activeLocked = () => { const gr = groups[P.activeGroup]; return !gr || gr.lockEdit || !gr.visible; };

/* ---------------- guides + undo ---------------- */
let guides = [], neigh = [], topoDirty = true, hairDirty = true;
const undoStack = [], redoStack = [];
const snapshot = () => ({
  guides: guides.map((g) => ({ pts: g.pts.slice(), n: g.normal.toArray(), type: g.type, layer: g.layer, w: g.wScale, seed: g.seed, group: g.group })),
  masks: headMeshes.map((m) => m.userData.mask.slice()),
  groups: JSON.parse(JSON.stringify(groups)), active: P.activeGroup,
});
const restore = (s) => {
  guides = s.guides.map((o) => { const g = newGuide(o.pts.slice(), new THREE.Vector3().fromArray(o.n), o.type, o.layer, o.group || 0); g.wScale = o.w; g.seed = o.seed; return g; });
  if (s.groups) { groups = JSON.parse(JSON.stringify(s.groups)); P.activeGroup = Math.min(s.active || 0, groups.length - 1); refreshUI(); }
  headMeshes.forEach((m, i) => { if (s.masks[i] && s.masks[i].length === m.userData.mask.length) { m.userData.mask.set(s.masks[i]); refreshMaskColors(m, P.showMask); } });
  topoDirty = hairDirty = true; resetSim();
};
const pushUndo = () => { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; };
const undo = () => { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); };
const redo = () => { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); };

/* ---------------- lights ---------------- */
const dirFrom = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); };
let presetCols = PRESETS.studio;
function applyLights() {
  const pc = presetCols, u = hairMat.uniforms;
  const set = (i, light, col, az, el, inten) => {
    const d = dirFrom(az, el);
    light.position.copy(d).multiplyScalar(10); light.color.set(col); light.intensity = inten;
    u.lDir.value[i].copy(d); u.lCol.value[i].set(col).multiplyScalar(inten);
  };
  set(0, lights.key, pc.key, L.keyAz, L.keyEl, L.keyI);
  set(1, lights.fill, pc.fill, L.fillAz, L.fillEl, L.fillI);
  set(2, lights.rim, pc.rim, L.rimAz, L.rimEl, L.rimI);
  lights.hemi.color.set(pc.sky); lights.hemi.groundColor.set(pc.gnd); lights.hemi.intensity = L.ambI;
  u.skyCol.value.set(pc.sky).multiplyScalar(L.ambI * 0.6); u.gndCol.value.set(pc.gnd).multiplyScalar(L.ambI * 0.6);
  scene.background.set(pc.bg);
  renderer.toneMappingExposure = P.exposure;
}
function applyPreset(name) {
  const p = PRESETS[name]; presetCols = p; Object.assign(L, p.v, { preset: name }); applyLights(); refreshUI();
}
function applyShading() {
  const u = hairMat.uniforms;
  u.rootCol.value.set(P.rootColor); u.tipCol.value.set(P.tipColor);
  u.spec1Col.value.set(P.spec1); u.spec2Col.value.set(P.spec2);
  Object.assign(u.texAmt, { value: P.texAmt }); u.origAmt.value = P.origAmt; u.exp1.value = P.exp1; u.exp2.value = P.exp2;
  u.sh1.value = P.sh1; u.sh2.value = P.sh2; u.specAmt.value = P.specAmt; u.sssAmt.value = P.sss; u.aoAmt.value = P.ao; u.aoLen.value = P.aoLen;
  u.cut.value = P.cut; u.rootFade.value = P.rootFade; u.tipFade.value = P.tipFade; u.gradA.value = P.gradA; u.gradB.value = P.gradB;
  u.alphaMode.value = P.hashed ? 1 : 0; u.showAO.value = P.showAO ? 1 : 0;
  hairMat.alphaToCoverage = !P.hashed; hairMat.wireframe = P.wire; hairMat.needsUpdate = true;
  renderer.toneMappingExposure = P.exposure;
}

/* ---------------- textures ---------------- */
async function loadAtlas() {
  const [a, b, c] = await Promise.all([loadImg(ALPHA1), loadImg(ALPHA2), loadImg(COLORTEX)]);
  const ctx = atlasCanvas.getContext('2d', { willReadFrequently: true });
  const chan = (img, k) => { ctx.clearRect(0, 0, 2048, 2048); ctx.drawImage(img, 0, 0, 2048, 2048); return ctx.getImageData(0, 0, 2048, 2048).data; };
  const da = chan(a), db = chan(b);
  const out = ctx.createImageData(2048, 2048);
  for (let i = 0; i < out.data.length; i += 4) { out.data[i] = da[i]; out.data[i + 1] = db[i]; out.data[i + 2] = 0; out.data[i + 3] = 255; }
  ctx.putImageData(out, 0, 0); atlasTex.needsUpdate = true;
  colorTex.image = c; colorTex.needsUpdate = true;
}
function addCustomAtlas(img) {
  const ctx = atlasCanvas.getContext('2d', { willReadFrequently: true });
  const cur = ctx.getImageData(0, 0, 2048, 2048);
  const tmp = document.createElement('canvas'); tmp.width = tmp.height = 2048;
  const tc = tmp.getContext('2d', { willReadFrequently: true }); tc.drawImage(img, 0, 0, 2048, 2048);
  const src = tc.getImageData(0, 0, 2048, 2048).data;
  const hasAlpha = (() => { for (let i = 3; i < src.length; i += 4 * 97) if (src[i] < 250) return true; return false; })();
  const col = new Float32Array(2048);
  for (let i = 0; i < src.length; i += 4) {
    const v = hasAlpha ? src[i + 3] : (src[i] + src[i + 1] + src[i + 2]) / 3;
    cur.data[i + 2] = v; col[(i >> 2) % 2048] += v / 255;
  }
  ctx.putImageData(cur, 0, 0); atlasTex.needsUpdate = true;
  for (let i = 0; i < 2048; i++) col[i] /= 2048;
  const runs = []; let s = -1;
  for (let x = 0; x <= 2048; x++) {
    const on = x < 2048 && col[x] > 0.03;
    if (on && s < 0) s = x; if (!on && s >= 0) { runs.push([s, x]); s = -1; }
  }
  const merged = [];
  for (const r of runs) { const l = merged[merged.length - 1]; if (l && r[0] - l[1] < 24) l[1] = r[1]; else merged.push(r.slice()); }
  const strips = merged.filter((r) => r[1] - r[0] > 40);
  strips.forEach((r, i) => ctypes.push({ name: `مخصص ${ctypes.length - 7} (شريط ${i + 1})`, ch: 2, u0: r[0] / 2048 + 0.004, u1: r[1] / 2048 - 0.004, vRoot: 0.97, vTip: 0.03 }));
  refreshUI(); setHint(`تمت إضافة ${strips.length} شريط من الأطلس المخصص (القناة B). الجذر في أعلى الصورة.`);
  hairDirty = true;
}

/* ---------------- head ---------------- */
let headExtras = null;
function setHead(res) {
  if (headExtras) { headGroup.remove(headExtras); headExtras = null; }
  headMeshes.forEach((m) => { headGroup.remove(m); m.geometry.dispose(); m.material.dispose(); });
  headMeshes = res.meshes; headMeshes.forEach((m) => headGroup.add(m));
  headCenter.copy(res.center); collider = new Collider(headMeshes);
  guides = []; undoStack.length = 0; redoStack.length = 0; topoDirty = hairDirty = true; resetSim();
  computeCrown(); frameHead();
}
function computeCrown() {
  let best = -1e9; const v = new THREE.Vector3();
  for (const m of headMeshes) {
    const p = m.geometry.attributes.position, mk = m.userData.mask;
    for (let i = 0; i < p.count; i++) if (mk[i] > 0.5 && p.getY(i) > best) { best = p.getY(i); v.fromBufferAttribute(p, i); }
  }
  if (best < -1e8) { const b = new THREE.Box3(); headMeshes.forEach((m) => b.expandByObject(m)); v.set(0, b.max.y, 0); }
  crown.copy(v);
}
function frameHead() {
  const b = new THREE.Box3(); headMeshes.forEach((m) => b.expandByObject(m));
  const c = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
  const focus = new THREE.Vector3(c.x, Math.max(c.y, headCenter.y), c.z);
  const r = Math.max(s.x, Math.min(s.y, 2.8), s.z);
  controls.target.copy(focus).add(new THREE.Vector3(0, 0.15, 0));
  camera.position.copy(controls.target).add(new THREE.Vector3(0.9, 0.3, 1).normalize().multiplyScalar(r * 2.7));
  controls.update();
}
function setView(name) {
  const d = { front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0], top: [0, 1, 0.001], three: [0.9, 0.3, 1] }[name];
  const dist = camera.position.distanceTo(controls.target);
  camera.position.copy(controls.target).add(new THREE.Vector3(...d).normalize().multiplyScalar(dist)); controls.update();
}

/* ---------------- flow + generation ---------------- */
const up = new THREE.Vector3(0, 1, 0);
function flowDir(root, n, out = new THREE.Vector3()) {
  out.copy(root).sub(crown);
  out.y -= 0.0001;
  out.addScaledVector(n, -out.dot(n));
  if (out.lengthSq() < 1e-8) out.copy(up).negate().addScaledVector(n, n.y);
  out.normalize();
  if (P.sweep) out.applyAxisAngle(n, P.sweep * Math.PI / 180);
  return out;
}
function addGuide(pts, n, mirror = P.symmetry) {
  if (guides.length >= MAX_GUIDES) return;
  const layer = P.layerMix ? [0, 1, 1, 2][Math.floor(Math.random() * 4)] : P.layer;
  const grp = P.activeGroup;
  const g = newGuide(pts, n, P.type, layer, grp); g.wScale = 0.85 + Math.random() * 0.3;
  guides.push(g);
  if (mirror) {
    const m = pts.slice(); for (let i = 0; i < N; i++) m[i * 3] = -m[i * 3];
    if (Math.abs(pts[0]) > 0.015 && guides.length < MAX_GUIDES) {
      const g2 = newGuide(m, new THREE.Vector3(-n.x, n.y, n.z), P.type, layer, grp); g2.wScale = 0.85 + Math.random() * 0.3; guides.push(g2);
    }
  }
  topoDirty = hairDirty = true;
}
function tooClose(p) {
  const d2 = P.minDist * P.minDist;
  for (const g of guides) { const q = g.pts; if ((q[0] - p.x) ** 2 + (q[1] - p.y) ** 2 + (q[2] - p.z) ** 2 < d2) return true; }
  return false;
}
function generateFromMask(style = null) {
  const tris = [], cum = [];
  let tot = 0;
  for (const m of headMeshes) {
    const mk = m.userData.mask, pos = m.geometry.attributes.position, idx = m.geometry.index;
    const nt = idx ? idx.count / 3 : pos.count / 3;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (let t = 0; t < nt; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      if ((mk[i0] + mk[i1] + mk[i2]) / 3 < 0.5) continue;
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
      const area = b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5;
      tot += area; tris.push([m, i0, i1, i2]); cum.push(tot);
    }
  }
  if (!tris.length) { setHint('لا توجد منطقة فروة مرسومة. استخدم أداة «رسم منطقة الفروة» أولاً.'); return; }
  pushUndo(); computeCrown();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), root = new THREE.Vector3(), n = new THREE.Vector3(), dir = new THREE.Vector3();
  let made = 0, tries = 0;
  while (made < P.count && tries < P.count * 6 && guides.length < MAX_GUIDES) {
    tries++;
    const r = Math.random() * tot; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    const [m, i0, i1, i2] = tris[lo], pos = m.geometry.attributes.position, nor = m.geometry.attributes.normal;
    let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
    root.set(0, 0, 0).addScaledVector(a, w).addScaledVector(b, u).addScaledVector(c, v);
    if (tooClose(root)) continue;
    a.fromBufferAttribute(nor, i0); b.fromBufferAttribute(nor, i1); c.fromBufferAttribute(nor, i2);
    n.set(0, 0, 0).addScaledVector(a, w).addScaledVector(b, u).addScaledVector(c, v).normalize();
    if (style) {
      const st = style(root, n, dir);
      addGuide(genGuide(root, n, dir, st.length, { ...P, ...st }, collider, headCenter), n.clone(), false);
    } else {
      flowDir(root, n, dir);
      const len = P.length * (1 + (Math.random() - 0.5) * 2 * P.lenVar);
      addGuide(genGuide(root, n, dir, len, P, collider), n.clone(), false);
    }
    made++;
  }
  setHint(`تم توليد ${made} مساراً من منطقة الفروة.`);
}

/* ---------------- sim ---------------- */
const M = new THREE.Matrix4(), Mi = new THREE.Matrix4(), vtmp = new THREE.Vector3();
function resetSim() { guides.forEach((g) => { g.sim = null; }); M.identity(); Mi.identity(); headGroup.matrix.identity(); headGroup.matrixWorldNeedsUpdate = true; SIM.t = 0; }
function simStep(dt) {
  SIM.t += dt;
  if (SIM.shake) {
    const a = Math.sin(SIM.t * 2.4) * 0.45 + Math.sin(SIM.t * 5.1) * 0.08;
    M.makeRotationY(a); M.setPosition(Math.sin(SIM.t * 2.4 + 1) * 0.08, 0, 0);
  } else M.identity();
  Mi.copy(M).invert(); headGroup.matrix.copy(M); headGroup.matrixWorldNeedsUpdate = true;
  const ws = SIM.wind * (0.6 + 0.4 * Math.sin(SIM.t * 1.3)), dt2 = dt * dt;
  for (const g of guides) {
    if (!g.sim) { const p = new Float32Array(g.pts.length); p.set(g.pts); g.sim = { p, pr: p.slice() }; }
    const { p, pr } = g.sim, q = g.pts, gr = grpOf(g);
    if (gr.lockPhys) {
      // locked groups (brows, moustache…) stay rigidly attached to the head
      for (let i = 0; i < N; i++) { const k = i * 3; vtmp.set(q[k], q[k + 1], q[k + 2]).applyMatrix4(M); p[k] = pr[k] = vtmp.x; p[k + 1] = pr[k + 1] = vtmp.y; p[k + 2] = pr[k + 2] = vtmp.z; }
      continue;
    }
    const stiff = Math.min(1, SIM.stiff * gr.stiff);
    vtmp.set(q[0], q[1], q[2]).applyMatrix4(M); p[0] = pr[0] = vtmp.x; p[1] = pr[1] = vtmp.y; p[2] = pr[2] = vtmp.z;
    for (let i = 1; i < N; i++) {
      const k = i * 3, f = i / (N - 1);
      vtmp.set(q[k], q[k + 1], q[k + 2]).applyMatrix4(M);
      for (let a = 0; a < 3; a++) {
        const v = (p[k + a] - pr[k + a]) * SIM.damp; pr[k + a] = p[k + a];
        const ext = a === 1 ? -SIM.gravity * 9 * dt2 : a === 0 ? ws * 9 * dt2 * (0.3 + f) : ws * 3 * dt2 * f;
        const rest = [vtmp.x, vtmp.y, vtmp.z][a];
        p[k + a] += v + ext + (rest - p[k + a]) * stiff * (1.05 - f * 0.85) * 0.5;
      }
    }
    for (let it = 0; it < 2; it++) {
      enforceLengths(g, p);
      for (let i = 1; i < N; i++) {
        const k = i * 3; vtmp.set(p[k], p[k + 1], p[k + 2]).applyMatrix4(Mi);
        if (collider.push(vtmp, 0.014)) { vtmp.applyMatrix4(M); p[k] = vtmp.x; p[k + 1] = vtmp.y; p[k + 2] = vtmp.z; }
      }
    }
  }
  hairDirty = true;
}

/* ---------------- rebuild hair + guide lines ---------------- */
const LC = [[0.4, 0.7, 1], [1, 0.82, 0.3], [1, 0.5, 0.75]];
let stats = { cards: 0, tris: 0, ms: 0 };
const tc = new THREE.Vector3();
function rebuild() {
  if (topoDirty) { neigh = groups.some((gr) => gr.card.fill > 0) ? neighbours(guides) : []; topoDirty = false; }
  const t0 = performance.now(), simOn = SIM.on;
  tc.copy(headCenter); tc.y += P.centerLift; if (simOn) tc.applyMatrix4(M);
  const nv = new THREE.Vector3();
  const ctx = {
    getPts: (g) => (simOn && g.sim ? g.sim.p : g.pts),
    getNormal: (g) => (simOn ? nv.copy(g.normal).transformDirection(M).clone() : g.normal),
    center: tc, neigh, types: ctypes,
    skip: (g) => !grpOf(g).visible,
    params: groups.map((gr) => {
      const t = new THREE.Color(gr.tint).multiplyScalar(gr.bright);
      const q = { ...P, ...gr.card, tintRGB: [t.r, t.g, t.b] };
      if (!neigh.length) q.fill = 0;
      if (simOn) q.segs = Math.min(q.segs, 7);
      return q;
    }),
  };
  stats = builder.build(guides, P, ctx); stats.ms = performance.now() - t0;
  let li = 0, ri = 0;
  const gc = groups.map((gr) => new THREE.Color(gr.color));
  for (let gi = 0; gi < guides.length; gi++) {
    const g = guides[gi], gr = grpOf(g);
    if (!gr.visible) continue;
    const pts = ctx.getPts(g), cc = gc[g.group] || gc[0], dim = (P.activeOnly && g.group !== P.activeGroup) || gr.lockEdit ? 0.35 : 1;
    const c = [cc.r * dim, cc.g * dim, cc.b * dim];
    for (let i = 0; i < N - 1; i++) {
      const a = i * 3, b = a + 3, k = li * 6;
      linePos.array.set([pts[a], pts[a + 1], pts[a + 2], pts[b], pts[b + 1], pts[b + 2]], k);
      const f = 0.45 + 0.55 * (1 - i / N);
      lineCol.array.set([c[0] * f, c[1] * f, c[2] * f, c[0] * f, c[1] * f, c[2] * f], k); li++;
    }
    rootPos.array[ri * 3] = pts[0]; rootPos.array[ri * 3 + 1] = pts[1]; rootPos.array[ri * 3 + 2] = pts[2]; ri++;
  }
  linePos.needsUpdate = lineCol.needsUpdate = rootPos.needsUpdate = true;
  lineGeo.setDrawRange(0, li * 2); rootGeo.setDrawRange(0, ri);
  hairDirty = false;
}

/* ---------------- tools ---------------- */
const TOOLS = [
  ['draw', 'رسم مسار', 'D', 'اسحب على الرأس لرسم مسار؛ يمكنك مواصلة الرسم في الهواء خارج الرأس لتحديد انسدال الشعر.'],
  ['spray', 'فرشاة إضافة', 'A', 'اسحب لنشر مسارات داخل الفرشاة باتجاه حركة السحب (أو اتجاه الدوامة عند النقر).'],
  ['comb', 'تمشيط', 'C', 'اسحب لتحريك المسارات مع الحفاظ على أطوالها. الجذر ثابت.'],
  ['smooth', 'تنعيم', 'S', 'ينعّم انحناءات المسارات تحت الفرشاة.'],
  ['length', 'الطول', 'L', 'يزيد الطول؛ Shift لتقصيره.'],
  ['puff', 'رفع / كثافة', 'P', 'يرفع المسارات عن الفروة؛ Shift لخفضها.'],
  ['erase', 'حذف', 'E', 'يحذف المسارات تحت الفرشاة.'],
  ['assign', 'نقل للمجموعة', 'G', 'ينقل المسارات تحت الفرشاة إلى المجموعة النشطة (مثل اختيار منحنيات في Blender).'],
  ['mask', 'رسم منطقة الفروة', 'M', 'ارسم المنطقة التي ينمو منها الشعر؛ Shift للمسح.'],
];
const toolBox = $('tools');
const toolBtns = {};
const setHint = (t) => { hint.textContent = t; };
function setTool(t) {
  P.tool = t; Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('on', k === t));
  const d = TOOLS.find((x) => x[0] === t); setHint(d[3] + '  ·  تدوير: كليك أيمن أو Alt+سحب · تكبير: عجلة الماوس');
  ring.style.display = t === 'draw' ? 'none' : ring.style.display;
}
const hd = document.createElement('h3'); hd.textContent = 'الأدوات'; toolBox.appendChild(hd);
TOOLS.forEach(([id, name, key]) => {
  const b = document.createElement('button'); b.innerHTML = `<span>${name}</span><kbd>${key}</kbd>`; b.onclick = () => setTool(id);
  toolBox.appendChild(b); toolBtns[id] = b;
});
const hd2 = document.createElement('h3'); hd2.textContent = 'الزاوية'; toolBox.appendChild(hd2);
[['front', 'أمام'], ['back', 'خلف'], ['left', 'يسار'], ['right', 'يمين'], ['top', 'أعلى'], ['three', '3/4']].forEach(([id, t]) => {
  const b = document.createElement('button'); b.textContent = t; b.onclick = () => setView(id); toolBox.appendChild(b);
});

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
const screenRay = (cx, cy) => { const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); };
const surfaceHit = () => ray.intersectObjects(headMeshes, false)[0];
const wpp = (dist) => (2 * Math.tan((camera.fov * Math.PI) / 360) * dist) / canvas.clientHeight;

let stroke = null;
const camDir = new THREE.Vector3();
canvas.addEventListener('pointerdown', (e) => {
  controls.mouseButtons.LEFT = e.altKey || SIM.on ? THREE.MOUSE.ROTATE : -1;
}, true);
canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.altKey || SIM.on || e.pointerType === 'touch' && false) return;
  canvas.setPointerCapture(e.pointerId);
  stroke = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, undo: false, pts: [], nrm: [], air: false, lastHit: null };
  const t = P.tool;
  if (t === 'draw') {
    if (activeLocked()) { stroke = null; setHint('المجموعة النشطة مقفلة للتحرير أو مخفية.'); return; }
    screenRay(e.clientX, e.clientY); const h = surfaceHit();
    if (!h) { stroke = null; setHint('ابدأ الرسم من فوق سطح الرأس.'); return; }
    stroke.pts.push(h.point.clone()); stroke.nrm.push(h.face.normal.clone()); updateStrokeLine();
  } else apply(e, true);
});
canvas.addEventListener('pointermove', (e) => {
  moveRing(e);
  if (!stroke) return;
  apply(e, false);
  stroke.lx = e.clientX; stroke.ly = e.clientY;
});
const end = (e) => {
  if (!stroke) return;
  if (P.tool === 'draw') finishDraw();
  if (P.tool === 'mask' || P.tool === 'spray' || P.tool === 'draw') computeCrown();
  stroke = null; strokeGeo.setDrawRange(0, 0);
};
canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
canvas.addEventListener('pointerleave', () => { if (!stroke) ring.style.display = 'none'; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function moveRing(e) {
  if (P.tool === 'draw' || SIM.on || e.buttons & 2) { ring.style.display = 'none'; return; }
  const r = view.getBoundingClientRect();
  ring.style.display = 'block'; ring.style.width = ring.style.height = P.radius * 2 + 'px';
  ring.style.left = e.clientX - r.left + 'px'; ring.style.top = e.clientY - r.top + 'px';
}
function beforeChange() { if (!stroke.undo) { pushUndo(); stroke.undo = true; } }

function updateStrokeLine() {
  const a = strokePos.array, p = stroke.pts, n = Math.min(p.length, 3000);
  for (let i = 0; i < n; i++) { a[i * 3] = p[i].x; a[i * 3 + 1] = p[i].y; a[i * 3 + 2] = p[i].z; }
  strokePos.needsUpdate = true; strokeGeo.setDrawRange(0, n);
}

function apply(e, first) {
  const t = P.tool;
  if (t !== 'mask' && first && ['draw', 'spray'].includes(t) && activeLocked()) { setHint('المجموعة النشطة مقفلة للتحرير أو مخفية.'); stroke = null; return; }
  if (t === 'draw') return drawMove(e);
  if (t === 'mask') return paintMask(e);
  const dx = e.clientX - stroke.lx, dy = e.clientY - stroke.ly;
  if (t === 'spray') return spray(e, first);
  if (!first && !dx && !dy && t === 'comb') return;
  brushOp(t, e.clientX, e.clientY, dx, dy, e.shiftKey);
}

function drawMove(e) {
  const st = stroke, last = st.pts[st.pts.length - 1];
  screenRay(e.clientX, e.clientY);
  const h = surfaceHit();
  let pt = null;
  if (!st.air) { if (h) pt = h.point; else st.air = true; }
  if (st.air) {
    camera.getWorldDirection(camDir);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camDir, last);
    const ip = ray.ray.intersectPlane(plane, new THREE.Vector3());
    if (ip && (!h || ray.ray.origin.distanceTo(ip) < h.distance + 0.003)) pt = ip; else if (h) pt = h.point;
  }
  if (!pt) return;
  pt = pt.clone(); if (collider) collider.push(pt, 0.012);
  if (pt.distanceTo(last) < 0.015) return;
  st.pts.push(pt); st.nrm.push(st.nrm[0]); updateStrokeLine();
}
function finishDraw() {
  const st = stroke; if (!st || !st.pts.length) return;
  pushUndo();
  const n = st.nrm[0].clone();
  let poly = st.pts.slice();
  if (poly.length < 2) { const d = flowDir(poly[0], n); poly = [poly[0].clone(), poly[0].clone().addScaledVector(d, 0.02)]; }
  let len = 0; for (let i = 1; i < poly.length; i++) len += poly[i].distanceTo(poly[i - 1]);
  const target = P.extend ? Math.max(P.length, len) : len;
  if (target > len + 1e-3) {
    const k = Math.min(poly.length - 1, 4), v = poly[poly.length - 1].clone().sub(poly[poly.length - 1 - k]).normalize();
    const p = poly[poly.length - 1].clone(), stepL = 0.025; let acc = len;
    while (acc < target - 1e-4) {
      v.y -= P.gravity * 0.1; v.normalize(); p.addScaledVector(v, stepL); if (collider) collider.push(p, 0.014); poly.push(p.clone()); acc += stepL;
    }
  }
  addGuide(resamplePolyline(poly), n);
  setHint(`عدد المسارات: ${guides.length}`);
}

const maskTmp = new THREE.Vector3();
function paintMask(e) {
  screenRay(e.clientX, e.clientY); const h = surfaceHit(); if (!h) return;
  beforeChange();
  const r = P.radius * wpp(h.distance), r2 = r * r, sign = e.shiftKey ? -1 : 1;
  const centers = [h.point.clone()]; if (P.symmetry) centers.push(new THREE.Vector3(-h.point.x, h.point.y, h.point.z));
  for (const m of headMeshes) {
    const pos = m.geometry.attributes.position, mk = m.userData.mask; let ch = false;
    for (let i = 0; i < pos.count; i++) {
      maskTmp.fromBufferAttribute(pos, i);
      for (const c of centers) {
        const d2 = maskTmp.distanceToSquared(c);
        if (d2 < r2) { const f = 1 - d2 / r2; mk[i] = Math.min(1, Math.max(0, mk[i] + sign * f * (0.25 + P.strength))); ch = true; }
      }
    }
    if (ch) refreshMaskColors(m, P.showMask);
  }
}

const prevC = new THREE.Vector3();
function spray(e, first) {
  const st = stroke;
  screenRay(e.clientX, e.clientY); const hc = surfaceHit();
  const moved = Math.hypot(e.clientX - st.x, e.clientY - st.y);
  if (!first && moved < P.radius * 0.35) return;
  st.x = e.clientX; st.y = e.clientY;
  beforeChange();
  let drag = null;
  if (hc && st.lastHit) drag = hc.point.clone().sub(st.lastHit);
  if (hc) st.lastHit = hc.point.clone();
  for (let i = 0; i < P.density; i++) {
    const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * P.radius;
    screenRay(e.clientX + Math.cos(a) * r, e.clientY + Math.sin(a) * r);
    const h = surfaceHit(); if (!h) continue;
    if (P.maskOnly && h.object.userData.mask[h.face.a] < 0.5) continue;
    const root = h.point.clone(), n = h.face.normal.clone();
    if (tooClose(root) || (P.symmetry && Math.abs(root.x) > 0.015 && tooClose(new THREE.Vector3(-root.x, root.y, root.z)))) continue;
    const dir = new THREE.Vector3();
    if (drag && drag.lengthSq() > 1e-6) { dir.copy(drag).addScaledVector(n, -drag.dot(n)); if (dir.lengthSq() < 1e-8) flowDir(root, n, dir); else dir.normalize(); if (P.sweep) dir.applyAxisAngle(n, P.sweep * Math.PI / 180); } else flowDir(root, n, dir);
    const len = P.length * (1 + (Math.random() - 0.5) * 2 * P.lenVar);
    addGuide(genGuide(root, n, dir, len, P, collider), n);
  }
}

const vp = new THREE.Matrix4(), q = new THREE.Vector3(), dv = new THREE.Vector3(), camRight = new THREE.Vector3(), camUp = new THREE.Vector3();
function brushOp(tool, cx, cy, dx, dy, shift) {
  camera.updateMatrixWorld(); vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  const rect = canvas.getBoundingClientRect(), R = P.radius, S = P.strength;
  camRight.setFromMatrixColumn(camera.matrixWorld, 0); camUp.setFromMatrixColumn(camera.matrixWorld, 1);
  const camPos = camera.position;
  let touched = false;
  const passes = P.symmetry ? [1, -1] : [1];
  const erase = [];
  for (let gi = 0; gi < guides.length; gi++) {
    const g = guides[gi], p = g.pts;
    if (tool === 'assign') { const gr = grpOf(g); if (!gr.visible || gr.lockEdit || g.group === P.activeGroup) continue; } else if (!editable(g)) continue;
    let gw = 0;
    for (const mx of passes) {
      if (P.frontOnly) {
        const rx = p[0] * mx, rn = g.normal;
        if (rn.x * mx * (camPos.x - rx) + rn.y * (camPos.y - p[1]) + rn.z * (camPos.z - p[2]) <= -0.0) continue;
      }
      const ws = [];
      let any = false;
      for (let i = 1; i < N; i++) {
        q.set(p[i * 3] * mx, p[i * 3 + 1], p[i * 3 + 2]);
        const dist = camPos.distanceTo(q);
        q.applyMatrix4(vp);
        const sx = (q.x * 0.5 + 0.5) * rect.width + rect.left, sy = (-q.y * 0.5 + 0.5) * rect.height + rect.top;
        const d = Math.hypot(sx - cx, sy - cy);
        let w = d < R ? Math.pow(1 - d / R, 1.2) : 0;
        ws.push([w, dist]); if (w > 0) any = true;
      }
      if (!any) continue;
      touched = true;
      if (tool === 'erase' || tool === 'assign') { gw = 1; continue; }
      if (tool === 'comb') {
        for (let i = 1; i < N; i++) {
          const [w, dist] = ws[i - 1]; if (!w) continue;
          const k = w * S * Math.pow(i / (N - 1), 0.8), s = wpp(dist);
          dv.set(0, 0, 0).addScaledVector(camRight, dx * s * k).addScaledVector(camUp, -dy * s * k);
          p[i * 3] += dv.x * mx; p[i * 3 + 1] += dv.y; p[i * 3 + 2] += dv.z;
        }
        gw = Math.max(gw, 0.01);
      } else if (tool === 'smooth') {
        const src = p.slice();
        for (let i = 1; i < N; i++) {
          const w = ws[i - 1][0]; if (!w) continue;
          const a = (i - 1) * 3, b = Math.min(N - 1, i + 1) * 3, c = i * 3;
          const k = w * S * 0.7;
          for (let a3 = 0; a3 < 3; a3++) {
            const tgt = i === N - 1 ? 2 * src[a + a3] - src[Math.max(0, i - 2) * 3 + a3] : (src[a + a3] + src[b + a3]) * 0.5;
            p[c + a3] += (tgt - src[c + a3]) * k;
          }
        }
        gw = Math.max(gw, 0.01);
      } else if (tool === 'length') {
        const w = Math.max(...ws.map((x) => x[0])), f = 1 + (shift ? -1 : 1) * w * S * 0.04;
        for (let i = 1; i < N; i++) for (let a3 = 0; a3 < 3; a3++) p[i * 3 + a3] = p[a3] + (p[i * 3 + a3] - p[a3]) * f;
        for (let i = 0; i < N - 1; i++) g.seg[i] *= f;
        gw = Math.max(gw, 0.01);
      } else if (tool === 'puff') {
        const sg = shift ? -1 : 1, n = g.normal;
        for (let i = 1; i < N; i++) {
          const w = ws[i - 1][0]; if (!w) continue;
          const k = sg * w * S * 0.02 * (i / (N - 1));
          p[i * 3] += n.x * mx * k; p[i * 3 + 1] += n.y * k; p[i * 3 + 2] += n.z * k;
        }
        gw = Math.max(gw, 0.01);
      }
    }
    if (gw > 0) {
      if (!stroke.undo) { pushUndo(); stroke.undo = true; }
      if (tool === 'erase') erase.push(gi);
      else if (tool === 'assign') { g.group = P.activeGroup; topoDirty = true; }
      else {
        if (tool !== 'length') enforceLengths(g);
        for (let i = 1; i < N; i++) { q.set(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); if (collider.push(q, 0.013)) { p[i * 3] = q.x; p[i * 3 + 1] = q.y; p[i * 3 + 2] = q.z; } }
        if (tool === 'length') computeSeg(g); else enforceLengths(g);
        g.sim = null;
      }
    }
  }
  if (erase.length) { const s = new Set(erase); guides = guides.filter((_, i) => !s.has(i)); topoDirty = true; }
  if (touched) hairDirty = true;
}

/* ---------------- tabs / panels ---------------- */
const tabEls = mkTabs($('tabs'), $('tabBody'), [['grp', 'المجموعات'], ['g', 'المسارات'], ['c', 'البطاقات'], ['s', 'الخامة'], ['l', 'الإضاءة'], ['p', 'فيزياء'], ['x', 'ملفات']]);
const dirty = () => { hairDirty = true; };
const topo = () => { topoDirty = hairDirty = true; };
{
  const p = tabEls('grp');
  h3(p, 'مجموعات الشعر');
  const list = document.createElement('div'); p.appendChild(list);
  let countEls = [];
  const tg = (gr, key, label, title, after) => {
    const b = document.createElement('button'); b.textContent = label; b.title = title;
    b.classList.toggle('on', !!gr[key]);
    b.onclick = (e) => { e.stopPropagation(); gr[key] = !gr[key]; b.classList.toggle('on', gr[key]); after && after(); hairDirty = true; refreshUI(); };
    return b;
  };
  const render = () => {
    list.innerHTML = ''; countEls = [];
    groups.forEach((gr, i) => {
      const row = document.createElement('div'); row.className = 'grp' + (i === P.activeGroup ? ' act' : '');
      row.onclick = () => { if (P.activeGroup !== i) { P.activeGroup = i; hairDirty = true; refreshUI(); } };
      const rd = document.createElement('input'); rd.type = 'radio'; rd.checked = i === P.activeGroup; rd.name = 'ag';
      const cl = document.createElement('input'); cl.type = 'color'; cl.value = gr.color; cl.title = 'لون عرض المسارات';
      cl.oninput = () => { gr.color = cl.value; hairDirty = true; }; cl.onclick = (e) => e.stopPropagation();
      const nm = document.createElement('input'); nm.type = 'text'; nm.value = gr.name;
      nm.onclick = (e) => e.stopPropagation(); nm.onkeydown = (e) => e.stopPropagation();
      nm.onchange = () => { gr.name = nm.value || gr.name; refreshUI(); };
      const t = document.createElement('div'); t.className = 'tg';
      t.append(tg(gr, 'visible', '👁', 'إظهار/إخفاء'), tg(gr, 'lockPhys', '⚓', 'قفل الفيزياء: لا تتأثر بالرياح أو الجاذبية'), tg(gr, 'lockEdit', '🔒', 'قفل التحرير: لا تتأثر بالفرش'));
      const sm = document.createElement('small'); countEls[i] = sm;
      row.append(rd, cl, nm, t, sm); list.appendChild(row);
    });
    updateCounts();
  };
  const updateCounts = () => {
    const c = groups.map(() => 0); guides.forEach((g) => { if (c[g.group] !== undefined) c[g.group]++; });
    countEls.forEach((el, i) => { const gr = groups[i]; el.textContent = `${c[i]} مسار` + (gr.lockPhys ? ' · فيزياء مقفلة' : '') + (gr.lockEdit ? ' · تحرير مقفل' : '') + (gr.visible ? '' : ' · مخفية'); });
  };
  window.__updateGroupCounts = updateCounts;
  onRefresh(render);
  buttons(p, [
    ['+ مجموعة جديدة', () => {
      pushUndo();
      const pal = ['#ffd43b', '#ff6b6b', '#74c0fc', '#b197fc', '#63e6be', '#ffa94d'];
      groups.push(mkGroup(`مجموعة ${groups.length + 1}`, pal[groups.length % pal.length], { card: { ...(groups[P.activeGroup] || groups[0]).card } }));
      P.activeGroup = groups.length - 1; refreshUI();
    }],
    ['تكرار الإعدادات', () => {
      pushUndo(); const src = groups[P.activeGroup];
      groups.push({ ...JSON.parse(JSON.stringify(src)), name: src.name + ' ٢' }); P.activeGroup = groups.length - 1; refreshUI();
    }],
    ['حذف المجموعة ومساراتها', () => {
      if (groups.length < 2) return setHint('يجب أن تبقى مجموعة واحدة على الأقل.');
      const gi = P.activeGroup; if (!confirm(`حذف «${groups[gi].name}» وكل مساراتها؟`)) return;
      pushUndo();
      guides = guides.filter((g) => g.group !== gi); guides.forEach((g) => { if (g.group > gi) g.group--; });
      groups.splice(gi, 1); P.activeGroup = Math.max(0, gi - 1); topoDirty = hairDirty = true; resetSim(); refreshUI();
    }, 'warn'],
  ]);
  check(p, P, 'activeOnly', 'الفرش تعمل على النشطة فقط', () => { hairDirty = true; });
  note(p, 'أداة «نقل للمجموعة» (G) تنقل المسارات تحت الفرشاة إلى المجموعة النشطة.');
  h3(p, 'خصائص المجموعة النشطة');
  color(p, AG, 'tint', 'صبغة اللون', dirty);
  slider(p, AG, 'bright', 'سطوع', 0, 2.5, 0.01, dirty);
  check(p, AG, 'lockPhys', 'قفل الفيزياء ⚓', () => { refreshUI(); hairDirty = true; });
  slider(p, AG, 'stiff', 'صلابة الفيزياء', 0, 3, 0.01);
  check(p, AG, 'lockEdit', 'قفل التحرير 🔒', () => { refreshUI(); hairDirty = true; });
  check(p, AG, 'visible', 'ظاهرة', () => { refreshUI(); hairDirty = true; });
  note(p, 'كل الحقول الرقمية قابلة للكتابة مباشرة لإدخال قيم دقيقة (Enter للتأكيد).');
}
{
  const p = tabEls('g');
  h3(p, 'الفرشاة');
  slider(p, P, 'radius', 'حجم الفرشاة', 10, 220, 1, () => moveRing({ clientX: -999, clientY: -999, buttons: 0 }));
  slider(p, P, 'strength', 'القوة', 0.05, 1, 0.01);
  check(p, P, 'symmetry', 'تناظر X');
  check(p, P, 'frontOnly', 'المواجهة للكاميرا فقط');
  check(p, P, 'maskOnly', 'النشر داخل المنطقة فقط');
  slider(p, P, 'density', 'كثافة النشر', 1, 20, 1);
  slider(p, P, 'minDist', 'أقل مسافة جذور', 0.005, 0.06, 0.001);
  h3(p, 'شكل المسار الأولي');
  slider(p, P, 'length', 'الطول', 0.15, 2.4, 0.01);
  slider(p, P, 'lenVar', 'تباين الطول', 0, 0.6, 0.01);
  slider(p, P, 'lift', 'الرفع عن الفروة', 0, 0.9, 0.01);
  slider(p, P, 'gravity', 'الجاذبية', 0, 1.5, 0.01);
  slider(p, P, 'wave', 'التموّج', 0, 1.5, 0.01);
  slider(p, P, 'sweep', 'ميل التسريحة °', -90, 90, 1);
  check(p, P, 'extend', 'تمديد الرسم بالجاذبية');
  check(p, P, 'layerMix', 'طبقات عشوائية');
  select(p, P, 'layer', 'الطبقة', () => [[0, 'داخلية (أغمق)'], [1, 'وسطى'], [2, 'خارجية']]);
  h3(p, 'توليد من منطقة الفروة');
  slider(p, P, 'count', 'عدد المسارات', 20, 1200, 1);
  buttons(p, [
    ['توليد من المنطقة', generateFromMask],
    ['مسح كل المسارات', () => { pushUndo(); guides = []; topo(); }, 'warn'],
    ['مسح المنطقة', () => { pushUndo(); headMeshes.forEach((m) => { m.userData.mask.fill(0); refreshMaskColors(m, P.showMask); }); computeCrown(); }, 'warn'],
  ]);
  note(p, 'سير العمل: ① ارسم منطقة الفروة ② وَلِّد المسارات أو ارسمها/انشرها يدوياً ③ مشِّط ونعِّم ④ اضبط البطاقات.');
}
{
  const p = tabEls('c');
  select(p, P, 'activeGroup', 'المجموعة', () => groups.map((g, i) => [i, g.name]), () => { refreshUI(); hairDirty = true; });
  note(p, 'إعدادات «الشكل» أدناه خاصة بالمجموعة النشطة.');
  h3(p, 'نوع البطاقة (من الأطلس)');
  select(p, P, 'type', 'النوع', () => ctypes.map((t, i) => [i, t.name]), dirty);
  buttons(p, [['تطبيق النوع على مسارات المجموعة', () => { pushUndo(); guides.forEach((g) => { if (g.group === P.activeGroup) g.type = P.type; }); dirty(); }]]);
  h3(p, 'الشكل');
  slider(p, GP, 'perGuide', 'بطاقات لكل مسار', 1, 6, 1, dirty);
  slider(p, GP, 'fill', 'تعبئة بين المسارات', 0, 4, 1, topo);
  slider(p, GP, 'width', 'العرض', 0.02, 0.4, 0.002, dirty);
  slider(p, GP, 'widthVar', 'تباين العرض', 0, 0.8, 0.01, dirty);
  slider(p, GP, 'taper', 'سماكة الطرف', 0.05, 1.2, 0.01, dirty);
  slider(p, GP, 'rootW', 'سماكة الجذر', 0.1, 1.2, 0.01, dirty);
  slider(p, GP, 'spread', 'تباعد البطاقات', 0, 2, 0.01, dirty);
  slider(p, GP, 'fan', 'انفراج نحو الطرف', 0, 2, 0.01, dirty);
  slider(p, GP, 'twist', 'التواء', 0, 2, 0.01, dirty);
  slider(p, GP, 'noise', 'عشوائية', 0, 3, 0.01, dirty);
  slider(p, GP, 'layerGap', 'فاصل الطبقات', 0, 0.03, 0.001, dirty);
  slider(p, GP, 'fly', 'خصلات شاردة', 0, 1, 0.01, dirty);
  slider(p, GP, 'segs', 'Resample (نقاط)', 2, 40, 1, dirty);
  slider(p, GP, 'vol', 'حجم الطبعة (Normal)', 0, 1, 0.01, dirty);
  slider(p, GP, 'curve', 'استدارة المقطع', 0, 1, 0.01, dirty);
  slider(p, GP, 'uvVar', 'تنوع UV', 0, 1, 0.01, dirty);
  slider(p, P, 'centerLift', 'ارتفاع مركز الرأس', -1, 1, 0.01, dirty);
  h3(p, 'أطلس مخصص');
  buttons(p, [
    ['أطلس Alpha جديد…', () => $('fAtlas').click()],
    ['نسيج لون جديد…', () => $('fColor').click()],
  ]);
  note(p, 'الأطلس الافتراضي: Ryan Sainsbury — مجاني للاستخدام (انظر assets/License.txt). الأطلس المخصص: تُكتشف الأشرطة تلقائياً ويكون الجذر أعلى الصورة.');
}
{
  const p = tabEls('s');
  h3(p, 'اللون');
  color(p, P, 'rootColor', 'لون الجذر', applyShading);
  color(p, P, 'tipColor', 'لون الطرف', applyShading);
  slider(p, P, 'gradA', 'بداية التدرج', 0, 1, 0.01, applyShading);
  slider(p, P, 'gradB', 'نهاية التدرج', 0, 1, 0.01, applyShading);
  slider(p, P, 'texAmt', 'تفاصيل النسيج', 0, 1, 0.01, applyShading);
  slider(p, P, 'origAmt', 'لون النسيج الأصلي', 0, 1, 0.01, applyShading);
  h3(p, 'اللمعان (Kajiya‑Kay مزدوج)');
  color(p, P, 'spec1', 'لون اللمعة 1', applyShading);
  slider(p, P, 'exp1', 'حدّة 1', 8, 300, 1, applyShading);
  slider(p, P, 'sh1', 'إزاحة 1', -0.5, 0.5, 0.01, applyShading);
  color(p, P, 'spec2', 'لون اللمعة 2', applyShading);
  slider(p, P, 'exp2', 'حدّة 2', 4, 150, 1, applyShading);
  slider(p, P, 'sh2', 'إزاحة 2', -0.5, 0.5, 0.01, applyShading);
  slider(p, P, 'specAmt', 'شدة اللمعان', 0, 3, 0.01, applyShading);
  slider(p, P, 'sss', 'نفاذ الضوء (SSS)', 0, 2, 0.01, applyShading);
  h3(p, 'العمق والشفافية');
  slider(p, P, 'ao', 'تعتيم الجذور (AO)', 0, 1, 0.01, applyShading);
  slider(p, P, 'aoLen', 'امتداد AO', 0.02, 1, 0.01, applyShading);
  slider(p, P, 'cut', 'عتبة Alpha', 0.05, 0.9, 0.01, applyShading);
  slider(p, P, 'rootFade', 'تلاشي الجذر', 0, 0.3, 0.005, applyShading);
  slider(p, P, 'tipFade', 'تقطّع الأطراف', 0, 0.6, 0.01, applyShading);
  check(p, P, 'hashed', 'Alpha Hash بدل A2C', applyShading);
  check(p, P, 'showAO', 'عرض AO فقط', applyShading);
}
{
  const p = tabEls('l');
  h3(p, 'إضاءة جاهزة');
  select(p, L, 'preset', 'البيئة', () => [['portrait', 'بورتريه'], ['studio', 'استوديو'], ['sun', 'شمس'], ['shade', 'ظل'], ['indoor', 'داخلي دافئ']], applyPreset);
  h3(p, 'الضوء الرئيسي');
  slider(p, L, 'keyAz', 'الاتجاه °', -180, 180, 1, applyLights);
  slider(p, L, 'keyEl', 'الارتفاع °', -10, 90, 1, applyLights);
  slider(p, L, 'keyI', 'الشدة', 0, 8, 0.05, applyLights);
  h3(p, 'التعبئة والحافة');
  slider(p, L, 'fillI', 'تعبئة', 0, 4, 0.05, applyLights);
  slider(p, L, 'rimAz', 'اتجاه الحافة °', -180, 180, 1, applyLights);
  slider(p, L, 'rimI', 'حافة', 0, 6, 0.05, applyLights);
  slider(p, L, 'ambI', 'محيط', 0, 3, 0.05, applyLights);
  slider(p, P, 'exposure', 'التعريض', 0.3, 2.5, 0.01, applyLights);
  note(p, 'اختبر الشعر في الشمس والظل والإضاءة الداخلية للتأكد من ثبات الشكل.');
}
{
  const p = tabEls('p');
  h3(p, 'معاينة الحركة');
  check(p, SIM, 'on', 'تشغيل المحاكاة', () => { resetSim(); hairDirty = true; setHint(SIM.on ? 'المحاكاة تعمل: الأدوات متوقفة (السحب = تدوير). عطّلها للتعديل.' : ''); setTool(P.tool); });
  check(p, SIM, 'shake', 'هز الرأس');
  slider(p, SIM, 'wind', 'الرياح', 0, 3, 0.01);
  slider(p, SIM, 'gravity', 'الجاذبية', 0, 3, 0.01);
  slider(p, SIM, 'stiff', 'تماسك الشكل', 0, 1, 0.01);
  slider(p, SIM, 'damp', 'التخميد', 0.8, 0.999, 0.001);
  note(p, 'تصادم الشعر مع الرأس والرقبة يعتمد على سطح الموديل نفسه.');
}
{
  const p = tabEls('x');
  h3(p, 'المشروع');
  buttons(p, [['حفظ المشروع (JSON)', saveProject], ['فتح مشروع…', () => $('fProj').click()]]);
  h3(p, 'تصدير');
  buttons(p, [
    ['بطاقات GLB', exportGLB],
    ['بطاقات OBJ', exportOBJ],
    ['منحنيات OBJ (للمايا/بلندر)', exportCurves],
    ['لقطة PNG', exportPNG],
  ]);
  note(p, 'GLB: ألوان الرأس‑للطرف كـ vertex colors مع نسيج Alpha لكل قناة أطلس. منحنيات OBJ تُستورد كـ Guide Curves في Maya/Blender لبناء Strands أو XGen.');
}
const fileInput = (id, accept, cb) => { const i = document.createElement('input'); i.type = 'file'; i.id = id; i.accept = accept; i.hidden = true; i.onchange = () => { if (i.files[0]) cb(i.files[0]); i.value = ''; }; document.body.appendChild(i); };
fileInput('fAtlas', 'image/*', (f) => loadImg(URL.createObjectURL(f)).then(addCustomAtlas));
fileInput('fColor', 'image/*', (f) => loadImg(URL.createObjectURL(f)).then((i) => { colorTex.image = i; colorTex.needsUpdate = true; }));
fileInput('fProj', '.json', (f) => f.text().then(loadProject));

/* view bar */
const vbar = $('vbar');
[['showGuides', 'المسارات'], ['showCards', 'البطاقات'], ['showHead', 'الرأس'], ['showMask', 'المنطقة'], ['wire', 'Wireframe'], ['xray', 'مسارات فوق الكل']].forEach(([k, t]) => {
  const b = document.createElement('button'); b.textContent = t;
  const sync = () => { b.classList.toggle('on', !!P[k]); };
  b.onclick = () => {
    P[k] = !P[k]; sync();
    if (k === 'showMask') headMeshes.forEach((m) => refreshMaskColors(m, P.showMask));
    if (k === 'wire') applyShading();
  };
  sync(); vbar.appendChild(b);
});

/* ---------------- files ---------------- */
const download = (name, data, type = 'application/octet-stream') => {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
function saveProject() {
  const prj = { v: 2, P: { ...P }, L: { ...L }, groups, guides: snapshot().guides.map((g) => ({ ...g, pts: Array.from(g.pts, (x) => +x.toFixed(5)) })), masks: headMeshes.map((m) => Array.from(m.userData.mask, (x) => Math.round(x * 100) / 100)) };
  download('hair-project.json', JSON.stringify(prj), 'application/json');
}
function loadProject(txt) {
  try {
    const o = JSON.parse(txt); Object.assign(P, o.P); Object.assign(L, o.L);
    pushUndo(); restore({ guides: o.guides.map((g) => ({ ...g, pts: Float32Array.from(g.pts) })), masks: o.masks.map((m) => Float32Array.from(m)), groups: o.groups || [mkGroup('شعر الرأس', '#2ee6a0')], active: 0 });
    presetCols = PRESETS[L.preset] || PRESETS.studio; applyLights(); applyShading(); refreshUI(); computeCrown(); setHint('تم تحميل المشروع.');
  } catch (err) { setHint('تعذر فتح المشروع: ' + err.message); }
}
function exportPNG() {
  renderFrame(); canvas.toBlob((b) => download('hair.png', b, 'image/png'));
}
function cardGeometries() {
  const nv = builder.nv, out = [];
  const idx = builder.idx.array, aux = builder.aux.array;
  for (let ch = 0; ch < 3; ch++) {
    const keep = [];
    for (let i = 0; i < builder.ni; i += 3) if (aux[idx[i] * 4 + 3] === ch) keep.push(idx[i], idx[i + 1], idx[i + 2]);
    if (!keep.length) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(builder.pos.array.slice(0, nv * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(builder.nor.array.slice(0, nv * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(builder.uv.array.slice(0, nv * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(builder.col.array.slice(0, nv * 3), 3));
    g.setIndex(keep); out.push([ch, g]);
  }
  return out;
}
function channelTexture(ch) {
  const c = document.createElement('canvas'); c.width = c.height = 2048;
  const ctx = c.getContext('2d'), src = atlasCanvas.getContext('2d').getImageData(0, 0, 2048, 2048), o = ctx.createImageData(2048, 2048);
  for (let i = 0; i < o.data.length; i += 4) { o.data[i] = o.data[i + 1] = o.data[i + 2] = 255; o.data[i + 3] = src.data[i + ch]; }
  ctx.putImageData(o, 0, 0); return c;
}
function exportGLB() {
  rebuild();
  const root = new THREE.Group(); root.name = 'HairCards';
  for (const [ch, g] of cardGeometries()) {
    const tx = new THREE.CanvasTexture(channelTexture(ch)); tx.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshStandardMaterial({ map: tx, vertexColors: true, alphaTest: P.cut, side: THREE.DoubleSide, roughness: 0.55, metalness: 0 });
    const me = new THREE.Mesh(g, m); me.name = `Hair_ch${ch}`; root.add(me);
  }
  new GLTFExporter().parse(root, (buf) => download('hair-cards.glb', buf, 'model/gltf-binary'), (e) => setHint('فشل التصدير: ' + e), { binary: true });
}
function exportOBJ() {
  rebuild();
  const pos = builder.pos.array, uv = builder.uv.array, nor = builder.nor.array, aux = builder.aux.array, idx = builder.idx.array;
  const s = [`# Smart Hair Tool cards\n`];
  for (let i = 0; i < builder.nv; i++) s.push(`v ${pos[i * 3].toFixed(5)} ${pos[i * 3 + 1].toFixed(5)} ${pos[i * 3 + 2].toFixed(5)}`);
  for (let i = 0; i < builder.nv; i++) s.push(`vt ${uv[i * 2].toFixed(5)} ${uv[i * 2 + 1].toFixed(5)}`);
  for (let i = 0; i < builder.nv; i++) s.push(`vn ${nor[i * 3].toFixed(4)} ${nor[i * 3 + 1].toFixed(4)} ${nor[i * 3 + 2].toFixed(4)}`);
  let cur = -1;
  for (let i = 0; i < builder.ni; i += 3) {
    const ch = aux[idx[i] * 4 + 3]; if (ch !== cur) { s.push(`g atlas_ch${ch}`); cur = ch; }
    const f = [idx[i], idx[i + 1], idx[i + 2]].map((k) => `${k + 1}/${k + 1}/${k + 1}`);
    s.push(`f ${f.join(' ')}`);
  }
  download('hair-cards.obj', s.join('\n'), 'text/plain');
}
function exportCurves() {
  const s = ['# Hair guide curves (polylines)'];
  guides.forEach((g, gi) => {
    for (let i = 0; i < N; i++) s.push(`v ${g.pts[i * 3].toFixed(5)} ${g.pts[i * 3 + 1].toFixed(5)} ${g.pts[i * 3 + 2].toFixed(5)}`);
  });
  guides.forEach((g, gi) => { s.push(`o guide_${gi}`); s.push('l ' + Array.from({ length: N }, (_, i) => gi * N + i + 1).join(' ')); });
  download('hair-guides.obj', s.join('\n'), 'text/plain');
}
async function importModel(file) {
  const buf = await file.arrayBuffer(); const n = file.name.toLowerCase();
  let root;
  try {
    if (n.endsWith('.obj')) root = new OBJLoader().parse(new TextDecoder().decode(buf));
    else root = (await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej))).scene;
  } catch (err) { setHint('تعذر قراءة الموديل: ' + err.message); return; }
  const res = bakeImported(root);
  if (!res) { setHint('لا يحتوي الملف على مجسمات.'); return; }
  setHead(res); setHint('تم استيراد الموديل. ارسم منطقة الفروة ثم ولّد المسارات. ضبط «ارتفاع مركز الرأس» في تبويب البطاقات.');
}
$('bImport').onclick = () => $('fModel').click();
$('fModel').onchange = (e) => { if (e.target.files[0]) importModel(e.target.files[0]); e.target.value = ''; };
$('bHead').onclick = () => { skin.color = null; setHead(makeProceduralHead()); };
$('bPortrait').onclick = () => loadPortrait();

function loadPortrait() {
  skin.color = null;
  Object.assign(P, PORTRAIT.PARAMS);
  groups = PORTRAIT.GROUPS.map((g) => mkGroup(g.name, g.color, g)); P.activeGroup = 0;
  setHead(PORTRAIT.loadPortraitHead());
  headExtras = PORTRAIT.makeEyes(); headGroup.add(headExtras);
  const v = new THREE.Vector3(), c = new THREE.Color();
  for (const m of headMeshes) {
    const pos = m.geometry.attributes.position, base = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      m.userData.mask[i] = PORTRAIT.maskAt(v);
      PORTRAIT.skinAt(v, c); base.set([c.r, c.g, c.b], i * 3);
    }
    m.userData.base = base; m.material.roughness = 0.62; refreshMaskColors(m, P.showMask);
  }
  computeCrown();
  generateFromMask(PORTRAIT.scalpStyle);
  const castFront = (x, y) => {
    ray.set(new THREE.Vector3(x, y, 3), new THREE.Vector3(0, 0, -1));
    const h = ray.intersectObjects(headMeshes, false)[0];
    return h ? { point: h.point, n: h.face.normal.clone() } : null;
  };
  for (const f of PORTRAIT.facialStrands(castFront)) {
    if (tooClose(f.root) && f.group === 0) continue;
    const pts = genGuide(f.root, f.n, f.dir.addScaledVector(f.n, -f.dir.dot(f.n)).normalize(), f.len, { ...P, lift: f.lift, gravity: 0.05, wave: f.wave, cling: 0 }, collider);
    const g = newGuide(pts, f.n, 5, 2, f.group); g.wScale = f.w * (0.8 + Math.random() * 0.4); guides.push(g);
  }
  topoDirty = hairDirty = true; undoStack.length = 0;
  presetCols = PRESETS.portrait; Object.assign(L, PRESETS.portrait.v, { preset: 'portrait' });
  applyLights(); applyShading(); refreshUI();
  controls.target.set(0, 0.45, 0.1); camera.position.set(0, 0.5, 6.2); controls.update();
  setHint('مثال البورتريه: MaleHead.obj + شعر مموج مرفوع للخلف، حواجب وشارب. عدّل بالفرشاة أو من التبويبات.');
}
$('bNew').onclick = () => { if (!guides.length || confirm('مسح كل المسارات؟')) { pushUndo(); guides = []; topo(); } };
$('bUndo').onclick = undo; $('bRedo').onclick = redo;
const drop = $('drop');
window.addEventListener('dragover', (e) => { e.preventDefault(); drop.style.display = 'flex'; });
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) drop.style.display = 'none'; });
window.addEventListener('drop', (e) => { e.preventDefault(); drop.style.display = 'none'; const f = e.dataTransfer.files[0]; if (f) importModel(f); });
window.addEventListener('keydown', (e) => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) && document.activeElement.type !== 'range') return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey) return;
  const t = TOOLS.find((x) => x[2].toLowerCase() === k); if (t) setTool(t[0]);
  if (k === '[') { P.radius = Math.max(10, P.radius - 8); refreshUI(); }
  if (k === ']') { P.radius = Math.min(220, P.radius + 8); refreshUI(); }
});

/* ---------------- loop ---------------- */
function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);
let fpsT = performance.now(), frames = 0, lastT = performance.now();
function renderFrame() {
  controls.update();
  hairMesh.visible = P.showCards && builder.ni > 0;
  lines.visible = rootPts.visible = P.showGuides;
  lineMat.depthTest = rootPts.material.depthTest = !P.xray;
  headGroup.visible = P.showHead;
  renderer.render(scene, camera);
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.033, (now - lastT) / 1000); lastT = now;
  if (SIM.on) simStep(dt);
  if (hairDirty) { rebuild(); }
  renderFrame();
  frames++;
  if (now - fpsT > 500) {
    $('sFps').textContent = `${Math.round((frames * 1000) / (now - fpsT))} fps`; frames = 0; fpsT = now;
    window.__updateGroupCounts && window.__updateGroupCounts();
    $('sGuides').textContent = `guides ${guides.length}`; $('sCards').textContent = `cards ${Math.round(stats.cards)}`;
    $('sTris').textContent = `tris ${stats.tris}`; $('sMs').textContent = `build ${stats.ms.toFixed(1)}ms`;
  }
}

/* ---------------- boot ---------------- */
(async () => {
  resize();
  setHead(makeProceduralHead());
  applyLights(); applyShading(); setTool('spray'); refreshUI();
  await loadAtlas();
  loadPortrait();
  requestAnimationFrame(frame);
  window.__hair = { loadPortrait, get groups() { return groups; }, P, L, SIM, get guides() { return guides; }, camera, controls, setTool, generateFromMask, setHead, makeProceduralHead, applyShading, applyLights, brushOp, undo, redo };
})();
