// Eyebrow / moustache PBR map generator (ported from "Eyebrow PBR Generator", CPU path) and its
// projection onto the head: texture px <-> reference-head space, so baked maps, the head texture
// and the 3D strand cards all share one shape.
import * as THREE from 'three';

export const TW = 2048, TH = 1024;
export const MAPS = ['Preview', 'Albedo', 'Normal', 'Roughness', 'AO', 'Height', 'Opacity'];
export const PARAMS = [
  ['seed', 'Seed', 1, 9999, 1], ['count', 'عدد الشعيرات', 2000, 24000, 500], ['length', 'الطول', 300, 1300, 10],
  ['thick', 'السماكة', 50, 260, 5], ['arch', 'ارتفاع القوس', 0, 200, 5], ['peak', 'موضع القمة', 0.2, 0.7, 0.01],
  ['tail', 'نزول الذيل', 0, 250, 5], ['taper', 'ترقق الذيل', 0, 1, 0.05], ['slen', 'طول الشعرة', 30, 220, 5],
  ['lift', 'رفع الداخل', 0, 1.4, 0.05], ['curl', 'التجعد', 0, 1, 0.05], ['gray', 'شيب', 0, 0.4, 0.01], ['depth', 'قوة Normal', 0.5, 6, 0.1],
];
const PR = {
  eyebrow: { count: 14000, length: 1000, thick: 125, arch: 90, peak: 0.5, tail: 150, taper: 0.7, slen: 130, lift: 1.1, curl: 0.3 },
  mustache: { count: 14000, length: 520, thick: 85, arch: 0, peak: 0.5, tail: 70, taper: 0.35, slen: 190, lift: 1.15, curl: 0.45 },
};
// where the texture sits on the reference head (ref units; KPX texture px per ref unit at scale 1)
const ANCHOR = { eyebrow: { xc: 0.25, yc: 0.585, zMin: 0.25 }, mustache: { xc: 0.115, yc: 0.03, zMin: 0.5 } };
const KPX = 1000 / 0.36;

export function makeLayer(type) {
  return { type, seed: type === 'eyebrow' ? 7 : 11, gray: 0.08, depth: 2.5, light: 320, strength: 1, useHair: true, color: '#3a2619', mode: 'both', CS: null, scale: 1, dx: 0, dy: 0, rot: 0, ...PR[type] };
}
export const resetShape = (L) => { Object.assign(L, PR[L.type]); L.CS = null; };

const mul = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const canvasPool = {};
const cv = (key, w = TW, h = TH) => { let c = canvasPool[key]; if (!c) { c = canvasPool[key] = document.createElement('canvas'); c.width = w; c.height = h; } return c; };

function splineFn(L) {
  const { length: len, arch, peak, tail } = L;
  const k = Math.log(0.5) / Math.log(peak), x0 = (TW - len) / 2, y0 = TH / 2;
  const CS = L.CS && L.CS.length >= 2 ? L.CS : null;
  if (!CS) return (t) => [x0 + t * len, y0 - arch * Math.sin(Math.PI * Math.pow(Math.max(t, 0), k)) + tail * t ** 4];
  return (t) => {
    const u = Math.min(1, Math.max(0, t)) * (CS.length - 1), i = Math.min(CS.length - 2, u | 0), f = u - i;
    const a = CS[Math.max(0, i - 1)], b = CS[i], c = CS[i + 1], d = CS[Math.min(CS.length - 1, i + 2)];
    const h = (p, q, r, s) => 0.5 * (2 * q + (r - p) * f + (2 * p - 5 * q + 4 * r - s) * f * f + (3 * q - p - 3 * r + s) * f ** 3);
    return [h(a[0], b[0], c[0], d[0]), h(a[1], b[1], c[1], d[1])];
  };
}

