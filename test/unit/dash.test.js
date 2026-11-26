import test from 'node:test';
import assert from 'node:assert/strict';
import { verdict, verdictText, CHECKS, byCategory, wideLine, rateChart, curveChart, bandAt } from '../../js/dash.js';
import { rng } from '../../js/score.js';

const rows = (n, p, seed) => { const r = rng(seed); return Array.from({ length: n }, () => ({ hit: r() < p, cat: 'Space', points: 10, l: 0.4, u: 0.6, x: 0.5, width: 0.2 })); };

test('about 2.5% of perfectly calibrated players are ever called narrow', () => {
  let flagged = 0;
  const N = 6000;
  for (let i = 0; i < N; i++) {
    const all = rows(350, 0.9, i + 1);
    if (CHECKS.some((c) => verdict(all.slice(0, c.n)).kind === 'narrow')) flagged++;
  }
  assert.ok(flagged / N > 0.01 && flagged / N < 0.04, String(flagged / N));
});

test('a 70% player is nearly always caught by 100 questions', () => {
  let flagged = 0;
  for (let i = 0; i < 400; i++) { const all = rows(100, 0.7, i + 9); if (CHECKS.filter((c) => c.n <= 100).some((c) => verdict(all.slice(0, c.n)).kind === 'narrow')) flagged++; }
  assert.ok(flagged > 380, String(flagged));
});

test('nothing is said about calibration from one day', () => {
  const v = verdict(rows(7, 0.2, 3));
  assert.equal(v.kind, 'early');
  assert.match(verdictText(v), /first check comes at 20/i);
  for (let n = 0; n < 20; n++) assert.equal(verdict(rows(n, 0, 4)).kind, 'early');
});

test('too wide is only said when it is rare by luck', () => {
  for (const c of CHECKS) assert.ok(wideLine(c.n) === null || wideLine(c.n) / c.n > 0.93, `${c.n}: ${wideLine(c.n)}`);
  assert.equal(verdict(rows(20, 1, 5)).kind, 'fine');
  assert.equal(verdict(rows(100, 1, 5)).kind, 'wide');
});

test('categories sort by points and wait for enough questions', () => {
  const r = [...rows(7, 0.9, 1), { hit: false, cat: 'Food', points: -50 }];
  const c = byCategory(r);
  assert.equal(c[0].cat, 'Space');
  assert.equal(c[0].enough, true);
  assert.equal(c[1].enough, false);
});

test('charts draw only when there is enough to draw', () => {
  assert.equal(rateChart(rows(8, 0.9, 1)), '');
  assert.match(rateChart(rows(40, 0.9, 1)), /<svg/);
  assert.equal(curveChart(rows(49, 0.9, 1)), '');
  assert.match(curveChart(rows(60, 0.9, 1)), /Calibration curve/);
  assert.equal(bandAt(100), 6);
});
