// Turn bank/questions.json into the files the game loads: one per month, plus practice packs.
// Days that were already shipped are frozen in bank/schedule.json and never change.
//   node tools/bank/ship.mjs [--days 60]
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { scramble } from '../../js/bank.js';
import { keyOf } from '../../js/day.js';
import { rng, hash, toUnit } from '../../js/score.js';
import { PER_DAY } from '../../js/config.js';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root)));
const write = (p, v) => writeFileSync(new URL(p, root), JSON.stringify(v));
const bank = read('bank/questions.json');
const byId = new Map(bank.map((q) => [q.id, q]));
const frozen = existsSync(new URL('bank/schedule.json', root)) ? read('bank/schedule.json') : { days: {}, practice: [] };

const arg = process.argv.indexOf('--days');
const wanted = arg > 0 ? Number(process.argv[arg + 1]) : 60;

/** What makes two questions feel alike. */
const COARSE = new Set(['sp', 'ma', 'ge', 'en', 'te', 'so', 'hu', 'ev', 'hi', 'mlb', 'nfl', 'ru', 'fo', 'mo', 'el', 'sc']);
const family = (q) => {
  if (q.topic === 'yr') return `yr-${q.category}`;
  if (!COARSE.has(q.topic)) return q.topic;
  const parts = q.id.split('-');
  if (/water$/.test(q.id)) return `${parts[0]}-water`;
  return q.topic === 'sp' ? `sp-${parts[parts.length - 1]}` : `${parts[0]}-${parts[1]}`;
};
const magnitude = (q) => (q.scale === 'linear' ? 'linear' : Math.floor(Math.log10(Math.abs(q.answer) || 1) / 2));
/** Harder when the ruler is long or the author said so. */
const hard = (q) => q.difficulty;

function plan() {
  const days = {};
  const used = new Set(frozen.practice);
  for (const [n, ids] of Object.entries(frozen.days)) if (ids.every((id) => byId.has(id))) { days[n] = ids; ids.forEach((id) => used.add(id)); }
  const r = rng(hash('schedule-1'));
  const shuffled = [...bank].filter((q) => !used.has(q.id));
  for (let i = shuffled.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]; }
  const left = new Set(shuffled);
  const start = Math.max(0, ...Object.keys(days).map(Number)) + 1;
  for (let n = start; n <= wanted; n++) {
    const recent = new Set();
    const lastCats = new Map();
    for (let k = Math.max(1, n - 6); k < n; k++) for (const id of days[k] || []) { const q = byId.get(id); recent.add(family(q)); lastCats.set(q.category, (lastCats.get(q.category) || 0) + 1); }
    const day = build(left, recent, lastCats, r);
    if (!day) { console.log(`stopped at day ${n - 1}: not enough variety left`); break; }
    days[n] = day.map((q) => q.id);
    day.forEach((q) => left.delete(q));
  }
  return { days, practice: [...left].map((q) => q.id).concat(frozen.practice.filter((id) => byId.has(id))) };
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
      const list = pool.filter((q) => !day.includes(q) && !cats.has(q.category) && !fams.has(family(q)) && !(q.label && day.some((d) => d.label === q.label)) && (mags.get(magnitude(q)) || 0) < (magnitude(q) === 'linear' ? 3 : 2) && (loose && slot !== slots[0] && slot !== slots[6] ? true : slot(hard(q))));
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

/** Known numbers of the same kind from the practice pool, for the landmark hint. Never from a daily question. */
function marks(q) {
  const x = unit(q.answer, q);
  const near = bank.filter((s) => s.id !== q.id && practiceSet.has(s.id) && s.label && s.topic === q.topic && s.unit === q.unit && s.answer > q.min && s.answer < q.max && s.label !== q.label)
    .map((s) => ({ s, t: unit(s.answer, q) }))
    .filter(({ t }) => Math.abs(t - x) > 0.12 && t > 0.03 && t < 0.97);
  const below = near.filter(({ t }) => t < x).sort((a, b) => b.t - a.t)[0];
  const above = near.filter(({ t }) => t > x).sort((a, b) => a.t - b.t)[0];
  return [below, above].filter(Boolean).slice(0, 2).map(({ s }) => ({ label: s.label, value: s.answer }));
}

const row = (id) => {
  const q = byId.get(id);
  const secret = { answer: q.answer, explainer: q.explainer, source_name: q.source_name, source_url: q.source_url, trims: trims(q), marks: marks(q) };
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
  months.get(m)[n] = ids.map(row);
}
for (const [m, d] of months) write(`data/${m}.json`, { days: d });
const packs = [];
for (let i = 0; i < practice.length; i += 120) { const name = `practice-${packs.length + 1}.json`; write(`data/${name}`, { rows: practice.slice(i, i + 120).map(row) }); packs.push(name); }
write('data/index.json', { days: total, months: [...months.keys()], practice: packs });
writeFileSync(new URL('bank/schedule.json', root), JSON.stringify({ days, practice }, null, 1) + '\n');

// Sources and licences actually used, for the credits page.
const credits = new Map();
for (const q of bank) { const k = `${q.source_name}|${q.licence}`; credits.set(k, (credits.get(k) || 0) + 1); }
write('data/credits.json', [...credits].map(([k, n]) => { const [name, licence] = k.split('|'); return { name, licence, n }; }).sort((a, b) => b.n - a.n));
console.log(`${total} days, ${practice.length} practice questions, ${bank.length} in the bank`);
