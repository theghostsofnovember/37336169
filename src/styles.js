// Hairstyle presets. Lengths are in reference-head units (head radius ≈ 0.89).
// reg = length multipliers for [front, top, crown, sides, back, nape, sideburn].
export const HAIR_COLORS = {
  black: ['أسود', '#0b0807', '#1e1712'],
  blueblack: ['أسود مزرق', '#07080b', '#161a22'],
  darkbrown: ['بني داكن', '#100a07', '#2c1d14'],
  brown: ['بني', '#2a1a12', '#6b4a32'],
  chestnut: ['كستنائي', '#2b120a', '#7a3b22'],
  blonde: ['أشقر', '#5a4228', '#c9a46c'],
  red: ['أحمر', '#3a120a', '#a0442a'],
  grey: ['رمادي', '#3a3633', '#9a948c'],
  white: ['أبيض', '#8f8a84', '#e6e2dc'],
};
export const SKIN_TONES = { light: ['فاتح', '#d8b49c'], wheat: ['حنطي', '#b88a6c'], tan: ['أسمر', '#9a6a4c'], dark: ['داكن', '#5e3c2a'], portrait: ['البورتريه', '#a5806b'] };

export const STYLE_DEFAULTS = {
  preset: 'portrait', style: 'up', part: 'none', len: 0.42, lenVar: 0.2, reg: [1, 1, 0.85, 0.65, 0.75, 0.45, 0.3],
  count: 650, lift: 0.55, rootBend: 0.25, gravity: 0.08, cling: 0.75, wave: 0.45, waveFreq: 2.5, curl: 0, curlFreq: 6, frizz: 0.04,
  recede: 0, napeUp: 0, sideburn: 0.18, swirl: 1, whorlX: 0.06, browThick: 1, beardCheek: 0, beardNeck: 0.3,
  brows: 'thick', mous: 'chevron', beard: 'stubble', beardLen: 0.06, beardCurl: 0.2,
  color: 'darkbrown', skin: 'portrait', scalpTex: 0.9, inner: 0.45,
  card: { type: 1, perGuide: 2, width: 0.07, widthVar: 0.35, taper: 0.4, rootW: 0.65, spread: 0.8, fan: 0.6, twist: 0.45, noise: 0.5, fill: 2, fly: 0.35, segs: 10 },
};

