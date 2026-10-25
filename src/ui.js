const refreshers = [];
export const onRefresh = (f) => refreshers.push(f);
export const refreshUI = () => refreshers.forEach((f) => f());

export function mkTabs(tabsEl, bodyEl, defs) {
  const panes = {};
  defs.forEach(([id, label], i) => {
    const b = document.createElement('button'); b.textContent = label;
    const p = document.createElement('div'); p.className = 'tab';
    b.onclick = () => {
      Object.values(panes).forEach((x) => { x.b.classList.remove('on'); x.p.classList.remove('show'); });
      b.classList.add('on'); p.classList.add('show');
    };
    tabsEl.appendChild(b); bodyEl.appendChild(p); panes[id] = { b, p };
    if (i === 0) b.onclick();
  });
  return (id) => panes[id].p;
}

export const head = (p, t) => { const h = document.createElement('h3'); h.textContent = t; p.appendChild(h); };
export const note = (p, t) => { const n = document.createElement('div'); n.className = 'note'; n.textContent = t; p.appendChild(n); };

export function slider(p, obj, key, label, min, max, step, cb) {
  const r = document.createElement('div'); r.className = 'row';
  const l = document.createElement('label'); l.textContent = label;
  const i = document.createElement('input'); i.type = 'range'; i.min = min; i.max = max; i.step = step;
  // editable number field: exact values, may go beyond the slider range
  const o = document.createElement('input'); o.type = 'number'; o.step = step;
  const dec = step < 0.01 ? 3 : step < 1 ? 2 : 0;
  const fmt = () => { if (document.activeElement !== o) o.value = (+obj[key]).toFixed(dec); };
  const sync = () => { i.value = obj[key]; fmt(); };
  i.oninput = () => { obj[key] = +i.value; fmt(); cb && cb(obj[key]); };
  o.onchange = () => { const v = parseFloat(o.value); if (!isFinite(v)) return fmt(); obj[key] = v; i.value = v; cb && cb(v); o.blur(); fmt(); };
  o.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') o.onchange(); };
  r.append(l, i, o); p.appendChild(r); refreshers.push(sync); sync();
}
export function check(p, obj, key, label, cb) {
  const r = document.createElement('div'); r.className = 'row2';
  const l = document.createElement('label'); l.textContent = label;
  const i = document.createElement('input'); i.type = 'checkbox'; i.style.justifySelf = 'start';
  i.onchange = () => { obj[key] = i.checked; cb && cb(i.checked); };
  const sync = () => { i.checked = !!obj[key]; };
  r.append(l, i); p.appendChild(r); refreshers.push(sync); sync();
}
export function color(p, obj, key, label, cb) {
  const r = document.createElement('div'); r.className = 'row2';
  const l = document.createElement('label'); l.textContent = label;
  const i = document.createElement('input'); i.type = 'color';
  i.oninput = () => { obj[key] = i.value; cb && cb(i.value); };
  const sync = () => { i.value = obj[key]; };
  r.append(l, i); p.appendChild(r); refreshers.push(sync); sync();
}
export function select(p, obj, key, label, options, cb) {
  const r = document.createElement('div'); r.className = 'row2';
  const l = document.createElement('label'); l.textContent = label;
  const s = document.createElement('select');
  s.onchange = () => { obj[key] = isNaN(+s.value) ? s.value : +s.value; cb && cb(obj[key]); };
  r.append(l, s); p.appendChild(r);
  const fill = () => { s.innerHTML = ''; options().forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; s.appendChild(o); }); s.value = obj[key]; };
  refreshers.push(() => { fill(); }); fill();
  return fill;
}
export function buttons(p, defs) {
  const d = document.createElement('div'); d.className = 'btns';
  defs.forEach(([t, f, cls]) => { const b = document.createElement('button'); b.textContent = t; if (cls) b.className = cls; b.onclick = f; d.appendChild(b); });
  p.appendChild(d);
  return d;
}
