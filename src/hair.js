import * as THREE from 'three';

export const N = 14;
export const MAX_GUIDES = 3000;

export const CARD_TYPES = [
  { name: 'خصلات شاردة ناعمة (A1)', ch: 0, u0: 0.03, u1: 0.225, vRoot: 0.91, vTip: 0.04 },
  { name: 'خصلة متموجة (A2)', ch: 0, u0: 0.295, u1: 0.475, vRoot: 0.91, vTip: 0.04 },
  { name: 'خصلة ناعمة مستقيمة (A3)', ch: 0, u0: 0.54, u1: 0.72, vRoot: 0.91, vTip: 0.04 },
  { name: 'خصلة سميكة (A4)', ch: 0, u0: 0.8, u1: 0.975, vRoot: 0.91, vTip: 0.04 },
  { name: 'ملساء كثيفة (B1)', ch: 1, u0: 0.06, u1: 0.23, vRoot: 0.9, vTip: 0.07 },
  { name: 'ناعمة رفيعة (B2)', ch: 1, u0: 0.275, u1: 0.455, vRoot: 0.9, vTip: 0.07 },
  { name: 'خصلة مدببة (B3)', ch: 1, u0: 0.485, u1: 0.685, vRoot: 0.07, vTip: 0.96 },
  { name: 'شعيرات متفرقة (B4)', ch: 1, u0: 0.775, u1: 0.925, vRoot: 0.07, vTip: 0.88 },
];

const fract = (x) => x - Math.floor(x);
export const rnd = (seed, k) => fract(Math.sin(seed * 127.1 + k * 311.7) * 43758.5453);
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function newGuide(pts, normal, type, layer) {
  const g = { pts, normal: normal.clone(), type, layer, wScale: 1, seed: Math.random() * 1000, seg: new Float32Array(N - 1) };
  computeSeg(g);
  return g;
}
export function computeSeg(g) {
  for (let i = 1; i < N; i++) {
    const a = (i - 1) * 3, b = i * 3;
    g.seg[i - 1] = Math.hypot(g.pts[b] - g.pts[a], g.pts[b + 1] - g.pts[a + 1], g.pts[b + 2] - g.pts[a + 2]);
  }
}
export function enforceLengths(g, pts = g.pts) {
  for (let i = 1; i < N; i++) {
    const a = (i - 1) * 3, b = i * 3;
    let dx = pts[b] - pts[a], dy = pts[b + 1] - pts[a + 1], dz = pts[b + 2] - pts[a + 2];
    const l = Math.hypot(dx, dy, dz) || 1, k = g.seg[i - 1] / l;
    pts[b] = pts[a] + dx * k; pts[b + 1] = pts[a + 1] + dy * k; pts[b + 2] = pts[a + 2] + dz * k;
  }
}

const tmp = new THREE.Vector3();
export function genGuide(root, normal, dir, length, P, collider) {
  const pts = new Float32Array(N * 3);
  const step = length / (N - 1);
  const p = root.clone().addScaledVector(normal, 0.004);
  pts.set([p.x, p.y, p.z], 0);
  const v = dir.clone().multiplyScalar(1 - P.lift).addScaledVector(normal, P.lift).normalize();
  const phase = Math.random() * 6.28, freq = 0.6 + Math.random() * 0.5;
  for (let i = 1; i < N; i++) {
    const tt = i / (N - 1);
    v.y -= P.gravity * 0.2 * (0.4 + tt);
    tmp.crossVectors(v, normal).normalize();
    v.addScaledVector(tmp, Math.sin(i * freq + phase) * P.wave * 0.3);
    v.normalize();
    const prev = p.clone();
    p.addScaledVector(v, step);
    collider.push(p, 0.014);
    pts.set([p.x, p.y, p.z], i * 3);
    v.copy(p).sub(prev).normalize();
  }
  return pts;
}

export function resamplePolyline(poly) {
  const out = new Float32Array(N * 3);
  const cum = [0];
  for (let i = 1; i < poly.length; i++) cum.push(cum[i - 1] + poly[i].distanceTo(poly[i - 1]));
  const total = cum[cum.length - 1] || 1e-6;
  let j = 0;
  for (let i = 0; i < N; i++) {
    const d = (i / (N - 1)) * total;
    while (j < poly.length - 2 && cum[j + 1] < d) j++;
    const seg = cum[j + 1] - cum[j] || 1e-6;
    const t = Math.min(1, Math.max(0, (d - cum[j]) / seg));
    tmp.lerpVectors(poly[j], poly[j + 1], t);
    out.set([tmp.x, tmp.y, tmp.z], i * 3);
  }
  return out;
}

export function neighbours(guides, K = 4) {
  const n = guides.length, res = new Array(n);
  for (let i = 0; i < n; i++) {
    const best = [];
    const a = guides[i].pts;
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const b = guides[j].pts;
      const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
      if (best.length < K || d < best[best.length - 1][0]) {
        best.push([d, j]); best.sort((x, y) => x[0] - y[0]); if (best.length > K) best.pop();
      }
    }
    res[i] = best.map((x) => x[1]);
  }
  return res;
}