const P = (id, name, o) => ({ id, name, ...o });
export const PRESETS = [
  P('portrait', 'مموج مرفوع (البورتريه)', {}),
  P('buzz', 'قصير جداً (حلاقة)', { style: 'natural', len: 0.035, lenVar: 0.15, reg: [1, 1, 1, 0.8, 0.8, 0.6, 0.7], count: 1300, lift: 0.08, rootBend: 0.1, cling: 0.4, wave: 0, curl: 0, frizz: 0, scalpTex: 1, inner: 0, beard: 'stubble', mous: 'thin', brows: 'natural', card: { type: 5, perGuide: 1, width: 0.03, fill: 0, fly: 0, segs: 3, twist: 0.1, noise: 0.1, taper: 0.5 } }),
  P('crew', 'قصير (كرو كت)', { style: 'forward', len: 0.15, reg: [1.1, 1, 0.8, 0.35, 0.4, 0.2, 0.3], count: 1000, lift: 0.45, rootBend: 0.3, cling: 0.5, wave: 0.1, scalpTex: 1, inner: 0.25, beard: 'none', mous: 'none', brows: 'natural', card: { type: 2, perGuide: 1, width: 0.05, fill: 1, fly: 0.1, segs: 5, twist: 0.3, noise: 0.3 } }),
  P('fade', 'تدرج (فيد) + أعلى مجعد', { style: 'up', len: 0.22, reg: [1.1, 1, 0.8, 0.12, 0.15, 0.06, 0.15], count: 1000, lift: 0.7, rootBend: 0.2, cling: 0.3, wave: 0.2, curl: 0.55, curlFreq: 9, scalpTex: 1, inner: 0.3, beard: 'short', beardLen: 0.035, mous: 'full', card: { type: 1, perGuide: 1, width: 0.06, fill: 1, fly: 0.3, segs: 12, twist: 0.6, noise: 0.5 } }),
  P('sidepart', 'فرق جانبي كلاسيكي', { style: 'side', part: 'left', len: 0.36, reg: [1, 1, 0.8, 0.35, 0.45, 0.25, 0.3], count: 900, lift: 0.3, rootBend: 0.2, cling: 0.85, wave: 0.12, beard: 'none', mous: 'none', brows: 'natural', color: 'brown', card: { type: 2, perGuide: 2, width: 0.07, fill: 2, fly: 0.15, segs: 10, twist: 0.25, noise: 0.3 } }),
  P('slick', 'مسحوب للخلف', { style: 'back', len: 0.48, reg: [1, 1, 0.85, 0.6, 0.7, 0.4, 0.3], count: 850, lift: 0.18, rootBend: 0.15, cling: 0.95, wave: 0.15, beard: 'short', beardLen: 0.03, mous: 'full', card: { type: 2, perGuide: 2, width: 0.07, fill: 2, fly: 0.1, segs: 10, twist: 0.2, noise: 0.25 } }),
  P('long', 'طويل ناعم', { style: 'down', part: 'center', len: 1.45, lenVar: 0.12, reg: [0.75, 1, 1, 0.95, 1.05, 1, 0.4], count: 900, lift: 0.12, rootBend: 0.12, gravity: 0.9, cling: 0.8, wave: 0.12, waveFreq: 1.2, beard: 'none', mous: 'none', brows: 'natural', color: 'chestnut', card: { type: 2, perGuide: 2, width: 0.09, fill: 2, fly: 0.25, segs: 18, twist: 0.3, noise: 0.4, taper: 0.5 } }),
  P('curly', 'مجعد', { style: 'natural', len: 0.42, reg: [1, 1, 0.95, 0.75, 0.85, 0.6, 0.3], count: 700, lift: 0.6, rootBend: 0.3, gravity: 0.15, cling: 0.3, wave: 0.2, curl: 0.8, curlFreq: 7, frizz: 0.08, card: { type: 1, perGuide: 1, width: 0.075, fill: 1, fly: 0.4, segs: 22, twist: 0.6, noise: 0.6 } }),
  P('afro', 'أفرو', { style: 'afro', len: 0.36, reg: [0.9, 1, 1, 0.85, 0.9, 0.55, 0.3], count: 800, lift: 0.9, rootBend: 0.25, gravity: 0.05, cling: 0, wave: 0.3, curl: 1, curlFreq: 11, frizz: 0.12, color: 'black', skin: 'dark', beard: 'short', beardLen: 0.04, beardCurl: 0.8, card: { type: 0, perGuide: 1, width: 0.08, fill: 1, fly: 0.5, segs: 24, twist: 0.8, noise: 0.7 } }),
  P('asian', 'آسيوي مستقيم (غرّة)', { style: 'forward', len: 0.52, reg: [1.05, 1, 0.9, 0.8, 0.75, 0.45, 0.4], count: 950, lift: 0.25, rootBend: 0.12, gravity: 0.55, cling: 0.85, wave: 0, curl: 0, frizz: 0, color: 'blueblack', skin: 'light', beard: 'none', mous: 'none', brows: 'natural', card: { type: 4, perGuide: 2, width: 0.075, fill: 2, fly: 0.1, segs: 12, twist: 0.15, noise: 0.15, taper: 0.55 } }),
  P('arab', 'عربي (كثيف مموج + لحية)', { style: 'back', part: 'none', len: 0.34, reg: [1.05, 1, 0.85, 0.55, 0.7, 0.4, 0.5], count: 900, lift: 0.5, rootBend: 0.22, gravity: 0.1, cling: 0.7, wave: 0.55, waveFreq: 3, curl: 0.3, curlFreq: 5, frizz: 0.05, color: 'black', skin: 'wheat', beard: 'full', beardLen: 0.13, beardCurl: 0.45, beardNeck: 0.35, mous: 'chevron', brows: 'thick', card: { type: 1, perGuide: 2, width: 0.07, fill: 2, fly: 0.3, segs: 12, twist: 0.5, noise: 0.5 } }),
  P('bald', 'أصلع + لحية', { style: 'natural', len: 0, count: 0, scalpTex: 0.15, inner: 0, recede: 1, beard: 'full', beardLen: 0.1, mous: 'full', color: 'darkbrown' }),
];

// generated groups (order = group index)
export function groupTemplates(S) {
  const c = { ...STYLE_DEFAULTS.card, ...S.card };
  const full = S.beard === 'full';
  const face = { perGuide: 1, fill: 0, fly: 0, widthVar: 0.3, noise: 0.2, twist: 0.25, taper: 0.4, rootW: 0.7, spread: 0.5, fan: 0.3 };
  return [
    { name: 'شعر الرأس', color: '#2ee6a0', card: c },
    { name: 'طبقة داخلية', color: '#12b886', stiff: 2.5, card: { ...c, perGuide: 1, fill: 1, width: c.width * 1.5, fly: 0, twist: 0.2, noise: 0.25 } },
    { name: 'الحواجب', color: '#4c6ef5', lockPhys: true, card: { ...face, segs: 4, width: 0.022 } },
    { name: 'الشارب', color: '#9775fa', lockPhys: true, card: { ...face, segs: 5, width: 0.026 } },
    { name: 'اللحية', color: '#e599f7', lockPhys: true, card: { ...face, fill: full ? 1 : 0, segs: full ? 10 : 4, width: full ? 0.04 : 0.024, twist: full ? 0.5 : 0.2, noise: full ? 0.5 : 0.2 } },
  ];
}

// shading defaults matched to the portrait reference
export const SHADE = {
  texAmt: 0.75, origAmt: 0, spec1: '#9c8a7a', exp1: 140, sh1: -0.08, spec2: '#4a3022', exp2: 30, sh2: 0.18,
  specAmt: 0.45, sss: 0.06, ao: 0.65, aoLen: 0.4, cut: 0.32, rootFade: 0.03, tipFade: 0.3, exposure: 0.95, showMask: false, showGuides: false,
  centerLift: 0, layerGap: 0.007, vol: 0.6, curve: 0.4, uvVar: 0.6, widthVar: 0.35, taper: 0.4, rootW: 0.65,
};
