import test from 'node:test';
import assert from 'node:assert/strict';
import { backend, rodeoSpace } from '../backend.js';
import { SECONDS, GRACE, NEXT_WAIT, LIFE, IDLE, MAX_RIDERS } from '../../server/rodeo.js';

const Q = ['q-one', 'q-two', 'q-three'];

/** A room with a host and some riders, all through the real worker and the room object. */
async function room(names = ['Ana', 'Ben', 'Cy'], { clock } = {}) {
  let t = Date.parse('2026-11-27T10:00:00Z');
  const now = clock || (() => t);
  const b = backend();
  b.rodeo = rodeoSpace({ now });
  b.env.RODEO = b.rodeo.namespace;
  const made = await b.call('/v1/rodeo', { method: 'POST', body: { name: names[0], q: Q } });
  assert.equal(made.status, 200);
  const { code, token } = made.data;
  assert.match(code, /^[A-Z]{4}$/);
  const host = b.rodeo.connect(code);
  await host.say({ t: 'hello', token });
  const riders = [host];
  for (const name of names.slice(1)) {
    const ws = b.rodeo.connect(code);
    await ws.say({ t: 'hello', name });
    riders.push(ws);
  }
  return { b, code, riders, host, at: (ms) => { t += ms; }, now };
}

const state = (ws) => ws.last('state');
const pick = (ws, i, lo = 10, hi = 20) => ws.say({ t: 'pick', i, lo, hi, fence: 0, scout: false });

test('a host opens a room, riders join it, and every device sees the same riders', async () => {
  const { riders, host } = await room(['Ana', 'Ben', 'Ana', '']);
  const s = state(host);
  assert.equal(s.phase, 'lobby');
  assert.equal(s.host, 0);
  assert.deepEqual(s.riders.map((r) => r.name), ['Ana', 'Ben', 'Ana 2', 'Rider 4']);
  assert.deepEqual(s.riders.map((r) => r.c), [0, 1, 2, 3]);
  assert.ok(s.riders.every((r) => r.on));
  for (const ws of riders) assert.deepEqual(state(ws).riders, s.riders);
  assert.equal(state(riders[2]).me, 2);
  // Tokens go only to their own rider.
  assert.ok(riders.every((ws) => ws.inbox.filter((m) => m.t === 'welcome').length === 1));
  assert.ok(!JSON.stringify(state(riders[1])).includes(riders[0].last('welcome').token));
});

test('names follow the leaderboard rules, two letters is enough, and bad ones become Rider N', async () => {
  const { host } = await room(['Ana', 'Bo', 'fuck you', 'www.spam.com', 'x']);
  assert.deepEqual(state(host).riders.map((r) => r.name), ['Ana', 'Bo', 'Rider 3', 'Rider 4', 'Rider 5']);
});

test('only the host starts, and only with two riders in the room', async () => {
  const { riders, host } = await room(['Ana', 'Ben']);
  await riders[1].say({ t: 'start' });
  assert.equal(state(host).phase, 'lobby');
  await riders[1].drop();
  await host.say({ t: 'start' });
  assert.equal(state(host).phase, 'lobby');
});

test('nobody sees a loop until every rider has thrown, then everyone sees all of them', async () => {
  const { riders, host } = await room();
  await host.say({ t: 'start' });
  assert.equal(state(host).phase, 'play');
  assert.equal(state(host).i, 0);
  await pick(riders[0], 0, 111, 222);
  await pick(riders[1], 0, 333, 444);
  const mid = state(riders[2]);
  assert.equal(mid.phase, 'play');
  assert.deepEqual(mid.riders.map((r) => r.thrown), [true, true, false]);
  for (const ws of riders) assert.doesNotMatch(JSON.stringify(ws.inbox), /111|333/);
  // A second throw on the same question is ignored, so a loop cannot change after it is in.
  await pick(riders[0], 0, 1, 2);
  await pick(riders[2], 0, 20, 10);
  for (const ws of riders) {
    const s = state(ws);
    assert.equal(s.phase, 'show');
    assert.deepEqual(s.shown[0], { 0: [111, 222, 0, 0], 1: [333, 444, 0, 0], 2: [10, 20, 0, 0] });
  }
});

