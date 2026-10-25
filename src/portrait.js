// Preset tuned to MaleHead.obj + "Stern Cinematic Portrait" reference: short-medium dark wavy hair
// swept up/back with volume and frizz, ears exposed, thick furrowed brows, chevron moustache, stubble.
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MALE_HEAD_OBJ } from './maleHead.js';
import { bakeImported } from './head.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerpTable = (tab, x) => {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return tab[tab.length - 1][1];
};

export const CENTER = new THREE.Vector3(0, 0.5, 0.02);
const azim = (p) => Math.atan2(Math.abs(p.x), p.z - 0.05);

// hairline height by azimuth (0 = forehead, PI = nape)
export const HAIRLINE = [[0, 0.9], [0.3, 0.88], [0.55, 0.8], [0.8, 0.74], [1.05, 0.64], [1.22, 0.52], [1.3, 0.34], [1.38, 0.5], [1.48, 0.6], [1.95, 0.6], [2.15, 0.36], [2.5, 0.12], [3.15, -0.02]];

export function loadPortraitHead() {
  const r = bakeImported(new OBJLoader().parse(MALE_HEAD_OBJ));
  r.center = CENTER.clone();
  return r;
}

export function maskAt(p) {
  if (p.y < -0.1) return 0;
  const h = lerpTable(HAIRLINE, azim(p));
  return sstep(h - 0.015, h + 0.02, p.y);
}

const SKIN = new THREE.Color('#a5806b'), STUBBLE = new THREE.Color('#5c463a'), LIP = new THREE.Color('#9c6455');

export function skinAt(p, out) {
  out.copy(SKIN);
  const front = sstep(-0.1, 0.35, p.z);
  // beard shadow: upper lip, chin, jaw
  const jaw = sstep(0.12, -0.05, p.y) * sstep(-0.75, -0.45, p.y) * front * (1 - sstep(0.5, 0.68, Math.abs(p.x)));
  const lipBand = Math.exp(-((p.y + 0.13) ** 2) / 0.0012) * Math.exp(-(p.x ** 2) / 0.03) * sstep(0.6, 0.8, p.z);
  out.lerp(STUBBLE, jaw * 0.75 * (1 - lipBand));
  out.lerp(LIP, lipBand * 0.5);
  return out;
}

const tmp = new THREE.Vector3();
export function scalpStyle(root, n, dir) {
  const th = azim(root), sx = Math.sign(root.x) || 1, r = Math.random;
  const frontW = 1 - sstep(0.7, 1.5, th);
  const backW = sstep(1.9, 2.6, th);
  const topW = sstep(1.0, 1.22, root.y);
  // front: up, back and fanning outward; sides: back and up; nape: down
  const front = tmp.set(sx * (0.25 + 0.5 * Math.min(1, th)), 0.55, -1);
  const side = new THREE.Vector3(sx * 0.1, 0.5, -1);
  const down = new THREE.Vector3(sx * 0.1, -1, -0.25);
  const top = new THREE.Vector3(sx * 0.35, 0.1, -1);
  const w = (1 - topW);
  const v = new THREE.Vector3()
    .addScaledVector(front, frontW * w)
    .addScaledVector(side, (1 - frontW) * (1 - backW) * w)
    .addScaledVector(down, backW * w)
    .addScaledVector(top, topW);
  v.x += (r() - 0.5) * 0.5; v.y += (r() - 0.5) * 0.4;
  dir.copy(v).addScaledVector(n, -v.dot(n)).normalize();
  const lowBack = backW * (1 - sstep(0.4, 0.9, root.y));
  return {
    length: (0.45 * frontW + 0.27 * (1 - frontW)) * (1 - 0.4 * lowBack) * (0.8 + r() * 0.4),
    lift: 0.6 * frontW + 0.22 * (1 - frontW) - 0.1 * lowBack,
    gravity: 0.06 + 0.25 * lowBack,
    wave: 0.45 + r() * 0.35,
    cling: 0.75 + 0.6 * (1 - frontW),
  };
}

