// Cinch standings: anonymous daily scores in, "better than N% of today's riders" out.
// Stores the day, the score, which of the seven were roped, a random client id and a time.
// Also runs Rodeo rooms, where up to twelve riders on their own devices rope the same questions at once (rodeo.js),
// accounts and the leaderboard (accounts.js), and works scores out from the loops thrown (verify.js).
import { accounts, who } from './accounts.js';
import { scoreLoops, Refused } from './verify.js';

const SITE = 'https://playcinch.pages.dev/';

const EPOCH = Date.UTC(2026, 10, 25); // day number 1
const DAY = 86400000;
const ALLOWED = ['https://playcinch.pages.dev', 'https://prathammukewar.github.io', 'http://127.0.0.1:8691', 'http://localhost:8691', 'http://127.0.0.1:8692'];

function cors(origin) {
  return {
    'access-control-allow-origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const json = (body, status, origin) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', ...cors(origin) } });

/** Day numbers that are "today" somewhere on Earth right now (UTC-12 to UTC+14). */
function liveDays(now = Date.now()) {
  const a = Math.floor((now - 12 * 3600000 - EPOCH) / DAY) + 1;
  const b = Math.floor((now + 14 * 3600000 - EPOCH) / DAY) + 1;
  return [a, b];
}

const Q = [1, 2, 3, 4, 5, 6, 7];
/** Share of the other riders you beat, ties counting half. null until someone else is in. */
const beat = (below, same, n) => (n > 1 ? Math.round((100 * ((below || 0) + Math.max(0, (same || 0) - 1) / 2)) / (n - 1)) : null);

async function standing(db, day, score, pts) {
  const per = pts ? Q.map((k) => `SUM(p${k} < ?${k + 2}) AS b${k}, SUM(p${k} = ?${k + 2}) AS s${k}`).join(', ') : '';
  const r = await db.prepare(
    `SELECT COUNT(*) AS n, SUM(score < ?2) AS below, SUM(score = ?2) AS same, COUNT(p1) AS nq,
       ${Q.map((k) => `SUM(substr(hits,${k},1)='1') AS h${k}`).join(', ')}${per ? `, ${per}` : ''}
     FROM scores WHERE day = ?1`,
  ).bind(day, score, ...(pts || [])).first();
  const n = r.n || 0;
  return {
    day,
    riders: n,
    better: beat(r.below, r.same, n),
    roped: n ? Q.map((k) => Math.round((100 * (r[`h${k}`] || 0)) / n)) : [],
    qriders: r.nq || 0,
    qbetter: pts ? Q.map((k) => beat(r[`b${k}`], r[`s${k}`], r.nq || 0)) : [],
  };
}

const goodPts = (p, score) => Array.isArray(p) && p.length === 7 && p.every((x) => Number.isInteger(x) && x >= 0 && x <= 100) && p.reduce((a, b) => a + b, 0) === score;

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

async function body(req, limit = 2048) {
  if (Number(req.headers.get('content-length') || 0) > limit) throw new Error('too big');
  const text = await req.text();
  if (text.length > limit) throw new Error('too big');
  try { return JSON.parse(text || '{}'); } catch { throw new Error('bad json'); }
}

const roomOf = (env, code) => env.RODEO.get(env.RODEO.idFromName(code));

/** Rodeo rooms: one Durable Object per four-letter code (rodeo.js). */
async function rodeo(req, env, url, origin) {
  const ip = req.headers.get('cf-connecting-ip') || 'local';
  if (env.LIMITS && !(await env.LIMITS.limit({ key: `rodeo:${ip}` })).success) return json({ error: 'Too many tries. Wait a minute.' }, 429, origin);
  if (req.method === 'POST' && url.pathname === '/v1/rodeo') {
    const b = await body(req);
    for (let tries = 0; tries < 8; tries++) {
      const code = Array.from(crypto.getRandomValues(new Uint8Array(4)), (n) => LETTERS[n % LETTERS.length]).join('');
      const res = await roomOf(env, code).fetch(new Request('https://rodeo/make', { method: 'POST', body: JSON.stringify({ code, name: b.name, q: b.q }) }));
      if (res.status === 409) continue;
      return json(await res.json(), res.status, origin);
    }
    return json({ error: 'busy' }, 503, origin);
  }
  const m = url.pathname.match(/^\/v1\/rodeo\/([A-Z]{4})$/);
  if (!m || req.method !== 'GET') return null;
  if (req.headers.get('upgrade') !== 'websocket') return json({ error: 'WebSocket only' }, 426, origin);
  // Browsers send their page's address with a WebSocket, so other sites cannot open rooms from their pages.
  if (!ALLOWED.includes(origin)) return json({ error: 'not allowed' }, 403, origin);
  return roomOf(env, m[1]).fetch(req);
}

export { Rodeo } from './rodeo.js';

