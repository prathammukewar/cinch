import test from 'node:test';
import assert from 'node:assert/strict';
import { num, withUnit, short, parse, friendly, ticks } from '../../js/format.js';

test('numbers read the way people say them', () => {
  assert.equal(num(209117), '209,117');
  assert.equal(num(1893, { unit: 'year' }), '1893');
  assert.equal(num(17e6), '17 million');
  assert.equal(num(4515e6), '4.515 billion');
  assert.equal(num(9223372036854775808), '9,223 quadrillion');
  assert.equal(num(0.36), '0.36');
  assert.equal(num(-89.2), '−89.2');
  assert.equal(num(2.268), '2.27');
  assert.equal(num(0.0045), '0.0045');
  assert.equal(num(0), '0');
});

test('units attach', () => {
  assert.equal(withUnit(71, { unit: '%' }), '71%');
  assert.equal(withUnit(-200, { unit: '°C' }), '−200°C');
  assert.equal(withUnit(254453000000, { unit: 'US dollars' }), '$254.5 billion');
  assert.equal(withUnit(206, { unit: 'bones' }), '206 bones');
  assert.equal(withUnit(1893, { unit: 'year' }), '1893');
});

test('short labels', () => {
  assert.equal(short(10000), '10K');
  assert.equal(short(1500), '1,500');
  assert.equal(short(2.5e6), '2.5M');
  assert.equal(short(1893, { unit: 'year' }), '1893');
});

test('typing is forgiving', () => {
  for (const [s, v] of [['1,200', 1200], ['3.5k', 3500], ['2 million', 2e6], ['-40', -40], ['−40', -40], ['$5', 5], ['71%', 71], ['1e6', 1e6], ['.5', 0.5], [' 12 ', 12], ['4.5bn', 4.5e9], ['20°C', 20], ['1 trillion', 1e12]]) assert.equal(parse(s), v, s);
  for (const s of ['', 'abc', '1.2.3', '5 apples', '--3', '1k2']) assert.equal(parse(s), null, s);
});

test('dragged values are round', () => {
  assert.equal(friendly(123456, { min: 1e3, max: 1e7, scale: 'log' }), 120000);
  assert.equal(friendly(71.234, { min: 0, max: 100, scale: 'linear' }), 71);
  assert.equal(friendly(1893.4, { min: 1700, max: 1950, scale: 'linear', whole: true }), 1893);
});

test('every ruler gets a usable set of ticks', () => {
  for (const [min, max, scale] of [[1000, 1e7, 'log'], [0.5, 50, 'log'], [3, 3000, 'log'], [1e8, 1e12, 'log'], [0, 100, 'linear'], [1700, 1950, 'linear'], [-140, 20, 'linear'], [20, 80, 'linear'], [150, 1500, 'log'], [40, 120, 'log']]) {
    for (const width of [290, 340, 1000]) {
      const t = ticks({ min, max, scale }, {}, width);
      assert.ok(t.length > 4 && t.length < 160, `${min} to ${max}: ${t.length} ticks at ${width}`);
      const labels = t.filter((x) => x.label);
      assert.ok(labels.length >= 2 && labels.length <= 24, `${min} to ${max}: ${labels.length} labels at ${width}`);
      for (const x of t) assert.ok(x.t > -0.001 && x.t < 1.001);
    }
  }
});
