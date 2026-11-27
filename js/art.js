// Drawn pieces of the ranch: the dynamite on Quick Draw's fuse, the scene on its start page, and
// an emblem for each mode's page. Plain SVG strings coloured by the theme's variables, so they
// follow light and dark.
// Its own styles come with it; importers wait for them so nothing is drawn unstyled.
await new Promise((resolve) => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'css/art.css';
  link.onload = link.onerror = resolve;
  document.head.append(link);
});

let n = 0;
const uid = () => `art${++n}`;

const LINE = 'var(--art-line)';
const hi = (c, k = 45) => `color-mix(in srgb, ${c} ${100 - k}%, #fff)`;
const lo = (c, k = 35) => `color-mix(in srgb, ${c} ${100 - k}%, #000)`;
const stops = (list) => list.map(([o, c, a = 1]) => `<stop offset="${o}" style="stop-color:${c};stop-opacity:${a}"/>`).join('');
const lin = (id, list, [x1, y1, x2, y2] = [0, 0, 0, 1]) => `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(list)}</linearGradient>`;
const rad = (id, list, extra = '') => `<radialGradient id="${id}" ${extra}>${stops(list)}</radialGradient>`;
const ln = (w = 2.2) => `stroke:${LINE};stroke-width:${w};stroke-linejoin:round;stroke-linecap:round`;
const svg = (box, body, cls = '') => `<svg class="art ${cls}" viewBox="${box}" aria-hidden="true" focusable="false">${body}</svg>`;
const shadow = (cx, cy, rx, ry, a = 0.55) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" style="fill:var(--shade);opacity:${a}"/>`;

// ------------------------------------------------------------------ dynamite

/** Three sticks tied with twine, lying with their ends to the right, in a 100 x 72 box.
 *  The middle stick sticks out furthest; its end is where the fuse goes in, at (87, 36). */
function bundle(g) {
  const defs = `<defs>${lin(`${g}s`, [[0, hi('var(--band)', 38)], [0.32, 'var(--band)'], [0.78, lo('var(--band)', 22)], [1, lo('var(--band)', 42)]])}`
    + rad(`${g}e`, [[0, '#f8e2c4'], [0.55, '#efcfa8'], [1, `color-mix(in srgb, var(--band) 55%, #efcfa8)`]], 'cx="0.45" cy="0.45" r="0.6"')
    + lin(`${g}t`, [[0, lo('var(--steel-1)', 28)], [0.45, hi('var(--steel-1)', 30)], [1, lo('var(--steel-1)', 38)]], [0, 0, 1, 0])
    + `<pattern id="${g}p" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><rect width="1.3" height="3.4" style="fill:${LINE};opacity:.38"/></pattern></defs>`;
  const stick = (x, y, w) => {
    const r = x + w;
    return `<path d="M${r} ${y}H${x + 5}A5 10 0 0 0 ${x + 5} ${y + 20}H${r}Z" style="fill:url(#${g}s);${ln()}"/>`
      + `<path d="M${x + 6} ${y + 5}H${r - 5}" style="stroke:#fff;stroke-opacity:.42;stroke-width:2.6;stroke-linecap:round"/>`
      + `<path d="M${x + 11} ${y + 1.5}v17M${r - 9} ${y + 1.5}v17" style="stroke:${lo('var(--band)', 45)};stroke-opacity:.55;stroke-width:1"/>`
      + `<ellipse cx="${r}" cy="${y + 10}" rx="4.6" ry="10" style="fill:url(#${g}e);${ln()}"/>`
      + `<ellipse cx="${r + 0.9}" cy="${y + 10}" rx="1.9" ry="4.2" style="fill:${LINE};opacity:.5"/>`;
  };
  const tie = (x) => {
    const d = `M${x} 3.5q-2.2 32.5 0 65h7.5q2.2-32.5 0-65z`;
    return `<path d="${d}" style="fill:url(#${g}t);${ln(1.8)}"/><path d="${d}" style="fill:url(#${g}p)"/>`;
  };
  return defs + shadow(46, 69.5, 42, 2.6)
    + stick(8, 6, 68) + stick(5, 46, 69) + stick(14, 26, 72)
    + tie(25) + tie(57)
    + `<rect x="37" y="29.5" width="16" height="13" rx="1.6" style="fill:#fbf0da;stroke:${lo('var(--band)', 40)};stroke-width:.8"/>`
    + `<text x="45" y="39.2" text-anchor="middle" style="font:800 8.6px var(--display);letter-spacing:.2px;fill:${lo('var(--band)', 30)}">TNT</text>`;
}