// facial hair, roots found by raycasting the face from the front
export function facialStrands(castFront) {
  const out = [], r = Math.random;
  for (let i = 0; i < 340; i++) {
    const sx = i % 2 ? 1 : -1, u = r();
    const x = sx * (0.07 + u * 0.36);
    // furrowed brow: inner heads raised and pinched, outer tails dropping
    const yc = 0.565 + 0.03 * Math.sin(Math.min(1, u * 1.6) * Math.PI) - 0.07 * u * u + 0.02 * (1 - u);
    const y = yc + (r() - 0.5) * 0.045 * (1 - 0.5 * u);
    const hit = castFront(x, y); if (!hit) continue;
    const up = 0.9 * (1 - sstep(0, 0.35, u)) - 0.25 * sstep(0.6, 1, u);
    out.push({ root: hit.point, n: hit.n, dir: new THREE.Vector3(sx, up + (r() - 0.5) * 0.3, 0), len: 0.05 + r() * 0.04, group: 1, w: 0.3, lift: 0.08, wave: 0.1 });
  }
  for (let i = 0; i < 560; i++) {
    const sx = i % 2 ? 1 : -1, u = r();
    const y = 0.035 - 0.12 * r();
    const half = 0.1 + 0.16 * sstep(0.04, -0.09, y);
    const x = sx * u * half;
    const hit = castFront(x, y); if (!hit || hit.point.z < 0.6) continue;
    const a = Math.abs(x) / 0.26;
    out.push({ root: hit.point, n: hit.n, dir: new THREE.Vector3(sx * (0.2 + 0.9 * a), -1, 0.15), len: 0.07 + r() * 0.05 + 0.05 * a, group: 2, w: 0.34, lift: 0.18, wave: 0.15 });
  }
  return out;
}

// eyebrows / moustache: physics locked, coarse resample, single card per strand
export const GROUPS = [
  { name: 'شعر الرأس', color: '#2ee6a0' },
  { name: 'الحواجب', color: '#4c6ef5', lockPhys: true, card: { perGuide: 1, fill: 0, fly: 0, segs: 4, noise: 0.2, twist: 0.2 } },
  { name: 'الشارب', color: '#9775fa', lockPhys: true, card: { perGuide: 1, fill: 0, fly: 0, segs: 4, noise: 0.3, twist: 0.3 } },
];

export const PARAMS = {
  type: 1, perGuide: 2, width: 0.07, widthVar: 0.35, taper: 0.4, rootW: 0.65, spread: 0.8, fan: 0.6, twist: 0.45, noise: 0.5,
  layerGap: 0.007, fill: 2, fly: 0.35, segs: 10, vol: 0.6, curve: 0.4, uvVar: 0.6, centerLift: 0, count: 600, minDist: 0.018,
  rootColor: '#100a07', tipColor: '#2c1d14', texAmt: 0.75, origAmt: 0, spec1: '#9c8a7a', exp1: 140, sh1: -0.08, spec2: '#4a3022', exp2: 30, sh2: 0.18,
  specAmt: 0.45, sss: 0.06, ao: 0.65, aoLen: 0.4, cut: 0.32, rootFade: 0.03, tipFade: 0.3, exposure: 0.95, showMask: false, showGuides: false,
};

// the sculpt has open eye sockets; fill them with simple eyeballs
export function makeEyes() {
  const g = new THREE.SphereGeometry(0.078, 48, 32).rotateX(Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const sclera = new THREE.Color('#c9b9aa'), iris = new THREE.Color('#4a2c1a'), ring = new THREE.Color('#1d120c'), pupil = new THREE.Color('#050404'), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const a = Math.acos(Math.min(1, pos.getZ(i) / 0.078));
    c.copy(sclera).multiplyScalar(0.85 + 0.15 * Math.cos(a))
      .lerp(ring, sstep(0.56, 0.5, a)).lerp(iris, sstep(0.5, 0.44, a)).lerp(pupil, sstep(0.2, 0.17, a));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0 });
  const grp = new THREE.Group();
  for (const sx of [-1, 1]) {
    const e = new THREE.Mesh(g, mat);
    e.position.set(sx * 0.226, 0.418, 0.588);
    e.rotation.set(-0.04, sx * -0.06, 0);
    grp.add(e);
  }
  return grp;
}