export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(req.url);
    try {
      if (req.method === 'POST' && url.pathname === '/v1/score') {
        // Every Roundup goes on the leaderboard, so posting is limited per address. Counted at Cloudflare's edge; nothing is kept here.
        if (env.SCORES && !(await env.SCORES.limit({ key: `score:${req.headers.get('cf-connecting-ip') || 'local'}` })).success) return json({ error: 'Too many tries. Wait a minute.' }, 429, origin);
        const b = await body(req, 4096);
        const day = Number(b.day);
        const [lo, hi] = liveDays();
        if (!Number.isInteger(day) || day < lo || day > hi) return json({ error: 'not a live day' }, 400, origin);
        if (typeof b.client !== 'string' || !/^[a-z0-9]{12,24}$/.test(b.client)) return json({ error: 'bad client' }, 400, origin);
        let score; let hits; let pts = null; let verified = 0;
        if (Array.isArray(b.loops)) {
          // The server works the score out itself from the loops, with the game's own scoring.
          try { ({ score, hits, points: pts } = await scoreLoops(env.SITE || SITE, day, b.loops)); verified = 1; }
          catch (e) { if (e instanceof Refused) return json({ error: e.message }, 400, origin); throw e; }
        } else {
          score = Number(b.score);
          hits = b.hits;
          if (!Number.isInteger(score) || score < 0 || score > 700) return json({ error: 'bad score' }, 400, origin);
          if (typeof hits !== 'string' || !/^[01]{7}$/.test(hits)) return json({ error: 'bad hits' }, 400, origin);
          pts = goodPts(b.points, score) ? b.points : null;
        }
        const me = verified ? await who(req, env.DB) : null;
        // One Roundup per account per day: if another device already counted one, this one stays anonymous.
        let account = me ? me.id : null;
        if (account && await env.DB.prepare('SELECT 1 FROM scores WHERE day = ?1 AND account = ?2 AND client != ?3').bind(day, account, b.client).first()) account = null;
        const had = await env.DB.prepare('SELECT score, verified, account, p1 FROM scores WHERE day = ?1 AND client = ?2').bind(day, b.client).first();
        const p7 = pts || Array(7).fill(null);
        if (!had) {
          await env.DB.prepare('INSERT INTO scores (day, client, score, hits, at, p1, p2, p3, p4, p5, p6, p7, account, verified) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)')
            .bind(day, b.client, score, hits, Date.now(), ...p7, account, verified).run();
        } else if (verified && !had.verified) {
          // The same finish, now worked out by the server: its numbers replace the ones the browser sent.
          await env.DB.prepare('UPDATE scores SET score = ?3, hits = ?4, p1 = ?5, p2 = ?6, p3 = ?7, p4 = ?8, p5 = ?9, p6 = ?10, p7 = ?11, verified = 1, account = COALESCE(account, ?12) WHERE day = ?1 AND client = ?2')
            .bind(day, b.client, score, hits, ...p7, account).run();
        } else if (verified && !had.account && account) {
          await env.DB.prepare('UPDATE scores SET account = ?3 WHERE day = ?1 AND client = ?2').bind(day, b.client, account).run();
        } else if (pts && had.p1 === null && had.score === score) {
          await env.DB.prepare('UPDATE scores SET p1 = ?3, p2 = ?4, p3 = ?5, p4 = ?6, p5 = ?7, p6 = ?8, p7 = ?9 WHERE day = ?1 AND client = ?2').bind(day, b.client, ...pts).run();
        }
        const mine = await env.DB.prepare('SELECT score, hits, verified, account, p1, p2, p3, p4, p5, p6, p7 FROM scores WHERE day = ?1 AND client = ?2').bind(day, b.client).first();
        const minePts = mine.p1 === null ? null : Q.map((k) => mine[`p${k}`]);
        return json({ ...(await standing(env.DB, day, mine.score, minePts)), score: mine.score, points: minePts, verified: !!mine.verified, counted: !!me && mine.account === me.id }, 200, origin);
      }
      const acct = await accounts(req, env, url, (b2, st) => json(b2, st, origin), body);
      if (acct) return acct;
      if (url.pathname.startsWith('/v1/rodeo')) {
        const res = await rodeo(req, env, url, origin);
        if (res) return res;
      }
      const m = url.pathname.match(/^\/v1\/day\/(\d{1,5})$/);
      if (req.method === 'GET' && m) {
        const score = Number(url.searchParams.get('score') || 0);
        const pts = (url.searchParams.get('pts') || '').split(',').filter(Boolean).map(Number);
        return json(await standing(env.DB, Number(m[1]), Number.isFinite(score) ? score : 0, goodPts(pts, score) ? pts : null), 200, origin);
      }
      return json({ error: 'not found' }, 404, origin);
    } catch (e) {
      if (e?.message === 'too big') return json({ error: 'too big' }, 413, origin);
      if (e?.message === 'bad json') return json({ error: 'bad json' }, 400, origin);
      return json({ error: 'server' }, 500, origin);
    }
  },
};
