// Accounts and the leaderboard.
//
// What an account holds: a public name, whether to list it, a one-way fingerprint of a sign-in key,
// the time it was made, the Roundups played while signed in, and a copy of the player's save so it
// can follow them to another device. No email, no password, no real name, no address of any kind.
// The sign-in key itself is shown to the player once and never stored here.
import { tidyName, nameKey, nameProblem } from '../js/names.js';

const KEY_CHARS = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32: no I, L, O or U to misread
const KEY_LEN = 25; // 125 random bits
const SAVE_MAX = 900000;
const SIGNUPS_PER_DAY = 1000;
const TOP = 100;

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fingerprint = async (key) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`cinch-key:${key}`)));

/** Keys are typed by hand on other devices, so spacing, dashes and look-alike letters are forgiven. */
export function cleanKey(raw) {
  const k = String(raw || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return new RegExp(`^[${KEY_CHARS}]{${KEY_LEN}}$`).test(k) ? k : null;
}

function newKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(KEY_LEN)), (b) => KEY_CHARS[b & 31]).join('');
}

/** The signed-in account for this request, or null. */
export async function who(req, db) {
  const m = (req.headers.get('authorization') || '').match(/^Bearer (\S+)$/);
  const key = m && cleanKey(m[1]);
  if (!key) return null;
  return db.prepare('SELECT * FROM accounts WHERE key_hash = ?1').bind(await fingerprint(key)).first();
}

/** Cloudflare's rate limiter, keyed by address. It counts at the edge and keeps nothing of ours. */
async function limited(env, req, kind) {
  const limiter = kind === 'signup' ? env.SIGNUP : env.LIMITS;
  if (!limiter) return false;
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  const { success } = await limiter.limit({ key: `${kind}:${ip}` });
  return !success;
}

const publicMe = (a) => ({ name: a.name, listed: !!a.listed, created: a.created });

/** Roundups a browser played before it had an account join the account, never anyone else's. */
async function link(db, account, client) {
  if (typeof client !== 'string' || !/^[a-z0-9]{12,24}$/.test(client)) return 0;
  const r = await db.prepare(`UPDATE scores SET account = ?1 WHERE client = ?2 AND account IS NULL AND verified = 1
    AND day NOT IN (SELECT day FROM scores WHERE account = ?1)`).bind(account, client).run();
  return r.meta.changes || 0;
}

