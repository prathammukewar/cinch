// The real standings worker, run in-process over a throwaway SQLite database, for tests.
// Question files are read from this checkout, as the deployed worker reads them from the site.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker, { Rodeo } from '../server/worker.js';

const SITE = 'http://questions.test/';
const root = new URL('../', import.meta.url);

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  const u = String(url instanceof Request ? url.url : url);
  if (u.startsWith(SITE)) {
    try { return new Response(readFileSync(new URL(u.slice(SITE.length), root)), { headers: { 'content-type': 'application/json' } }); } catch { return new Response('missing', { status: 404 }); }
  }
  return realFetch(url, opts);
};

class Stmt {
  constructor(sql, text, args = []) { this.sql = sql; this.text = text; this.args = args; }
  bind(...a) { return new Stmt(this.sql, this.text, a.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v))); }
  exec() { return this.sql.prepare(this.text); }
  async first(col) { const r = this.exec().get(...this.args); if (!r) return null; return col ? r[col] : { ...r }; }
  async all() { return { results: this.exec().all(...this.args).map((r) => ({ ...r })) }; }
  async run() { const r = this.exec().run(...this.args); return { meta: { changes: Number(r.changes) } }; }
}

/** A fresh server with an empty database. limits: { signup, me } let a test switch rate limiting on. */
export function backend({ limits } = {}) {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('server/schema.sql', root), 'utf8'));
  const DB = {
    prepare: (text) => new Stmt(sql, text),
    batch: async (list) => {
      sql.exec('BEGIN');
      try { const out = list.map((s) => ({ meta: { changes: Number(s.exec().run(...s.args).changes) } })); sql.exec('COMMIT'); return out; } catch (e) { sql.exec('ROLLBACK'); throw e; }
    },
  };
  const rodeo = rodeoSpace();
  const env = { DB, SITE, RODEO: rodeo.namespace };
  if (limits) {
    env.SIGNUP = { limit: async () => ({ success: limits.signup !== false }) };
    env.LIMITS = { limit: async () => ({ success: limits.me !== false }) };
  }
  return {
    env,
    sql,
    rodeo,
    fetch: (req) => worker.fetch(req, env),
    scheduled: () => worker.scheduled({}, env),
    /** Calls the API as the page would. */
    async call(path, { method = 'GET', body, key, origin = 'https://playcinch.pages.dev' } = {}) {
      const headers = { origin };
      if (body !== undefined) headers['content-type'] = 'application/json';
      if (key) headers.authorization = `Bearer ${key}`;
      const res = await worker.fetch(new Request(`https://api.test${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }), env);
      return { status: res.status, headers: res.headers, data: await res.json().catch(() => null) };
    },
  };
}

/**
 * Rodeo rooms in memory: one Rodeo object per room code, with its storage, alarm and sockets faked
 * the way Cloudflare runs them. now() sets the room clock; evict() throws the object away and keeps
 * its storage, as Cloudflare does when a room sleeps.
 */
export function rodeoSpace({ now } = {}) {
  const env = now ? { NOW: now } : {};
  const rooms = new Map();
  const room = (code) => {
    if (!rooms.has(code)) {
      const data = new Map();
      const sockets = [];
      const state = {
        alarm: null,
        storage: {
          get: async (k) => (data.has(k) ? structuredClone(data.get(k)) : undefined),
          put: async (k, v) => { data.set(k, structuredClone(v)); },
          deleteAll: async () => { data.clear(); },
          setAlarm: async (t) => { state.alarm = t; },
          deleteAlarm: async () => { state.alarm = null; },
        },
        acceptWebSocket: (ws) => { sockets.push(ws); },
        getWebSockets: () => sockets.filter((w) => w.readyState !== 3),
      };
      // Cloudflare hands a room one event at a time; the queue does the same here.
      rooms.set(code, { state, data, obj: new Rodeo(state, env), queue: Promise.resolve() });
    }
    return rooms.get(code);
  };
  return {
    namespace: { idFromName: (name) => name, get: (id) => ({ fetch: (req) => room(id).obj.fetch(req) }) },
    room,
    evict(code) { const r = room(code); r.obj = new Rodeo(r.state, env); },
    /** Runs a room's alarm if it is due by now(). */
    tick(code, t) { const r = room(code); return (r.queue = r.queue.then(async () => { if (r.state.alarm != null && t >= r.state.alarm) { r.state.alarm = null; await r.obj.alarm(); } })); },
    /**
     * A rider's device. say() sends to the room, inbox holds what came back, drop() is the
     * connection going away. onSend lets a test pass the messages on (to a page, say).
     */
    connect(code, onSend) {
      const r = room(code);
      let att = null;
      const ws = {
        readyState: 1,
        inbox: [],
        closed: null,
        serializeAttachment: (v) => { att = structuredClone(v); },
        deserializeAttachment: () => structuredClone(att),
        send: (m) => { if (ws.readyState !== 1) throw new Error('closed'); ws.inbox.push(JSON.parse(m)); onSend?.(m); },
        close: (code, reason) => { if (ws.readyState === 3) return; ws.readyState = 3; ws.closed = { code, reason }; ws.onclose?.(code, reason); },
        say: (o) => (r.queue = r.queue.then(() => r.obj.webSocketMessage(ws, typeof o === 'string' ? o : JSON.stringify(o)))),
        drop: () => { ws.readyState = 3; return (r.queue = r.queue.then(() => r.obj.webSocketClose(ws, 1006, '', false))); },
        last: (t = 'state') => [...ws.inbox].reverse().find((m) => m.t === t),
      };
      r.obj.accept(ws);
      return ws;
    },
  };
}

export { SITE };
