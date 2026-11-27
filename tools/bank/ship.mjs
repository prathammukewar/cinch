// Turn bank/questions.json into the files the game loads: one per month, plus practice packs.
// Days that were already shipped are frozen in bank/schedule.json and never change.
//   node tools/bank/ship.mjs [--days 60]
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { scramble, unscramble } from '../../js/bank.js';
import { keyOf } from '../../js/day.js';
import { rng, hash, toUnit } from '../../js/score.js';
import { PER_DAY } from '../../js/config.js';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root)));
const write = (p, v) => writeFileSync(new URL(p, root), JSON.stringify(v));
const bank = read('bank/questions.json');
const byId = new Map(bank.map((q) => [q.id, q]));
const frozen = existsSync(new URL('bank/schedule.json', root)) ? read('bank/schedule.json') : { days: {}, practice: [] };

// ------------------------------------------------------------ standard rails
// Every rail of the same kind has the same length, so the same loop always scores the same:
// numbers that grow by multiples span a factor of 100, years 150 years, temperatures 1,000 degrees,
// percentages 0 to 100. The answer sits at a random spot on its rail. Days already played keep
// the rails they were played on, so nobody's score changes after the fact.
const RAILS_FROM = 3;
const NICE = [1, 2, 5];
const niceDown = (x) => { const p = 10 ** Math.floor(Math.log10(x)); return NICE.map((s) => s * p).filter((v) => v <= x * (1 + 1e-9)).pop() || p; };
const niceStep = (v, dir) => {
  const p = 10 ** Math.floor(Math.log10(v) + 1e-9);
  const i = NICE.indexOf(Math.round(v / p));
  if (dir > 0) return i === NICE.length - 1 ? 10 * p : NICE[i + 1] * p;
  return i === 0 ? 5 * (p / 10) : NICE[i - 1] * p;
};
const tidy = (v) => Number(v.toPrecision(12));
function standardRail(q) {
  const r = rng(hash(`rail:${q.id}`));
  const pos = 0.1 + 0.8 * r();
  const a = q.answer;
  if (q.scale === 'log') {
    let lo = niceDown(a / 10 ** (2 * pos));
    if (q.whole && lo < 1) lo = 1;
    // Keep the answer well inside: never in the outer tenth of the rail.
    while (a / lo > 10 ** 1.8) lo = niceStep(lo, 1);
    while (a / lo < 10 ** 0.2 && !(q.whole && lo <= 1)) lo = niceStep(lo, -1);
    return [tidy(lo), tidy(lo * 100)];
  }
  if (q.unit === '%') return [0, 100];
  if (q.unit === 'year') {
    let lo = Math.floor((a - pos * 150) / 10) * 10;
    if (lo + 150 > 2030) lo = 2030 - 150;
    return [lo, lo + 150];
  }
  if (q.unit === '\u00b0C') {
    let lo = Math.floor((a - pos * 1000) / 50) * 50;
    if (lo < -273) lo = -273;
    return [lo, lo + 1000];
  }
  return [q.min, q.max];
}
const playedRails = new Set(Object.entries(frozen.days).filter(([n]) => Number(n) < RAILS_FROM).flatMap(([, ids]) => ids));
for (const q of bank) {
  if (playedRails.has(q.id)) continue;
  [q.min, q.max] = standardRail(q);
}


const arg = process.argv.indexOf('--days');
const wanted = arg > 0 ? Number(process.argv[arg + 1]) : 400;
/** Share of new questions kept for practice, chosen by each question's own id so it never moves. */
const PRACTICE_SHARE = 30;

/** What makes two questions feel alike. */
const COARSE = new Set(['sp', 'ma', 'ge', 'en', 'te', 'so', 'hu', 'ev', 'hi', 'mlb', 'nfl', 'ru', 'fo', 'mo', 'el', 'sc']);
const family = (q) => {
  if (q.topic === 'yr') return `yr-${q.category}`;
  if (!COARSE.has(q.topic)) return q.topic;
  const parts = q.id.split('-');
  if (/water$/.test(q.id)) return `${parts[0]}-water`;
  return q.topic === 'sp' ? `sp-${parts[parts.length - 1]}` : `${parts[0]}-${parts[1]}`;
};
/** "How many ... in <country>" questions read alike, so a day takes two at most. */
const isCountry = (q) => q.topic?.startsWith('wb-');
const magnitude = (q) => (q.scale === 'linear' ? 'linear' : Math.floor(Math.log10(Math.abs(q.answer) || 1) / 2));
/** Harder when the ruler is long or the author said so. */
const hard = (q) => q.difficulty;

