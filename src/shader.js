import * as THREE from 'three';

const vert = /* glsl */ `
attribute vec3 tangent; attribute vec4 aAux; attribute vec2 aCol; attribute vec3 aTint;
varying vec3 vTint;
varying vec2 vUv; varying vec4 vAux; varying vec2 vCol; varying vec3 vW; varying vec3 vN; varying vec3 vT;
void main(){
  vUv = uv; vAux = aAux; vCol = aCol; vTint = aTint;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vT = normalize(mat3(modelMatrix) * tangent);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const frag = /* glsl */ `
uniform sampler2D tAlpha; uniform sampler2D tColor;
uniform vec3 rootCol, tipCol, spec1Col, spec2Col, skyCol, gndCol;
uniform vec3 lDir[3]; uniform vec3 lCol[3];
uniform float texAmt, origAmt, exp1, exp2, sh1, sh2, specAmt, sssAmt, aoAmt, aoLen, cut, rootFade, tipFade, gradA, gradB, alphaMode, showAO;
varying vec3 vTint;
varying vec2 vUv; varying vec4 vAux; varying vec2 vCol; varying vec3 vW; varying vec3 vN; varying vec3 vT;
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
  vec4 tx = texture2D(tAlpha, vUv);
  float ch = vAux.w;
  float a = ch < 0.5 ? tx.r : (ch < 1.5 ? tx.g : tx.b);
  float t = vAux.x;
  a *= smoothstep(0.0, rootFade + 1e-4, t);
  float tipCut = 1.0 - tipFade * hash(vec2(floor(vUv.x * 700.0), 1.7));
  a *= 1.0 - smoothstep(tipCut - tipFade * 0.5, tipCut + 1e-3, t);
  float aa = 1.0;
  if (alphaMode < 0.5) { aa = clamp((a - cut) / max(fwidth(a), 1e-4) + 0.5, 0.0, 1.0); if (aa < 0.02) discard; }
  else { if (a < cut * (0.4 + 1.2 * hash(gl_FragCoord.xy))) discard; }

  vec3 ct = texture2D(tColor, vCol).rgb;
  float lum = dot(ct, vec3(0.333));
  vec3 base = mix(rootCol, tipCol, smoothstep(gradA, gradB, t));
  vec3 albedo = mix(base * mix(1.0, lum * 3.0, texAmt), ct, origAmt) * vTint;

  vec3 N = normalize(vN), T = normalize(vT), V = normalize(cameraPosition - vW);
  float nz = (lum - 0.3) * 0.6;
  float layerK = mix(0.72, 1.0, vAux.y * 0.5);
  float ao = mix(1.0 - aoAmt, 1.0, smoothstep(0.0, aoLen + 1e-4, t)) * layerK;
  vec3 diff = vec3(0.0), spec = vec3(0.0), sss = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec3 L = normalize(lDir[i]);
    float nl = dot(N, L);
    float wrap = clamp(nl * 0.5 + 0.5, 0.0, 1.0);
    float tl = dot(T, L);
    float kk = sqrt(max(0.0, 1.0 - tl * tl));
    diff += lCol[i] * kk * (0.3 + 0.7 * wrap);
    vec3 H = normalize(L + V);
    vec3 T1 = normalize(T + N * (sh1 + nz)), T2 = normalize(T + N * (sh2 + nz * 1.5));
    float d1 = dot(T1, H), d2 = dot(T2, H);
    float s1 = pow(sqrt(max(0.0, 1.0 - d1 * d1)), exp1);
    float s2 = pow(sqrt(max(0.0, 1.0 - d2 * d2)), exp2);
    float m = smoothstep(-0.25, 0.45, nl);
    spec += lCol[i] * m * (spec1Col * s1 + spec2Col * s2 * 0.6);
    sss += lCol[i] * pow(clamp(dot(-L, V), 0.0, 1.0), 3.0) * (1.0 - wrap * 0.5);
  }
  vec3 amb = mix(gndCol, skyCol, N.y * 0.5 + 0.5);
  vec3 col = albedo * (diff * 0.32 + amb) * ao + spec * specAmt * ao * 0.22 + albedo * sss * sssAmt * 0.4;
  if (showAO > 0.5) col = vec3(ao);
  gl_FragColor = vec4(col, aa);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function makeHairMaterial(tAlpha, tColor) {
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const m = new THREE.ShaderMaterial({
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.DoubleSide,
    alphaToCoverage: true,
    uniforms: {
      tAlpha: { value: tAlpha }, tColor: { value: tColor },
      rootCol: { value: new THREE.Color() }, tipCol: { value: new THREE.Color() },
      spec1Col: { value: new THREE.Color() }, spec2Col: { value: new THREE.Color() },
      skyCol: { value: new THREE.Color() }, gndCol: { value: new THREE.Color() },
      lDir: { value: [v3(0, 1, 0), v3(0, 1, 0), v3(0, 1, 0)] },
      lCol: { value: [new THREE.Color(), new THREE.Color(), new THREE.Color()] },
      texAmt: { value: 0.6 }, origAmt: { value: 0 }, exp1: { value: 90 }, exp2: { value: 24 },
      sh1: { value: -0.1 }, sh2: { value: 0.2 }, specAmt: { value: 1 }, sssAmt: { value: 0.3 },
      aoAmt: { value: 0.6 }, aoLen: { value: 0.35 }, cut: { value: 0.35 }, rootFade: { value: 0.03 }, tipFade: { value: 0.25 },
      gradA: { value: 0.0 }, gradB: { value: 1.0 }, alphaMode: { value: 0 }, showAO: { value: 0 },
    },
  });
  return m;
}
