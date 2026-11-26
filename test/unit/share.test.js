import test from 'node:test';
import assert from 'node:assert/strict';
import { shareText, iconOf, ICONS } from '../../js/share.js';
import { scoreRange } from '../../js/score.js';

const rail = { min: 0, max: 100, scale: 'linear' };
const row = (lo, hi, x, extra = {}) => ({ ...scoreRange(lo, hi, x, rail), ...extra });

test('each throw is one emoji for its name, from the best to nothing', () => {
  assert.equal(iconOf(row(49, 51, 50)), ICONS.dead);
  assert.equal(iconOf(row(45, 55, 50)), ICONS.ringer);
  assert.equal(iconOf(row(35, 65, 50)), ICONS.hogtied);
  assert.equal(iconOf(row(25, 75, 50)), ICONS.roped);
  assert.equal(iconOf(row(10, 80, 50)), ICONS.snagged);
  assert.equal(iconOf(row(5, 95, 50)), ICONS.dust);
  assert.equal(iconOf(row(0, 100, 50)), ICONS.tumble);
  assert.equal(iconOf(row(80, 90, 20)), ICONS.tumble);
  assert.equal(iconOf(row(45, 49, 49.5)), ICONS.leaner);
});

test('share text is three lines: the score, one emoji per question, the link', () => {
  const rows = [row(45, 55, 50), row(80, 90, 20), row(25, 75, 50)];
  const score = rows.reduce((s, r) => s + r.points, 0);
  const lines = shareText({ title: 'No. 12', score, of: 700, rows }).split('\n');
  assert.equal(lines.length, 3);
  assert.equal(lines[0], `Cinch No. 12 \u00b7 ${score} of 700 \u00b7 roped 2 of 3`);
  assert.equal(lines[1], ICONS.ringer + ICONS.tumble + ICONS.roped);
  assert.match(lines[2], /^https:\/\//);
  assert.ok(!/\d/.test(lines[1]), 'no numbers, so no answers, in the emoji row');
});

test('hints are owned up to on the first line', () => {
  const t = shareText({ title: 'x', score: 10, of: 700, rows: [row(40, 60, 50, { hints: { scout: true, fence: 0 } })] });
  assert.match(t.split('\n')[0], /1 with hints$/);
});
