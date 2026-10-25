// Maya/Arnold-style look-dev rig: three-point area lights with colour temperature,
// a skydome (PMREM of a studio with softboxes), raytrace-like soft key shadows
// and light linking of the rim to the hair.
import * as THREE from 'three';

export const LDEF = {
  keyAz: -40, keyEl: 35, keyI: 2.2, keyK: 5600, keySize: 0.4,
  fillAz: 60, fillEl: 10, fillI: 0.5, fillK: 6500,
  rimAz: 175, rimEl: 32, rimI: 1.4, rimK: 7000, rimHairOnly: false,
  ambI: 0.55, skyK: 7000,
  shadows: true, shadowDens: 0.85, hairShadow: 1,
};

const mk = (bg, gnd, v) => ({ bg, gnd, v });
export const LIGHT_PRESETS = {
  portrait: mk(0x141517, 0x2a221d, { keyAz: -35, keyEl: 32, keyI: 2.7, keyK: 4800, keySize: 0.35, fillAz: 55, fillEl: 5, fillI: 0.3, fillK: 7200, rimAz: 155, rimEl: 35, rimI: 2.0, rimK: 7800, ambI: 0.35, skyK: 7000, shadowDens: 0.9 }),
  rembrandt: mk(0x121212, 0x231d19, { keyAz: -50, keyEl: 42, keyI: 2.9, keyK: 5200, keySize: 0.3, fillAz: 60, fillEl: 0, fillI: 0.14, fillK: 6500, rimAz: 170, rimEl: 30, rimI: 0.8, rimK: 6500, ambI: 0.22, skyK: 6000, shadowDens: 0.95 }),
  loop: mk(0x1b1c1f, 0x2e2722, { keyAz: -30, keyEl: 30, keyI: 2.4, keyK: 5600, keySize: 0.5, fillAz: 45, fillEl: 5, fillI: 0.45, fillK: 6500, rimAz: 165, rimEl: 30, rimI: 1.1, rimK: 7000, ambI: 0.45, skyK: 6800, shadowDens: 0.85 }),
  butterfly: mk(0x1d1d20, 0x34302c, { keyAz: 0, keyEl: 45, keyI: 2.4, keyK: 5600, keySize: 0.55, fillAz: 0, fillEl: -12, fillI: 0.5, fillK: 6000, rimAz: 180, rimEl: 40, rimI: 1.1, rimK: 7000, ambI: 0.5, skyK: 6500, shadowDens: 0.8 }),
  split: mk(0x0f1011, 0x1c1916, { keyAz: -90, keyEl: 12, keyI: 2.8, keyK: 5000, keySize: 0.25, fillAz: 90, fillEl: 5, fillI: 0.08, fillK: 7000, rimAz: 160, rimEl: 30, rimI: 0.7, rimK: 7500, ambI: 0.18, skyK: 6500, shadowDens: 1 }),
  rimlit: mk(0x0d0f13, 0x1a1a1d, { keyAz: -125, keyEl: 25, keyI: 1.4, keyK: 6000, keySize: 0.3, fillAz: 30, fillEl: 5, fillI: 0.25, fillK: 6500, rimAz: 155, rimEl: 28, rimI: 3.6, rimK: 8500, ambI: 0.3, skyK: 8000, shadowDens: 0.9 }),
  studio: mk(0x1a1d24, 0x3a342f, { keyAz: -40, keyEl: 35, keyI: 2.2, keyK: 5600, keySize: 0.6, fillAz: 60, fillEl: 10, fillI: 0.7, fillK: 6200, rimAz: 180, rimEl: 35, rimI: 1.4, rimK: 6500, ambI: 0.55, skyK: 6800, shadowDens: 0.75 }),
  maya: mk(0x55585e, 0x3a3a3a, { keyAz: -20, keyEl: 25, keyI: 1.7, keyK: 6500, keySize: 1, fillAz: 50, fillEl: 10, fillI: 0.6, fillK: 6500, rimAz: 180, rimEl: 30, rimI: 0.5, rimK: 6500, ambI: 0.9, skyK: 6500, shadowDens: 0.45 }),
  sun: mk(0x2b3c52, 0x5a4a38, { keyAz: -55, keyEl: 50, keyI: 4.2, keyK: 5400, keySize: 0.08, fillAz: 70, fillEl: 10, fillI: 0.35, fillK: 11000, rimAz: 180, rimEl: 30, rimI: 1.6, rimK: 5600, ambI: 0.6, skyK: 11000, shadowDens: 0.9 }),
  shade: mk(0x2a3140, 0x39414f, { keyAz: -20, keyEl: 55, keyI: 0.9, keyK: 7500, keySize: 1, fillAz: 70, fillEl: 10, fillI: 0.5, fillK: 8000, rimAz: 180, rimEl: 30, rimI: 0.7, rimK: 8000, ambI: 1.2, skyK: 8500, shadowDens: 0.6 }),
  indoor: mk(0x1d1612, 0x1e1612, { keyAz: -65, keyEl: 20, keyI: 2.8, keyK: 3000, keySize: 0.45, fillAz: 70, fillEl: 10, fillI: 0.3, fillK: 9000, rimAz: 180, rimEl: 30, rimI: 1.8, rimK: 9500, ambI: 0.5, skyK: 4000, shadowDens: 0.85 }),
};
export const LIGHT_PRESET_NAMES = [
  ['portrait', 'بورتريه سينمائي (المرجع)'], ['rembrandt', 'رامبرانت'], ['loop', 'لوب (Loop)'], ['butterfly', 'فراشة (Paramount)'],
  ['split', 'انقسام (Split)'], ['rimlit', 'إضاءة خلفية (Rim)'], ['studio', 'استوديو ثلاثي النقاط'], ['maya', 'عرض Maya الافتراضي'],
  ['sun', 'شمس'], ['shade', 'ظل / غائم (Skydome)'], ['indoor', 'داخلي دافئ'],
];

