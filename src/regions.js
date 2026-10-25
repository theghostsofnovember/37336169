// Head segmentation + follicle (growth) and styling direction fields.
// Everything is evaluated in "reference space" = the bundled MaleHead.obj after normalisation;
// other heads are mapped into it by a similarity transform (computeFrame / toRef).
import * as THREE from 'three';

export const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const lerpTable = (tab, x) => {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return tab[tab.length - 1][1];
};

export const REG = { SKIN: 0, FRONT: 1, TOP: 2, CROWN: 3, SIDES: 4, BACK: 5, NAPE: 6, SIDEBURN: 7, BROW: 8, MOUS: 9, BEARD: 10, NECK: 11 };
export const REGION_INFO = [
  ['الجلد', '#b8a598'], ['المقدمة', '#ff6b6b'], ['الأعلى', '#ffa94d'], ['التاج (الدوامة)', '#ffd43b'], ['الجانبان', '#69db7c'],
  ['الخلف', '#38d9a9'], ['القفا', '#4dabf7'], ['السوالف', '#748ffc'], ['الحواجب', '#da77f2'], ['الشارب', '#f783ac'], ['اللحية', '#a9e34b'], ['الرقبة', '#66d9e8'],
];
export const isScalp = (id) => id >= 1 && id <= 7;

/* ---------------- frame ---------------- */
export const REF = { c: new THREE.Vector3(0, 0.4125, 0.1298), R: 0.8875 }; // = computeFrame(MaleHead.obj)
export function computeFrame(meshes) {
  let top = -Infinity;
  for (const m of meshes) { const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) top = Math.max(top, a.getY(i)); }
  const step = 0.025, nb = 400, hw = new Float32Array(nb).fill(-1);
  for (const m of meshes) {
    const a = m.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) { const b = Math.floor((top - a.getY(i)) / step); if (b >= 0 && b < nb) hw[b] = Math.max(hw[b], Math.abs(a.getX(i))); }
  }
  let best = 0, by = top;
  for (let b = 0; b < nb; b++) {
    if (hw[b] < 0) continue;
    const yy = top - (b + 0.5) * step;
    if (hw[b] > best) { best = hw[b]; by = yy; } else if (best > 0 && hw[b] < 0.75 * best && top - yy > 1.2 * best) break;
  }
  const R = Math.max(1e-3, top - by);
  let zmin = Infinity, zmax = -Infinity, xmin = Infinity, xmax = -Infinity;
  for (const m of meshes) {
    const a = m.geometry.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const y = a.getY(i); if (y < by - 0.2 * R || y > by + 0.6 * R) continue;
      zmin = Math.min(zmin, a.getZ(i)); zmax = Math.max(zmax, a.getZ(i)); xmin = Math.min(xmin, a.getX(i)); xmax = Math.max(xmax, a.getX(i));
    }
  }
  return { c: new THREE.Vector3((xmin + xmax) / 2, by, (zmin + zmax) / 2), R };
}
export const toRef = (p, F, out) => out.copy(p).sub(F.c).multiplyScalar(REF.R / F.R).add(REF.c);
export const fromRef = (q, F, out) => out.copy(q).sub(REF.c).multiplyScalar(F.R / REF.R).add(F.c);

/* ---------------- regions ---------------- */
const azim = (p) => Math.atan2(Math.abs(p.x), p.z - 0.05);
const HAIRLINE = [[0, 0.9], [0.3, 0.88], [0.55, 0.8], [0.8, 0.74], [1.05, 0.64], [1.22, 0.55], [1.32, 0.53], [1.42, 0.55], [1.5, 0.6], [1.95, 0.6], [2.15, 0.36], [2.5, 0.12], [3.15, -0.02]];
const JAW = [[0, -0.62], [0.6, -0.56], [1.0, -0.44], [1.3, -0.32], [1.5, -0.26]];
const CHEEK = [[0, -0.02], [0.2, -0.02], [0.32, 0.05], [0.45, 0.19], [0.55, 0.34], [0.7, 0.4]];

export function hairlineY(th, o) {
  let h = lerpTable(HAIRLINE, th);
  h += o.recede * 0.3 * (1 - sstep(0.1, 1.2, th));
  h += o.recede * 0.14 * Math.exp(-((th - 0.75) ** 2) / 0.05);
  h += o.napeUp * 0.55 * sstep(1.9, 2.8, th);
  // natural irregularity so the line never reads as a cut edge
  h += (0.011 * Math.sin(th * 19 + 0.7) + 0.006 * Math.sin(th * 37 + 2.1)) * (1 - sstep(1.6, 2.0, th));
  return h;
}
// signed height above the hairline (ref units): <0 skin, >0 hair
export const hairEdge = (p, o) => p.y - hairlineY(azim(p), o);
const browY = (u) => 0.565 + 0.03 * Math.sin(Math.min(1, u * 1.6) * Math.PI) - 0.07 * u * u + 0.02 * (1 - u);

