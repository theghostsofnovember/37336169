// Bundled reference head (MaleHead.obj) + eyeballs for its open sockets.
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MALE_HEAD_OBJ } from './maleHead.js';
import { bakeImported } from './head.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const CENTER = new THREE.Vector3(0, 0.5, 0.02);

export function loadPortraitHead() {
  const r = bakeImported(new OBJLoader().parse(MALE_HEAD_OBJ));
  r.center = CENTER.clone();
  return r;
}

// The sculpt has open, wide eye sockets: an elliptical eyeball fills the opening and a dark
// backing hides the hollow head interior around it.
export const EYE = { r: 0.088, sx: 1.22, x: 0.226, y: 0.42, z: 0.585, yaw: 0.08, pitch: 0.07, iris: 0.5, pupil: 0.17 };
export function makeEyes(opts = {}) {
  const E = { ...EYE, ...opts };
  const g = new THREE.SphereGeometry(1, 96, 64).rotateX(Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const sclera = new THREE.Color('#c8b6a6'), vein = new THREE.Color('#c79a8c'), irisIn = new THREE.Color('#2a160c'), irisOut = new THREE.Color('#5a3418');
  const limbus = new THREE.Color('#120a06'), pupil = new THREE.Color('#030303'), c = new THREE.Color(), ic = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const rho = z > 0 ? Math.hypot(x * E.sx, y) : 2, phi = Math.atan2(y, x * E.sx);
    // sclera: darker toward the corners and under the upper lid, faint veins at the sides
    c.copy(sclera).lerp(vein, 0.35 * sstep(0.45, 0.95, Math.abs(x)) * (0.6 + 0.4 * Math.sin(phi * 9)))
      .multiplyScalar((0.55 + 0.45 * sstep(-0.2, 0.9, z)) * (1 - 0.3 * sstep(0.1, 0.8, y)));
    const streak = 0.5 + 0.5 * Math.sin(phi * 41 + 2.3 * Math.sin(phi * 7));
    ic.copy(irisIn).lerp(irisOut, sstep(E.pupil, E.iris, rho) * (0.5 + 0.5 * streak));
    ic.lerp(limbus, sstep(E.iris - 0.08, E.iris, rho));
    c.lerp(ic, sstep(E.iris + 0.015, E.iris - 0.01, rho)).lerp(pupil, sstep(E.pupil + 0.015, E.pupil - 0.01, rho));
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.04, metalness: 0 });
  const backMat = new THREE.MeshStandardMaterial({ color: '#3d211b', roughness: 0.9 });
  const backGeo = new THREE.SphereGeometry(1, 32, 16);
  const grp = new THREE.Group();
  for (const side of [-1, 1]) {
    const e = new THREE.Mesh(g, mat);
    e.scale.set(E.r * E.sx, E.r, E.r);
    e.position.set(side * E.x, E.y, E.z);
    e.rotation.set(E.pitch, side * E.yaw, 0);
    const back = new THREE.Mesh(backGeo, backMat);
    back.scale.set(E.r * 1.95, E.r * 1.35, E.r * 0.6);
    back.position.set(side * E.x, E.y, E.z - E.r * 0.3);
    grp.add(e, back);
  }
  return grp;
}
