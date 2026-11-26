import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, bestCoverage, STRATEGIES } from '../../tools/simulate.mjs';

const rows = simulate({ questions: 70000 });
const honest = rows[0];

test('the honest player really catches 90%', () => {
  assert.equal(honest.name, 'Honest 90%');
  assert.ok(Math.abs(honest.hitRate - 0.9) < 0.005, String(honest.hitRate));
});

for (const r of rows.slice(1)) {
  test(`honest beats: ${r.name}`, () => {
    assert.ok(r.gap - 3 * r.gapSe > 0, `lead ${r.gap.toFixed(1)} a day, give or take ${(3 * r.gapSe).toFixed(1)}`);
  });
}

test('nine huge and one silly also covers 90%, and still loses badly', () => {
  const r = rows.find((x) => x.name.startsWith('Nine huge'));
  assert.ok(Math.abs(r.hitRate - 0.9) < 0.01);
  assert.ok(r.perDay < 0);
});

test('every strategy in the list was simulated', () => {
  assert.equal(rows.length, Object.keys(STRATEGIES).length);
});

test('the best claimed coverage under the real score is 90% at every skill level', () => {
  for (const sd of [0.03, 0.1, 0.2]) assert.equal(bestCoverage((p) => p, { sd, questions: 30000 }).best, 0.9);
});

test('a floor at zero would reward gambling for players who know little', () => {
  const b = bestCoverage((p) => Math.max(0, p), { sd: 0.2, questions: 30000 });
  assert.ok(b.best < 0.85 && b.gain > 2, JSON.stringify(b));
});
