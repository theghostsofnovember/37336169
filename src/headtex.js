// Auto UV unwrap + baked head texture (skin + directional scalp/beard hair base) to hide gaps between cards.
import * as THREE from 'three';
import { toRef, regionAt, follicleDir, beardShape, isScalp, REG, REGION_INFO, sstep, fadeMul } from './regions.js';

// Azimuthal-equidistant unwrap around the head's up axis: one seamless island, least distortion on the scalp.
export function computeUVs(meshes, F) {
  const d = new THREE.Vector3();
  for (const m of meshes) {
    const pos = m.geometry.attributes.position, uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      d.fromBufferAttribute(pos, i).sub(F.c).normalize();
      const polar = Math.acos(Math.max(-1, Math.min(1, d.y))), phi = Math.atan2(d.x, d.z), r = (polar / Math.PI) * 0.49;
      uv[i * 2] = 0.5 + r * Math.sin(phi); uv[i * 2 + 1] = 0.5 + r * Math.cos(phi);
    }
    m.geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
}

const hash = (x, y, z) => {
  let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), fx), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), fx), fy),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), fx), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), fx), fy), fz);
}
// streaky noise stretched along the follicle direction
function streak(q, d, F) {
  const k = (q.x * d.x + q.y * d.y + q.z * d.z) * F, c = k * 0.1;
  const px = q.x * F - d.x * k + d.x * c, py = q.y * F - d.y * k + d.y * c, pz = q.z * F - d.z * k + d.z * c;
  const a = vnoise(px, py, pz), b = vnoise(q.x * 22 + 7, q.y * 22 + 3, q.z * 22 + 1);
  return Math.min(1, sstep(0.3, 0.85, a) * 0.8 + b * 0.35);
}

// short hair stubs: one jittered stub per 3D cell, elongated along the follicle, present with probability ~ density
function stipple(q, d, F, dens) {
  const x = q.x * F, y = q.y * F, z = q.z * F, xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let best = 0;
  for (let dx = -1; dx <= 0; dx++) for (let dy = -1; dy <= 0; dy++) for (let dz = -1; dz <= 0; dz++) {
    const cx = xi + dx + (x - xi > 0.5 ? 1 : 0), cy = yi + dy + (y - yi > 0.5 ? 1 : 0), cz = zi + dz + (z - zi > 0.5 ? 1 : 0);
    if (hash(cx, cy, cz + 911) > dens * 0.88 + 0.1) continue;
    const ox = cx + hash(cx, cy, cz) - x, oy = cy + hash(cx + 7, cy, cz) - y, oz = cz + hash(cx, cy + 3, cz) - z;
    const al = ox * d.x + oy * d.y + oz * d.z, px = ox - al * d.x, py = oy - al * d.y, pz = oz - al * d.z;
    const r2 = (al * al) / 0.25 + (px * px + py * py + pz * pz) / 0.07;
    if (r2 < 1) best = Math.max(best, 1 - r2);
  }
  return Math.min(1, best * 2.2);
}

const LIP = new THREE.Color('#9c5a4c'), BLUSH = new THREE.Color('#b0645a');
function skinAt(q, base, out) {
  out.copy(base);
  const ax = Math.abs(q.x);
  const lip = Math.exp(-((q.y + 0.135) ** 2) / 0.0014) * sstep(0.17, 0.1, ax) * sstep(0.62, 0.75, q.z);
  const cheek = Math.exp(-((ax - 0.36) ** 2 + (q.y - 0.18) ** 2) / 0.02) * sstep(0.2, 0.5, q.z);
  const ear = sstep(1.35, 1.55, Math.atan2(ax, q.z - 0.05)) * sstep(0.1, 0.25, q.y) * sstep(0.7, 0.55, q.y);
  out.lerp(BLUSH, cheek * 0.18 + ear * 0.15);
  out.lerp(LIP, lip * 0.55);
  return out;
}

export function hairDensity(q, mk, reg, o) {
  const id = reg.id;
  if (isScalp(id)) return mk * o.scalpTex;
  if (id === REG.BROW) return o.brows === 'none' || o.pbrBrowOn ? 0 : reg.w * 0.85;
  if (id === REG.MOUS) return o.mous === 'none' || o.pbrMousOn ? 0 : reg.w * (o.mous === 'thin' ? 0.45 : 0.75);
  if (id === REG.BEARD || id === REG.NECK) return o.beard === 'none' ? 0 : reg.w * beardShape(q, id, o) * (o.beard === 'stubble' ? 0.42 : 0.8) * (id === REG.NECK ? 0.7 : 1);
  return 0;
}

// THREE.Color works in linear space; the canvas texture is sRGB
const s8 = (x) => 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055);
const lin2s = (c, D, i) => { D[i] = s8(c.r); D[i + 1] = s8(c.g); D[i + 2] = s8(c.b); D[i + 3] = 255; };

