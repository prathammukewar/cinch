import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, bestCoverage, STRATEGIES } from '../../tools/simulate.mjs';

const rows = simulate({ questions: 70000 });
const honest = rows[0];
const by = (name) => rows.find((r) => r.name.startsWith(name));

test('the honest player really ropes 90%', () => {
  assert.equal(honest.name, 'Honest 90%');
  assert.ok(Math.abs(honest.hitRate - 0.9) < 0.005, String(honest.hitRate));
});

test('no habit beats honest loops by more than 2%', () => {
  for (const r of rows) assert.ok(r.perDay < honest.perDay * 1.02, `${r.name}: ${r.perDay.toFixed(0)} against ${honest.perDay.toFixed(0)}`);
});

for (const name of ['Far too narrow', 'Too narrow', 'Too wide', 'Whole ruler', 'Nine huge', 'Random']) {
  test(`honest clearly beats: ${name}`, () => {
    const r = by(name);
    assert.ok(r.gap - 3 * r.gapSe > 30, `lead ${r.gap.toFixed(1)} a day, give or take ${(3 * r.gapSe).toFixed(1)}`);
  });
}

test('nine huge and one silly also covers 90%, and still scores almost nothing', () => {
  const r = by('Nine huge');
  assert.ok(Math.abs(r.hitRate - 0.9) < 0.01);
  assert.ok(r.perDay < 10);
});

test('every strategy in the list was simulated', () => {
  assert.equal(rows.length, Object.keys(STRATEGIES).length);
});

test('for questions you know well, the best loop is close to 90%', () => {
  const b = bestCoverage((p) => p, { sd: 0.03, questions: 30000 });
  assert.ok(b.best >= 0.85 && b.gain < 1, JSON.stringify(b));
});

test('for questions you barely know, a slightly tighter loop pays a little more (the documented trade-off)', () => {
  const b = bestCoverage((p) => p, { sd: 0.2, questions: 30000 });
  assert.ok(b.best < 0.9 && b.gain < 10, JSON.stringify(b));
});
