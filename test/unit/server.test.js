import test from 'node:test';
import assert from 'node:assert/strict';
import { backend, SITE } from '../backend.js';
import { forDay, setBase } from '../../js/bank.js';
import { scoreRange, HINTS } from '../../js/score.js';

// The day that is live right now, by the server's own clock, so these tests never go stale.
const DAY = Math.floor((Date.now() - Date.UTC(2026, 10, 25)) / 864e5) + 1;
setBase(SITE);
const questions = await forDay(DAY);
const client = (n) => `testclient${String(n).padStart(4, '0')}`;
const loopsAt = (shrink, extra = () => ({})) => questions.map((q, i) => {
  const span = q.scale === 'log' ? q.answer * shrink : (q.max - q.min) * shrink / 10;
  return { lo: q.answer - span / 2, hi: q.answer + span / 2, fence: 0, scout: false, ...extra(q, i) };
});
const clientPoints = (loops) => questions.map((q, i) => {
  const p = loops[i];
  const r = scoreRange(p.lo, p.hi, q.answer, { min: q.min, max: q.max, scale: q.scale }, p.fence ? q.trims[p.fence - 1] : [0, 1]);
  return Math.round(r.exact * (p.scout ? HINTS.scout : 1) * HINTS.fence[p.fence]);
});
const finish = (b, n, loops, key) => b.call('/v1/score', { method: 'POST', body: { day: DAY, client: client(n), loops }, key });
const join = async (b, name, listed = true, n = 900) => (await b.call('/v1/account', { method: 'POST', body: { name, listed, client: client(n) } })).data;

test('the server scores loops itself, exactly as the game does, hints included', async () => {
  const b = backend();
  for (const [n, loops] of [[1, loopsAt(0.1)], [2, loopsAt(2)], [3, loopsAt(0.5, (q) => ({ fence: q.trims?.length ? 2 : 0, scout: !!q.marks?.length }))]]) {
    const r = await finish(b, n, loops);
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.points, clientPoints(loops));
    assert.equal(r.data.score, clientPoints(loops).reduce((a, x) => a + x, 0));
    assert.equal(r.data.verified, true);
  }
});

test('made-up scores are refused or never reach the leaderboard', async () => {
  const b = backend();
  const ana = await join(b, 'Ana');
  assert.equal((await b.call('/v1/score', { method: 'POST', body: { day: DAY, client: client(1), loops: loopsAt(0.1).slice(0, 3) }, key: ana.key })).status, 400);
  assert.equal((await b.call('/v1/score', { method: 'POST', body: { day: DAY, client: client(1), loops: loopsAt(0.1).map((l) => ({ ...l, lo: 'x' })) }, key: ana.key })).status, 400);
  assert.equal((await b.call('/v1/score', { method: 'POST', body: { day: DAY + 5, client: client(1), loops: loopsAt(0.1) }, key: ana.key })).status, 400);
  // The old way, a score with no loops, still counts for anonymous standings but is never verified or tied to an account.
  const legacy = await b.call('/v1/score', { method: 'POST', body: { day: DAY, client: client(2), score: 700, hits: '1111111' }, key: ana.key });
  assert.equal(legacy.status, 200);
  assert.equal(legacy.data.verified, false);
  const board = await b.call(`/v1/leaderboard?view=today&day=${DAY}`);
  assert.equal(board.data.rows.length, 0, 'only scores the server worked out itself are on the board');
});

test('accounts hold no email or password, and the sign-in key is never stored', async () => {
  const b = backend();
  const r = await b.call('/v1/account', { method: 'POST', body: { name: '  Ana   Lee ', listed: false } });
  assert.equal(r.status, 200);
  assert.match(r.data.key, /^[0-9A-HJKMNP-TV-Z]{25}$/);
  assert.equal(r.data.name, 'Ana Lee');
  const row = b.sql.prepare('SELECT * FROM accounts').get();
  assert.deepEqual(Object.keys(row).sort(), ['created', 'id', 'key_hash', 'listed', 'name', 'name_key', 'updated']);
  assert.notEqual(row.key_hash, r.data.key);
  assert.ok(!JSON.stringify(row).includes(r.data.key));
  assert.equal(row.listed, 0, 'not listed unless asked');
  const me = await b.call('/v1/me', { key: r.data.key.toLowerCase().replace(/(.{5})/g, '$1-') });
  assert.equal(me.status, 200, 'keys typed in lower case and with dashes still work');
  assert.equal((await b.call('/v1/me', { key: '0'.repeat(25) })).status, 401);
  assert.equal((await b.call('/v1/me')).status, 401);
});

