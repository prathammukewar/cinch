// Rodeo rooms: up to twelve riders, each on their own device, rope the same questions at the same time.
// One Durable Object per room code keeps the room and talks to every rider over a WebSocket.
// Nobody sees another rider's loop until every rider has thrown or the time is up.
// A room is deleted six hours after it opens, or half an hour after the last rider leaves, whichever comes first.
import { tidyName, nameKey, nameProblem } from '../js/names.js';

export const MAX_RIDERS = 12;
export const SECONDS = 30;
export const GRACE = 2500; // a late loop still counts this long after the fuse runs out
export const NEXT_WAIT = 30000; // the next question starts once everyone is ready, or after this long
export const LIFE = 6 * 3600000;
export const IDLE = 30 * 60000;
const COLORS = 12;
const OPEN = 1;

const validQ = (q) => Array.isArray(q) && q.length >= 1 && q.length <= 10 && q.every((x) => typeof x === 'string' && /^[a-z0-9-]{1,60}$/.test(x));

/** A name for the room: the same rules as leaderboard names, but two letters is enough among friends. */
export function roomName(raw) {
  const name = tidyName(String(raw || '').replace(/[^\p{L}\p{N} '._’-]/gu, '')).slice(0, 20);
  if (!name) return null;
  return nameProblem(name, { min: 2 }) ? null : name;
}

export class Rodeo {
  constructor(state, env) {
    this.state = state;
    this.env = env || {};
    this.s = undefined;
    this.rate = new Map();
  }

  now() { return this.env.NOW ? this.env.NOW() : Date.now(); }

  async load() {
    if (this.s === undefined) this.s = (await this.state.storage.get('s')) || null;
    return this.s;
  }

  async save() {
    await this.state.storage.put('s', this.s);
    await this.arm();
  }

  /** One alarm covers the fuse, the wait between questions and the room's end. */
  async arm() {
    const s = this.s;
    if (!s) return;
    const times = [s.made + LIFE];
    if (!this.sockets().length) times.push(s.seen + IDLE);
    if (s.phase === 'play') times.push(s.ends + GRACE);
    if (s.phase === 'show') times.push(s.nextAt);
    await this.state.storage.setAlarm(Math.min(...times));
  }

  sockets(except) {
    return this.state.getWebSockets().filter((ws) => ws !== except && ws.readyState === OPEN && ws.deserializeAttachment()?.seat != null);
  }

  /** Seats with a device in the room right now. */
  onSeats(except) { return new Set(this.sockets(except).map((ws) => ws.deserializeAttachment().seat)); }

  /** The host is the earliest rider still here, so the room never waits on someone who left. */
  host(on) {
    const r = this.s.riders.find((x) => !x.gone && on.has(x.seat));
    return r ? r.seat : null;
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/make') {
      const b = await req.json().catch(() => ({}));
      await this.load();
      const now = this.now();
      if (this.s && now < this.s.made + LIFE) return Response.json({ error: 'taken' }, { status: 409 });
      if (!validQ(b.q) || !/^[A-Z]{4}$/.test(b.code || '')) return Response.json({ error: 'bad room' }, { status: 400 });
      const token = crypto.randomUUID();
      this.s = { code: b.code, made: now, seen: now, q: b.q, phase: 'lobby', i: 0, ends: 0, nextAt: 0, seat: 1, riders: [{ seat: 0, c: 0, name: roomName(b.name) || 'Rider 1', token }], picks: {}, ready: [], shown: [] };
      await this.save();
      return Response.json({ code: b.code, token });
    }
    if (req.headers.get('upgrade') !== 'websocket') return new Response('not found', { status: 404 });
    const pair = new WebSocketPair();
    this.accept(pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  /** A new connection. It has no seat until it says hello. */
  accept(ws) {
    this.state.acceptWebSocket(ws);
    ws.serializeAttachment({ seat: null });
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== 'string' || raw.length > 2000) return;
    // A device sending far more than a game needs is cut off.
    const now = this.now();
    const r8 = this.rate.get(ws) || { n: 0, t: now };
    if (now - r8.t > 10000) { r8.n = 0; r8.t = now; }
    r8.n += 1;
    this.rate.set(ws, r8);
    if (r8.n > 40) { ws.close(4008, 'too many messages'); return; }
    let m;
    try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object') return;
    const s = await this.load();
    if (!s) { refuse(ws, 'gone'); return; }
    s.seen = now;
    if (m.t === 'hello') { await this.hello(ws, m, now); return; }
    const seat = ws.deserializeAttachment()?.seat;
    const me = seat == null ? null : s.riders.find((x) => x.seat === seat);
    if (!me) return;
    const on = this.onSeats();
    const isHost = this.host(on) === seat;
    if (m.t === 'pick') this.pick(me, m, now);
    else if (m.t === 'next' && s.phase === 'show' && m.i === s.i && !s.ready.includes(seat)) s.ready.push(seat);
    else if (m.t === 'start' && isHost && s.phase === 'lobby') {
      const here = s.riders.filter((x) => on.has(x.seat));
      if (here.length < 2) return;
      s.riders = here;
      Object.assign(s, { phase: 'play', i: 0, ends: now + SECONDS * 1000, picks: {}, ready: [], shown: [] });
    } else if (m.t === 'again' && isHost && s.phase === 'done' && validQ(m.q)) {
      s.riders = s.riders.filter((x) => !x.gone && on.has(x.seat));
      Object.assign(s, { phase: 'lobby', q: m.q, i: 0, ends: 0, nextAt: 0, picks: {}, ready: [], shown: [] });
    } else if (m.t === 'kick' && isHost && s.phase === 'lobby' && m.seat !== seat) {
      const out = s.riders.find((x) => x.seat === m.seat);
      if (!out) return;
      s.riders = s.riders.filter((x) => x !== out);
      for (const w of this.sockets()) if (w.deserializeAttachment().seat === out.seat) refuse(w, 'removed');
    } else if (m.t === 'leave') {
      if (s.phase === 'lobby') s.riders = s.riders.filter((x) => x !== me);
      else me.gone = true;
      ws.serializeAttachment({ seat: null });
      ws.close(1000, 'left');
    } else return;
    this.settle(now, ws.readyState === OPEN ? undefined : ws);
    await this.save();
    this.broadcast(now);
  }

  async hello(ws, m, now) {
    const s = this.s;
    let me = typeof m.token === 'string' && m.token.length >= 20 ? s.riders.find((x) => x.token === m.token) : null;
    if (me?.gone) me.gone = false;
    if (!me) {
      if (s.phase !== 'lobby') { refuse(ws, 'started'); return; }
      if (s.riders.length >= MAX_RIDERS) { refuse(ws, 'full'); return; }
      const used = new Set(s.riders.map((x) => x.c));
      const c = [...Array(COLORS).keys()].find((k) => !used.has(k)) ?? 0;
      me = { seat: s.seat++, c, name: this.unique(roomName(m.name) || `Rider ${s.riders.length + 1}`), token: crypto.randomUUID() };
      s.riders.push(me);
    }
    // The same rider on a second tab or device takes over the seat; the older one is told why.
    for (const w of this.sockets(ws)) if (w.deserializeAttachment().seat === me.seat) refuse(w, 'moved');
    ws.serializeAttachment({ seat: me.seat });
    ws.send(JSON.stringify({ t: 'welcome', seat: me.seat, token: me.token, code: s.code }));
    this.settle(now);
    await this.save();
    this.broadcast(now);
  }

  unique(name) {
    const keys = new Set(this.s.riders.map((x) => nameKey(x.name)));
    if (!keys.has(nameKey(name))) return name;
    for (let k = 2; ; k++) if (!keys.has(nameKey(`${name.slice(0, 17)} ${k}`))) return `${name.slice(0, 17)} ${k}`;
  }

  pick(me, m, now) {
    const s = this.s;
    if (s.phase !== 'play' || m.i !== s.i || me.gone || s.picks[me.seat] || now > s.ends + GRACE) return;
    const lo = Number(m.lo);
    const hi = Number(m.hi);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
    const fence = [0, 1, 2].includes(m.fence) ? m.fence : 0;
    s.picks[me.seat] = [Math.min(lo, hi), Math.max(lo, hi), fence, m.scout ? 1 : 0];
  }

  /** Move the room on when nobody is left to wait for. An empty room only moves on its clock. */
  settle(now, except) {
    const s = this.s;
    const on = this.onSeats(except);
    const here = s.riders.filter((x) => !x.gone && on.has(x.seat));
    if (!here.length) return;
    if (s.phase === 'play' && here.every((x) => s.picks[x.seat])) this.reveal(now);
    else if (s.phase === 'show' && here.every((x) => s.ready.includes(x.seat))) this.advance(now);
  }

  reveal(now) {
    const s = this.s;
    s.shown[s.i] = s.picks;
    Object.assign(s, { phase: 'show', picks: {}, ready: [], nextAt: now + NEXT_WAIT });
  }

  advance(now) {
    const s = this.s;
    if (s.i + 1 < s.q.length) Object.assign(s, { phase: 'play', i: s.i + 1, ends: now + SECONDS * 1000, picks: {}, ready: [] });
    else Object.assign(s, { phase: 'done', ready: [] });
  }

  async alarm() {
    const s = await this.load();
    if (!s) return;
    const now = this.now();
    if (now >= s.made + LIFE || (!this.sockets().length && now >= s.seen + IDLE)) { await this.wipe(); return; }
    if (s.phase === 'play' && now >= s.ends + GRACE) this.reveal(now);
    else if (s.phase === 'show' && now >= s.nextAt) this.advance(now);
    await this.save();
    this.broadcast(now);
  }

  async wipe() {
    for (const ws of this.state.getWebSockets()) refuse(ws, 'gone');
    await this.state.storage.deleteAlarm();
    await this.state.storage.deleteAll();
    this.s = null;
  }

  async webSocketClose(ws) {
    const s = await this.load();
    if (!s) return;
    const now = this.now();
    s.seen = now;
    this.settle(now, ws);
    await this.save();
    this.broadcast(now, ws);
  }

  async webSocketError(ws) { await this.webSocketClose(ws); }

  /** What one rider may see: everyone's loops for questions already shown, and only who has thrown on the open one. */
  view(seat, now, on) {
    const s = this.s;
    return {
      t: 'state', now, code: s.code, q: s.q, phase: s.phase, i: s.i, ends: s.ends, nextAt: s.nextAt, seconds: SECONDS, max: MAX_RIDERS,
      me: seat, host: this.host(on),
      riders: s.riders.map((x) => ({ seat: x.seat, c: x.c, name: x.name, on: on.has(x.seat), gone: !!x.gone, thrown: !!s.picks[x.seat], ready: s.ready.includes(x.seat) })),
      shown: s.shown,
    };
  }

  broadcast(now, except) {
    if (!this.s) return;
    const on = this.onSeats(except);
    for (const ws of this.sockets(except)) {
      try { ws.send(JSON.stringify(this.view(ws.deserializeAttachment().seat, now, on))); } catch { /* a closing socket */ }
    }
  }
}

function refuse(ws, why) {
  try {
    ws.serializeAttachment({ seat: null });
    ws.send(JSON.stringify({ t: 'refused', why }));
    ws.close(4000, why);
  } catch { /* already closed */ }
}