export function generate(L, { draft = false, color } = {}) {
  const t0 = performance.now(), W = TW, H = TH, R = mul(L.seed * 7919), G = () => R() + R() - 1, MU = L.type === 'mustache', key = L.type;
  const { thick, taper } = L, sp = splineFn(L);
  const wd = (t) => Math.max(8, thick * (1 - taper * t ** 2.2) * (0.7 + 0.3 * Math.sin(Math.PI * Math.min(t * 1.3, 1))));
  const hex = color || L.color, bc = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16));
  const S = [], n = 10, cnt = draft ? Math.round(L.count * 0.2) : L.count, gr = L.gray, lift = L.lift, curl = L.curl, sl = L.slen;
  for (let i = 0; i < cnt; i++) {
    const t = Math.pow(R(), 0.9) * 0.985, v = Math.max(-1, Math.min(1, G() * 0.9));
    const a = sp(t - 0.01), b = sp(t + 0.01), th = Math.atan2(b[1] - a[1], b[0] - a[0]), p = sp(t), w = wd(t);
    let x = p[0] + -Math.sin(th) * v * w / 2, y = p[1] + Math.cos(th) * v * w / 2;
    let ang = MU ? th + lift * (1 - 0.5 * t) * (0.75 + 0.25 * v) + G() * 0.14 : th - lift * Math.pow(1 - t, 1.6) * (0.6 - 0.4 * v) + v * 0.12 * t + G() * 0.12;
    const Ls = sl * (0.6 + R() * 0.8), ds = Ls / n, cs = R() < 0.5 ? 1 : -1, pts = [[x, y]];
    for (let j = 0; j < n; j++) {
      ang += MU ? (th - ang) * 0.02 + (Math.PI / 2 - ang) * 0.03 + cs * curl * 0.05 * R() : (th - ang) * 0.07 + cs * curl * 0.05 * R();
      x += ds * Math.cos(ang); y += ds * Math.sin(ang); pts.push([x, y]);
    }
    const f = 0.7 + 0.6 * R(), gy = R() < gr;
    const r0 = gy ? [170 + R() * 50, 170 + R() * 50, 165 + R() * 50] : bc.map((c, q) => Math.min(255, c * f * (1.25 + (q == 0 ? 0.15 : 0))));
    const r1 = gy ? r0.map((c) => c * 0.8) : bc.map((c) => c * f * 0.55);
    S.push({ pts, z: R(), w: (MU ? 1.4 : 1) * (0.6 + R() * 1.1), o: 0.3 + 0.7 * R(), r0, r1 });
  }
  S.sort((a, b) => a.z - b.z);
  const box = [1e9, 1e9, -1e9, -1e9];
  for (const s of S) for (const p of s.pts) { box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]); box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]); }

  // software rasterizer (same compositing as the original canvas strokes: source-over albedo/opacity, lighten height)
  const NP = W * H, Af = new Float32Array(NP * 4), Hf = new Float32Array(NP), Mf = new Float32Array(NP);
  const seg = (x1, y1, x2, y2, w, ga, r, g, b, hv) => {
    const hw = w * 0.5 + 0.5, cw = Math.min(1, w);
    const minX = Math.max(0, Math.floor(Math.min(x1, x2) - hw)), maxX = Math.min(W - 1, Math.ceil(Math.max(x1, x2) + hw));
    const minY = Math.max(0, Math.floor(Math.min(y1, y2) - hw)), maxY = Math.min(H - 1, Math.ceil(Math.max(y1, y2) + hw));
    const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1e-6;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5 - x1, py = y + 0.5 - y1;
      let t = (px * dx + py * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - t * dx, ey = py - t * dy, cov = hw - Math.sqrt(ex * ex + ey * ey);
      if (cov <= 0) continue;
      const a = (cov > 1 ? 1 : cov) * cw * ga, i = y * W + x, k = i * 4, ia = 1 - a;
      Af[k] = r * a + Af[k] * ia; Af[k + 1] = g * a + Af[k + 1] * ia; Af[k + 2] = b * a + Af[k + 2] * ia; Af[k + 3] = a + Af[k + 3] * ia;
      const hh = Hf[i]; if (hv > hh) Hf[i] = hh + a * (hv - hh);
      Mf[i] = 255 * a + Mf[i] * ia;
    }
  };
  for (const s of S) {
    const q = s.pts;
    for (let j = 0; j < n; j++) {
      const f = j / n, ga = (1 - 0.6 * f * f) * s.o, w = s.w * (1 - f) + 0.25 * f;
      const hv = (255 * (0.25 + 0.75 * s.z) * (1 - 0.35 * f)) | 0;
      seg(q[j][0], q[j][1], q[j + 1][0], q[j + 1][1], w, ga, (s.r0[0] + (s.r1[0] - s.r0[0]) * f) | 0, (s.r0[1] + (s.r1[1] - s.r0[1]) * f) | 0, (s.r0[2] + (s.r1[2] - s.r0[2]) * f) | 0, hv);
    }
  }
  const cA = cv(key + 'A'), cH = cv(key + 'H'), cM = cv(key + 'M');
  const iA = new ImageData(W, H), iH = new ImageData(W, H), iM = new ImageData(W, H), A = iA.data, Hd = iH.data, M = iM.data;
  for (let i = 0; i < NP; i++) {
    const k = i * 4, al = Af[k + 3];
    if (al > 1e-4) { A[k] = Af[k] / al; A[k + 1] = Af[k + 1] / al; A[k + 2] = Af[k + 2] / al; A[k + 3] = al * 255; }
    Hd[k] = Hd[k + 1] = Hd[k + 2] = Hf[i]; Hd[k + 3] = 255; M[k] = M[k + 1] = M[k + 2] = Mf[i]; M[k + 3] = 255;
  }
  cA.getContext('2d').putImageData(iA, 0, 0); cH.getContext('2d').putImageData(iH, 0, 0); cM.getContext('2d').putImageData(iM, 0, 0);
  const sm = cv(key + 'blurS', W / 16, H / 16), sx = sm.getContext('2d'); sx.imageSmoothingQuality = 'high'; sx.clearRect(0, 0, sm.width, sm.height); sx.drawImage(cM, 0, 0, sm.width, sm.height);
  const bl = cv(key + 'blur'), bx = bl.getContext('2d'); bx.imageSmoothingEnabled = true; bx.drawImage(sm, 0, 0, W, H);
  const B = bx.getImageData(0, 0, W, H).data;
  const cN = cv(key + 'N'), cAO = cv(key + 'AO'), cR = cv(key + 'R');
  const N = new ImageData(W, H), AO = new ImageData(W, H), RO = new ImageData(W, H), sc = L.depth / 60;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, h = Hd[i] / 255, m = M[i] / 255;
    let nx = 0, ny = 0; if (x > 0 && y > 0 && x < W - 1 && y < H - 1) { nx = (Hd[i - 4] - Hd[i + 4]) * sc; ny = (Hd[i + W * 4] - Hd[i - W * 4]) * sc; }
    const l = Math.hypot(nx, ny, 1);
    N.data[i] = (nx / l * 0.5 + 0.5) * 255; N.data[i + 1] = (ny / l * 0.5 + 0.5) * 255; N.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; N.data[i + 3] = 255;
    const ao = m > 0.02 ? 255 * (0.35 + 0.65 * B[i] / 255) * (0.6 + 0.4 * h) : 255, ro = m > 0.02 ? 255 * (0.5 + 0.4 * (1 - h)) : 204;
    AO.data[i] = AO.data[i + 1] = AO.data[i + 2] = ao; AO.data[i + 3] = 255; RO.data[i] = RO.data[i + 1] = RO.data[i + 2] = ro; RO.data[i + 3] = 255;
  }
  cN.getContext('2d').putImageData(N, 0, 0); cAO.getContext('2d').putImageData(AO, 0, 0); cR.getContext('2d').putImageData(RO, 0, 0);

  // low-res copies for projecting onto the head + strand field
  const SW = 512, SH = 256, small = (src, k2) => { const c = cv(key + k2, SW, SH), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.clearRect(0, 0, SW, SH); x.drawImage(src, 0, 0, SW, SH); return x.getImageData(0, 0, SW, SH).data; };
  const sA = small(cA, 'sA'), sAO = small(cAO, 'sAO');
  const FW = 128, FH = 64, fm = cv(key + 'fm', FW, FH), fx = fm.getContext('2d'); fx.imageSmoothingQuality = 'high'; fx.clearRect(0, 0, FW, FH); fx.drawImage(cM, 0, 0, FW, FH);
  const raw = fx.getImageData(0, 0, FW, FH).data, mask = new Float32Array(FW * FH);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    let s2 = 0, c2 = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= FW || yy >= FH) continue; s2 += raw[(yy * FW + xx) * 4]; c2++; }
    mask[y * FW + x] = Math.min(1, (s2 / c2 / 255) * 2.2);
  }
  // growth direction per field cell: nearest spline sample, deterministic version of the strand angle
  const NS = 64, smp = [];
  for (let i = 0; i < NS; i++) { const t = i / (NS - 1), a = sp(t - 0.01), b = sp(t + 0.01), p = sp(t); smp.push([p[0], p[1], Math.atan2(b[1] - a[1], b[0] - a[0]), t]); }
  const dir = new Float32Array(FW * FH * 2);
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) {
    const px = ((x + 0.5) / FW) * W, py = ((y + 0.5) / FH) * H;
    let best = 0, bd = 1e18;
    for (let i = 0; i < NS; i++) { const d = (smp[i][0] - px) ** 2 + (smp[i][1] - py) ** 2; if (d < bd) { bd = d; best = i; } }
    const [, , th, t] = smp[best], ang = MU ? th + lift * (1 - 0.5 * t) * 0.75 : th - lift * Math.pow(1 - t, 1.6) * 0.6;
    dir[(y * FW + x) * 2] = Math.cos(ang); dir[(y * FW + x) * 2 + 1] = Math.sin(ang);
  }
  return {
    type: L.type, ms: performance.now() - t0, strands: S.length, draft, box,
    maps: { Albedo: cA, Height: cH, Opacity: cM, Normal: cN, AO: cAO, Roughness: cR, Preview: cv(key + 'P') },
    A, N: N.data, AOd: AO.data, RO: RO.data, sA, sAO, SW, SH, mask, dir, FW, FH,
  };
}

