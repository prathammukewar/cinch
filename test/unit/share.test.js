import test from 'node:test';
import assert from 'node:assert/strict';
import { symbolRow, shareText } from '../../js/share.js';

const GREEN = '\u{1F7E9}';
const ORANGE = '\u{1F7E7}';
const RED = '\u{1F7E5}';
const SHOE = '\u{1F7E1}';
const MISS = '❌';
const EMPTY = '⬜';
const cells = (s) => [...s];
const row = (l, u, x, points = 0) => ({ l, u, x, hit: x >= l && x <= u, width: u - l, points });

test('every row is seven symbols with the answer in the middle', () => {
  for (const [l, u, x] of [[0.4, 0.6, 0.5], [0, 1, 0.5], [0.1, 0.2, 0.9], [0.8, 0.9, 0.1], [0.5, 0.5, 0.5], [0.49, 0.5, 0.51], [0, 0.01, 0.02]]) {
    const c = cells(symbolRow(row(l, u, x)));
    assert.equal(c.length, 7);
    assert.equal(c[3], x >= l && x <= u ? SHOE : MISS);
  }
});

test('roped, close and missed look different, and a catch is never red', () => {
  assert.equal(symbolRow(row(0.45, 0.55, 0.5)), [EMPTY, EMPTY, GREEN, SHOE, GREEN, EMPTY, EMPTY].join(''));
  assert.equal(symbolRow(row(0.1, 0.9, 0.5)), [GREEN, GREEN, GREEN, SHOE, GREEN, GREEN, GREEN].join(''));
  const low = cells(symbolRow(row(0.1, 0.3, 0.5)));
  assert.ok(low.slice(0, 3).includes(RED) && !low.slice(4).includes(RED));
  const high = cells(symbolRow(row(0.7, 0.9, 0.5)));
  assert.ok(!high.slice(0, 3).includes(RED) && high.slice(4).includes(RED));
  assert.ok(cells(symbolRow(row(0.3, 0.48, 0.5, 12))).includes(ORANGE));
  assert.ok(!cells(symbolRow(row(0.3, 0.48, 0.5, 4))).includes(ORANGE));
});

test('share text leads with the catches, then rows, then the link, and no answers', () => {
  const t = shareText({ title: 'Roundup No. 12', score: 40, of: 700, rows: [row(0.4, 0.6, 0.5), row(0.1, 0.2, 0.9)] });
  const lines = t.split('\n');
  assert.match(lines[0], /Roundup No\. 12: roped 1 of 2, 40 points$/);
  assert.equal(lines.length, 4);
  assert.match(lines[3], /^https:\/\//);
  assert.ok(!/\d{3,}/.test(lines.slice(1, 3).join('')), 'no numbers in the symbol rows');
});

test('hints are owned up to', () => {
  const t = shareText({ title: 'x', score: 10, of: 700, rows: [{ ...row(0.4, 0.6, 0.5), hints: { scout: true, fence: 0 } }] });
  assert.match(t, /1 with hints/);
});
