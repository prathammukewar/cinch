import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { answerKind, tidyPick, missedIds, matching, countFor, ladder, deal } from '../../js/deal.js';

const root = new URL('../../', import.meta.url);
const pool = readdirSync(new URL('data/', root)).filter((f) => /^practice-\d+\.json$/.test(f))
  .flatMap((f) => JSON.parse(readFileSync(new URL(`data/${f}`, root))).rows);
const seeded = (seed) => () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

test('answers sort into years, percentages, temperatures and amounts', () => {
  assert.equal(answerKind({ unit: 'year' }), 'year');
  assert.equal(answerKind({ unit: '%' }), 'pct');
  assert.equal(answerKind({ unit: '°C' }), 'temp');
  assert.equal(answerKind({ unit: 'years' }), 'amount');
  assert.equal(answerKind({ unit: 'meters' }), 'amount');
  const kinds = new Set(pool.map(answerKind));
  assert.deepEqual([...kinds].sort(), ['amount', 'pct', 'temp', 'year']);
});

test('picks fall back to the defaults when they are missing or broken', () => {
  assert.deepEqual(tidyPick(undefined), { off: { cat: [], level: [], kind: [] }, n: 7, clock: 0, draw: 'new' });
  assert.deepEqual(tidyPick({ off: { cat: 'Space', level: [3, null] }, n: 8, clock: 30, draw: 'missed' }),
    { off: { cat: [], level: [3], kind: [] }, n: 7, clock: 30, draw: 'missed' });
});

test('a question counts as missed only while its last throw missed', () => {
  const m = missedIds([{ id: 'a', hit: false }, { id: 'b', hit: false }, { id: 'a', hit: true }, { id: 'c', hit: true }]);
  assert.deepEqual([...m], ['b']);
});

test('the picks narrow the pool, and each chip counts what it would add', () => {
  const pick = tidyPick({ off: { cat: [...new Set(pool.map((q) => q.category))].filter((c) => c !== 'Space'), level: [1], kind: [] } });
  const fits = matching(pool, pick);
  assert.ok(fits.length > 10);
  assert.ok(fits.every((q) => q.category === 'Space' && q.difficulty !== 1));
  assert.equal(countFor(pool, pick, new Set(), 'level', 1), pool.filter((q) => q.category === 'Space' && q.difficulty === 1).length);
  assert.equal(countFor(pool, pick, new Set(), 'cat', 'Space'), fits.length);
  const missed = new Set([fits[0].id, fits[1].id, pool.find((q) => q.category === 'Food').id]);
  assert.deepEqual(matching(pool, { ...pick, draw: 'missed' }, missed).map((q) => q.id), [fits[0].id, fits[1].id]);
});

test('a set follows the ladder, never repeats a question or a topic, and favours the least seen', () => {
  assert.deepEqual(ladder(7), [1, 2, 2, 2, 2, 3, 3]);
  assert.deepEqual(ladder(5), [1, 2, 2, 2, 3]);
  assert.equal(ladder(15).length, 15);
  for (let s = 1; s < 30; s++) {
    const set = deal(pool, 7, {}, seeded(s));
    assert.deepEqual(set.map((q) => q.difficulty), [1, 2, 2, 2, 2, 3, 3]);
    assert.equal(new Set(set.map((q) => q.id)).size, 7);
    assert.equal(new Set(set.map((q) => q.category)).size, 7);
  }
  const seen = Object.fromEntries(pool.slice(0, pool.length - 40).map((q) => [q.id, 1]));
  const fresh = new Set(pool.slice(pool.length - 40).map((q) => q.id));
  const set = deal(pool, 7, seen, seeded(3));
  assert.ok(set.filter((q) => fresh.has(q.id)).length >= 5);
});

test('a narrow pool still deals: one topic never runs twice in a row when it can help it, and a small pool gives a short set', () => {
  const two = pool.filter((q) => q.category === 'Space' || q.category === 'Money');
  const set = deal(two, 10, {}, seeded(7));
  assert.equal(set.length, 10);
  for (let i = 1; i < set.length; i++) assert.notEqual(set[i].category, set[i - 1].category);
  const hard = pool.filter((q) => q.difficulty === 3 && q.category === 'Space');
  assert.ok(deal(hard, 7, {}, seeded(2)).every((q) => q.difficulty === 3));
  assert.equal(deal(pool.slice(0, 3), 7).length, 3);
  assert.deepEqual(deal([], 7), []);
});