export function bakeHeadTexture(meshes, F, o, size) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(size, size), D = img.data, filled = new Uint8Array(size * size);
  const skin = new THREE.Color(o.skin), hair = new THREE.Color(o.hairRoot), c = new THREE.Color(), hc = new THREE.Color();
  const P = new THREE.Vector3(), Nn = new THREE.Vector3(), q = new THREE.Vector3(), dir = new THREE.Vector3();
  const FREQ = 150 * (size / 2048);
  for (const m of meshes) {
    const pos = m.geometry.attributes.position.array, nor = m.geometry.attributes.normal.array, uv = m.geometry.attributes.uv.array, mk = m.userData.mask;
    const idx = m.geometry.index ? m.geometry.index.array : null, nt = idx ? idx.length / 3 : pos.length / 9;
    for (let t = 0; t < nt; t++) {
      const i0 = idx ? idx[t * 3] : t * 3, i1 = idx ? idx[t * 3 + 1] : t * 3 + 1, i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      const x0 = uv[i0 * 2] * size, y0 = (1 - uv[i0 * 2 + 1]) * size, x1 = uv[i1 * 2] * size, y1 = (1 - uv[i1 * 2 + 1]) * size, x2 = uv[i2 * 2] * size, y2 = (1 - uv[i2 * 2 + 1]) * size;
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (Math.abs(area) < 1e-9) continue;
      const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2))), maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1, x2)));
      const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2))), maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1, y2)));
      if ((maxX - minX) * (maxY - minY) > size * size * 0.02) continue; // degenerate wrap near the antipode
      for (let py = minY; py <= maxY; py++) for (let px = minX; px <= maxX; px++) {
        const k = py * size + px; if (filled[k]) continue;
        const sx = px + 0.5, sy = py + 0.5;
        const w1 = ((sx - x0) * (y2 - y0) - (x2 - x0) * (sy - y0)) / area, w2 = ((x1 - x0) * (sy - y0) - (sx - x0) * (y1 - y0)) / area, w0 = 1 - w1 - w2;
        if (w0 < -0.002 || w1 < -0.002 || w2 < -0.002) continue;
        P.set(pos[i0 * 3] * w0 + pos[i1 * 3] * w1 + pos[i2 * 3] * w2, pos[i0 * 3 + 1] * w0 + pos[i1 * 3 + 1] * w1 + pos[i2 * 3 + 1] * w2, pos[i0 * 3 + 2] * w0 + pos[i1 * 3 + 2] * w1 + pos[i2 * 3 + 2] * w2);
        Nn.set(nor[i0 * 3] * w0 + nor[i1 * 3] * w1 + nor[i2 * 3] * w2, nor[i0 * 3 + 1] * w0 + nor[i1 * 3 + 1] * w1 + nor[i2 * 3 + 1] * w2, nor[i0 * 3 + 2] * w0 + nor[i1 * 3 + 2] * w1 + nor[i2 * 3 + 2] * w2).normalize();
        toRef(P, F, q);
        const reg = regionAt(q, o);
        skinAt(q, skin, c);
        const dens = Math.min(1, hairDensity(q, mk[i0] * w0 + mk[i1] * w1 + mk[i2] * w2, reg, o));
        const fm = isScalp(reg.id) ? fadeMul(q, reg.id, o) : 1;
        if (fm < 0.999 && dens > 0.003) {
          // faded zone: individual follicle stipple whose density follows the fade
          follicleDir(q, Nn, reg.id, o, dir);
          const dot = stipple(q, dir, 115 * Math.min(1, size / 2048), fm);
          c.multiplyScalar(1 - (0.06 + 0.55 * fm * fm) * dens);
          hc.copy(hair).multiplyScalar(0.8);
          c.lerp(hc, Math.min(1, dot * dens * (0.75 + 0.25 * fm)));
        } else if (dens > 0.003) {
          follicleDir(q, Nn, reg.id, o, dir);
          const s = streak(q, dir, FREQ);
          c.multiplyScalar(1 - 0.4 * dens);
          hc.copy(hair).multiplyScalar(0.6 + 0.7 * s);
          c.lerp(hc, Math.min(1, dens * (0.45 + 0.6 * s)));
        }
        if (o.pbrComposite) o.pbrComposite(q, c);
        lin2s(c, D, k * 4); filled[k] = 1;
      }
    }
  }
  // pad islands so mip-mapping never pulls in empty texels
  for (let pass = 0; pass < 6; pass++) {
    const nf = filled.slice();
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const k = y * size + x; if (filled[k]) continue;
      for (const o2 of [-1, 1, -size, size]) if (filled[k + o2]) { D.copyWithin(k * 4, (k + o2) * 4, (k + o2) * 4 + 4); nf[k] = 1; break; }
    }
    filled.set(nf);
  }
  for (let k = 0; k < size * size; k++) if (!filled[k]) lin2s(skin, D, k * 4);
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function checkerCanvas() {
  const s = 1024, cv = document.createElement('canvas'); cv.width = cv.height = s;
  const g = cv.getContext('2d'), n = 16;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    g.fillStyle = `hsl(${(x / n) * 300},55%,${(x + y) % 2 ? 62 : 42}%)`; g.fillRect((x * s) / n, (y * s) / n, s / n, s / n);
  }
  g.fillStyle = '#fff'; g.font = 'bold 18px monospace';
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) g.fillText(String.fromCharCode(65 + y) + x, (x * s) / n + 6, (y * s) / n + 24);
  return cv;
}

export function regionColors(meshes, F, o) {
  const q = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), base = new THREE.Color(REGION_INFO[0][1]);
  const cols = REGION_INFO.map((r) => new THREE.Color(r[1]));
  for (const m of meshes) {
    const pos = m.geometry.attributes.position, out = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      toRef(p.fromBufferAttribute(pos, i), F, q);
      const r = regionAt(q, o);
      c.copy(base).lerp(cols[r.id], r.id ? 0.25 + 0.75 * r.w : 0);
      out.set([c.r, c.g, c.b], i * 3);
    }
    m.userData.regionColors = out;
  }
}
