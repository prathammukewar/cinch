import test from 'node:test';
import assert from 'node:assert/strict';
import { symbolRow, shareText } from '../../js/share.js';

const cells = (s) => [...s];
const row = (l, u, x) => ({ l, u, x, hit: x >= l && x <= u, width: u - l, points: 0 });

test('every row is seven symbols with the answer in the middle', () => {
  for (const [l, u, x] of [[0.4, 0.6, 0.5], [0, 1, 0.5], [0.1, 0.2, 0.9], [0.8, 0.9, 0.1], [0.5, 0.5, 0.5], [0.49, 0.5, 0.51], [0, 0.01, 0.02]]) {
    const c = cells(symbolRow(row(l, u, x)));
    assert.equal(c.length, 7);
    assert.equal(c[3], x >= l && x <= u ? '\u{1F7E1}' : '❌');
  }
});

test('tight, wide and miss look different', () => {
  assert.equal(symbolRow(row(0.45, 0.55, 0.5)), '⬜⬜\u{1F7E5}\u{1F7E1}\u{1F7E5}⬜⬜');
  assert.equal(symbolRow(row(0.1, 0.9, 0.5)), '\u{1F7E5}\u{1F7E5}\u{1F7E5}\u{1F7E1}\u{1F7E5}\u{1F7E5}\u{1F7E5}');
  const low = cells(symbolRow(row(0.1, 0.3, 0.5)));
  assert.ok(low.slice(0, 3).includes('\u{1F7E5}') && !low.slice(4).includes('\u{1F7E5}'));
  const high = cells(symbolRow(row(0.7, 0.9, 0.5)));
  assert.ok(!high.slice(0, 3).includes('\u{1F7E5}') && high.slice(4).includes('\u{1F7E5}'));
});

test('share text has the day, the score and no answers', () => {
  const t = shareText({ title: 'no. 12', score: -40, of: 700, rows: [row(0.4, 0.6, 0.5), row(0.1, 0.2, 0.9)] });
  const lines = t.split('\n');
  assert.match(lines[0], /no\. 12: −40 of 700/);
  assert.equal(lines.length, 4);
  assert.equal(lines[3], 'Caught 1 of 2');
});
