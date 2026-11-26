// Tiny element helper.
export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== 'string' && k !== 'style') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid);
  return el;
}

export const $ = (id) => document.getElementById(id);
export const say = (text) => { const l = $('live'); l.textContent = ''; setTimeout(() => { l.textContent = text; }, 30); };
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function toast(text) {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast', role: 'status' }, text);
  document.body.append(t);
  setTimeout(() => t.remove(), 2200);
}

export const plus = (n) => (n > 0 ? `+${n}` : String(n).replace('-', '−'));
export const signed = (n) => String(n).replace('-', '−');
