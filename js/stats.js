// Statistics used on the result and dashboard screens.
import { pointsAt, rng, wilson } from './score.js';

/** Inverse of the normal CDF (Acklam's rational approximation). */
export function probit(p) {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - 0.02425) return -probit(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/**
 * What a perfectly calibrated player would score using ranges as wide as the
 * ones given. Simulated, not other people. Returns the 10th, 50th and 90th
 * percentile of the total.
 */
export function calibratedTotals(widths, { runs = 4000, seed = 1 } = {}) {
  const rand = rng(seed);
  const z90 = probit(0.95);
  const totals = [];
  for (let i = 0; i < runs; i++) {
    let sum = 0;
    for (const w of widths) {
      const half = w / 2;
      const z = Math.abs(probit(Math.min(1 - 1e-9, Math.max(1e-9, rand()))));
      // Answer position relative to a range centred on 0.5.
      const x = 0.5 + Math.sign(probit(rand()) || 1) * half * (z / z90);
      sum += Math.round(pointsAt(0.5 - half, 0.5 + half, x));
    }
    totals.push(sum);
  }
  totals.sort((p, q) => p - q);
  const at = (f) => totals[Math.min(runs - 1, Math.floor(f * runs))];
  return { p10: at(0.1), p50: at(0.5), p90: at(0.9) };
}

/**
 * Coverage curve. Each 90% range is read as the middle 90% of a bell curve on
 * the ruler, so a narrower or wider middle slice can be checked as well.
 * rows: [{ l, u, x }]. Returns [{ claim, n, k, p, lo, hi }].
 */
export function coverageCurve(rows, claims = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95]) {
  const z90 = probit(0.95);
  return claims.map((claim) => {
    const f = probit((1 + claim) / 2) / z90;
    let k = 0;
    for (const { l, u, x } of rows) {
      const mid = (l + u) / 2;
      const half = ((u - l) / 2) * f;
      if (Math.abs(x - mid) <= half + 1e-9) k++;
    }
    return { claim, n: rows.length, k, ...wilson(k, rows.length) };
  });
}
