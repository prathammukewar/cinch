// Write data/proof.json and docs/scoring.md from the strategy simulation.
import { writeFileSync, mkdirSync } from 'node:fs';
import { simulate, bestCoverage } from './simulate.mjs';

const questions = 200000;
const rows = simulate({ questions });
writeFileSync(new URL('../data/proof.json', import.meta.url), JSON.stringify({ questions, rows: rows.map(({ name, perDay, hitRate }) => ({ name, perDay: Math.round(perDay * 10) / 10, hitRate: Math.round(hitRate * 1000) / 1000 })) }));

const n = (v, d = 0) => v.toFixed(d).replace('-', '\u2212');
const sds = [0.03, 0.1, 0.2, 0.4];
const squeezes = [
  ['Straight line (used in the game)', (p) => p],
  ['Floor at 0', (p) => Math.max(0, p)],
  ['Floor at \u2212100', (p) => Math.max(-100, p)],
  ['Floor at \u2212300', (p) => Math.max(-300, p)],
  ['Cap at 80', (p) => Math.min(80, p)],
  ['Sigmoid squash', (p) => 100 / (1 + Math.exp(-p / 40))],
];
const cells = squeezes.map(([name, f]) => [name, ...sds.map((sd) => { const b = bestCoverage(f, { sd }); return `${Math.round(b.best * 100)}% (+${n(Math.max(0, b.gain), 1)})`; })]);

const md = `# Scoring proof

## The rule

Every question has a fixed ruler. Positions on it run from 0 to 1, on a log scale for numbers that span many sizes and a straight scale for years, percentages and temperatures. For a range from l to u and an answer x:

    points = 100 - 100 * [ (u - l) + 20 * max(0, l - x) + 20 * max(0, x - u) ]

In words: start at 100, lose 1 point for every 1% of the ruler you cover, and 20 for every 1% the answer misses your range by. The whole ruler scores 0. There is no cap and no floor.

## Why honest 90% ranges are best

The bracket is the interval score for a 90% range, with 20 = 2 / 0.10 (Winkler 1972, Gneiting and Raftery 2007). It is proper, and it stays proper when the numbers are first put through any fixed increasing function, which is what the ruler is. Points are a straight line of it, so the order of preference never changes.

Directly: moving your high end down by a small step d always earns 100d points, and costs 2,000d when the answer is above it. The trade pays only while the chance of the answer being above is under 100 / 2,000 = 5%. The same holds at the low end. The best range leaves 5% on each side, which is the 90% range.

The ruler is shown before you answer and does not depend on what you enter, and the answer is placed on it uniformly at random when the question is built (between 7% and 93% of the way along), so the middle of the ruler is not a hint. Ends typed past the ruler are moved to its edge. The score itself is never clipped.

## Simulation

${questions.toLocaleString('en-US')} questions. Each simulated player has a true but uncertain belief (a bell curve on the ruler, standard deviation between 3% and 20% of it), and each strategy turns the same belief into a range.

| Strategy | Points a day | Caught | Ruler covered | Honest scores higher | Honest lead a day |
|---|---|---|---|---|---|
${rows.map((r) => `| ${r.name} | ${n(r.perDay)} | ${n(r.hitRate * 100)}% | ${n(r.width * 100)}% | ${r === rows[0] ? '' : `${n(r.honestWinsDay * 100)}% of days`} | ${r === rows[0] ? '' : `${n(r.gap, 1)} \u00b1 ${n(2 * r.gapSe, 1)}`} |`).join('\n')}

"Nine huge, one silly" also catches 90% of answers. A score that only counted catches would call it perfect. This one gives it less than nothing.

The peak is flat near the top: claiming 80% or 97% instead of 90% costs only about 4% of the points. That is a property of every proper score for ranges. It means the score is fair, and that one day cannot tell a slightly overconfident player from an honest one.

## What a squeeze would have done

Best claimed coverage under each squeezed score, and the points per question gained over the honest range. Columns are how uncertain the player is, as a share of the ruler.

| Score | ${sds.map((s) => `sd ${Math.round(s * 100)}%`).join(' | ')} |
|---|${sds.map(() => '---').join('|')}|
${cells.map((c) => `| ${c.join(' | ')} |`).join('\n')}

A floor at zero does little harm to a player who knows the subject and a lot to one who does not: the worse you know a topic, the more it pays to gamble. Caps push the other way, toward ranges that are too wide. That is why the game shows negative scores instead.

## Small samples

A perfectly calibrated player catches all seven on 47.8% of days, six on 37.2%, five on 12.4%, and four or fewer on 2.6%. The 95% band around a 90% catch rate is about 9 points either side at 50 questions, 6 at 100 and 4 at 220. The dashboard therefore makes a call only at 20, 50, 100, 200 and 350 questions, at 13, 39, 81, 169 and 300 catches or fewer. About 2.5% of perfectly calibrated players would ever be told their ranges look narrow.

Reproduce with \`node tools/simulate.mjs\` and \`node tools/proof.mjs\`. The same checks run in \`test/unit/simulation.test.js\`.
`;
mkdirSync(new URL('../docs/', import.meta.url), { recursive: true });
writeFileSync(new URL('../docs/scoring.md', import.meta.url), md);
console.log(md.split('## Simulation')[1].split('## Small')[0]);