function plan() {
  const days = {};
  const used = new Set(frozen.practice);
  for (const [n, ids] of Object.entries(frozen.days)) if (ids.every((id) => byId.has(id))) { days[n] = ids; ids.forEach((id) => used.add(id)); }
  const r = rng(hash('schedule-1'));
  const kept = [...bank].filter((q) => !used.has(q.id) && (hash(`practice:${q.id}`) >>> 0) % 100 < PRACTICE_SHARE);
  kept.forEach((q) => used.add(q.id));
  const shuffled = [...bank].filter((q) => !used.has(q.id));
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const left = new Set(shuffled);
  const start = Math.max(0, ...Object.keys(days).map(Number)) + 1;
  const gaps = {};
  for (let n = start; n <= wanted; n++) {
    // A family of questions waits a week before it comes back. When too few families are left for
    // that, the wait shortens, never below two days. Every day still has seven topics and seven families.
    let day = null;
    for (const back of [6, 4, 3, 2]) {
      const recent = new Set();
      const lastCats = new Map();
      for (let k = Math.max(1, n - back); k < n; k++) for (const id of days[k] || []) { const q = byId.get(id); recent.add(family(q)); lastCats.set(q.category, (lastCats.get(q.category) || 0) + 1); }
      day = build(left, recent, lastCats, r);
      if (day) { gaps[back] = (gaps[back] || 0) + 1; break; }
    }
    if (!day) { console.log(`stopped at day ${n - 1}: not enough variety left`); break; }
    days[n] = day.map((q) => q.id);
    day.forEach((q) => left.delete(q));
  }
  if (Object.keys(gaps).length) console.log(`new days by family gap (days): ${JSON.stringify(gaps)}`);
  return { days, practice: [...left, ...kept].map((q) => q.id).concat(frozen.practice.filter((id) => byId.has(id))) };
}

function build(left, recent, lastCats, r) {
  const remaining = new Map();
  for (const q of left) remaining.set(q.category, (remaining.get(q.category) || 0) + 1);
  const pool = [...left].filter((q) => !recent.has(family(q)));
  const slots = [(d) => d === 1, (d) => d <= 2, (d) => d <= 2, (d) => d === 2, (d) => d >= 2, (d) => d >= 2, (d) => d === 3];
  for (let tries = 0; tries < 300; tries++) {
    // Use up the categories with the most left, and avoid ones seen a lot this week.
    const w = new Map(pool.map((q) => [q, Math.log1p(remaining.get(q.category) || 0) - (lastCats.get(q.category) || 0) * 0.9 + r() * 2.2]));
    const loose = tries > 150;
    const day = [];
    const cats = new Set();
    const fams = new Set();
    const mags = new Map();
    let ok = true;
    for (const slot of slots) {
      const list = pool.filter((q) => !day.includes(q) && !cats.has(q.category) && !fams.has(family(q)) && !(q.label && day.some((d) => d.label === q.label)) && !(isCountry(q) && day.filter(isCountry).length >= 2) && (mags.get(magnitude(q)) || 0) < (magnitude(q) === 'linear' ? 3 : 2) && (loose && slot !== slots[0] && slot !== slots[6] ? true : slot(hard(q))));
      if (!list.length) { ok = false; break; }
      list.sort((a, b) => w.get(b) - w.get(a));
      const q = list[0];
      day.push(q); cats.add(q.category); fams.add(family(q)); mags.set(magnitude(q), (mags.get(magnitude(q)) || 0) + 1);
    }
    if (ok) return day;
  }
  return null;
}

const { days, practice } = plan();
const total = Object.keys(days).length;

const practiceSet = new Set();
const unit = (v, q) => (q.scale === 'log' ? Math.log(v / q.min) / Math.log(q.max / q.min) : (v - q.min) / (q.max - q.min));
const r3 = (v) => Math.round(v * 1000) / 1000;

/** Two nested windows of the ruler that still hold the answer, for the trim hint. */
function trims(q) {
  const r = rng(hash(`trim:${q.id}`));
  const x = unit(q.answer, q);
  const out = [];
  let [a, b] = [0, 1];
  for (const len of [0.5, 0.25]) {
    let lo = x - len * (0.12 + 0.76 * r());
    lo = Math.min(Math.max(lo, a), b - len);
    out.push([r3(lo), r3(lo + len)]);
    [a, b] = [lo, lo + len];
  }
  return out;
}

