import test from 'node:test';
import assert from 'node:assert/strict';

const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k),
};
const { store, exportSave, importSave, upgrade, allRows } = await import('../../js/store.js');
const { STORE_KEY } = await import('../../js/config.js');
const rec = (n, live = true) => ({ key: `k${n}`, live, at: n, rows: [{ id: `q${n}`, cat: 'Space', hit: true, l: 0, u: 1, x: 0.5, width: 1, points: 0, at: n }] });

test('a fresh save has sound off', () => {
  store.reset();
  assert.equal(store.get('sound'), false);
  assert.deepEqual(store.data().days, {});
});

test('changes survive a reload', () => {
  store.change((d) => { d.days[3] = rec(3); });
  store.set('theme', 'dark');
  store.reload();
  assert.equal(store.data().days[3].rows[0].id, 'q3');
  assert.equal(store.get('theme'), 'dark');
});

test('backup and restore round trip', () => {
  store.reset();
  store.change((d) => { d.days[1] = rec(1); d.days[2] = rec(2); d.practice.rows.push({ id: 'p', at: 5, hit: false }); d.quant.runs.push({ at: 9, rows: [], points: 10 }); });
  const file = exportSave();
  store.reset();
  assert.equal(importSave(file).days, 2);
  assert.equal(store.data().practice.rows.length, 1);
  assert.equal(store.data().quant.runs.length, 1);
  assert.equal(allRows().length, 3);
});

test('restoring never removes a day and never doubles anything', () => {
  store.reset();
  store.change((d) => { d.days[1] = rec(1); d.practice.rows.push({ id: 'p', at: 5 }); });
  const file = exportSave();
  store.change((d) => { d.days[2] = rec(2); });
  importSave(file); importSave(file);
  assert.deepEqual(Object.keys(store.data().days), ['1', '2']);
  assert.equal(store.data().practice.rows.length, 1);
});

test('a day played live beats the same day from the archive', () => {
  store.reset();
  store.change((d) => { d.days[1] = rec(1, true); });
  const file = exportSave();
  store.reset();
  store.change((d) => { d.days[1] = rec(1, false); });
  importSave(file);
  assert.equal(store.data().days[1].live, true);
});

test('other files are refused and change nothing', () => {
  store.reset();
  store.change((d) => { d.days[1] = rec(1); });
  for (const bad of ['', '{}', 'null', '[]', '{"app":"other","data":{}}', 'not json']) assert.throws(() => importSave(bad), undefined, bad);
  assert.deepEqual(Object.keys(store.data().days), ['1']);
});

test('old and partial saves are upgraded, newer ones keep their fields', () => {
  assert.deepEqual(upgrade({ days: { 4: rec(4) } }).days[4].rows.length, 1);
  assert.equal(upgrade({ v: 0 }).settings.sound, false);
  const later = upgrade({ v: 99, days: {}, extra: 1 });
  assert.equal(later.v, 99);
  assert.equal(later.extra, 1);
});

test('unreadable data is set aside, not overwritten', () => {
  mem.clear();
  mem.set(STORE_KEY, '{broken');
  store.reload();
  store.change((d) => { d.days[7] = rec(7); });
  const aside = [...mem.keys()].find((k) => k.startsWith(`${STORE_KEY}-unreadable`));
  assert.equal(mem.get(aside), '{broken');
});

test('blocked storage does not crash the game', () => {
  mem.clear();
  store.reload();
  const set = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('quota'); };
  store.change((d) => { d.days[1] = rec(1); });
  assert.equal(store.memoryOnly, true);
  assert.equal(store.data().days[1].rows.length, 1);
  localStorage.setItem = set;
});
