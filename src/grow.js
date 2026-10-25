import * as THREE from 'three';
import { N } from './hair.js';

const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const v = new THREE.Vector3(), r = new THREE.Vector3(), tgt = new THREE.Vector3(), tmp = new THREE.Vector3(), p = new THREE.Vector3();

// o: root, n, follicle, style, len, lift, rootBend, gravity, cling, wave, waveFreq, curlR, curlFreq, frizz, center, R (head radius), outward
export function growStrand(o, collider) {
  const pts = new Float32Array(N * 3), step = o.len / (N - 1), c = o.center, R = o.R;
  p.copy(o.root).addScaledVector(o.n, o.sink ?? 0.003);
  pts[0] = p.x; pts[1] = p.y; pts[2] = p.z;
  v.copy(o.follicle).multiplyScalar(1 - Math.min(0.9, o.lift)).addScaledVector(o.n, Math.min(0.9, o.lift)).normalize();
  const ph = Math.random() * 6.283, ph2 = Math.random() * 6.283;
  for (let i = 1; i < N; i++) {
    const t = i / (N - 1), s = t * o.len;
    r.copy(p).sub(c); const dist = r.length(); r.multiplyScalar(1 / (dist || 1));
    // near the skull the hair follows the surface; below it, it falls freely
    const near = sstep(c.y - 0.95 * R, c.y - 0.35 * R, p.y) * sstep(1.9 * R, 1.2 * R, dist);
    const b = sstep(0, o.rootBend, t);
    tgt.copy(o.follicle).lerp(o.style, b);
    if (!o.outward) { tmp.copy(r).multiplyScalar(tgt.dot(r) * near); tgt.sub(tmp); }
    if (tgt.lengthSq() < 1e-8) tgt.copy(o.style);
    tgt.normalize();
    tgt.addScaledVector(r, (o.lift * (1 - t) * 1.3 - o.cling * t * 0.7) * near);
    tgt.y -= o.gravity * (0.25 + t) * (o.outward ? 0.3 : 1);
    tgt.normalize();
    v.lerp(tgt, 0.3 + 0.45 * b).normalize();
    tmp.crossVectors(v, r).normalize();
    v.addScaledVector(tmp, Math.sin(s * o.waveFreq * 6.283 + ph) * o.wave * 0.45);
    if (o.frizz) v.addScaledVector(tmp.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), o.frizz * t);
    v.normalize();
    p.addScaledVector(v, step);
    collider.push(p, 0.012);
    pts[i * 3] = p.x; pts[i * 3 + 1] = p.y; pts[i * 3 + 2] = p.z;
  }
  if (o.curlR > 0) curl(pts, o, ph2, collider);
  return pts;
}

const T = new THREE.Vector3(), B = new THREE.Vector3(), O = new THREE.Vector3(), q = new THREE.Vector3();
function curl(pts, o, ph, collider) {
  const src = pts.slice();
  let s = 0;
  for (let i = 1; i < N; i++) {
    const a = Math.max(0, i - 1) * 3, b = Math.min(N - 1, i + 1) * 3, k = i * 3;
    s += Math.hypot(src[k] - src[k - 3], src[k + 1] - src[k - 2], src[k + 2] - src[k - 1]);
    T.set(src[b] - src[a], src[b + 1] - src[a + 1], src[b + 2] - src[a + 2]).normalize();
    r.set(src[k], src[k + 1], src[k + 2]).sub(o.center).normalize();
    B.crossVectors(T, r); if (B.lengthSq() < 1e-8) B.set(1, 0, 0); B.normalize();
    O.crossVectors(B, T).normalize();
    const env = o.curlR * sstep(0, 0.18, i / (N - 1)), phi = ph + s * o.curlFreq * 6.283;
    q.set(src[k], src[k + 1], src[k + 2]).addScaledVector(B, Math.cos(phi) * env).addScaledVector(O, Math.sin(phi) * env);
    collider.push(q, 0.012);
    pts[k] = q.x; pts[k + 1] = q.y; pts[k + 2] = q.z;
  }
}
