// The real standings worker, run in-process over a throwaway SQLite database, for tests.
// Question files are read from this checkout, as the deployed worker reads them from the site.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../server/worker.js';

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
  const env = { DB, SITE };
  if (limits) {
    env.SIGNUP = { limit: async () => ({ success: limits.signup !== false }) };
    env.LIMITS = { limit: async () => ({ success: limits.me !== false }) };
  }
  return {
    env,
    sql,
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

export { SITE };
