// Dashboard maths and charts. Nothing here compares the player with other people.
import { wilson, binomCdf } from './score.js';
import { coverageCurve } from './stats.js';
import { CURVE_MIN } from './config.js';

/**
 * Looks at fixed checkpoints only. At each one a perfectly calibrated player
 * would be flagged rarely: about 2.5% of them are ever flagged as narrow.
 */
export const CHECKS = [
  { n: 20, low: 13 }, { n: 50, low: 39 }, { n: 100, low: 81 }, { n: 200, low: 169 }, { n: 350, low: 300 },
];

/** Fewest catches that count as "too wide" at n: a calibrated player gets there less than 0.6% of the time. */
export function wideLine(n) {
  for (let k = 0; k <= n; k++) if (1 - binomCdf(k - 1, n, 0.9) < 0.006) return k;
  return null;
}

export function verdict(rows) {
  const done = CHECKS.filter((c) => rows.length >= c.n);
  const next = CHECKS.find((c) => rows.length < c.n);
  if (!done.length) return { kind: 'early', next: next.n, n: rows.length };
  const c = done[done.length - 1];
  const k = rows.slice(0, c.n).filter((r) => r.hit).length;
  const wide = wideLine(c.n);
  const kind = k <= c.low ? 'narrow' : wide !== null && k >= wide ? 'wide' : 'fine';
  return { kind, n: c.n, k, next: next?.n ?? null };
}

export function verdictText(v) {
  if (v.kind === 'early') return `The first check comes at ${v.next} questions. You have answered ${v.n}. Before that, luck drowns out everything else.`;
  const at = `At ${v.n} questions you had roped ${v.k}.`;
  const next = v.next ? ` The next check is at ${v.next}.` : '';
  if (v.kind === 'narrow') return `${at} Loops that really were 90% would almost never rope that few, so yours are probably too tight. Throw them wider.${next}`;
  if (v.kind === 'wide') return `${at} That is more than 90% loops should rope, so you can probably pull them tighter.${next}`;
  return `${at} That fits loops that really are 90%.${next}`;
}

export function byCategory(rows, min = 6) {
  const map = new Map();
  for (const r of rows) {
    const c = map.get(r.cat) || { cat: r.cat, n: 0, k: 0, pts: 0 };
    c.n++; c.k += r.hit ? 1 : 0; c.pts += r.points;
    map.set(r.cat, c);
  }
  return [...map.values()].map((c) => ({ ...c, mean: c.pts / c.n, enough: c.n >= min, ...wilson(c.k, c.n) })).sort((a, b) => b.mean - a.mean);
}

const svg = (w, h, body, label) => `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">${body}</svg>`;
const pct = (p) => `${Math.round(p * 100)}%`;

/** Catch rate over the last `span` questions, with its 95% band. */
export function rateChart(rows, span = 50) {
  const W = 720; const H = 260; const L = 46; const R = 16; const T = 16; const B = 34;
  const pts = [];
  for (let i = 9; i < rows.length; i++) {
    const part = rows.slice(Math.max(0, i + 1 - span), i + 1);
    pts.push({ i: i + 1, ...wilson(part.filter((r) => r.hit).length, part.length) });
  }
  if (pts.length < 2) return '';
  const x = (i) => L + ((i - pts[0].i) / (pts[pts.length - 1].i - pts[0].i)) * (W - L - R);
  const y = (p) => T + (1 - (p - 0.2) / 0.8) * (H - T - B);
  const yc = (p) => Math.min(H - B, y(p));
  let g = '';
  for (const p of [0.25, 0.5, 0.75]) g += `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}" stroke="var(--line)"/><text x="${L - 8}" y="${y(p) + 4}" text-anchor="end">${pct(p)}</text>`;
  const up = pts.map((p) => `${x(p.i).toFixed(1)},${yc(p.hi).toFixed(1)}`);
  const down = pts.map((p) => `${x(p.i).toFixed(1)},${yc(p.lo).toFixed(1)}`).reverse();
  g += `<polygon points="${up.concat(down).join(' ')}" fill="var(--band)" opacity=".16"/>`;
  g += `<line x1="${L}" x2="${W - R}" y1="${y(0.9)}" y2="${y(0.9)}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 4"/><text class="strong" x="${L - 8}" y="${y(0.9) + 4}" text-anchor="end">90%</text>`;
  g += `<polyline points="${pts.map((p) => `${x(p.i).toFixed(1)},${yc(p.p).toFixed(1)}`).join(' ')}" fill="none" stroke="var(--band)" stroke-width="3" stroke-linejoin="round"/>`;
  const last = pts[pts.length - 1];
  g += `<circle cx="${x(last.i)}" cy="${yc(last.p)}" r="5.5" fill="var(--pin)" stroke="var(--ink)" stroke-width="1.5"/>`;
  g += `<text x="${L}" y="${H - 8}">question ${pts[0].i}</text><text x="${W - R}" y="${H - 8}" text-anchor="end">${last.i}</text>`;
  return svg(W, H, g, `Catch rate over the last ${span} questions, now ${pct(last.p)}`);
}

export function curveChart(rows) {
  if (rows.length < CURVE_MIN) return '';
  const pts = coverageCurve(rows);
  const W = 520; const H = 420; const L = 52; const R = 20; const T = 16; const B = 46;
  const lo = 0.2;
  const x = (p) => L + ((p - 0.45) / 0.55) * (W - L - R);
  const y = (p) => T + (1 - (Math.max(lo, p) - lo) / (1 - lo)) * (H - T - B);
  let g = '';
  for (const p of [0.25, 0.5, 0.75, 1]) g += `<line x1="${L}" x2="${W - R}" y1="${y(p)}" y2="${y(p)}" stroke="var(--line)"/><text x="${L - 8}" y="${y(p) + 4}" text-anchor="end">${pct(p)}</text>`;
  for (const p of pts) g += `<text x="${x(p.claim)}" y="${H - 24}" text-anchor="middle">${p.claim === 0.95 ? '95' : pct(p.claim)}</text>`;
  g += `<text x="${L}" y="${H - 5}">claimed</text>`;
  g += `<line x1="${x(0.5)}" y1="${y(0.5)}" x2="${x(0.95)}" y2="${y(0.95)}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 4"/>`;
  const up = pts.map((p) => `${x(p.claim)},${y(p.hi)}`);
  const down = pts.map((p) => `${x(p.claim)},${y(p.lo)}`).reverse();
  g += `<polygon points="${up.concat(down).join(' ')}" fill="var(--band)" opacity=".16"/>`;
  g += `<polyline points="${pts.map((p) => `${x(p.claim)},${y(p.p)}`).join(' ')}" fill="none" stroke="var(--band)" stroke-width="3"/>`;
  for (const p of pts) g += `<circle cx="${x(p.claim)}" cy="${y(p.p)}" r="${p.claim === 0.9 ? 6.5 : 4.5}" fill="${p.claim === 0.9 ? 'var(--pin)' : 'var(--band)'}" stroke="var(--ink)" stroke-width="${p.claim === 0.9 ? 1.5 : 0}"/>`;
  return svg(W, H, g, `Calibration curve. At the 90% claim you caught ${pct(pts.find((p) => p.claim === 0.9).p)}.`);
}

/** Half-width of the 95% band at n questions, in points, for a true 90% player. */
export const bandAt = (n) => { const w = wilson(Math.round(n * 0.9), n); return Math.round(((w.hi - w.lo) / 2) * 100); };
