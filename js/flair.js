// Moving pictures between screens: saloon doors swing shut and open between pages, and a tumbleweed
// blows the old question away. Loaded after the first screen is up, so the first paint never waits.

const CSS = `
.saloon { --wood: var(--steel-1); --wood-2: var(--steel-2); --edge: #3a2214; position: fixed; inset: 0; z-index: 60; pointer-events: none; display: flex; justify-content: center; align-items: center; perspective: 1500px; view-transition-name: saloon; }
@media (prefers-color-scheme: dark) { :root:not([data-theme='light']) .saloon { --edge: #100c1d; } }
:root[data-theme='dark'] .saloon { --edge: #100c1d; }
.saloon .dim { position: absolute; inset: 0; background: radial-gradient(ellipse at 50% 55%, transparent 30%, color-mix(in srgb, var(--ink) 40%, transparent)), var(--paper); opacity: 0; animation: saloon-dim .7s ease both; }
.saloon svg { position: relative; height: min(76vh, 640px); width: min(50vw, calc(min(76vh, 640px) * .72)); overflow: visible; filter: drop-shadow(0 12px 16px rgba(0, 0, 0, .28)); animation: door-l .7s cubic-bezier(.3, .6, .35, 1) both; transform-origin: 0 50%; }
.saloon svg.r { transform-origin: 100% 50%; animation-name: door-r; }
@keyframes saloon-dim { 0% { opacity: 0; } 38%, 56% { opacity: .62; } 100% { opacity: 0; } }
@keyframes door-l { 0% { transform: rotateY(86deg); } 34% { transform: rotateY(-9deg); } 44% { transform: rotateY(4deg); } 52% { transform: rotateY(-1deg); } 100% { transform: rotateY(98deg); } }
@keyframes door-r { 0% { transform: rotateY(-86deg); } 34% { transform: rotateY(9deg); } 44% { transform: rotateY(-4deg); } 52% { transform: rotateY(1deg); } 100% { transform: rotateY(-98deg); } }
::view-transition-group(saloon), ::view-transition-new(saloon) { animation: none; }
html.doors::view-transition-old(root) { animation: doors-out .7s linear both; }
html.doors::view-transition-new(root) { animation: doors-in .7s linear both; }
@keyframes doors-out { 0%, 26% { opacity: 1; } 48%, 100% { opacity: 0; } }
@keyframes doors-in { 0%, 44% { opacity: 0; transform: scale(.985); } 74%, 100% { opacity: 1; transform: none; } }
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

// One batwing door, hinge on the left, in a 300 x 420 box. The right one is drawn mirrored.
const door = (s) => {
  const g = `dr${s}`;
  const line = 'stroke:var(--edge);stroke-width:2.6;stroke-linejoin:round';
  return `<svg class="${s}" viewBox="0 0 300 420" preserveAspectRatio="none" aria-hidden="true"><defs>`
    + `<linearGradient id="${g}w" x2="1"><stop offset="0" style="stop-color:color-mix(in srgb,var(--wood) 80%,#fff)"/><stop offset=".55" style="stop-color:var(--wood)"/><stop offset="1" style="stop-color:var(--wood-2)"/></linearGradient>`
    + `<pattern id="${g}s" width="20" height="18" patternUnits="userSpaceOnUse"><rect width="20" height="18" style="fill:var(--wood-2)"/><rect y="2" width="20" height="10" style="fill:var(--wood)"/><rect y="2" width="20" height="2.5" style="fill:#fff;opacity:.22"/></pattern></defs>`
    + `<g${s === 'r' ? ' transform="matrix(-1 0 0 1 300 0)"' : ''}>`
    + `<path d="M6 414V26C112 14 204 50 294 104V414Z" style="fill:url(#${g}w);${line}" vector-effect="non-scaling-stroke"/>`
    + `<path d="M36 58C120 50 200 78 264 124V142H36Z" style="fill:var(--wood-2);opacity:.45;${line}" vector-effect="non-scaling-stroke"/>`
    + `<rect x="36" y="168" width="228" height="170" style="fill:url(#${g}s);${line}" vector-effect="non-scaling-stroke"/>`
    + `<rect x="36" y="362" width="228" height="26" rx="3" style="fill:var(--wood-2);opacity:.45;${line}" vector-effect="non-scaling-stroke"/>`
    + `<path d="M0 64h30v16H0zM0 344h30v16H0z" style="fill:#4c4844;${line}" vector-effect="non-scaling-stroke"/>`
    + `<circle cx="20" cy="72" r="3" style="fill:#bdb5a8"/><circle cx="20" cy="352" r="3" style="fill:#bdb5a8"/></g></svg>`;
};
const DOORS = `<i class="dim"></i>${door('l')}${door('r')}`;

/** Doors still swinging from a quick earlier change; two at once would clash in the transition. */
export const clearDoors = () => document.querySelectorAll('.saloon').forEach((e) => e.remove());

/** Swing the doors over the change of screen. Call inside a view transition's update, after the new screen is in. */
export function doors() {
  clearDoors();
  const el = document.createElement('div');
  el.className = 'saloon';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = DOORS;
  document.body.append(el);
  setTimeout(() => el.remove(), 760);
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
