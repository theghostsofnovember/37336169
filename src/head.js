import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const CLAY = new THREE.Color(0.62, 0.55, 0.5);
export const skin = { color: null };
const WHITE = new THREE.Color(1, 1, 1);
export const MASK_COLOR = new THREE.Color(0.85, 0.28, 0.32);

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const gauss = (d2, s) => Math.exp(-d2 / s);

export function makeProceduralHead() {
  const g = new THREE.SphereGeometry(1, 192, 144);
  const pos = g.attributes.position;
  const d = new THREE.Vector3();
  const ear = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    let { x, y, z } = d;
    let px = x * 0.78, py = y, pz = z * 0.92;
    const jaw = Math.pow(Math.max(0, -y), 1.4);
    px *= 1 - 0.2 * jaw; pz *= 1 - 0.22 * jaw + (z > 0 ? 0.08 * jaw : 0); py *= 1 + 0.1 * jaw;
    const sq = (a, b, c) => (x - a) ** 2 + (y - b) ** 2 + (z - c) ** 2;
    pz += gauss(sq(0, -0.14, 1), 0.012) * 0.17 * (z > 0 ? 1 : 0);
    pz += gauss(sq(0, 0.12, 0.99), 0.05) * 0.035;
    pz -= (gauss(sq(0.3, 0.1, 0.93), 0.012) + gauss(sq(-0.3, 0.1, 0.93), 0.012)) * 0.05;
    pz += gauss(sq(0, -0.5, 0.86), 0.01) * 0.02;
    ear.set(Math.sign(x), -0.05, -0.05);
    px += Math.sign(x) * gauss(sq(ear.x, ear.y, ear.z), 0.03) * 0.13;
    pos.setXYZ(i, px, py, pz);
  }
  g.computeVertexNormals();
  const neck = new THREE.CylinderGeometry(0.36, 0.42, 1.3, 56, 14, true);
  neck.translate(0, -1.55, -0.12);
  const meshes = [g, neck].map((geo) => makePaintable(geo));
  const mask = meshes[0].userData.mask;
  const p = new THREE.Vector3();
  for (let i = 0; i < mask.length; i++) {
    p.fromBufferAttribute(meshes[0].geometry.attributes.position, i).normalize();
    const hair = p.y > 0.12 && p.z < 0.36 + 1.1 * Math.max(0, p.y - 0.5) + 0.12 * p.y;
    mask[i] = hair ? 1 : 0;
  }
  refreshMaskColors(meshes[0]);
  return { meshes, center: new THREE.Vector3(0, 0, -0.02) };
}

export function makePaintable(geo) {
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, side: THREE.DoubleSide })
  );
  mesh.userData.mask = new Float32Array(n);
  refreshMaskColors(mesh);
  return mesh;
}

export function refreshMaskColors(mesh, show = true) {
  const m = mesh.userData.mask, c = mesh.geometry.attributes.color;
  const vc = mesh.userData.viewColors, white = mesh.userData.textured;
  const base = vc || (white ? null : mesh.userData.base);
  const B = white ? WHITE : skin.color || CLAY;
  for (let i = 0; i < m.length; i++) {
    const k = show ? m[i] * 0.55 : 0;
    const r = base ? base[i * 3] : B.r, g = base ? base[i * 3 + 1] : B.g, b = base ? base[i * 3 + 2] : B.b;
    c.setXYZ(i, r + (MASK_COLOR.r - r) * k, g + (MASK_COLOR.g - g) * k, b + (MASK_COLOR.b - b) * k);
  }
  c.needsUpdate = true;
}

export function bakeImported(root) {
  root.updateWorldMatrix(true, true);
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const geo = o.geometry.clone();
    geo.applyMatrix4(o.matrixWorld);
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal'].includes(k)) geo.deleteAttribute(k);
    if (geo.index === null && geo.attributes.position.count > 400000) return;
    let g2 = mergeVertices(geo.deleteAttribute('normal'), 1e-5);
    // low-poly sculpt exports: smooth + densify so shading, masking and collision behave
    while (g2.attributes.position.count < 12000) g2 = loopSubdivide(g2);
    g2.computeVertexNormals();
    meshes.push(makePaintable(g2));
  });
  if (!meshes.length) return null;
  const box = new THREE.Box3();
  meshes.forEach((m) => box.expandByObject(m));
  const size = box.getSize(new THREE.Vector3());
  const s = 2.6 / Math.max(size.x, size.y, size.z);
  const c = box.getCenter(new THREE.Vector3());
  const body = size.y > 1.7 * size.x;
  const m = new THREE.Matrix4().makeTranslation(-c.x * s, -c.y * s, -c.z * s).multiply(new THREE.Matrix4().makeScale(s, s, s));
  meshes.forEach((me) => { me.geometry.applyMatrix4(m); me.geometry.computeBoundingBox(); });
  const nb = new THREE.Box3();
  meshes.forEach((me) => nb.expandByObject(me));
  const nsize = nb.getSize(new THREE.Vector3());
  const center = new THREE.Vector3(0, body ? nb.max.y - nsize.y * 0.07 : 0, 0);
  return { meshes, center };
}