// colour temperature -> linear RGB normalised to unit luminance (Arnold "use colour temperature")
export function kelvin(K, out = new THREE.Color()) {
  const t = Math.min(400, Math.max(10, K / 100));
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
  const c = (x) => Math.min(1, Math.max(0, x / 255));
  out.setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
  const lum = 0.2126 * out.r + 0.7152 * out.g + 0.0722 * out.b;
  return out.multiplyScalar(1 / Math.max(1e-3, lum));
}
export const dirFrom = (az, el) => { const a = az * Math.PI / 180, e = el * Math.PI / 180; return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)); };

export class MayaRig {
  constructor(renderer, scene) {
    this.renderer = renderer; this.scene = scene;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
    this.key = new THREE.DirectionalLight(); this.fill = new THREE.DirectionalLight(); this.rim = new THREE.DirectionalLight();
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 0);
    for (const l of [this.key, this.fill, this.rim]) { scene.add(l); scene.add(l.target); }
    scene.add(this.hemi);
    const k = this.key; k.castShadow = true; k.shadow.mapSize.set(2048, 2048); k.shadow.bias = -0.0003; k.shadow.normalBias = 0.01;
    this.center = new THREE.Vector3(0, 0.3, 0); this.R = 2.5;
    this.pmrem = new THREE.PMREMGenerator(renderer); this.envRT = null; this.envDirty = true;
    this.bgCanvas = document.createElement('canvas'); this.bgCanvas.width = 4; this.bgCanvas.height = 256;
    this.bgTex = new THREE.CanvasTexture(this.bgCanvas); this.bgTex.colorSpace = THREE.SRGBColorSpace;
    this.buildEnvScene();
  }
  buildEnvScene() {
    const s = this.env = new THREE.Scene();
    const geo = new THREE.SphereGeometry(20, 48, 24), col = new Float32Array(geo.attributes.position.count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
    s.add(this.dome);
    this.boxes = ['key', 'fill', 'rim'].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); s.add(m); return m; });
  }
  fit(box) {
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    this.center.copy(c); this.R = Math.max(sz.x, sz.y, sz.z) * 0.5 * 1.6;
    this.place();
  }
  place() {
    const R = this.R, cam = this.key.shadow.camera;
    for (const l of [this.key, this.fill, this.rim]) { l.target.position.copy(this.center); l.target.updateMatrixWorld(); }
    cam.left = -R; cam.right = R; cam.top = R; cam.bottom = -R; cam.near = 0.1; cam.far = R * 6; cam.updateProjectionMatrix();
    this.key.position.copy(this.center).addScaledVector(this._kd || new THREE.Vector3(0, 1, 1), R * 3);
  }
  apply(L, pc, hairU) {
    const tmp = new THREE.Color();
    const set = (i, light, K, az, el, I, headI = I) => {
      const d = dirFrom(az, el); if (i === 0) this._kd = d;
      light.position.copy(this.center).addScaledVector(d, this.R * 3);
      kelvin(K, light.color); light.intensity = headI;
      hairU.lDir.value[i].copy(d); hairU.lCol.value[i].copy(light.color).multiplyScalar(I);
      const b = this.boxes[i], sz = 2 + 9 * (i === 0 ? L.keySize : 0.5);
      b.position.copy(d).multiplyScalar(14); b.lookAt(0, 0, 0); b.scale.set(sz, sz * 1.3, 1);
      b.material.color.copy(light.color).multiplyScalar(I * (i === 0 ? 3.2 : 1.6) / (0.4 + L.keySize));
    };
    set(0, this.key, L.keyK, L.keyAz, L.keyEl, L.keyI);
    set(1, this.fill, L.fillK, L.fillAz, L.fillEl, L.fillI);
    set(2, this.rim, L.rimK, L.rimAz, L.rimEl, L.rimI, L.rimHairOnly ? 0 : L.rimI); // light linking
    this.place();
    const k = this.key; k.castShadow = !!L.shadows; k.shadow.radius = 1 + L.keySize * 7; k.shadow.intensity = L.shadowDens;
    // skydome gradient: zenith colour temperature -> horizon -> ground bounce
    const sky = kelvin(L.skyK, new THREE.Color()).multiplyScalar(0.55), gnd = new THREE.Color(pc.gnd), hor = sky.clone().lerp(gnd, 0.35).multiplyScalar(0.8);
    const pos = this.dome.geometry.attributes.position, col = this.dome.geometry.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 20;
      tmp.copy(y > 0 ? hor : gnd).lerp(y > 0 ? sky : hor, y > 0 ? Math.pow(y, 0.6) : 1 + y);
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
    this.scene.environmentIntensity = L.ambI;
    hairU.skyCol.value.copy(sky).multiplyScalar(L.ambI * 1.1); hairU.gndCol.value.copy(gnd).multiplyScalar(L.ambI * 0.6);
    // hair: soft PCF in texels + deep-shadow transmittance per world unit
    hairU.shRadius.value = 1 + L.keySize * 5; hairU.shDens.value = L.shadows ? L.shadowDens : 0; hairU.shHair.value = 12 * L.hairShadow;
    this.drawBg(pc.bg);
    this.envDirty = true;
  }
  drawBg(hex) {
    const g = this.bgCanvas.getContext('2d'), c = new THREE.Color(hex), top = c.clone().offsetHSL(0, 0, 0.06), bot = c.clone().offsetHSL(0, 0, -0.04);
    const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#' + top.getHexString()); gr.addColorStop(1, '#' + bot.getHexString());
    g.fillStyle = gr; g.fillRect(0, 0, 4, 256); this.bgTex.needsUpdate = true; this.scene.background = this.bgTex;
  }
  // call once per frame before rendering
  update(hairU) {
    if (this.envDirty) {
      this.envDirty = false;
      const rt = this.pmrem.fromScene(this.env, 0.02);
      if (this.envRT) this.envRT.dispose();
      this.envRT = rt; this.scene.environment = rt.texture;
    }
    const m = this.key.shadow.map;
    hairU.shMap.value = m ? m.texture : null; hairU.shOn.value = m && this.key.castShadow ? 1 : 0;
    hairU.shMat.value = this.key.shadow.matrix; hairU.shDepth.value = this.key.shadow.camera.far - this.key.shadow.camera.near;
  }
}