function catmull(pts, u, out) {
  let i = Math.min(N - 2, Math.max(0, Math.floor(u)));
  const t = u - i, t2 = t * t, t3 = t2 * t;
  const i0 = Math.max(0, i - 1) * 3, i1 = i * 3, i2 = (i + 1) * 3, i3 = Math.min(N - 1, i + 2) * 3;
  for (let k = 0; k < 3; k++) {
    const p0 = pts[i0 + k], p1 = pts[i1 + k], p2 = pts[i2 + k], p3 = pts[i3 + k];
    out[k] = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
  }
}

export class CardBuilder {
  constructor() {
    this.cap = 0;
    this.geo = new THREE.BufferGeometry();
    this.nv = 0; this.ni = 0;
    this.scratch = [];
    this.C = new Float32Array(40 * 3); this.T = new Float32Array(40 * 3);
    this.O = new Float32Array(40 * 3); this.B = new Float32Array(40 * 3);
  }
  ensure(nv) {
    if (nv <= this.cap) return;
    this.cap = Math.ceil(nv * 1.4) + 256;
    const c = this.cap, mk = (n) => { const a = new THREE.BufferAttribute(new Float32Array(c * n), n); a.setUsage(THREE.DynamicDrawUsage); return a; };
    this.pos = mk(3); this.nor = mk(3); this.uv = mk(2); this.tan = mk(3); this.aux = mk(4); this.acol = mk(2); this.col = mk(3);
    this.idx = new THREE.BufferAttribute(new Uint32Array(c * 3), 1);
    this.idx.setUsage(THREE.DynamicDrawUsage);
    const g = this.geo;
    g.setAttribute('position', this.pos); g.setAttribute('normal', this.nor); g.setAttribute('uv', this.uv);
    g.setAttribute('tangent', this.tan); g.setAttribute('aAux', this.aux); g.setAttribute('aCol', this.acol); g.setAttribute('color', this.col);
    g.setIndex(this.idx);
  }

