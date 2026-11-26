// Scoring. Every question has a fixed ruler [min, max], log or linear.
// Positions on the ruler run from 0 to 1. The score is the 90% interval score
// measured on the ruler and flipped so that more is better:
//
//   points = 100 - 100 * [ (u - l) + 20 * max(0, l - x) + 20 * max(0, x - u) ]
//
// In words: start at 100, lose 1 point for each 1% of the ruler you cover,
// and 20 for each 1% you miss by. It is a straight line of a proper score, so
// the honest 90% range has the best average. There is no cap and no floor.

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

/** Score one range given in real values. */
export function scoreRange(low, high, answer, ruler) {
  const a = Math.min(low, high);
  const b = Math.max(low, high);
  const l = toUnit(a, ruler);
  const u = toUnit(b, ruler);
  const x = toUnit(answer, ruler);
  const hit = answer >= a && answer <= b;
  const gap = hit ? 0 : Math.max(l - x, x - u, 0);
  const exact = PERFECT - PERFECT * ((u - l) + MISS * gap);
  return { l, u, x, hit, width: u - l, gap, exact, points: Math.round(exact), side: hit ? 0 : answer < a ? -1 : 1 };
}

/** A catch is tight when it covers at most this share of the ruler. */
export const TIGHT = 0.25;

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
