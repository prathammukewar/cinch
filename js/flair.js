// Moving pictures between screens: saloon doors swing shut and open between pages, and a tumbleweed
// blows the old question away. Loaded after the first screen is up, so the first paint never waits.

const CSS = `
.saloon { --wood: var(--steel-1); --wood-2: var(--steel-2); --edge: #3a2214; position: fixed; inset: 0; z-index: 60; pointer-events: none; overflow: hidden; perspective: max(1500px, 160vw); view-transition-name: saloon; }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) .saloon { --edge: #100c1d; } }
:root[data-theme='dark'] .saloon { --edge: #100c1d; }
.saloon .dim { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 55%, transparent 30%, color-mix(in srgb, var(--ink) 40%, transparent)), var(--paper); opacity: 0; animation: saloon-dim .76s ease both; }
.saloon svg { position: absolute; left: 0; display: block; overflow: visible; filter: drop-shadow(0 8px 14px rgba(0, 0, 0, .25)); --s: 1; animation: door .76s both; transform-origin: 0 50%; }
.saloon svg.r { --s: -1; left: auto; right: 0; transform-origin: 100% 50%; }
@keyframes saloon-dim { 0% { opacity: 0; } 30%, 56% { opacity: .62; } 100% { opacity: 0; } }
/* Doors meet, knock together, rebound twice toward you (never past shut, so the screen stays covered), then swing wide. */
@keyframes door {
  0% { transform: rotateY(calc(var(--s) * 86deg)); animation-timing-function: cubic-bezier(.45, .05, .8, .6); }
  28%, 44% { transform: none; animation-timing-function: ease-out; }
  36% { transform: rotateY(calc(var(--s) * 6deg)); animation-timing-function: ease-in; }
  49% { transform: rotateY(calc(var(--s) * 1.5deg)); animation-timing-function: ease-in; }
  55% { transform: none; animation-timing-function: cubic-bezier(.4, 0, .6, 1); }
  100% { transform: rotateY(calc(var(--s) * 98deg)); }
}
::view-transition-group(saloon), ::view-transition-new(saloon) { animation: none; }
html.doors::view-transition-old(root) { animation: doors-out .76s linear both; }
html.doors::view-transition-new(root) { animation: doors-in .76s linear both; }
@keyframes doors-out { 0%, 22% { opacity: 1; } 36%, 100% { opacity: 0; } }
@keyframes doors-in { 0%, 40% { opacity: 0; transform: scale(.985); } 62%, 100% { opacity: 1; transform: none; } }
.weed { position: absolute; left: 0; bottom: 2px; z-index: 4; width: 84px; height: 84px; pointer-events: none; animation: weed-x .95s linear both; }
.weed svg { display: block; width: 100%; height: 100%; overflow: visible; fill: none; stroke: #a8773f; stroke-width: 1.5; stroke-linecap: round; filter: drop-shadow(0 3px 2px rgba(60, 30, 0, .25)); animation: weed-hop .95s both, weed-spin .95s linear both; }
.weed svg .dk { stroke: #6b4521; stroke-width: 1.8; }
.weed svg .lt { stroke: #d2a868; }
.weed svg .tw { stroke: #7a5129; stroke-width: 1.3; }
@keyframes weed-x { from { translate: -100px 0; } to { translate: var(--w) 0; } }
@keyframes weed-spin { to { rotate: 760deg; } }
@keyframes weed-hop {
  0% { translate: 0 -26px; animation-timing-function: cubic-bezier(.5, 0, 1, .6); }
  30% { translate: 0 0; animation-timing-function: cubic-bezier(0, .5, .5, 1); }
  52% { translate: 0 -40px; animation-timing-function: cubic-bezier(.5, 0, 1, .6); }
  74% { translate: 0 0; animation-timing-function: cubic-bezier(0, .5, .5, 1); }
  88% { translate: 0 -18px; animation-timing-function: cubic-bezier(.5, 0, 1, .6); }
  100% { translate: 0 0; }
}
.puff { position: absolute; bottom: 0; z-index: 3; width: 70px; height: 30px; margin-left: -35px; border-radius: 50%; pointer-events: none; background: radial-gradient(closest-side, color-mix(in srgb, var(--far) 85%, var(--ink) 15%), transparent); opacity: 0; animation: puff .7s ease-out both; }
@keyframes puff { 0% { opacity: .9; transform: scale(.3, .5); } 100% { opacity: 0; transform: translate(18px, -14px) scale(1.4, 1.1); } }
`;
document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));

