# How Cinch scores a loop

## The rule

Every question has a fixed rail (the ruler). Positions on it run from 0 to 1, on a scale that multiplies for numbers of every size and a straight scale for years, percentages and temperatures. For a loop from l to u and an answer at x:

    width  = u - l
    inside = 100 * (1 - width)                       if l <= x <= u
    gap    = how far x lies outside the loop
    fade   = max(0, 1 - gap / (0.5 * width))
    points = inside * fade^2                         if x is outside

In words: inside your loop you score 100 minus the share of the rail it covers. Outside it, those points fade to nothing once the answer is half a loop's width beyond the edge. Tight loops are worth more and fade faster. Nothing goes below zero. Hints multiply the result: fence in once keeps 75%, twice 50%, and a scout keeps 85%.

## What it rewards

200,000 simulated questions. Each simulated player has a true but uncertain belief (a bell curve on the rail, spread between 3% and 20% of it), and each habit turns the same belief into a loop.

| Habit | Points a day | Roped | Rail covered |
|---|---|---|---|
| Honest 90% | 498 | 90% | 26% |
| Far too narrow (30%) | 257 | 30% | 6% |
| Too narrow (50%) | 392 | 50% | 11% |
| A bit narrow (80%) | 502 | 80% | 21% |
| A bit wide (97%) | 460 | 97% | 34% |
| Too wide (99.8%) | 382 | 100% | 45% |
| Whole ruler every time | 0 | 100% | 100% |
| Nine huge, one silly | 1 | 90% | 90% |
| Random ranges | 153 | 34% | 33% |

Honest 90% loops come within about 1% of the best habit and far ahead of the gambling ones. "Nine huge, one silly" also ropes 90% of answers and scores almost nothing.

## The trade-off

An earlier version used the interval score, where a miss cost 20 points for every 1% of the rail and totals could go negative. That rule makes an honest 90% loop the single best play at every level of knowledge. A score that cannot go below zero cannot do that exactly. Best-paying loop size, by how unsure the player is:

| How unsure (spread as a share of the rail) | 2% | 5% | 10% | 20% |
|---|---|---|---|---|
| Best loop under this rule | 95% | 90% | 80% | 70% |
| Points a question it gains over a 90% loop | 0.9 | 0.0 | 1.6 | 9.4 |
| Best loop under the old interval score | 90% | 90% | 90% | 90% |

So when you know a subject, the honest loop is the best one. When you are guessing, a loop a little tighter than 90% pays a few points more on average. The Brand Book does not use points at all: it checks how often your 90% loops really rope the answer, which is the honest measure either way.

## Small samples

A perfectly judged player ropes all seven on 47.8% of days, six on 37.2%, five on 12.4%, and four or fewer on 2.6%. The 95% band around a 90% rate is about 9 points either side at 50 questions, 6 at 100 and 4 at 220. The Brand Book makes a call only at 20, 50, 100, 200 and 350 questions, at 13, 39, 81, 169 and 300 ropes or fewer. About 2.5% of perfectly judged players would ever be told their loops look tight.

Reproduce with `node tools/simulate.mjs` and `node tools/proof.mjs`. The same checks run in `test/unit/simulation.test.js`.