/**
 * Known numbers of the same kind from the practice pool, for the landmark hint. Never from a daily question.
 * Drawn at random from the closest few on each side, so the answer sits between the two marks only about
 * half the time. The rest of the time both marks are on one side of it.
 */
function marks(q) {
  const r = rng(hash(`marks:${q.id}`));
  const x = unit(q.answer, q);
  const near = bank.filter((s) => s.id !== q.id && practiceSet.has(s.id) && s.label && s.topic === q.topic && s.unit === q.unit && s.answer > q.min && s.answer < q.max && s.label !== q.label)
    .map((s) => ({ s, t: unit(s.answer, q) }))
    .filter(({ t }) => Math.abs(t - x) > 0.12 && t > 0.03 && t < 0.97);
  const below = near.filter(({ t }) => t < x).sort((a, b) => b.t - a.t).slice(0, 3);
  const above = near.filter(({ t }) => t > x).sort((a, b) => a.t - b.t).slice(0, 3);
  const pairs = (a, b) => a.flatMap((m, i) => b.filter((n, j) => (a !== b || j > i) && Math.abs(n.t - m.t) > 0.06).map((n) => [m, n]));
  const kinds = [[0.5, pairs(below, above)], [0.25, pairs(below, below)], [0.25, pairs(above, above)]].filter(([, p]) => p.length);
  let chosen;
  if (kinds.length) {
    const total = kinds.reduce((t, [w]) => t + w, 0);
    let roll = r() * total;
    const [, list] = kinds.find(([w]) => (roll -= w) < 0) || kinds[kinds.length - 1];
    chosen = list[Math.floor(r() * list.length)];
  } else {
    chosen = [...below, ...above].slice(0, 1);
  }
  return chosen.sort((a, b) => a.t - b.t).map(({ s }) => ({ label: s.label, value: s.answer }));
}

// Scout marks come from the practice pool, which grows. Days already shipped keep the marks they shipped with.
const shippedMarks = new Map();
for (const f of existsSync(new URL('data/', root)) ? readdirSync(new URL('data/', root)) : []) {
  if (!/^\d{4}-\d\d\.json$/.test(f)) continue;
  for (const [n, rows] of Object.entries(read(`data/${f}`).days)) {
    if (!frozen.days[n]) continue;
    for (const r of rows) shippedMarks.set(`${n}:${r.id}`, JSON.parse(unscramble(r.id, r.x)).marks);
  }
}

const row = (id, n) => {
  const q = byId.get(id);
  const secret = { answer: q.answer, explainer: q.explainer, source_name: q.source_name, source_url: q.source_url, trims: trims(q), marks: shippedMarks.get(`${n}:${id}`) ?? marks(q) };
  const out = { id: q.id, question: q.question, unit: q.unit, category: q.category, difficulty: q.difficulty, scale: q.scale, min: q.min, max: q.max, licence: q.licence, x: scramble(q.id, JSON.stringify(secret)) };
  if (q.as_of) out.as_of = q.as_of;
  if (q.whole) out.whole = true;
  return out;
};

practice.forEach((id) => practiceSet.add(id));
mkdirSync(new URL('data/', root), { recursive: true });
for (const f of readdirSync(new URL('data/', root))) if (/^(\d{4}-\d\d|practice-\d+|index)\.json$/.test(f)) unlinkSync(new URL(`data/${f}`, root));
const months = new Map();
for (const [n, ids] of Object.entries(days)) {
  const m = keyOf(Number(n)).slice(0, 7);
  if (!months.has(m)) months.set(m, {});
  months.get(m)[n] = ids.map((id) => row(id, n));
}
for (const [m, d] of months) write(`data/${m}.json`, { days: d });
const packs = [];
for (let i = 0; i < practice.length; i += 120) { const name = `practice-${packs.length + 1}.json`; write(`data/${name}`, { rows: practice.slice(i, i + 120).map((id) => row(id)) }); packs.push(name); }
write('data/index.json', { days: total, months: [...months.keys()], practice: packs });
writeFileSync(new URL('bank/schedule.json', root), JSON.stringify({ days, practice }, null, 1) + '\n');

// Sources and licences actually used, for the credits page.
const credits = new Map();
for (const q of bank) { const k = `${q.source_name}|${q.licence}`; credits.set(k, (credits.get(k) || 0) + 1); }
write('data/credits.json', [...credits].map(([k, n]) => { const [name, licence] = k.split('|'); return { name, licence, n }; }).sort((a, b) => b.n - a.n));
console.log(`${total} days, ${practice.length} practice questions, ${bank.length} in the bank`);
