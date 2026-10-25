// Region-aware hair generation: roots sampled per head region, grown along follicle → style fields.
import * as THREE from 'three';
import { toRef, regionAt, follicleDir, styleDir, beardShape, isScalp, REG, REF, fadeMul, hairEdge, sstep } from './regions.js';
import { growStrand } from './grow.js';

function sampler(meshes, F, o) {
  const tris = [], q = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m3 = new THREE.Vector3();
  for (const m of meshes) {
    const pos = m.geometry.attributes.position, idx = m.geometry.index, nt = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < nt; t++) {
      const i0 = idx ? idx.getX(t * 3) : t * 3, i1 = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, i2 = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
      let tags = 0;
      for (const p of [a, b, c, m3.copy(a).add(b).add(c).multiplyScalar(1 / 3)]) tags |= 1 << regionAt(toRef(p, F, q), o).id;
      if (tags === 1) continue;
      tris.push({ m, i0, i1, i2, tags, area: b.clone().sub(a).cross(c.clone().sub(a)).length() * 0.5 });
    }
  }
  return tris;
}

function sampleRoots(tris, F, o, ids, count, minDist, weight) {
  let bits = 0; ids.forEach((i) => { bits |= 1 << i; });
  const cand = tris.filter((t) => t.tags & bits);
  if (!cand.length || count <= 0) return [];
  const cum = []; let tot = 0; for (const t of cand) { tot += t.area; cum.push(tot); }
  const grid = new Map(), cell = minDist, key = (x, y, z) => `${x},${y},${z}`;
  const near = (p) => {
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell), cz = Math.floor(p.z / cell);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = grid.get(key(cx + dx, cy + dy, cz + dz)); if (!l) continue;
      for (const r of l) if (r.distanceToSquared(p) < minDist * minDist) return true;
    }
    return false;
  };
  const out = [], A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
  for (let tries = 0; out.length < count && tries < count * 40; tries++) {
    const r = Math.random() * tot; let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    const t = cand[lo], pos = t.m.geometry.attributes.position, nor = t.m.geometry.attributes.normal, mk = t.m.userData.mask;
    let u = Math.random(), v = Math.random(); if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    const p = new THREE.Vector3().addScaledVector(A.fromBufferAttribute(pos, t.i0), w).addScaledVector(B.fromBufferAttribute(pos, t.i1), u).addScaledVector(C.fromBufferAttribute(pos, t.i2), v);
    const q = toRef(p, F, new THREE.Vector3()), reg = regionAt(q, o);
    if (!ids.includes(reg.id)) continue;
    const mkv = mk[t.i0] * w + mk[t.i1] * u + mk[t.i2] * v;
    if (Math.random() > weight(reg, q, mkv)) continue;
    if (near(p)) continue;
    const n = new THREE.Vector3().addScaledVector(A.fromBufferAttribute(nor, t.i0), w).addScaledVector(B.fromBufferAttribute(nor, t.i1), u).addScaledVector(C.fromBufferAttribute(nor, t.i2), v).normalize();
    out.push({ p, n, q, id: reg.id, w: reg.w });
    const k = key(Math.floor(p.x / cell), Math.floor(p.y / cell), Math.floor(p.z / cell));
    (grid.get(k) || grid.set(k, []).get(k)).push(p);
  }
  return out;
}

function smoothLengths(roots, L, iters = 2, K = 6) {
  const n = roots.length, nb = new Array(n);
  for (let i = 0; i < n; i++) {
    const best = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const d = roots[i].q.distanceToSquared(roots[j].q);
      if (best.length < K || d < best[best.length - 1][0]) { best.push([d, j]); best.sort((x, y) => x[0] - y[0]); if (best.length > K) best.pop(); }
    }
    nb[i] = best.map((x) => x[1]);
  }
  for (let it = 0; it < iters; it++) {
    const nL = L.slice();
    for (let i = 0; i < n; i++) { let s = 0; for (const j of nb[i]) s += L[j]; if (nb[i].length) nL[i] = 0.5 * L[i] + (0.5 * s) / nb[i].length; }
    L.set(nL);
  }
}