test('the next question starts when everyone is ready, or once the wait runs out', async () => {
  const { b, code, riders, host, at, now } = await room();
  await host.say({ t: 'start' });
  for (const ws of riders) await pick(ws, 0);
  for (const ws of riders.slice(0, 2)) await ws.say({ t: 'next', i: 0 });
  assert.equal(state(host).phase, 'show');
  assert.deepEqual(state(host).riders.map((r) => r.ready), [true, true, false]);
  await riders[2].say({ t: 'next', i: 0 });
  assert.equal(state(host).phase, 'play');
  assert.equal(state(host).i, 1);
  for (const ws of riders) await pick(ws, 1);
  at(NEXT_WAIT - 1);
  await b.rodeo.tick(code, now());
  assert.equal(state(host).i, 1);
  at(1);
  await b.rodeo.tick(code, now());
  assert.equal(state(host).phase, 'play');
  assert.equal(state(host).i, 2);
});

test('when the fuse runs out, the question is shown with the loops that came in', async () => {
  const { b, code, riders, host, at, now } = await room();
  await host.say({ t: 'start' });
  assert.equal(state(host).ends, now() + SECONDS * 1000);
  await pick(riders[0], 0);
  at(SECONDS * 1000 + 1000);
  await pick(riders[1], 0); // late, but inside the grace
  await b.rodeo.tick(code, now());
  assert.equal(state(host).phase, 'play');
  at(GRACE);
  await pick(riders[2], 0); // too late
  await b.rodeo.tick(code, now());
  assert.equal(state(host).phase, 'show');
  assert.deepEqual(Object.keys(state(host).shown[0]), ['0', '1']);
});

test('a rider who drops out is not waited for, and comes back to the same seat', async () => {
  const { b, code, riders, host } = await room();
  await host.say({ t: 'start' });
  const token = riders[2].last('welcome').token;
  await riders[2].drop();
  assert.equal(state(host).riders[2].on, false);
  await pick(riders[0], 0);
  await pick(riders[1], 0);
  assert.equal(state(host).phase, 'show');
  // A stranger cannot join a game that has started; the rider with the token can.
  const stranger = b.rodeo.connect(code);
  await stranger.say({ t: 'hello', name: 'Dee' });
  assert.deepEqual(stranger.last('refused'), { t: 'refused', why: 'started' });
  assert.equal(stranger.closed.code, 4000);
  const back = b.rodeo.connect(code);
  await back.say({ t: 'hello', token });
  assert.equal(back.last('welcome').seat, 2);
  assert.equal(state(back).phase, 'show');
  assert.equal(state(host).riders[2].on, true);
});

test('the same rider on a second tab takes the seat, and the first tab is told why', async () => {
  const { b, code, riders, host } = await room(['Ana', 'Ben']);
  const again = b.rodeo.connect(code);
  await again.say({ t: 'hello', token: riders[1].last('welcome').token });
  assert.deepEqual(riders[1].last('refused'), { t: 'refused', why: 'moved' });
  assert.equal(state(host).riders.length, 2);
  assert.equal(state(again).me, 1);
});

test('a room holds twelve riders', async () => {
  const names = Array.from({ length: MAX_RIDERS }, (_, k) => `Rider ${String.fromCharCode(65 + k)}x`);
  const { b, code, host } = await room(names);
  assert.equal(state(host).riders.length, MAX_RIDERS);
  assert.equal(new Set(state(host).riders.map((r) => r.c)).size, MAX_RIDERS);
  const late = b.rodeo.connect(code);
  await late.say({ t: 'hello', name: 'Zed' });
  assert.deepEqual(late.last('refused'), { t: 'refused', why: 'full' });
});

test('the host can take a rider out before the start, and nobody else can', async () => {
  const { riders, host } = await room();
  await riders[1].say({ t: 'kick', seat: 2 });
  assert.equal(state(host).riders.length, 3);
  await host.say({ t: 'kick', seat: 2 });
  assert.deepEqual(riders[2].last('refused'), { t: 'refused', why: 'removed' });
  assert.deepEqual(state(host).riders.map((r) => r.name), ['Ana', 'Ben']);
});

