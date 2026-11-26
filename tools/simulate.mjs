// Strategy simulation. Each simulated player has real but uncertain knowledge:
// a normal belief on the ruler, cut to the ruler's ends. Every strategy turns
// the same belief into a range, and all are scored on the same questions.
import { intervalScore, rng, PERFECT } from '../js/score.js';
import { probit } from '../js/stats.js';

const erf = (x) => { // Abramowitz and Stegun 7.1.26
  const s = Math.sign(x); x = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
};
const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));

/** Quantile of N(mu, sd) cut to [0, 1]. */
function cutQuantile(q, mu, sd) {
  const a = Phi((0 - mu) / sd);
  const b = Phi((1 - mu) / sd);
  return Math.min(1, Math.max(0, mu + sd * probit(Math.min(1 - 1e-9, Math.max(1e-9, a + q * (b - a))))));
}
const middle = (cover) => (mu, sd) => [cutQuantile((1 - cover) / 2, mu, sd), cutQuantile((1 + cover) / 2, mu, sd)];

export const STRATEGIES = {
  'Honest 90%': middle(0.9),
  'Far too narrow (30%)': middle(0.3),
  'Too narrow (50%)': middle(0.5),
  'A bit narrow (80%)': middle(0.8),
  'A bit wide (97%)': middle(0.97),
  'Too wide (99.8%)': middle(0.998),
  'Whole ruler every time': () => [0, 1],
  'Nine huge, one silly': (mu, sd, rand) => (rand() < 0.9 ? [0, 1] : [cutQuantile(0.495, mu, sd), cutQuantile(0.505, mu, sd)]),
  'Random ranges': (mu, sd, rand) => [rand(), rand()].sort((a, b) => a - b),
};

/** skew: how much wider the player's real error is than they believe (1 = well informed). */
export function simulate({ questions = 200000, seed = 7, sdRange = [0.03, 0.2], perDay = 7, strategies = STRATEGIES, scoreFn } = {}) {
  const world = rng(seed);
  const noise = rng(seed + 1);
  const score = scoreFn || ((l, u, x) => PERFECT - PERFECT * intervalScore(l, u, x));
  const names = Object.keys(strategies);
  const out = Object.fromEntries(names.map((n) => [n, { sum: 0, sq: 0, hits: 0, width: 0, days: [], day: 0 }]));
  for (let i = 0; i < questions; i++) {
    const [a, b] = sdRange;
    const sd = a * Math.pow(b / a, world());
    // The player's best guess is uniform over the ruler and the truth is drawn
    // from their belief, which is what having a correct belief means.
    const mu = world();
    const x = cutQuantile(world(), mu, sd);
    for (const n of names) {
      const [l, u] = strategies[n](mu, sd, noise);
      const s = score(l, u, x);
      const o = out[n];
      o.sum += s; o.sq += s * s; o.width += u - l; o.day += s;
      if (x >= l && x <= u) o.hits++;
      if ((i + 1) % perDay === 0) { o.days.push(o.day); o.day = 0; }
    }
  }
  const honest = out[names[0]];
  return names.map((name) => {
    const o = out[name];
    const mean = o.sum / questions;
    const se = Math.sqrt((o.sq / questions - mean * mean) / questions);
    let beaten = 0;
    let diffSum = 0;
    let diffSq = 0;
    o.days.forEach((d, i) => {
      const diff = honest.days[i] - d;
      if (diff > 0) beaten += 1; else if (diff === 0) beaten += 0.5;
      diffSum += diff; diffSq += diff * diff;
    });
    const D = o.days.length;
    const gap = diffSum / D;
    const gapSe = Math.sqrt((diffSq / D - gap * gap) / D);
    return { name, mean, se, perDay: mean * perDay, hitRate: o.hits / questions, width: o.width / questions, honestWinsDay: beaten / D, gap, gapSe };
  });
}

/** Best claimed coverage under a squeezed score, found on a grid. */
export function bestCoverage(transform, { sd = 0.1, questions = 60000, seed = 3 } = {}) {
  const grid = [0.02, 0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 0.93, 0.95, 0.97, 0.99];
  const strategies = Object.fromEntries(grid.map((c) => [String(c), middle(c)]));
  const rows = simulate({ questions, seed, sdRange: [sd, sd * 1.0001], strategies, scoreFn: (l, u, x) => transform(PERFECT - PERFECT * intervalScore(l, u, x)) });
  const best = rows.reduce((m, r) => (r.mean > m.mean ? r : m));
  const honest = rows[grid.indexOf(0.9)];
  return { best: Number(best.name), bestMean: best.mean, honestMean: honest.mean, gain: best.mean - honest.mean };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pad = (s, n) => String(s).padEnd(n);
  const num = (v, n = 9, d = 1) => v.toFixed(d).padStart(n);
  console.log('Seven questions a day, 200,000 simulated questions\n');
  console.log(pad('Strategy', 26) + '   points/day    catches   ruler covered   honest scores higher   honest lead per day (± 2 se)');
  for (const r of simulate()) {
    console.log(pad(r.name, 26) + num(r.perDay, 13) + num(r.hitRate * 100, 10) + '%' + num(r.width * 100, 15) + '%' + num(r.honestWinsDay * 100, 18) + '% of days' + num(r.gap, 14) + ' ± ' + (2 * r.gapSe).toFixed(1));
  }
  console.log('\nWhat a squeeze would do: best claimed coverage and the gain per question over honest 90%');
  const squeezes = {
    'Straight line (what the game uses)': (p) => p,
    'Floor at 0': (p) => Math.max(0, p),
    'Floor at -100': (p) => Math.max(-100, p),
    'Floor at -300': (p) => Math.max(-300, p),
    'Cap at 80': (p) => Math.min(80, p),
    'Sigmoid': (p) => 100 / (1 + Math.exp(-p / 40)),
  };
  for (const [name, f] of Object.entries(squeezes)) {
    const cells = [0.03, 0.06, 0.1, 0.2].map((sd) => { const b = bestCoverage(f, { sd }); return `${(b.best * 100).toFixed(0)}% (+${b.gain.toFixed(1)})`.padStart(14); });
    console.log(pad(name, 36) + cells.join(''));
  }
  console.log(pad('', 36) + ['sd 3%', 'sd 6%', 'sd 10%', 'sd 20%'].map((s) => s.padStart(14)).join(''));
}