// One of two doors that fill the screen, hinge on the left, drawn in real pixels so nothing stretches.
// The right one is mirrored. Each runs past the top and bottom so the swing shows no gap there.
const door = (s, w, h, m) => {
  const g = `dr${s}`;
  const y = (f) => Math.round(m + (h - 2 * m) * f);
  const st = Math.round(Math.min(44, Math.max(18, w * 0.09)));
  const x1 = st, x2 = w - st, pw = x2 - x1;
  const pitch = Math.round(Math.min(22, Math.max(14, (h - 2 * m) * 0.022)));
  const hw = Math.round(Math.min(38, w * 0.14));
  const line = 'stroke:var(--edge);stroke-width:2.5;stroke-linejoin:round';
  const hinges = [y(0.12), y(0.86)];
  const grain = Array.from({ length: Math.round(w / 24) }, (_, i) => {
    const x = Math.round(((i + 0.5) * w) / Math.round(w / 24) + ((i * 37) % 11) - 5);
    const a = 4 + ((i * 13) % 7);
    return `M${x} 0C${x + a} ${Math.round(h * 0.3)} ${x - a} ${Math.round(h * 0.62)} ${x + (a >> 1)} ${h}`;
  }).join('');
  // Raised panel: light on the top and hinge side, shadow on the other two.
  const bevel = (a, b) => `<path d="M${x1 + 3} ${b - 3}V${a + 3}H${x2 - 3}" style="fill:none;stroke:#fff;stroke-width:2;opacity:.22"/>`
    + `<path d="M${x1 + 3} ${b - 3}H${x2 - 3}V${a + 3}" style="fill:none;stroke:#000;stroke-width:2;opacity:.16"/>`;
  return `<svg class="${s}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="top:${-m}px" aria-hidden="true"><defs>`
    + `<linearGradient id="${g}w" x2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--wood) 80%,#fff)"/><stop offset=".6" style="stop-color:var(--wood)"/><stop offset="1" style="stop-color:var(--wood-2)"/></linearGradient>`
    + `<pattern id="${g}s" width="20" height="${pitch}" patternUnits="userSpaceOnUse" y="${y(0.31)}"><rect width="20" height="${pitch}" style="fill:var(--wood-2)"/><rect y="2" width="20" height="${Math.round(pitch * 0.56)}" style="fill:var(--wood)"/><rect y="2" width="20" height="2.5" style="fill:#fff;opacity:.22"/></pattern></defs>`
    + `<g${s === 'r' ? ` transform="matrix(-1 0 0 1 ${w} 0)"` : ''}>`
    + `<rect x="1.25" y="-2" width="${w - 2.5}" height="${h + 4}" style="fill:url(#${g}w);${line}"/>`
    + `<path d="${grain}" style="fill:none;stroke:var(--edge);stroke-width:1.2;opacity:.09"/>`
    + `<path d="M${x1} ${y(0.25)}V${y(0.07)}C${Math.round(x1 + pw * 0.35)} ${y(0.045)} ${Math.round(x1 + pw * 0.7)} ${y(0.09)} ${x2} ${y(0.15)}V${y(0.25)}Z" style="fill:var(--wood-2);opacity:.45;${line}"/>`
    + `<path d="M${x1 + 3} ${y(0.25) - 3}V${y(0.07) + 3}" style="fill:none;stroke:#fff;stroke-width:2;opacity:.22"/>`
    + `<rect x="${x1}" y="${y(0.31)}" width="${pw}" height="${y(0.7) - y(0.31)}" style="fill:url(#${g}s);${line}"/>`
    + `<path d="M${x1 + 2} ${y(0.31) + 3}H${x2 - 2}" style="stroke:#000;stroke-width:5;opacity:.18"/>`
    + `<rect x="${x1}" y="${y(0.76)}" width="${pw}" height="${y(0.92) - y(0.76)}" rx="3" style="fill:var(--wood-2);opacity:.45;${line}"/>`
    + bevel(y(0.76), y(0.92))
    + hinges.map((t) => `<path d="M0 ${t}h${hw}v18H0z" style="fill:#4c4844;${line}"/><circle cx="${Math.round(hw * 0.6)}" cy="${t + 9}" r="3" style="fill:#bdb5a8"/>`).join('')
    + '</g></svg>';
};

/** Doors still swinging from a quick earlier change; two at once would clash in the transition. */
export const clearDoors = () => document.querySelectorAll('.saloon').forEach((e) => e.remove());

/** Swing the doors over the change of screen. Call inside a view transition's update, after the new screen is in. */
export function doors() {
  clearDoors();
  const el = document.createElement('div');
  el.className = 'saloon';
  el.setAttribute('aria-hidden', 'true');
  document.body.append(el);
  // Half the screen and a pixel each, so they meet with no seam.
  const w = Math.ceil(el.clientWidth / 2) + 1;
  const m = Math.round(el.clientHeight * 0.06);
  const h = el.clientHeight + 2 * m;
  el.innerHTML = `<i class="dim"></i>${door('l', w, h, m)}${door('r', w, h, m)}`;
  setTimeout(() => el.remove(), 820);
}

// A tumbleweed: loose loops of dry brush at all angles, a few stray twigs, light and dark stems.
const WEED = `<svg viewBox="-34 -34 68 68" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => {
  const r = 12 + ((i * 7) % 17);
  return `<ellipse class="${['', 'dk', 'lt'][i % 3]}" rx="${r}" ry="${(r * (0.28 + (i % 5) * 0.1)).toFixed(1)}" transform="rotate(${(i * 41) % 180}) translate(${(i % 7) - 3} ${(i % 5) - 2})"/>`;
}).join('')}<path class="tw" d="M-17 7q-8 3-14 9M15-11q7-5 14-6M3 18q2 7 0 13M-10-15q-2-7 1-13"/></svg>`;

/** Roll a tumbleweed across the rail. The wind it brings blows the old question off to the right. */
export function tumbleweed(desk) {
  const w = desk.clientWidth + 100;
  const el = document.createElement('div');
  el.className = 'weed';
  el.style.setProperty('--w', `${w}px`);
  el.innerHTML = WEED;
  desk.append(el);
  // Dust where it lands, at 30% and 74% of the way.
  for (const t of [0.3, 0.74]) {
    setTimeout(() => {
      const p = document.createElement('i');
      p.className = 'puff';
      p.style.left = `${-80 + (w + 80) * t + 42}px`;
      desk.append(p);
      setTimeout(() => p.remove(), 760);
    }, 950 * t);
  }
  setTimeout(() => el.remove(), 1000);
}