test('when the host leaves, the next rider runs the room', async () => {
  const { riders, host } = await room();
  await host.say({ t: 'leave' });
  assert.equal(host.closed.code, 1000);
  assert.equal(state(riders[1]).host, 1);
  assert.deepEqual(state(riders[1]).riders.map((r) => r.name), ['Ben', 'Cy']);
  await riders[1].say({ t: 'start' });
  assert.equal(state(riders[2]).phase, 'play');
  // Leaving mid-game keeps the rider in the standings, and the room stops waiting for them.
  await riders[2].say({ t: 'leave' });
  assert.equal(state(riders[1]).riders[1].gone, true);
  await pick(riders[1], 0);
  assert.equal(state(riders[1]).phase, 'show');
});

test('after the last question the room is done, and the host can run it again with new questions', async () => {
  const { riders, host } = await room(['Ana', 'Ben']);
  await host.say({ t: 'start' });
  for (let i = 0; i < Q.length; i++) {
    for (const ws of riders) await pick(ws, i);
    for (const ws of riders) await ws.say({ t: 'next', i });
  }
  assert.equal(state(host).phase, 'done');
  assert.equal(state(host).shown.length, Q.length);
  await riders[1].say({ t: 'again', q: ['q-four'] });
  assert.equal(state(host).phase, 'done');
  await host.say({ t: 'again', q: ['q-four', 'bad id!'] });
  assert.equal(state(host).phase, 'done');
  await host.say({ t: 'again', q: ['q-four', 'q-five'] });
  const s = state(riders[1]);
  assert.equal(s.phase, 'lobby');
  assert.deepEqual(s.q, ['q-four', 'q-five']);
  assert.deepEqual(s.shown, []);
  assert.equal(s.riders.length, 2);
});

test('a room picks up where it was after Cloudflare puts it to sleep', async () => {
  const { b, code, riders, host } = await room(['Ana', 'Ben']);
  await host.say({ t: 'start' });
  await pick(riders[0], 0, 5, 6);
  b.rodeo.evict(code);
  await pick(riders[1], 0, 7, 8);
  assert.deepEqual(state(host).shown[0], { 0: [5, 6, 0, 0], 1: [7, 8, 0, 0] });
});

test('rooms are deleted six hours after they open, or half an hour after everyone leaves', async () => {
  const one = await room(['Ana', 'Ben']);
  one.at(LIFE);
  await one.b.rodeo.tick(one.code, one.now());
  assert.deepEqual(one.host.last('refused'), { t: 'refused', why: 'gone' });
  assert.equal(one.b.rodeo.room(one.code).data.size, 0);
  const late = one.b.rodeo.connect(one.code);
  await late.say({ t: 'hello', name: 'Cy' });
  assert.deepEqual(late.last('refused'), { t: 'refused', why: 'gone' });

  const two = await room(['Ana', 'Ben']);
  for (const ws of two.riders) await ws.drop();
  two.at(IDLE - 1000);
  await two.b.rodeo.tick(two.code, two.now());
  assert.equal(two.b.rodeo.room(two.code).data.size, 1);
  two.at(1000);
  await two.b.rodeo.tick(two.code, two.now());
  assert.equal(two.b.rodeo.room(two.code).data.size, 0);
});

test('a device that floods the room is cut off, and junk is ignored', async () => {
  const { riders, host } = await room(['Ana', 'Ben']);
  await riders[1].say('not json');
  await riders[1].say('x'.repeat(3000));
  await riders[1].say({ t: 'pick', i: 0, lo: 'a', hi: 2 });
  for (let k = 0; k < 40 && !riders[1].closed; k++) await riders[1].say({ t: 'nothing' });
  assert.equal(riders[1].closed.code, 4008);
  assert.equal(state(host).phase, 'lobby');
});

test('the worker only opens WebSockets for the game, and checks room requests', async () => {
  const b = backend();
  const bad = await b.call('/v1/rodeo', { method: 'POST', body: { name: 'Ana', q: 'nope' } });
  assert.equal(bad.status, 400);
  assert.equal((await b.call('/v1/rodeo/ABCD')).status, 426);
  const res = await b.fetch(new Request('https://api.test/v1/rodeo/ABCD', { headers: { upgrade: 'websocket', origin: 'https://evil.example' } }));
  assert.equal(res.status, 403);
});