// The blast when Quick Draw's time runs out: a flash, two shock rings, smoke and flying scraps.
const BLAST = '<i class="flash"></i><i class="ring"></i><i class="ring r2"></i>'
  + [[-26, -30], [22, -34], [-4, -44], [30, -8], [-32, -6]].map(([x, y], i) => `<i class="smoke" style="--x:${x}px;--y:${y}px;--d:${i * 0.05}s"></i>`).join('')
  + Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2 + 0.3; const r = 46 + (i * 13) % 30; return `<i class="bit b${i % 3}" style="--x:${(Math.cos(a) * r).toFixed(0)}px;--y:${(Math.sin(a) * r * 0.8 - 12).toFixed(0)}px;--r:${i * 67 % 360}deg"></i>`; }).join('');

/** The bundle at the end of Quick Draw's fuse, with the blast it makes when time runs out. */
export function dynamite() {
  return svg('0 0 100 72', `<g class="bundle">${bundle(uid())}</g>`, 'tnt') + `<span class="blast">${BLAST}</span><i class="scorch"></i>`;
}

/** Quick Draw's start page: the bundle with a long fuse snaking off to the right. Lighting it runs
 *  a spark down the fuse into the sticks. */
export function fuseScene() {
  const g = uid();
  // From the frayed tip back to the bundle, so the burn runs the way the path does.
  const path = 'M532 150C498 152 488 118 452 120S398 160 352 154S300 112 262 116S214 118 191 112';
  const spark = `<g class="qd-spark">`
    + `<circle r="15" style="fill:url(#${g}g)"/>`
    + `<g class="qd-rays">${Array.from({ length: 8 }, (_, i) => `<path d="M0 0L${(Math.cos(i * 0.785) * 15).toFixed(1)} ${(Math.sin(i * 0.785) * 15).toFixed(1)}" style="stroke:#fff6d0;stroke-width:1.6;stroke-linecap:round"/>`).join('')}</g>`
    + `<circle r="5" style="fill:#fffbe8"/></g>`;
  return svg('0 0 560 190', `<defs>${rad(`${g}g`, [[0, '#fffbe8'], [0.3, 'var(--pin)'], [0.7, 'var(--band)', 0.55], [1, 'var(--band)', 0]])}</defs>`
    + `<path d="${path}" transform="translate(0 6)" style="fill:none;stroke:var(--shade);stroke-width:7;opacity:.5;stroke-linecap:round"/>`
    + shadow(120, 186, 104, 4.5, 0.5)
    + `<g transform="translate(16 40) scale(2.1)"><g class="qd-tnt">${bundle(g)}</g></g>`
    + `<path d="${path}" style="fill:none;${ln(10)}"/>`
    + `<path d="${path}" style="fill:none;stroke:var(--peg);stroke-width:6.4;stroke-linecap:round"/>`
    + `<path d="${path}" style="fill:none;stroke:${lo('var(--peg)', 45)};stroke-width:6.4;stroke-dasharray:2.4 3.4"/>`
    + `<path class="qd-ash" d="${path}" pathLength="1" style="fill:none;stroke:color-mix(in srgb, var(--ink) 22%, var(--paper));stroke-width:7.2;stroke-dasharray:1 1;stroke-dashoffset:1;stroke-linecap:round"><animate attributeName="stroke-dashoffset" from="1" to="0" dur="0.9s" begin="indefinite" fill="freeze"/></path>`
    + `<path d="M532 150l9 -5M532 150l10 1M532 150l8 6" style="stroke:var(--peg);stroke-width:2;stroke-linecap:round"/>`
    + `<g class="qd-glow" transform="translate(532 150)"><circle r="9" style="fill:url(#${g}g)"/></g>`
    + `<g class="qd-runner">${spark}<animateMotion dur="0.9s" begin="indefinite" fill="freeze" path="${path}"/></g>`,
    'qd-scene');
}