export class Collider {
  constructor(meshes, cell = 0.1) {
    this.cell = cell;
    this.map = new Map();
    const P = [], Nn = [];
    for (const m of meshes) {
      const pa = m.geometry.attributes.position, na = m.geometry.attributes.normal;
      for (let i = 0; i < pa.count; i++) {
        const idx = P.length / 3;
        P.push(pa.getX(i), pa.getY(i), pa.getZ(i));
        Nn.push(na.getX(i), na.getY(i), na.getZ(i));
        const k = this.key(Math.floor(pa.getX(i) / cell), Math.floor(pa.getY(i) / cell), Math.floor(pa.getZ(i) / cell));
        let l = this.map.get(k);
        if (!l) this.map.set(k, (l = []));
        l.push(idx);
      }
    }
    this.P = new Float32Array(P);
    this.N = new Float32Array(Nn);
  }
  key(x, y, z) { return (x + 512) * 1048576 + (y + 512) * 1024 + (z + 512); }
  push(p, margin) {
    const c = this.cell, ix = Math.floor(p.x / c), iy = Math.floor(p.y / c), iz = Math.floor(p.z / c);
    let best = -1, bd = 1e9;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const l = this.map.get(this.key(ix + dx, iy + dy, iz + dz));
      if (!l) continue;
      for (let q = 0; q < l.length; q++) {
        const j = l[q] * 3;
        const ex = p.x - this.P[j], ey = p.y - this.P[j + 1], ez = p.z - this.P[j + 2];
        const dd = ex * ex + ey * ey + ez * ez;
        if (dd < bd) { bd = dd; best = j; }
      }
    }
    if (best < 0 || bd > c * c * 2.2) return false;
    const nx = this.N[best], ny = this.N[best + 1], nz = this.N[best + 2];
    const s = (p.x - this.P[best]) * nx + (p.y - this.P[best + 1]) * ny + (p.z - this.P[best + 2]) * nz;
    if (s >= margin) return false;
    const k = margin - s;
    p.x += nx * k; p.y += ny * k; p.z += nz * k;
    return true;
  }
}

export { sstep };

export function loopSubdivide(geo) {
  const P = geo.attributes.position.array, I = geo.index.array, nv = P.length / 3, nf = I.length / 3;
  const edges = new Map(), nbr = Array.from({ length: nv }, () => new Set());
  const ek = (a, b) => (a < b ? a * nv + b : b * nv + a);
  for (let f = 0; f < nf; f++) for (let e = 0; e < 3; e++) {
    const a = I[f * 3 + e], b = I[f * 3 + ((e + 1) % 3)], c = I[f * 3 + ((e + 2) % 3)];
    const k = ek(a, b); let E = edges.get(k);
    if (!E) edges.set(k, (E = { a, b, opp: [], id: -1 }));
    E.opp.push(c); nbr[a].add(b); nbr[b].add(a);
  }
  const boundary = new Uint8Array(nv);
  for (const E of edges.values()) if (E.opp.length !== 2) boundary[E.a] = boundary[E.b] = 1;
  const out = new Float32Array((nv + edges.size) * 3);
  for (let v = 0; v < nv; v++) {
    const ns = [...nbr[v]], n = ns.length;
    let sx = 0, sy = 0, sz = 0, w, cnt = 0;
    if (boundary[v]) {
      for (const u of ns) { const E = edges.get(ek(u, v)); if (E.opp.length !== 2) { sx += P[u * 3]; sy += P[u * 3 + 1]; sz += P[u * 3 + 2]; cnt++; } }
      if (cnt !== 2) { out.set([P[v * 3], P[v * 3 + 1], P[v * 3 + 2]], v * 3); continue; }
      out.set([0.75 * P[v * 3] + 0.125 * sx, 0.75 * P[v * 3 + 1] + 0.125 * sy, 0.75 * P[v * 3 + 2] + 0.125 * sz], v * 3); continue;
    }
    for (const u of ns) { sx += P[u * 3]; sy += P[u * 3 + 1]; sz += P[u * 3 + 2]; }
    w = n === 3 ? 3 / 16 : 3 / (8 * n);
    out.set([(1 - n * w) * P[v * 3] + w * sx, (1 - n * w) * P[v * 3 + 1] + w * sy, (1 - n * w) * P[v * 3 + 2] + w * sz], v * 3);
  }
  let id = nv;
  for (const E of edges.values()) {
    E.id = id;
    for (let k = 0; k < 3; k++) {
      out[id * 3 + k] = E.opp.length === 2
        ? 0.375 * (P[E.a * 3 + k] + P[E.b * 3 + k]) + 0.125 * (P[E.opp[0] * 3 + k] + P[E.opp[1] * 3 + k])
        : 0.5 * (P[E.a * 3 + k] + P[E.b * 3 + k]);
    }
    id++;
  }
  const idx = new Uint32Array(nf * 12);
  for (let f = 0; f < nf; f++) {
    const a = I[f * 3], b = I[f * 3 + 1], c = I[f * 3 + 2];
    const ab = edges.get(ek(a, b)).id, bc = edges.get(ek(b, c)).id, ca = edges.get(ek(c, a)).id;
    idx.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], f * 12);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
