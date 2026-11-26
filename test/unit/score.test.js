import test from 'node:test';
import assert from 'node:assert/strict';
import { intervalScore, scoreRange, pointsAt, toUnit, fromUnit, kindOf, wilson, binomCdf, total } from '../../js/score.js';
import { probit, calibratedTotals, coverageCurve } from '../../js/stats.js';

const log = { min: 1000, max: 1e7, scale: 'log' };
const pct = { min: 0, max: 100, scale: 'linear' };
const cold = { min: -140, max: 20, scale: 'linear' };
const near = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} is not ${b}`);

test('positions on the ruler go both ways', () => {
  for (const r of [log, pct, cold]) for (const t of [0, 0.1, 0.5, 0.93, 1]) near(toUnit(fromUnit(t, r), r), t);
  near(toUnit(1e5, log), 0.5);
  near(toUnit(-140, cold), 0);
  near(toUnit(5e9, log), 1);
  near(toUnit(1, log), 0);
});

test('the interval score matches its definition', () => {
  near(intervalScore(0.2, 0.5, 0.3), 0.3);
  near(intervalScore(0.2, 0.5, 0.1), 0.3 + 20 * 0.1);
  near(intervalScore(0.2, 0.5, 0.55), 0.3 + 20 * 0.05);
  near(intervalScore(0.2, 0.5, 0.2), 0.3);
});

test('a catch earns 100 minus the share covered', () => {
  const r = scoreRange(50, 80, 71, pct);
  assert.equal(r.points, 70);
  assert.equal(r.hit, true);
  assert.equal(kindOf(r), 'wide');
  assert.equal(kindOf(scoreRange(60, 80, 71, pct)), 'tight');
});

test('outside the range, points fade to zero over half the range width', () => {
  const near = scoreRange(50, 70, 71, pct);       // 20% wide, 1% outside, fade reaches 10%
  assert.equal(near.hit, false);
  assert.equal(near.points, Math.round(80 * 0.9 * 0.9));
  assert.equal(scoreRange(50, 70, 80, pct).points, 0);   // exactly at the edge of the fade
  assert.equal(scoreRange(50, 60, 71, pct).points, 0);
  assert.equal(near.side, 1);
  assert.equal(scoreRange(80, 90, 71, pct).side, -1);
  assert.equal(kindOf(near), 'miss');
});

test('a tighter range fades faster', () => {
  const wide = pointsAt(0.4, 0.6, 0.62) / pointsAt(0.4, 0.6, 0.5);
  const tight = pointsAt(0.45, 0.55, 0.57) / pointsAt(0.45, 0.55, 0.5);
  assert.ok(tight < wide, `${tight} should be below ${wide}`);
});

test('ends in the wrong order are swapped, and edges count as inside', () => {
  assert.equal(scoreRange(80, 50, 71, pct).points, 70);
  assert.equal(scoreRange(71, 80, 71, pct).hit, true);
  assert.equal(scoreRange(50, 71, 71, pct).hit, true);
});

test('the whole ruler scores zero and an exact answer scores 100', () => {
  assert.equal(scoreRange(0, 100, 71, pct).points, 0);
  assert.equal(scoreRange(71, 71, 71, pct).points, 100);
});

test('points never go below zero', () => {
  let s = 7;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 5000; i++) {
    const a = r() * 100; const b = r() * 100; const x = r() * 100;
    const p = scoreRange(a, b, x, pct).points;
    assert.ok(p >= 0 && p <= 100, `${a} ${b} ${x} gave ${p}`);
  }
  assert.equal(scoreRange(0, 0, 100, pct).points, 0);
});

test('negative numbers and years work on a linear ruler', () => {
  assert.equal(scoreRange(-100, -60, -89.2, cold).points, 75);
  assert.equal(scoreRange(-100, -60, -50, cold).points, 19);
  assert.equal(scoreRange(-100, -60, -30, cold).points, 0);
  assert.equal(scoreRange(1880, 1900, 1889, { min: 1700, max: 1950, scale: 'linear' }).points, 92);
});

test('log rulers charge by ratio, whatever the size', () => {
  const a = scoreRange(1e4, 2e4, 1.5e4, log).points;
  const b = scoreRange(1e6, 2e6, 1.5e6, log).points;
  assert.equal(a, b);
});

test('totals add up what is shown', () => {
  const rows = [scoreRange(50, 80, 71, pct), scoreRange(50, 60, 71, pct)];
  assert.equal(total(rows), rows[0].points + rows[1].points);
});

test('luck numbers used on screen are right', () => {
  near(0.9 ** 7, 0.4783, 1e-4);
  near(1 - binomCdf(6, 7, 0.9), 0.4783, 1e-4);
  near(binomCdf(6, 7, 0.9) - binomCdf(5, 7, 0.9), 0.372, 1e-3);
  near(binomCdf(5, 7, 0.9) - binomCdf(4, 7, 0.9), 0.124, 1e-3);
  near(binomCdf(4, 7, 0.9), 0.0257, 1e-3);
  const w = wilson(90, 100);
  near((w.hi - w.lo) / 2, 0.06, 0.004);
  const w2 = wilson(198, 220);
  near((w2.hi - w2.lo) / 2, 0.04, 0.003);
});

test('probit inverts the normal curve', () => {
  near(probit(0.95), 1.6448536, 1e-5);
  near(probit(0.5), 0, 1e-9);
  near(probit(0.001), -3.0902323, 1e-4);
});

test('the simulated calibrated player is centred and repeatable', () => {
  const a = calibratedTotals(Array(7).fill(0.25), { seed: 5 });
  assert.deepEqual(a, calibratedTotals(Array(7).fill(0.25), { seed: 5 }));
  assert.ok(a.p10 <= a.p50 && a.p50 <= a.p90);
  assert.ok(a.p90 <= 7 * 75);
});

test('the coverage curve finds a calibrated player on the line', () => {
  let s = 1;
  const rand = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const rows = Array.from({ length: 6000 }, () => {
    const mid = 0.5; const half = 0.1;
    return { l: mid - half, u: mid + half, x: mid + (probit(rand()) / probit(0.95)) * half };
  });
  for (const p of coverageCurve(rows)) near(p.p, p.claim, 0.02);
});