// ------------------------------------------------------------------ emblems, one per mode page

/** Showdown: two lassos lying on the ground, linked, one per rider. */
function showdown() {
  const g = uid();
  const rope = (d, color, w = 7) => `<path d="${d}" style="fill:none;${ln(w + 3.6)}"/>`
    + `<path d="${d}" style="fill:none;stroke:${color};stroke-width:${w};stroke-linecap:round"/>`
    + `<path d="${d}" style="fill:none;stroke:${lo(color, 40)};stroke-width:${w};stroke-dasharray:2.4 4"/>`
    + `<path d="${d}" transform="translate(0 -2)" style="fill:none;stroke:#fff;stroke-opacity:.3;stroke-width:1.3;stroke-dasharray:2.4 4"/>`;
  const loop = (cx) => `M${cx - 34} 62a34 22 0 1 0 68 0a34 22 0 1 0 -68 0`;
  const honda = (x, y, color) => `<ellipse cx="${x}" cy="${y}" rx="5.4" ry="4.2" style="fill:${color};${ln(1.8)}"/><ellipse cx="${x}" cy="${y}" rx="2" ry="1.4" style="fill:${LINE}"/>`;
  return svg('0 0 160 120', `<defs><clipPath id="${g}c"><rect x="66" y="70" width="28" height="24"/></clipPath></defs>`
    + `<ellipse cx="80" cy="66" rx="76" ry="30" style="fill:var(--shade);opacity:.28"/>`
    + rope('M33 74C26 88 18 84 12 94S6 106 2 108', 'var(--band)')
    + rope('M127 74C134 88 142 84 148 94S154 106 158 108', 'var(--rider2)')
    + rope(loop(60), 'var(--band)') + honda(33, 73, 'var(--band)')
    + rope(loop(100), 'var(--rider2)') + honda(127, 73, 'var(--rider2)')
    + `<g clip-path="url(#${g}c)">${rope(loop(60), 'var(--band)')}</g>`);
}

/** Rodeo: a crowd of hats. */
function hat(x, y, s, felt, band, g) {
  const crown = 'M-22-2C-24-22-20-40-10-42C-4-43-2-37 0-38C2-37 4-43 10-42C20-40 24-22 22-2C12 3-12 3-22-2Z';
  const brim = 'M-48-8C-40-15 40-15 48-8C46 4 26 11 0 11C-26 11-46 4-48-8Z';
  return `<g transform="translate(${x} ${y}) scale(${s})">`
    + `<defs>${lin(`${g}c`, [[0, hi(felt, 22)], [0.5, felt], [1, lo(felt, 30)]], [0, 0, 1, 0])}${lin(`${g}b`, [[0, hi(felt, 18)], [0.6, felt], [1, lo(felt, 28)]])}</defs>`
    + `<path d="${brim}" style="fill:url(#${g}b);${ln(2.2 / s)}"/>`
    + `<path d="M-46-5C-40 3-24 7.4 0 7.4S40 3 46-5" style="fill:none;stroke:${lo(felt, 40)};stroke-width:${1.4 / s};opacity:.55"/>`
    + `<path d="${crown}" style="fill:url(#${g}c);${ln(2.2 / s)}"/>`
    + `<path d="M-23.2-11C-12-7 12-7 23.2-11L22.6-3.4C12 1.4-12 1.4-22.6-3.4Z" style="fill:${band};${ln(1.6 / s)}"/>`
    + `<path d="M0-37C-1-30-1-24 0-18" style="fill:none;stroke:${lo(felt, 45)};stroke-width:${1.6 / s};stroke-linecap:round;opacity:.7"/>`
    + `<path d="M-15-36C-19-28-19-20-18-14" style="fill:none;stroke:#fff;stroke-opacity:.3;stroke-width:${2.4 / s};stroke-linecap:round"/>`
    + `</g>`;
}
function rodeo() {
  return svg('0 0 160 120', shadow(80, 110, 70, 5)
    + hat(38, 74, 0.82, 'var(--steel-1)', 'var(--peg)', uid())
    + hat(122, 72, 0.82, '#efe2c6', 'var(--rider2)', uid())
    + hat(80, 92, 1.28, 'var(--peg)', 'var(--band)', uid()));
}