export function renderPreview(G, light) {
  const W = TW, H = TH, o = new ImageData(W, H), a = (light * Math.PI) / 180, Lx = Math.cos(a) * 0.6, Ly = -Math.sin(a) * 0.6, Lz = 0.55, hl = Math.hypot(Lx, Ly, Lz);
  const lx = Lx / hl, ly = Ly / hl, lz = Lz / hl, hx = lx, hy = ly, hz = lz + 1, hh = Math.hypot(hx, hy, hz), D = G;
  for (let i = 0; i < W * H * 4; i += 4) {
    const px = (i / 4) % W, py = (i / 4 / W) | 0, sk = 0.92 + 0.08 * Math.sin(px * 0.01) * Math.cos(py * 0.013);
    const al = D.A[i + 3] / 255, nx = D.N[i] / 127.5 - 1, ny = D.N[i + 1] / 127.5 - 1, nz = D.N[i + 2] / 127.5 - 1;
    const nd = Math.max(0, nx * lx + ny * ly + nz * lz), nh = Math.max(0, (nx * hx + ny * hy + nz * hz) / hh), ao = D.AOd[i] / 255, spc = 0.35 * Math.pow(nh, 28) * (1 - D.RO[i] / 255);
    for (let c = 0; c < 3; c++) { const scc = [222, 176, 148][c] * sk, hair = D.A[i + c] * (0.3 + 0.9 * nd) * ao + 255 * spc; o.data[i + c] = hair * al + scc * (1 - al); }
    o.data[i + 3] = 255;
  }
  G.maps.Preview.getContext('2d').putImageData(o, 0, 0);
}

