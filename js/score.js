// Scoring. Every question has a fixed ruler [min, max], log or linear, with positions from 0 to 1.
//
// Inside your range you score 100 minus 100 times the share of the ruler it covers.
// Outside it, those points fade to zero, reaching zero once the answer is half your
// range's width away. Tighter ranges are worth more but fade faster. Nothing goes below 0.

export const FADE = 0.5;   // how far the fade reaches, as a share of the range's width
export const ALPHA = 0.1;
export const MISS = 2 / ALPHA; // 20
export const PERFECT = 100;

export function toUnit(value, ruler) {
  const { min, max, scale } = ruler;
  const t = scale === 'log'
    ? Math.log(value / min) / Math.log(max / min)
    : (value - min) / (max - min);
  return Math.min(1, Math.max(0, t));
}

export function fromUnit(t, ruler) {
  const { min, max, scale } = ruler;
  const c = Math.min(1, Math.max(0, t));
  return scale === 'log' ? min * Math.pow(max / min, c) : min + c * (max - min);
}

/** Interval score in ruler units, for positions l <= u and answer x. */
export function intervalScore(l, u, x) {
  return (u - l) + MISS * Math.max(0, l - x) + MISS * Math.max(0, x - u);
}

/** Points at position x for a range from l to u, before rounding. */
export function pointsAt(l, u, x) {
  const w = u - l;
  const plateau = PERFECT * (1 - w);
  if (x >= l && x <= u) return plateau;
  const gap = x < l ? l - x : x - u;
  const reach = FADE * w;
  if (reach <= 0 || gap >= reach) return 0;
  const f = 1 - gap / reach;
  return plateau * f * f;
}

/**
 * Score one range given in real values. view is the stretch of the ruler still showing
 * after Fence in, as shares of it. The loop is measured against what is showing, so a
 * loop around the whole fenced rail scores 0, the same as one around the whole rail.
 */
export function scoreRange(low, high, answer, ruler, view = [0, 1]) {
  const a = Math.min(low, high);
  const b = Math.max(low, high);
  const l = toUnit(a, ruler);
  const u = toUnit(b, ruler);
  const x = toUnit(answer, ruler);
  const [va, vb] = view;
  const span = Math.max(1e-9, vb - va);
  const rel = (t) => Math.min(1, Math.max(0, (t - va) / span));
  const hit = answer >= a && answer <= b;
  const [rl, ru, rx] = [rel(l), rel(u), rel(x)];
  const gap = hit ? 0 : Math.max(rl - rx, rx - ru, 0);
  const exact = pointsAt(rl, ru, rx);
  return { l, u, x, hit, width: ru - rl, gap, exact, points: Math.round(exact), side: hit ? 0 : answer < a ? -1 : 1 };
}

/** A catch is tight when it covers at most this share of the ruler. */
export const TIGHT = 0.25;

/** What each throw is called, by the points it scored. A miss that still scores well is a Leaner. */
export const TIERS = [
  { key: 'dead', name: 'Dead ringer', min: 96 },
  { key: 'ringer', name: 'Ringer', min: 81 },
  { key: 'hogtied', name: 'Hog-tied', min: 61 },
  { key: 'roped', name: 'Roped', min: 41 },
  { key: 'snagged', name: 'Snagged', min: 21 },
  { key: 'dust', name: 'Dust devil', min: 1 },
  { key: 'tumble', name: 'Tumbleweed', min: -Infinity },
];
export const LEANER = { key: 'leaner', name: 'Leaner', min: 41 };

export function tierOf(row) {
  const p = row.points ?? 0;
  if (!row.hit && p >= LEANER.min) return LEANER;
  return TIERS.find((t) => p >= t.min);
}

export function kindOf(result) {
  if (!result.hit) return 'miss';
  return result.width <= TIGHT ? 'tight' : 'wide';
}

export function total(results) {
  return results.reduce((s, r) => s + r.points, 0);
}

// ---------------------------------------------------------------- statistics

/** Wilson interval for k of n. z defaults to a 95% band. */
export function wilson(k, n, z = 1.96) {
  if (!n) return { p: 0, lo: 0, hi: 1 };
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { p, lo: Math.max(0, c - h), hi: Math.min(1, c + h) };
}

/** P(X <= k) for X ~ Binomial(n, p). */
export function binomCdf(k, n, p) {
  let sum = 0;
  let term = Math.pow(1 - p, n);
  for (let i = 0; i <= k; i++) {
    sum += term;
    term *= ((n - i) / (i + 1)) * (p / (1 - p));
  }
  return Math.min(1, sum);
}

/** Small seeded generator, so simulations and daily picks repeat exactly. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  return (h ^ (h >>> 15)) >>> 0;
}
