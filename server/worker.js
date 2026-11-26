// Cinch standings: anonymous daily scores in, "better than N% of today's riders" out.
// Stores the day, the score, which of the seven were roped, a random client id and a time.

const EPOCH = Date.UTC(2026, 10, 25); // day number 1
const DAY = 86400000;
const ALLOWED = ['https://playcinch.pages.dev', 'https://prathammukewar.github.io', 'http://127.0.0.1:8691', 'http://localhost:8691', 'http://127.0.0.1:8692'];

function cors(origin) {
  return {
    'access-control-allow-origin': ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'origin',
  };
}

const json = (body, status, origin) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...cors(origin) } });

/** Day numbers that are "today" somewhere on Earth right now (UTC-12 to UTC+14). */
function liveDays(now = Date.now()) {
  const a = Math.floor((now - 12 * 3600000 - EPOCH) / DAY) + 1;
  const b = Math.floor((now + 14 * 3600000 - EPOCH) / DAY) + 1;
  return [a, b];
}

async function standing(db, day, score) {
  const r = await db.prepare(
    `SELECT COUNT(*) AS n, SUM(score < ?2) AS below, SUM(score = ?2) AS same,
       SUM(substr(hits,1,1)='1') AS h1, SUM(substr(hits,2,1)='1') AS h2, SUM(substr(hits,3,1)='1') AS h3,
       SUM(substr(hits,4,1)='1') AS h4, SUM(substr(hits,5,1)='1') AS h5, SUM(substr(hits,6,1)='1') AS h6, SUM(substr(hits,7,1)='1') AS h7
     FROM scores WHERE day = ?1`,
  ).bind(day, score).first();
  const n = r.n || 0;
  return {
    day,
    riders: n,
    better: n ? Math.round((100 * ((r.below || 0) + Math.max(0, (r.same || 0) - 1) / 2)) / Math.max(1, n - 1)) : null,
    roped: n ? [r.h1, r.h2, r.h3, r.h4, r.h5, r.h6, r.h7].map((x) => Math.round((100 * (x || 0)) / n)) : [],
  };
}

export default {
  async fetch(req, env) {
    const origin = req.headers.get('origin') || '';
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(req.url);
    try {
      if (req.method === 'POST' && url.pathname === '/v1/score') {
        if (Number(req.headers.get('content-length') || 0) > 512) return json({ error: 'too big' }, 413, origin);
        const b = await req.json();
        const day = Number(b.day);
        const score = Number(b.score);
        const [lo, hi] = liveDays();
        if (!Number.isInteger(day) || day < lo || day > hi) return json({ error: 'not a live day' }, 400, origin);
        if (!Number.isInteger(score) || score < 0 || score > 700) return json({ error: 'bad score' }, 400, origin);
        if (typeof b.hits !== 'string' || !/^[01]{7}$/.test(b.hits)) return json({ error: 'bad hits' }, 400, origin);
        if (typeof b.client !== 'string' || !/^[a-z0-9]{12,24}$/.test(b.client)) return json({ error: 'bad client' }, 400, origin);
        await env.DB.prepare('INSERT OR IGNORE INTO scores (day, client, score, hits, at) VALUES (?1, ?2, ?3, ?4, ?5)')
          .bind(day, b.client, score, b.hits, Date.now()).run();
        const mine = await env.DB.prepare('SELECT score FROM scores WHERE day = ?1 AND client = ?2').bind(day, b.client).first();
        return json(await standing(env.DB, day, mine.score), 200, origin);
      }
      const m = url.pathname.match(/^\/v1\/day\/(\d{1,5})$/);
      if (req.method === 'GET' && m) {
        const score = Number(url.searchParams.get('score') || 0);
        return json(await standing(env.DB, Number(m[1]), Number.isFinite(score) ? score : 0), 200, origin);
      }
      return json({ error: 'not found' }, 404, origin);
    } catch (e) {
      return json({ error: 'server' }, 500, origin);
    }
  },
};