/** Old Trails: a signpost and a line of hoofprints. */
function trails() {
  const g = uid();
  const wood = `fill:url(#${g}w);${ln()}`;
  const print = (x, y, s, r) => `<path transform="translate(${x} ${y}) rotate(${r}) scale(${s})" d="M-4-4C-5 2-3 5 0 5S5 2 4-4" style="fill:none;stroke:${LINE};stroke-opacity:.32;stroke-width:${2.2 / s};stroke-linecap:round"/>`;
  const letters = (y, xs) => xs.map(([a, b]) => `<path d="M${a} ${y}H${b}" style="stroke:${lo('var(--steel-2)', 45)};stroke-width:3;stroke-linecap:round;opacity:.8"/>`).join('');
  return svg('0 0 160 120', `<defs>${lin(`${g}w`, [[0, hi('var(--steel-1)', 18)], [0.6, 'var(--steel-1)'], [1, lo('var(--steel-1)', 22)]])}${lin(`${g}p`, [[0, hi('var(--steel-2)', 15)], [0.5, 'var(--steel-1)'], [1, lo('var(--steel-2)', 25)]], [0, 0, 1, 0])}</defs>`
    + `<ellipse cx="82" cy="110" rx="74" ry="8" style="fill:var(--far);opacity:.7"/>`
    + shadow(84, 110, 16, 3)
    + print(14, 113, 0.9, -8) + print(30, 108, 0.82, 6) + print(46, 112, 0.76, -6) + print(110, 108, 0.7, 4) + print(126, 112, 0.66, -4) + print(142, 107, 0.6, 8)
    + `<rect x="75" y="12" width="12" height="99" rx="2" style="fill:url(#${g}p);${ln()}"/>`
    + `<path d="M78 22V104M83.5 30V96" style="stroke:${lo('var(--steel-2)', 30)};stroke-width:.9;opacity:.6"/>`
    + `<path d="M31 22H128V44H31L19 33Z" style="${wood}"/>`
    + `<path d="M36 28H122M34 39H118" style="stroke:${lo('var(--steel-2)', 20)};stroke-width:.8;opacity:.6"/>`
    + letters(33.5, [[36, 52], [58, 70], [94, 116]])
    + `<g transform="rotate(5 81 62)"><path d="M38 52H128L140 63L128 74H38Z" style="${wood}"/>`
    + `<path d="M42 58H124M44 69H126" style="stroke:${lo('var(--steel-2)', 20)};stroke-width:.8;opacity:.6"/>`
    + letters(63.5, [[46, 68], [94, 106], [111, 124]]) + `</g>`
    + `<circle cx="81" cy="28" r="1.5" style="fill:${LINE}"/><circle cx="81" cy="38" r="1.5" style="fill:${LINE}"/><circle cx="81" cy="58" r="1.5" style="fill:${LINE}"/><circle cx="81" cy="68" r="1.5" style="fill:${LINE}"/>`);
}

/** Brand Book: a branding iron with the loop red hot. */
function book() {
  const g = uid();
  const loop = 'M34 26H72A13 13 0 0 1 72 52H34A13 13 0 0 1 34 26Z';
  const wisp = (x, d) => `<path class="wisp" style="--d:${d}s" d="M${x} 20c-5-6 5-10 0-16s4-9 0-14" />`;
  return svg('0 0 160 120', `<defs>${lin(`${g}h`, [[0, '#fff4c8'], [0.35, 'var(--pin)'], [1, 'var(--band)']], [0, 0, 1, 1])}`
    + `<filter id="${g}f" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>`
    + `${lin(`${g}r`, [[0, '#9d968b'], [1, '#55504a']])}${lin(`${g}w`, [[0, hi('var(--steel-1)', 15)], [1, lo('var(--steel-2)', 20)]])}</defs>`
    + shadow(96, 112, 56, 3.5)
    + `<g class="smoke">${wisp(40, 0)}${wisp(54, 0.9)}${wisp(68, 1.8)}</g>`
    + `<path d="M72 52L128 104" style="fill:none;${ln(8)}"/><path d="M72 52L128 104" style="fill:none;stroke:url(#${g}r);stroke-width:4.8;stroke-linecap:round"/>`
    + `<path d="M120 96L148 122" style="fill:none;${ln(14)}"/><path d="M120 96L148 122" style="fill:none;stroke:url(#${g}w);stroke-width:10.6;stroke-linecap:round"/>`
    + `<path d="M118 94l5 5" style="${ln(15)}"/><path d="M118 94l5 5" style="stroke:#9d968b;stroke-width:11.4"/>`
    + `<path class="heat" d="${loop}" style="fill:none;stroke:var(--pin);stroke-width:16;filter:url(#${g}f)"/>`
    + `<path d="${loop}" style="fill:none;${ln(10)}"/>`
    + `<path d="${loop}" style="fill:none;stroke:url(#${g}h);stroke-width:6.6"/>`
    + `<path d="M36 29.5H70" style="stroke:#fff;stroke-opacity:.6;stroke-width:1.6;stroke-linecap:round"/>`);
}