// returns strand specs { pts, n, group, type, layer, w }
export function generateHair({ meshes, F, collider, center }, S, { parts = null } = {}) {
  const want = (k) => !parts || parts.includes(k);
  const s = F.R / REF.R, out = [], tris = sampler(meshes, F, S), rnd = Math.random;
  const fol = new THREE.Vector3(), sty = new THREE.Vector3();
  const grow = (r, len, extra) => {
    follicleDir(r.q, r.n, r.id, S, fol); styleDir(r.q, r.n, r.id, S, fol, sty);
    // at the hairline, start already combed in the style direction (no spike over the forehead)
    const ek = isScalp(r.id) ? 1 - sstep(0.02, 0.14, hairEdge(r.q, S)) : 0;
    if (ek > 0) fol.lerp(sty, (extra && extra.combed ? 1 : 0.8) * ek).normalize();
    return growStrand({
      root: r.p, n: r.n, follicle: fol, style: sty, len: len * s, lift: S.lift, rootBend: S.rootBend, gravity: S.gravity, cling: S.cling,
      wave: S.wave, waveFreq: S.waveFreq / s, curlR: S.curl * 0.04 * s, curlFreq: S.curlFreq / s, frizz: S.frizz, center, R: F.R, outward: S.style === 'afro', ...extra,
    }, collider);
  };
  // scalp + inner layer
  const scalpIds = [1, 2, 3, 4, 5, 6, 7];
  if (want('scalp') && S.count > 0 && S.len > 0) {
    // main cards start just behind the hairline; the edge itself is texture + fine hairs
    const roots = sampleRoots(tris, F, S, scalpIds, S.count, 0.62 * Math.sqrt(3.6 / S.count) * s, (reg, q, mk) => mk * (0.25 + 0.75 * sstep(0.04, 0.12, hairEdge(q, S))) * sstep(0.006, 0.04, hairEdge(q, S)));
    const L = new Float32Array(roots.length);
    roots.forEach((r, i) => { L[i] = S.len * S.reg[r.id - 1] * (1 + (rnd() - 0.5) * 2 * S.lenVar); });
    smoothLengths(roots, L);
    roots.forEach((r, i) => { L[i] *= Math.pow(fadeMul(r.q, r.id, S), 1.6); });
    roots.forEach((r, i) => {
      if (L[i] < 0.012) return;
      const e = hairEdge(r.q, S), edge = 0.35 + 0.65 * sstep(0.01, 0.14, e), ef = sstep(0.02, 0.2, e);
      // hair lies flat at the hairline and only builds volume further back
      out.push({ pts: grow(r, L[i], { lift: S.lift * (0.12 + 0.88 * ef), rootBend: S.rootBend * (0.4 + 0.6 * ef) }), n: r.n, group: 0, type: S.card.type ?? 1, layer: [0, 1, 1, 2][Math.floor(rnd() * 4)], w: (0.85 + rnd() * 0.3) * edge });
      if (rnd() < S.inner && L[i] > 0.05 && r.w > 0.97 && r.id !== REG.FRONT && r.id !== REG.SIDEBURN) out.push({ pts: grow(r, L[i] * 0.55, { lift: S.lift * 0.25, cling: 1, curlR: S.curl * 0.02 * s, gravity: S.gravity * 0.5 }), n: r.n, group: 1, type: 4, layer: 0, w: 0.9 + rnd() * 0.3 });
    });
  }
  const face = (ids, count, minD, weight, len, group, type, extra) => {
    for (const r of sampleRoots(tris, F, S, ids, count, minD * s, weight)) {
      follicleDir(r.q, r.n, r.id, S, fol);
      const l = len(r) * s;
      const pts = growStrand({ root: r.p, n: r.n, follicle: fol, style: fol, len: l, lift: 0.12, rootBend: 0.1, gravity: 0.08, cling: 0.5, wave: 0.08, waveFreq: 8, curlR: 0, curlFreq: 0, frizz: 0.03, center, R: F.R, ...extra }, collider);
      out.push({ pts, n: r.n, group, type, layer: 2, w: 0.8 + rnd() * 0.4 });
    }
  };
  // baby hairs: short, thin, sparse strands straddling the hairline
  if (want('scalp') && S.hairlineFine > 0 && S.count > 0 && S.len > 0 && S.style !== 'afro') {
    const n = Math.round(S.hairlineFine * 240 * Math.min(1.5, S.count / 1000));
    const roots = sampleRoots(tris, F, S, [REG.FRONT, REG.TOP, REG.SIDES, REG.SIDEBURN], n, 0.012 * s, (reg, q, mk) => {
      const e = hairEdge(q, S); return e > -0.03 && e < 0.06 ? sstep(-0.03, 0.01, e) * Math.min(1, mk * 3) : 0;
    });
    for (const r of roots) {
      const fm = fadeMul(r.q, r.id, S), len = Math.min(S.len * S.reg[r.id - 1], 0.06 + 0.06 * rnd()) * fm;
      if (len < 0.015) continue;
      out.push({ pts: grow(r, len, { lift: 0.06, rootBend: 0.12, cling: 0.8, gravity: 0, wave: 0.05, curlR: 0, frizz: 0.015, combed: true }), n: r.n, group: 0, type: 0, layer: 2, w: 0.05 + 0.05 * rnd() });
    }
  }
  if (want('brow') && S.brows !== 'none' && !S.pbrNoBrowCards) {
    const thick = S.brows === 'thick' ? 1.25 : S.brows === 'thin' ? 0.7 : 1;
    face([REG.BROW], Math.round(280 * thick), 0.006, (reg) => reg.w, () => (S.pbrBrowLen ? S.pbrBrowLen * (0.6 + 0.8 * rnd()) : (0.045 + rnd() * 0.035) * thick), 2, 5);
  }
  if (want('mous') && S.mous !== 'none' && !S.pbrNoMousCards) {
    const k = { thin: 0.5, full: 1, chevron: 1.35 }[S.mous] || 1;
    face([REG.MOUS], Math.round(320 * k), 0.006, (reg) => reg.w, (r) => (S.pbrMousLen ? S.pbrMousLen * (0.6 + 0.8 * rnd()) : (0.06 + rnd() * 0.04 + 0.05 * Math.abs(r.q.x) / 0.26) * (0.6 + 0.4 * k)), 3, 5, { lift: 0.18 });
  }
  if (want('beard') && ['short', 'full', 'goatee', 'chinstrap'].includes(S.beard)) {
    const full = S.beard !== 'short';
    face([REG.BEARD, REG.NECK], full ? 900 : 1000, full ? 0.011 : 0.009, (reg, q) => reg.w * beardShape(q, reg.id, S),
      (r) => S.beardLen * (0.7 + 0.6 * rnd()) * (r.id === REG.NECK ? 0.7 : 1), 4, full ? 1 : 5,
      { lift: full ? 0.3 : 0.1, gravity: full ? 0.25 : 0.05, curlR: S.beardCurl * 0.02 * s * (full ? 1 : 0.3), curlFreq: 9 / s, wave: full ? 0.25 : 0.05, cling: full ? 0.2 : 0.6 });
  }
  return out;
}