const res = { id: 0, w: 0 };
const ret = (id, w) => { res.id = id; res.w = w; return res; };
export function regionAt(p, o) {
  const th = azim(p), ax = Math.abs(p.x), y = p.y;
  const h = hairlineY(th, o);
  const ws = sstep(h - 0.035, h + 0.03, y);
  if (ws > 0.01 && y > -0.25) {
    let id;
    if (th < 0.75 && y < h + 0.28) id = REG.FRONT;
    else if (th < 1.9) id = y > 0.98 || th < 0.75 ? REG.TOP : REG.SIDES;
    else id = y > 0.88 ? REG.CROWN : y > 0.35 ? REG.BACK : REG.NAPE;
    return ret(id, ws);
  }
  const sbBand = sstep(1.1, 1.18, th) * (1 - sstep(1.42, 1.48, th));
  if (sbBand > 0.01 && y > h - o.sideburn - 0.02) return ret(REG.SIDEBURN, sbBand * sstep(h - o.sideburn - 0.02, h - o.sideburn + 0.015, y));
  if (th > 1.5) return ret(REG.SKIN, 0);
  // PBR eyebrow / moustache layers replace the built-in shapes
  if (o.pbrField) { const f = o.pbrField(p); if (f) return ret(f.id, f.w); }
  if (!o.pbrBrowOn && p.z > 0.4 && ax > 0.04 && ax < 0.47 && y > 0.4) {
    const u = Math.min(1, Math.max(0, (ax - 0.07) / 0.36)), half = 0.024 * (1 - 0.45 * u) * o.browThick, d = Math.abs(y - browY(u));
    if (d < half + 0.01) return ret(REG.BROW, sstep(half + 0.01, half - 0.006, d) * sstep(0.045, 0.075, ax) * (1 - sstep(0.43, 0.465, ax)));
  }
  if (!o.pbrMousOn && p.z > 0.58 && y < 0.04 && y > -0.09) {
    const half = 0.1 + 0.16 * sstep(0.04, -0.09, y);
    if (ax < half + 0.01) return ret(REG.MOUS, sstep(half + 0.01, half - 0.02, ax) * sstep(0.045, 0.02, y));
  }
  if (p.z > 0.66 && ax < 0.17 && y <= -0.09 && y > -0.2) return ret(REG.SKIN, 0); // lips
  const top = lerpTable(CHEEK, ax) - o.beardCheek * 0.15;
  if (y < top && th < 1.48) {
    const jaw = lerpTable(JAW, th), wt = sstep(top + 0.005, top - 0.03, y);
    if (y >= jaw) return ret(REG.BEARD, wt);
    const depth = 0.06 + 0.32 * o.beardNeck;
    if (th < 1.35 && y > jaw - depth - 0.03) return ret(REG.NECK, wt * sstep(jaw - depth - 0.03, jaw - depth + 0.02, y));
  }
  return ret(REG.SKIN, 0);
}

// beard shape mask on top of BEARD / NECK regions
export function beardShape(p, id, o) {
  if (id !== REG.BEARD && id !== REG.NECK) return 0;
  const ax = Math.abs(p.x);
  switch (o.beard) {
    case 'none': return 0;
    case 'goatee': return id === REG.BEARD ? sstep(0.2, 0.15, ax) * sstep(-0.06, -0.12, p.y) : 0;
    case 'chinstrap': return id === REG.BEARD ? sstep(lerpTable(JAW, azim(p)) + 0.13, lerpTable(JAW, azim(p)) + 0.09, p.y) : 0;
    default: return 1;
  }
}

/* ---------------- direction fields ---------------- */
const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
const tangent = (v, n) => { v.addScaledVector(n, -v.dot(n)); const l = v.length(); if (l > 1e-6) v.multiplyScalar(1 / l); return l > 1e-6; };
const rot = (v, n, a) => { tmp2.crossVectors(n, v); return v.multiplyScalar(Math.cos(a)).addScaledVector(tmp2, Math.sin(a)); };