test('names are checked on the server and must be unique however they are written', async () => {
  const b = backend();
  assert.equal((await b.call('/v1/account', { method: 'POST', body: { name: 'fuck off' } })).status, 400);
  assert.equal((await b.call('/v1/account', { method: 'POST', body: { name: 'Cinch' } })).status, 400);
  assert.equal((await b.call('/v1/account', { method: 'POST', body: { name: 'me@mail.com' } })).status, 400);
  assert.equal((await b.call('/v1/account', { method: 'POST', body: { name: 'Pratham' } })).status, 200);
  assert.equal((await b.call('/v1/account', { method: 'POST', body: { name: 'pr4th_am' } })).status, 409);
  const other = await join(b, 'Other');
  assert.equal((await b.call('/v1/me', { method: 'PATCH', body: { name: 'PRATHAM' }, key: other.key })).status, 409);
  assert.equal((await b.call('/v1/me', { method: 'PATCH', body: { name: 'sh1t' }, key: other.key })).status, 400);
  assert.equal((await b.call('/v1/me', { method: 'PATCH', body: { name: 'Other Two' }, key: other.key })).data.name, 'Other Two');
});

test('the leaderboard ranks every rider, shares ranks on ties, and names only listed riders', async () => {
  const b = backend();
  const ana = await join(b, 'Ana');
  const ben = await join(b, 'Ben');
  const cy = await join(b, 'Cyd');
  const dee = await join(b, 'Dee', false);
  await finish(b, 1, loopsAt(0.05), ana.key);
  await finish(b, 2, loopsAt(0.05), ben.key);
  await finish(b, 3, loopsAt(1.5), cy.key);
  await finish(b, 4, loopsAt(0.02), dee.key);
  await finish(b, 5, loopsAt(0.05));
  const board = (await b.call(`/v1/leaderboard?view=today&day=${DAY}`, { key: cy.key })).data;
  const tag = (rows) => rows.map((r) => `${r.rank} ${r.name ?? '(no name)'}`).sort();
  assert.deepEqual(tag(board.rows), ['1 (no name)', '2 (no name)', '2 Ana', '2 Ben', '5 Cyd']);
  assert.equal(board.players, 5);
  assert.equal(board.rows.find((r) => r.name === 'Cyd').you, true);
  assert.equal(board.rows.find((r) => r.name === 'Ana').you, false);
  const text = JSON.stringify(board);
  assert.ok(!text.includes('"id"') && !text.includes('"rider"') && !text.includes(client(5)) && !text.includes('Dee'), 'no ids, browser ids or hidden names leave the server');
  // A hidden rider is on the board with no name and sees their own place.
  const hidden = (await b.call(`/v1/leaderboard?view=today&day=${DAY}`, { key: dee.key })).data;
  assert.equal(hidden.you.listed, false);
  assert.equal(hidden.you.rank, 1);
  assert.equal(hidden.rows[0].you, true);
  // Without an account, the browser id finds your row; someone else's id is not you.
  const anon = (await b.call(`/v1/leaderboard?view=today&day=${DAY}&client=${client(5)}`)).data;
  assert.equal(anon.you.rank, 2);
  assert.equal(anon.rows.filter((r) => r.you).length, 1);
  assert.equal(anon.rows.find((r) => r.you).name, null);
  assert.equal((await b.call(`/v1/leaderboard?view=today&day=${DAY}&client=nottheirs1234`)).data.you, null);
  assert.equal((await b.call(`/v1/leaderboard?view=today&day=${DAY}&client=BAD!`)).data.you, null);
  for (const view of ['week', 'all']) {
    const v = (await b.call(`/v1/leaderboard?view=${view}&day=${DAY}`)).data;
    assert.equal(v.rows.length, 5);
    assert.equal(v.rows[0].days, 1);
  }
});

test('score posts are limited per address', async () => {
  const b = backend();
  let n = 0;
  b.env.SCORES = { limit: async () => ({ success: ++n <= 2 }) };
  assert.equal((await finish(b, 1, loopsAt(0.05))).status, 200);
  assert.equal((await finish(b, 2, loopsAt(0.05))).status, 200);
  assert.equal((await finish(b, 3, loopsAt(0.05))).status, 429);
});

test('one Roundup a day counts per account, and earlier Roundups from this browser join a new account', async () => {
  const b = backend();
  const early = await finish(b, 7, loopsAt(0.05));
  assert.equal(early.data.counted, false);
  const ana = await join(b, 'Ana', true, 7);
  let board = (await b.call(`/v1/leaderboard?view=today&day=${DAY}`)).data;
  assert.deepEqual(board.rows.map((r) => r.name), ['Ana'], 'the Roundup played before signing up joins the account');
  const second = await finish(b, 8, loopsAt(0.01), ana.key);
  assert.equal(second.data.counted, false, 'a second device cannot add a second Roundup for the same day');
  board = (await b.call(`/v1/leaderboard?view=today&day=${DAY}`)).data;
  assert.deepEqual(board.rows.map((r) => r.name), [null, 'Ana'], 'the second device\u2019s Roundup stays on the board without the name');
  assert.equal(board.rows.find((r) => r.name === 'Ana').score, early.data.score);
  // Someone else's browser id cannot pull another person's Roundups into their account.
  const ben = await join(b, 'Ben', true, 7);
  assert.equal(ben.joined, 0);
});