  // ctx: { getPts(g), getNormal(g, out), center: Vector3, neigh, types }
  build(guides, P, ctx) {
    const S = P.segs, K = P.perGuide, fillN = P.fill;
    const items = [];
    let si = 0;
    const virtualPts = () => this.scratch[si] || (this.scratch[si] = new Float32Array(N * 3));
    for (let gi = 0; gi < guides.length; gi++) {
      const g = guides[gi];
      items.push({ pts: ctx.getPts(g), g, n: ctx.getNormal(g), seed: g.seed });
      if (fillN > 0 && ctx.neigh[gi] && ctx.neigh[gi].length) {
        for (let f = 0; f < fillN; f++) {
          const nbIdx = ctx.neigh[gi][f % ctx.neigh[gi].length];
          const nb = guides[nbIdx];
          if (!nb) continue;
          const t = 0.25 + 0.5 * rnd(g.seed, f + 5);
          const a = ctx.getPts(g), b = ctx.getPts(nb), out = virtualPts(); si++;
          for (let i = 0; i < N * 3; i++) out[i] = a[i] + (b[i] - a[i]) * t;
          items.push({ pts: out, g, n: ctx.getNormal(g), seed: g.seed + (f + 1) * 17.31 });
        }
      }
    }
    const maxCards = items.length * (K + 1);
    this.ensure(maxCards * (S + 1) * 2);
    const { pos, nor, uv, tan, aux, acol, col, idx } = this;
    const types = ctx.types;
    const rc = P.rootColor, tc = P.tipColor;
    const cr = new THREE.Color(rc), ct = new THREE.Color(tc), cc = new THREE.Color();
    let nv = 0, ni = 0;
    const { C, T, O, B } = this;
    const hc = ctx.center;
    const tmpP = [0, 0, 0];
    for (const it of items) {
      const pts = it.pts, g = it.g, seed = it.seed, rn = it.n;
      for (let j = 0; j <= S; j++) { catmull(pts, (j / S) * (N - 1), tmpP); C[j * 3] = tmpP[0]; C[j * 3 + 1] = tmpP[1]; C[j * 3 + 2] = tmpP[2]; }
      for (let j = 0; j <= S; j++) {
        const a = Math.max(0, j - 1) * 3, b = Math.min(S, j + 1) * 3, j3 = j * 3;
        let x = C[b] - C[a], y = C[b + 1] - C[a + 1], z = C[b + 2] - C[a + 2];
        let l = Math.hypot(x, y, z) || 1; x /= l; y /= l; z /= l;
        T[j3] = x; T[j3 + 1] = y; T[j3 + 2] = z;
        const t = j / S;
        let hx = C[j3] - hc.x, hy = C[j3 + 1] - hc.y, hz = C[j3 + 2] - hc.z;
        l = Math.hypot(hx, hy, hz) || 1; hx /= l; hy /= l; hz /= l;
        const w = 0.35 * (1 - t);
        let ox = hx + (rn.x - hx) * w, oy = hy + (rn.y - hy) * w, oz = hz + (rn.z - hz) * w;
        l = Math.hypot(ox, oy, oz) || 1; ox /= l; oy /= l; oz /= l;
        let bx = y * oz - z * oy, by = z * ox - x * oz, bz = x * oy - y * ox;
        l = Math.hypot(bx, by, bz);
        if (l < 1e-4) { bx = 1; by = 0; bz = 0; l = 1; }
        bx /= l; by /= l; bz /= l;
        O[j3] = ox; O[j3 + 1] = oy; O[j3 + 2] = oz; B[j3] = bx; B[j3 + 1] = by; B[j3 + 2] = bz;
      }
      const nCards = K + (rnd(seed, 99) < P.fly ? 1 : 0);
      for (let c = 0; c < nCards; c++) {
        const fly = c >= K;
        const typ = types[fly ? 0 : g.type] || types[0];
        const r1 = rnd(seed, c * 7 + 1), r2 = rnd(seed, c * 7 + 2), r3 = rnd(seed, c * 7 + 3), r4 = rnd(seed, c * 7 + 4), r5 = rnd(seed, c * 7 + 5);
        const W = P.width * g.wScale * (1 + (r1 - 0.5) * 2 * P.widthVar) * (fly ? 1.5 : 1);
        const off = fly ? (r2 - 0.5) * 2.2 : (c - (K - 1) / 2) * P.spread * (0.9 + 0.2 * r2);
        const lift = (g.layer - 1) * P.layerGap + (c % 2) * 0.0015 + (fly ? 0.004 : 0);
        const uwF = 1 - P.uvVar * r3 * 0.5;
        const uw = (typ.u1 - typ.u0) * uwF;
        const us = typ.u0 + (typ.u1 - typ.u0) * (1 - uwF) * r4;
        const ua = r5 < 0.5 ? us : us + uw, ub = r5 < 0.5 ? us + uw : us;
        const fB = 4 + r3 * 4, fO = 3 + r2 * 4, ph = r4 * 6.283, ph2 = r5 * 6.283;
        const base = nv;
        for (let j = 0; j <= S; j++) {
          const t = j / S, j3 = j * 3;
          const tx = T[j3], ty = T[j3 + 1], tz = T[j3 + 2];
          let bx = B[j3], by = B[j3 + 1], bz = B[j3 + 2];
          const ox = O[j3], oy = O[j3 + 1], oz = O[j3 + 2];
          const nzB = P.noise * 0.05 * t * Math.sin(t * fB + ph);
          const nzO = P.noise * 0.02 * t * Math.sin(t * fO + ph2);
          const lat = off * W * (1 + P.fan * t) + nzB;
          const ang = P.twist * 0.8 * Math.sin(t * 3 + seed * 0.7 + c) * t, ca = Math.cos(ang), sa = Math.sin(ang);
          const bxr = bx * ca + ox * sa, byr = by * ca + oy * sa, bzr = bz * ca + oz * sa;
          const cx = C[j3] + bx * lat + ox * (lift + nzO), cy = C[j3 + 1] + by * lat + oy * (lift + nzO), cz = C[j3 + 2] + bz * lat + oz * (lift + nzO);
          const wid = W * (1 + (P.taper - 1) * Math.pow(t, 1.6)) * (P.rootW + (1 - P.rootW) * sstep(0, 0.15, t)) * 0.5;
          let nx = byr * tz - bzr * ty, ny = bzr * tx - bxr * tz, nz = bxr * ty - byr * tx;
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          nx += (ox - nx) * P.vol; ny += (oy - ny) * P.vol; nz += (oz - nz) * P.vol;
          const vv = typ.vRoot + (typ.vTip - typ.vRoot) * t;
          cc.copy(cr).lerp(ct, sstep(0, 1, t)).multiplyScalar(0.72 + 0.14 * g.layer);
          for (let s = 0; s < 2; s++) {
            const sg = s === 0 ? -1 : 1, k = nv;
            pos.setXYZ(k, cx + bxr * wid * sg, cy + byr * wid * sg, cz + bzr * wid * sg);
            let ax = nx + bxr * P.curve * sg, ay = ny + byr * P.curve * sg, az = nz + bzr * P.curve * sg;
            const al = Math.hypot(ax, ay, az) || 1;
            nor.setXYZ(k, ax / al, ay / al, az / al);
            uv.setXY(k, s === 0 ? ua : ub, vv);
            tan.setXYZ(k, tx, ty, tz);
            aux.setXYZW(k, t, g.layer, r1, typ.ch);
            acol.setXY(k, r5 + (s === 0 ? 0 : 0.18), t * 0.8 + r1);
            col.setXYZ(k, cc.r, cc.g, cc.b);
            nv++;
          }
          if (j < S) {
            const a = base + j * 2;
            idx.setX(ni++, a); idx.setX(ni++, a + 1); idx.setX(ni++, a + 2);
            idx.setX(ni++, a + 1); idx.setX(ni++, a + 3); idx.setX(ni++, a + 2);
          }
        }
      }
    }
    this.nv = nv; this.ni = ni;
    for (const a of [pos, nor, uv, tan, aux, acol, col, idx]) a.needsUpdate = true;
    this.geo.setDrawRange(0, ni);
    return { cards: nv / ((S + 1) * 2), tris: ni / 3 };
  }
}