// natural follicle direction: radial spiral from the crown whorl, converging nape, downward sideburns, facial patterns
export function follicleDir(p, n, id, o, out) {
  const ax = Math.abs(p.x), sx = Math.sign(p.x) || 1, th = azim(p);
  if (isScalp(id)) {
    const W = tmp.set(o.whorlX, 1.12, -0.42);
    out.copy(p).sub(W);
    const d = out.length();
    if (!tangent(out, n)) out.set(0, 0, 1);
    rot(out, n, -o.swirl * 1.4 * Math.exp(-d / 0.33));
    out.x -= sx * 0.55 * sstep(0.45, 0.05, p.y) * sstep(1.9, 2.6, th);
    const sb = sstep(1.0, 1.22, th) * (1 - sstep(1.5, 1.75, th)) * sstep(0.8, 0.55, p.y);
    out.lerp(tmp.set(0, -1, 0.2), sb);
  } else if ((id === REG.BROW || id === REG.MOUS) && o.pbrDir && o.pbrDir(p, id, out)) {
    // direction from the PBR layer's strand field
  } else if (id === REG.BROW) {
    const u = Math.min(1, Math.max(0, (ax - 0.07) / 0.36));
    out.set(sx, 0.9 * (1 - sstep(0, 0.35, u)) - 0.25 * sstep(0.6, 1, u), 0);
  } else if (id === REG.MOUS) {
    const a = ax / 0.26; out.set(sx * (0.2 + 0.9 * a), -1, 0.15);
  } else if (id === REG.BEARD) {
    out.set(-sx * 0.12 * sstep(0.3, 0.1, ax), -1, 0.3 * sstep(0.6, 0.2, ax));
  } else if (id === REG.NECK) {
    out.set(-sx * 0.3, -0.5, 0.5);
  } else out.set(0, -1, 0);
  if (!tangent(out, n)) out.set(0, -1, 0);
  return out;
}

// fade / taper: 1 = full hair, 0 = skin; crown, sides, back, nape and sideburns
export function fadeMul(p, id, o) {
  if (!o.fade || !(id >= 3 && id <= 7)) return 1;
  const f = sstep(o.fadeLo, o.fadeHi, p.y);
  return 1 - o.fade * (1 - f);
}

export const partX = (o) => ({ center: 0, left: 0.27, right: -0.27 }[o.part] ?? null);

// styling direction (where the hair is combed to); facial hair keeps its follicle direction
export function styleDir(p, n, id, o, fol, out) {
  if (!isScalp(id)) return out.copy(fol);
  const th = azim(p), sx = Math.sign(p.x) || 1, y = p.y;
  const backW = sstep(1.85, 2.5, th), frontW = 1 - sstep(0.7, 1.5, th), topW = sstep(0.95, 1.2, y);
  const xp = partX(o), side = xp === null ? sx : Math.sign(p.x - xp) || 1;
  switch (o.style) {
    case 'natural': out.copy(fol); break;
    case 'up': {
      const f = tmp.set(sx * (0.25 + 0.5 * Math.min(1, th)), 0.55, -1);
      out.set(0, 0, 0).addScaledVector(f, frontW * (1 - topW))
        .addScaledVector(tmp2.set(sx * 0.1, 0.5, -1), (1 - frontW) * (1 - backW) * (1 - topW))
        .addScaledVector(tmp2.set(sx * 0.1, -1, -0.25), backW * (1 - topW));
      out.add(tmp.set(sx * 0.35, 0.1, -1).multiplyScalar(topW));
      break;
    }
    case 'back': out.set(sx * 0.12, 0.25, -1).lerp(tmp.set(sx * 0.05, -1, -0.3), backW * (1 - topW)); break;
    case 'forward': out.set(sx * 0.1, -0.25, 1).lerp(tmp.set(sx * 0.3, -1, 0.35), (1 - topW) * (1 - frontW) * (1 - backW)).lerp(tmp.set(0, -1, 0.1), backW * (1 - topW)); break;
    case 'side': out.set(side, -0.1, -0.25 - 0.4 * backW).lerp(tmp.set(side * 0.2, -1, -0.3), (1 - topW) * 0.6); break;
    case 'down': out.set(side * 0.9, -0.35, -0.15).lerp(tmp.set(0, -1, -0.15), 1 - topW); break;
    case 'afro': out.copy(n).add(tmp.set(0, 0.25, 0)); break;
    default: out.copy(fol);
  }
  if (o.style !== 'afro' && !tangent(out, n)) out.copy(fol);
  return out.normalize();
}