export async function accounts(req, env, url, json, body) {
  const db = env.DB;
  const path = url.pathname;

  if (req.method === 'POST' && path === '/v1/account') {
    if (await limited(env, req, 'signup')) return json({ error: 'Too many new accounts from here just now. Try again in a minute.' }, 429);
    const b = await body(req);
    const name = tidyName(b.name);
    const problem = nameProblem(name);
    if (problem) return json({ error: problem }, 400);
    const recent = await db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE created > ?1').bind(Date.now() - 86400000).first();
    if (recent.n >= SIGNUPS_PER_DAY) return json({ error: 'New accounts are paused for today. Try again tomorrow.' }, 503);
    const key = newKey();
    const id = hex(crypto.getRandomValues(new Uint8Array(16)));
    const now = Date.now();
    const r = await db.prepare('INSERT OR IGNORE INTO accounts (id, name, name_key, key_hash, listed, created, updated) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?6)')
      .bind(id, name, nameKey(name), await fingerprint(key), b.listed === true ? 1 : 0, now).run();
    if (r.meta.changes !== 1) return json({ error: 'That name is taken. Pick another.' }, 409);
    const joined = await link(db, id, b.client);
    return json({ key, name, listed: b.listed === true, created: now, joined }, 200);
  }

  if (path === '/v1/leaderboard' && req.method === 'GET') return leaderboard(req, db, url, json);

  if (!path.startsWith('/v1/me')) return null;
  if (await limited(env, req, 'me')) return json({ error: 'Too many requests. Wait a moment.' }, 429);
  const me = await who(req, db);
  if (!me) return json({ error: 'That sign-in key is not right, or the account was deleted.' }, 401);

  if (path === '/v1/me' && req.method === 'GET') {
    const n = await db.prepare('SELECT COUNT(*) AS n FROM scores WHERE account = ?1').bind(me.id).first();
    const save = await db.prepare('SELECT rev, at, length(data) AS bytes FROM saves WHERE account = ?1').bind(me.id).first();
    return json({ ...publicMe(me), roundups: n.n, save: save || null }, 200);
  }
  if (path === '/v1/me' && req.method === 'PATCH') {
    const b = await body(req);
    let { name, listed } = me;
    if (b.name !== undefined) {
      name = tidyName(b.name);
      const problem = nameProblem(name);
      if (problem) return json({ error: problem }, 400);
    }
    if (b.listed !== undefined) listed = b.listed === true ? 1 : 0;
    const r = await db.prepare('UPDATE OR IGNORE accounts SET name = ?1, name_key = ?2, listed = ?3, updated = ?4 WHERE id = ?5')
      .bind(name, nameKey(name), listed, Date.now(), me.id).run();
    if (r.meta.changes !== 1) return json({ error: 'That name is taken. Pick another.' }, 409);
    return json(publicMe({ ...me, name, listed }), 200);
  }
  if (path === '/v1/me' && req.method === 'DELETE') {
    // Everything goes, at once: the account, its saved copy and every Roundup tied to it.
    await db.batch([
      db.prepare('DELETE FROM scores WHERE account = ?1').bind(me.id),
      db.prepare('DELETE FROM saves WHERE account = ?1').bind(me.id),
      db.prepare('DELETE FROM accounts WHERE id = ?1').bind(me.id),
    ]);
    return json({ deleted: true }, 200);
  }
  if (path === '/v1/me/export' && req.method === 'GET') {
    const { results } = await db.prepare('SELECT day, score, hits, p1, p2, p3, p4, p5, p6, p7, at FROM scores WHERE account = ?1 ORDER BY day').bind(me.id).all();
    const save = await db.prepare('SELECT rev, at, data FROM saves WHERE account = ?1').bind(me.id).first();
    return json({
      about: 'Everything the Cinch server holds for this account. The sign-in key is not here: the server keeps only a one-way fingerprint of it.',
      account: { name: me.name, listed: !!me.listed, created: new Date(me.created).toISOString(), updated: new Date(me.updated).toISOString() },
      roundups: results.map((s) => ({ day: s.day, score: s.score, roped: s.hits, points: [s.p1, s.p2, s.p3, s.p4, s.p5, s.p6, s.p7], at: new Date(s.at).toISOString() })),
      save: save ? { rev: save.rev, at: new Date(save.at).toISOString(), data: JSON.parse(save.data) } : null,
    }, 200);
  }
  if (path === '/v1/me/link' && req.method === 'POST') {
    const b = await body(req);
    return json({ joined: await link(db, me.id, b.client) }, 200);
  }
  if (path === '/v1/me/save' && req.method === 'GET') {
    const save = await db.prepare('SELECT rev, at, data FROM saves WHERE account = ?1').bind(me.id).first();
    return json(save ? { rev: save.rev, at: save.at, data: JSON.parse(save.data) } : { rev: 0, at: 0, data: null }, 200);
  }
  if (path === '/v1/me/save' && req.method === 'PUT') {
    const b = await body(req, SAVE_MAX + 2000);
    const data = JSON.stringify(b.data);
    if (!b.data || typeof b.data !== 'object' || data.length > SAVE_MAX) return json({ error: 'That save is too large to keep.' }, 413);
    const rev = Number(b.rev) || 0;
    const now = Date.now();
    // Only replace the copy this device last saw. If another device saved in between, it must merge first.
    const r = rev === 0
      ? await db.prepare('INSERT OR IGNORE INTO saves (account, rev, at, data) VALUES (?1, 1, ?2, ?3)').bind(me.id, now, data).run()
      : await db.prepare('UPDATE saves SET rev = rev + 1, at = ?1, data = ?2 WHERE account = ?3 AND rev = ?4').bind(now, data, me.id, rev).run();
    if (r.meta.changes !== 1) return json({ error: 'stale' }, 409);
    return json({ rev: rev + 1, at: now }, 200);
  }
  return json({ error: 'not found' }, 404);
}