/** Leaderboard: a champion's belt buckle. */
function board() {
  const g = uid();
  const star = (x, y, r) => `<path d="${Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5; const k = i % 2 ? r * 0.45 : r; return `${i ? 'L' : 'M'}${(x + Math.cos(a) * k).toFixed(1)} ${(y + Math.sin(a) * k).toFixed(1)}`; }).join('')}Z" style="fill:url(#${g}g);${ln(1.4)}"/>`;
  const shoe = 'M63 34C58 56 64 79 80 79C96 79 102 56 97 34';
  return svg('0 0 160 120', `<defs>${lin(`${g}g`, [[0, hi('var(--pin)', 45)], [0.45, 'var(--pin)'], [1, lo('var(--pin)', 40)]])}`
    + lin(`${g}s`, [[0, '#f1ede6'], [0.55, '#c9c2b7'], [1, '#948c80']])
    + `<clipPath id="${g}c"><ellipse cx="80" cy="56" rx="68" ry="49"/></clipPath></defs>`
    + shadow(80, 112, 58, 4)
    + `<ellipse cx="80" cy="56" rx="68" ry="49" style="fill:url(#${g}g);${ln(2.4)}"/>`
    + `<ellipse cx="80" cy="56" rx="60.5" ry="41.5" style="fill:none;stroke:${lo('var(--pin)', 45)};stroke-width:5"/>`
    + `<ellipse cx="80" cy="56" rx="60.5" ry="41.5" style="fill:none;stroke:${hi('var(--pin)', 35)};stroke-width:5;stroke-dasharray:3 3.2"/>`
    + `<ellipse cx="80" cy="56" rx="53" ry="34" style="fill:url(#${g}s);${ln(1.6)}"/>`
    + `<path d="M40 56C46 44 54 40 60 42M120 56C114 44 106 40 100 42M40 56C46 68 54 72 60 70M120 56C114 68 106 72 100 70" style="fill:none;stroke:#7d766b;stroke-width:1;opacity:.6"/>`
    + star(44, 56, 6.5) + star(116, 56, 6.5)
    + `<path d="${shoe}" style="fill:none;${ln(14)}"/>`
    + `<path d="${shoe}" style="fill:none;stroke:var(--band);stroke-width:10;stroke-linecap:butt"/>`
    + `<path d="M64.5 40C61 57 66 74 80 74.5" style="fill:none;stroke:#fff;stroke-opacity:.35;stroke-width:2;stroke-linecap:round"/>`
    + [[63.6, 44], [64.8, 58], [70, 70], [90, 70], [95.2, 58], [96.4, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" style="fill:${LINE}"/>`).join('')
    + `<g clip-path="url(#${g}c)"><rect class="glint" x="-30" y="-10" width="16" height="140" transform="rotate(22 80 56)" style="fill:#fff;opacity:.4"/></g>`);
}

const EMBLEMS = { showdown, rodeo, trails, book, board };

/** The emblem that sits beside a mode page's title. */
export function emblem(name) {
  return EMBLEMS[name]();
}

/** Puts a mode's emblem beside the title of a page built as div.page > h1 + the rest. */
export function withEmblem(page, name) {
  page.classList.add('arty');
  const art = document.createElement('div');
  art.className = 'page-art';
  art.innerHTML = emblem(name);
  page.querySelector('h1').after(art);
  return page;
}