/* ---------------- head projection ---------------- */
export function refToPx(q, L, out) {
  const A = ANCHOR[L.type], r = (L.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), k = KPX / L.scale;
  const lx = Math.abs(q.x) - A.xc - L.dx, ly = q.y - A.yc - L.dy;
  out[0] = TW / 2 + (lx * c + ly * s) * k; out[1] = TH / 2 - (-lx * s + ly * c) * k;
  return out;
}
export function pxToRef(px, py, L) {
  const A = ANCHOR[L.type], r = (L.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), k = KPX / L.scale;
  const rx = (px - TW / 2) / k, ry = (TH / 2 - py) / k;
  return { x: rx * c - ry * s + A.xc + L.dx, y: rx * s + ry * c + A.yc + L.dy };
}
const P2 = [0, 0];
function locate(q, L, G) {
  if (q.z < ANCHOR[L.type].zMin) return false;
  refToPx(q, L, P2);
  const b = G.box, m = 4;
  return P2[0] > b[0] - m && P2[0] < b[2] + m && P2[1] > b[1] - m && P2[1] < b[3] + m;
}
function bilerp(arr, w, h, stride, ch, u, v) {
  const x = Math.min(w - 1.001, Math.max(0, u * w - 0.5)), y = Math.min(h - 1.001, Math.max(0, v * h - 0.5)), xi = x | 0, yi = y | 0, fx = x - xi, fy = y - yi;
  const i00 = (yi * w + xi) * stride + ch, i10 = i00 + stride, i01 = i00 + w * stride, i11 = i01 + stride;
  return (arr[i00] * (1 - fx) + arr[i10] * fx) * (1 - fy) + (arr[i01] * (1 - fx) + arr[i11] * fx) * fy;
}
export function fieldW(q, L, G) {
  if (!locate(q, L, G)) return 0;
  return bilerp(G.mask, G.FW, G.FH, 1, 0, P2[0] / TW, P2[1] / TH);
}
// growth direction on the head (tangent-plane projection done by the caller)
export function fieldDir(q, L, G, out) {
  if (!locate(q, L, G)) return false;
  const x = Math.min(G.FW - 1, Math.max(0, ((P2[0] / TW) * G.FW) | 0)), y = Math.min(G.FH - 1, Math.max(0, ((P2[1] / TH) * G.FH) | 0));
  const dxp = G.dir[(y * G.FW + x) * 2], dyp = G.dir[(y * G.FW + x) * 2 + 1];
  const r = (L.rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), rx = dxp, ry = -dyp;
  out.set((Math.sign(q.x) || 1) * (rx * c - ry * s), rx * s + ry * c, 0);
  return true;
}
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const hc = new THREE.Color();
export function composite(q, c, L, G) {
  if (!locate(q, L, G)) return;
  const u = P2[0] / TW, v = P2[1] / TH;
  const a = (bilerp(G.sA, G.SW, G.SH, 4, 3, u, v) / 255) * L.strength;
  if (a < 0.003) return;
  const ao = bilerp(G.sAO, G.SW, G.SH, 4, 0, u, v) / 255;
  hc.setRGB(lin(bilerp(G.sA, G.SW, G.SH, 4, 0, u, v)), lin(bilerp(G.sA, G.SW, G.SH, 4, 1, u, v)), lin(bilerp(G.sA, G.SW, G.SH, 4, 2, u, v))).multiplyScalar(0.55 + 0.45 * ao);
  c.multiplyScalar(1 - 0.25 * Math.min(1, a * 1.5) * (1 - ao)).lerp(hc, Math.min(1, a));
}