/** Today, this week or all time. Every Roundup the server worked out itself is on it; a name shows only
 * for an account that chose to be listed. A rider is an account, or a browser id when there is none. */
async function leaderboard(req, db, url, json) {
  const view = ['today', 'week', 'all'].includes(url.searchParams.get('view')) ? url.searchParams.get('view') : 'today';
  const day = Number(url.searchParams.get('day'));
  if (!Number.isInteger(day) || day < 1 || day > 100000) return json({ error: 'bad day' }, 400);
  const [from, to] = view === 'today' ? [day, day] : view === 'week' ? [day - 6, day] : [1, day];
  const today = view === 'today';
  const rider = "COALESCE(s.account, 'c:' || s.client)";
  const named = 'CASE WHEN a.listed = 1 THEN a.name END';
  const sum = today ? 's.score' : 'SUM(s.score)';
  const base = 'FROM scores s LEFT JOIN accounts a ON a.id = s.account WHERE s.verified = 1 AND s.day BETWEEN ?1 AND ?2';
  const group = today ? '' : `GROUP BY ${rider}`;
  // One row per rider. Today is a single Roundup each; a week or all time adds them up.
  const cols = today
    ? `${rider} AS rider, ${named} AS name, s.score AS score, 1 AS days, s.score AS best, s.hits AS hits, length(replace(s.hits, '0', '')) AS roped`
    : `${rider} AS rider, MAX(${named}) AS name, SUM(s.score) AS score, COUNT(*) AS days, MAX(s.score) AS best, NULL AS hits, SUM(length(replace(s.hits, '0', ''))) AS roped`;
  const { results } = await db.prepare(`SELECT ${cols} ${base} ${group} ORDER BY score DESC, ${today ? 's.at' : 'MIN(s.at)'} ASC LIMIT ${TOP}`).bind(from, to).all();
  const players = await db.prepare(`SELECT COUNT(DISTINCT ${rider}) AS n ${base}`).bind(from, to).first();
  // You: your account when signed in, otherwise this browser's id. Neither is ever sent back.
  const me = await who(req, db);
  const client = url.searchParams.get('client');
  const mine = me ? me.id : typeof client === 'string' && /^[a-z0-9]{12,24}$/.test(client) ? `c:${client}` : null;
  let you = null;
  if (mine) {
    const row = await db.prepare(`SELECT ${sum} AS score, COUNT(*) AS days, MAX(s.score) AS best, SUM(length(replace(s.hits, '0', ''))) AS roped ${base} AND ${rider} = ?3 ${group}`).bind(from, to, mine).first();
    if (row && row.days) {
      const above = await db.prepare(`SELECT COUNT(*) AS n FROM (SELECT ${sum} AS score ${base} AND ${rider} != ?3 ${group}) WHERE score > ?4`).bind(from, to, mine, row.score).first();
      you = { name: me ? me.name : null, listed: !!me?.listed, rank: above.n + 1, score: row.score, days: row.days, best: row.best, roped: row.roped };
    }
  }
  // Ranks are shared on ties: two riders on 500 are both third.
  let rank = 0;
  let last = null;
  const rows = results.map((r, i) => {
    if (r.score !== last) { rank = i + 1; last = r.score; }
    return { rank, name: r.name, score: r.score, days: r.days, best: r.best, roped: r.roped, hits: r.hits, you: r.rider === mine };
  });
  return json({ view, day, from, to, players: players.n, rows, you }, 200);
}
