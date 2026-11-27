// Dealing practice sets: which questions fit the Corral picks, and the order a set comes in.
// Plain functions with no page or storage, so the tests can run them.

export const LEVELS = [1, 2, 3];
export const KINDS = [['year', 'Years'], ['pct', 'Percentages'], ['temp', 'Temperatures'], ['amount', 'Amounts']];
export const SIZES = [5, 7, 10, 15];
export const CLOCKS = [0, 30, 10];

/** What sort of rail a question gets: years, a percentage, a temperature, or an amount. */
export function answerKind(q) {
  if (q.unit === 'year') return 'year';
  if (q.unit === '%') return 'pct';
  if (/^°[CF]$/.test(q.unit)) return 'temp';
  return 'amount';
}

/** The picks, with anything missing or out of range put back to the default. */
export function tidyPick(p) {
  const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' || Number.isFinite(x)) : []);
  const off = p?.off || {};
  return {
    off: { cat: list(off.cat), level: list(off.level), kind: list(off.kind) },
    n: SIZES.includes(p?.n) ? p.n : 7,
    clock: CLOCKS.includes(p?.clock) ? p.clock : 0,
    draw: p?.draw === 'missed' ? 'missed' : 'new',
  };
}

/** Questions whose last throw missed. A later catch takes a question off the list. */
export function missedIds(rows) {
  const last = new Map();
  for (const r of rows || []) if (r?.id) last.set(r.id, !!r.hit);
  return new Set([...last].filter(([, hit]) => !hit).map(([id]) => id));
}

const valueOf = { cat: (q) => q.category, level: (q) => q.difficulty, kind: answerKind };

/** The pool narrowed to the picks. */
export function matching(pool, pick, missed = new Set()) {
  const { off } = pick;
  return pool.filter((q) => !off.cat.includes(q.category) && !off.level.includes(q.difficulty)
    && !off.kind.includes(answerKind(q)) && (pick.draw !== 'missed' || missed.has(q.id)));
}

/** How many questions a chip would add or keep: the matches with that one value turned on. */
export function countFor(pool, pick, missed, group, value) {
  const on = { ...pick, off: { ...pick.off, [group]: pick.off[group].filter((x) => x !== value) } };
  return matching(pool, on, missed).filter((q) => valueOf[group](q) === value).length;
}

const LADDERS = { 7: [1, 2, 2, 2, 2, 3, 3], 10: [1, 1, 2, 2, 2, 2, 3, 2, 3, 3] };
/** The difficulty wanted at each spot: an easy start, a hard finish. */
export const ladder = (n) => LADDERS[n] || Array.from({ length: n }, (_, i) => (i < n * 0.15 ? 1 : i >= n * 0.7 ? 3 : 2));

/**
 * A set of n from the pool: least seen first, following the ladder as closely as the pool
 * allows, no topic twice while there are others to use, and never the same topic twice running.
 */
export function deal(pool, n, seen = {}, rand = Math.random) {
  const order = pool.map((q) => [q, rand()])
    .sort((a, b) => (seen[a[0].id] || 0) - (seen[b[0].id] || 0) || a[1] - b[1])
    .map(([q]) => q);
  const have = new Set(pool.map((q) => q.difficulty));
  const near = (d) => [d, d - 1, d + 1, d - 2, d + 2].find((x) => have.has(x));
  const out = [];
  const used = new Set();
  const cats = new Set();
  for (const want of ladder(n)) {
    const d = near(want);
    const last = out.at(-1)?.category;
    const free = (x) => !used.has(x.id);
    const q = order.find((x) => free(x) && !cats.has(x.category) && x.difficulty === d)
      || order.find((x) => free(x) && !cats.has(x.category))
      || order.find((x) => free(x) && x.category !== last && x.difficulty === d)
      || order.find((x) => free(x) && x.category !== last)
      || order.find(free);
    if (!q) break;
    out.push(q); used.add(q.id); cats.add(q.category);
  }
  return out;
}
