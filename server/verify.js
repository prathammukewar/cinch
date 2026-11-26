// Recomputes a Roundup score from the loops a rider threw, with the game's own scoring code,
// so a leaderboard score can only come from loops that were really thrown.
import { forDay, setBase } from '../js/bank.js';
import { scoreRange, HINTS } from '../js/score.js';

export class Refused extends Error {}

/** loops: one { lo, hi, fence, scout } per question, in order. Returns points per question, hits and the total. */
export async function scoreLoops(site, day, loops) {
  setBase(site);
  const qs = await forDay(day);
  if (!Array.isArray(loops) || loops.length !== qs.length) throw new Refused('bad loops');
  const points = [];
  let hits = '';
  qs.forEach((q, i) => {
    const p = loops[i] || {};
    const lo = Number(p.lo);
    const hi = Number(p.hi);
    const fence = [0, 1, 2].includes(p.fence) ? p.fence : 0;
    const scout = p.scout === true;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) throw new Refused('bad loop');
    if (fence && !q.trims?.[fence - 1]) throw new Refused('no fence here');
    if (scout && !q.marks?.length) throw new Refused('no scout here');
    const r = scoreRange(lo, hi, q.answer, { min: q.min, max: q.max, scale: q.scale }, fence ? q.trims[fence - 1] : [0, 1]);
    points.push(Math.round(r.exact * (scout ? HINTS.scout : 1) * HINTS.fence[fence]));
    hits += r.hit ? '1' : '0';
  });
  return { points, hits, score: points.reduce((s, x) => s + x, 0) };
}
