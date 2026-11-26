// Write data/proof.json and docs/scoring.md from the strategy simulation.
import { writeFileSync, mkdirSync } from 'node:fs';
import { simulate, bestCoverage } from './simulate.mjs';
import { intervalScore } from '../js/score.js';

const questions = 200000;
const rows = simulate({ questions });
writeFileSync(new URL('../data/proof.json', import.meta.url), JSON.stringify({ questions, rows: rows.map(({ name, perDay, hitRate }) => ({ name, perDay: Math.round(perDay * 10) / 10, hitRate: Math.round(hitRate * 1000) / 1000 })) }));

const n = (v, d = 0) => v.toFixed(d).replace('-', '−');
const sds = [0.02, 0.05, 0.1, 0.2];
const best = sds.map((sd) => bestCoverage((p) => p, { sd }));
const proper = (l, u, x) => 100 - 100 * intervalScore(l, u, x);
const oldBest = sds.map((sd) => bestCoverage((p) => p, { sd, scoreFn: proper }));

const md = `# How Cinch scores a loop

## The rule

Every question has a fixed rail (the ruler). Positions on it run from 0 to 1, on a scale that multiplies for numbers of every size and a straight scale for years, percentages and temperatures. For a loop from l to u and an answer at x:

    width  = u - l
    inside = 100 * (1 - width)                       if l <= x <= u
    gap    = how far x lies outside the loop
    fade   = max(0, 1 - gap / (0.5 * width))
    points = inside * fade^2                         if x is outside

In words: inside your loop you score 100 minus the share of the rail it covers. Outside it, those points fade to nothing once the answer is half a loop's width beyond the edge. Tight loops are worth more and fade faster. Nothing goes below zero. Fence in shortens the rail to a stretch that holds the answer, and the loop is then measured against that shorter rail, so a loop around the whole fenced stretch scores 0. On top of that, fence in once keeps 85% of the points, twice 70%, and a scout keeps 85%. Scout marks can sit on either side of the answer.

## What it rewards

${questions.toLocaleString('en-US')} simulated questions. Each simulated player has a true but uncertain belief (a bell curve on the rail, spread between 3% and 20% of it), and each habit turns the same belief into a loop.

| Habit | Points a day | Roped | Rail covered |
|---|---|---|---|
${rows.map((r) => `| ${r.name} | ${n(r.perDay)} | ${n(r.hitRate * 100)}% | ${n(r.width * 100)}% |`).join('\n')}

Honest 90% loops come within about 1% of the best habit and far ahead of the gambling ones. "Nine huge, one silly" also ropes 90% of answers and scores almost nothing.

## The trade-off

An earlier version used the interval score, where a miss cost 20 points for every 1% of the rail and totals could go negative. That rule makes an honest 90% loop the single best play at every level of knowledge. A score that cannot go below zero cannot do that exactly. Best-paying loop size, by how unsure the player is:

| How unsure (spread as a share of the rail) | ${sds.map((s) => `${Math.round(s * 100)}%`).join(' | ')} |
|---|${sds.map(() => '---').join('|')}|
| Best loop under this rule | ${best.map((b) => `${Math.round(b.best * 100)}%`).join(' | ')} |
| Points a question it gains over a 90% loop | ${best.map((b) => n(b.gain, 1)).join(' | ')} |
| Best loop under the old interval score | ${oldBest.map((b) => `${Math.round(b.best * 100)}%`).join(' | ')} |

So when you know a subject, the honest loop is the best one. When you are guessing, a loop a little tighter than 90% pays a few points more on average. The Brand Book does not use points at all: it checks how often your 90% loops really rope the answer, which is the honest measure either way.

## Small samples

A perfectly judged player ropes all seven on 47.8% of days, six on 37.2%, five on 12.4%, and four or fewer on 2.6%. The 95% band around a 90% rate is about 9 points either side at 50 questions, 6 at 100 and 4 at 220. The Brand Book makes a call only at 20, 50, 100, 200 and 350 questions, at 13, 39, 81, 169 and 300 ropes or fewer. About 2.5% of perfectly judged players would ever be told their loops look tight.

Reproduce with \`node tools/simulate.mjs\` and \`node tools/proof.mjs\`. The same checks run in \`test/unit/simulation.test.js\`.
`;
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/scoring.md', import.meta.url), md);
console.log(md.split('## The trade-off')[1].split('## Small')[0]);