test('the save copy only moves forward: a stale device must merge first', async () => {
  const b = backend();
  const ana = await join(b, 'Ana');
  assert.deepEqual((await b.call('/v1/me/save', { key: ana.key })).data, { rev: 0, at: 0, data: null });
  assert.equal((await b.call('/v1/me/save', { method: 'PUT', body: { rev: 0, data: { days: { 1: { rows: [] } } } }, key: ana.key })).data.rev, 1);
  assert.equal((await b.call('/v1/me/save', { method: 'PUT', body: { rev: 0, data: { days: {} } }, key: ana.key })).status, 409);
  assert.equal((await b.call('/v1/me/save', { method: 'PUT', body: { rev: 1, data: { days: { 2: { rows: [] } } } }, key: ana.key })).data.rev, 2);
  assert.deepEqual(Object.keys((await b.call('/v1/me/save', { key: ana.key })).data.data.days), ['2']);
  const big = { days: {}, filler: 'x'.repeat(950000) };
  assert.equal((await b.call('/v1/me/save', { method: 'PUT', body: { rev: 2, data: big }, key: ana.key })).status, 413);
});

test('export shows everything held, and deleting removes all of it at once', async () => {
  const b = backend();
  const ana = await join(b, 'Ana', true, 3);
  await finish(b, 3, loopsAt(0.1), ana.key);
  await b.call('/v1/me/save', { method: 'PUT', body: { rev: 0, data: { days: {} } }, key: ana.key });
  const out = (await b.call('/v1/me/export', { key: ana.key })).data;
  assert.equal(out.account.name, 'Ana');
  assert.equal(out.roundups.length, 1);
  assert.ok(out.save);
  assert.ok(!JSON.stringify(out).includes(ana.key));
  assert.equal((await b.call('/v1/me', { method: 'DELETE', key: ana.key })).status, 200);
  assert.equal((await b.call('/v1/me', { key: ana.key })).status, 401);
  for (const t of ['accounts', 'saves']) assert.equal(b.sql.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n, 0, t);
  assert.equal(b.sql.prepare('SELECT COUNT(*) AS n FROM scores').get().n, 0, 'their Roundups go too');
});

test('sign-ups and account calls are rate limited, and only the site may call from a browser', async () => {
  const b = backend({ limits: { signup: false } });
  assert.equal((await b.call('/v1/account', { method: 'POST', body: { name: 'Ana' } })).status, 429);
  const pre = await b.fetch(new Request('https://api.test/v1/me', { method: 'OPTIONS', headers: { origin: 'https://playcinch.pages.dev' } }));
  assert.equal(pre.status, 204);
  assert.match(pre.headers.get('access-control-allow-headers'), /authorization/);
  assert.match(pre.headers.get('access-control-allow-methods'), /DELETE/);
  const evil = await b.call('/v1/leaderboard?view=today&day=1', { origin: 'https://evil.example' });
  assert.notEqual(evil.headers.get('access-control-allow-origin'), 'https://evil.example');
  assert.equal((await b.call('/v1/leaderboard?view=today&day=0')).status, 400);
});

test('the hourly clean-up deletes Side by side rooms older than six hours, and only those', async () => {
  const b = backend();
  const old = Date.now() - 7 * 3600000;
  b.sql.prepare('INSERT INTO rooms (code, at, q, n0, t0) VALUES (?, ?, ?, ?, ?)').run('OLDR', old, '[]', 'Ana', 'x'.repeat(36));
  b.sql.prepare('INSERT INTO picks (code, seat, i, lo, hi, fence, scout, at) VALUES (?, 0, 0, 1, 2, 0, 0, ?)').run('OLDR', old);
  const fresh = (await b.call('/v1/room', { method: 'POST', body: { name: 'Ben', q: ['a'] } })).data;
  b.sql.prepare("UPDATE rooms SET at = ? WHERE code = 'OLDR'").run(old);
  await b.scheduled();
  assert.deepEqual(b.sql.prepare('SELECT code FROM rooms').all().map((r) => r.code), [fresh.code]);
  assert.equal(b.sql.prepare('SELECT COUNT(*) AS n FROM picks').get().n, 0);
});
