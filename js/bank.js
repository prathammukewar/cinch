// Questions arrive in monthly files. Answers are lightly scrambled so they are
// not readable at a glance in the network tab. That is all it is.
import { EPOCH, PER_DAY } from './config.js';
import { keyOf, dayNumber } from './day.js';
import { rng, hash } from './score.js';

const cache = new Map();
let indexPromise = null;

async function get(path) {
  if (!cache.has(path)) {
    cache.set(path, fetch(path).then((r) => {
      if (!r.ok) throw new Error(`${path}: ${r.status}`);
      return r.json();
    }).catch((e) => { cache.delete(path); throw e; }));
  }
  return cache.get(path);
}

export function index() {
  if (!indexPromise) indexPromise = get('data/index.json').catch((e) => { indexPromise = null; throw e; });
  return indexPromise;
}

const mask = (id, i) => hash(`${id}:${i >> 2}`) >>> ((i & 3) * 8) & 255;

export function scramble(id, text) {
  const bytes = new TextEncoder().encode(text);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ^ mask(id, i));
  return btoa(s);
}

export function unscramble(id, code) {
  const s = atob(code);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) ^ mask(id, i);
  return new TextDecoder().decode(bytes);
}

/** File row -> playable question. */
export function open(row) {
  const { x, ...rest } = row;
  return { ...rest, ...JSON.parse(unscramble(row.id, x)) };
}

/**
 * Questions for a day number. Days beyond the planned ones reuse the bank in a
 * fixed shuffled order, so the page never runs dry.
 */
export async function forDay(number) {
  const idx = await index();
  let n = number;
  if (n > idx.days) {
    const r = rng(hash(`loop-${Math.floor((number - 1) / idx.days)}`));
    const order = Array.from({ length: idx.days }, (_, i) => i + 1);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    n = order[(number - 1) % idx.days];
  }
  if (n < 1) n = 1 + (((number - 1) % idx.days) + idx.days) % idx.days;
  const month = keyOf(n).slice(0, 7);
  const file = await get(`data/${month}.json`);
  const rows = file.days[n];
  if (!rows || rows.length !== PER_DAY) throw new Error(`no questions for day ${n}`);
  return rows.map(open);
}

/** Practice pool plus every daily question from days before today. */
export async function practicePool(today) {
  const idx = await index();
  const files = await Promise.all(idx.practice.map((f) => get(`data/${f}`)));
  const rows = files.flatMap((f) => f.rows);
  const months = new Set();
  const last = Math.min(today - 1, idx.days);
  for (let n = Math.max(1, last - 59); n <= last; n++) months.add(keyOf(n).slice(0, 7));
  const past = await Promise.all([...months].map((m) => get(`data/${m}.json`)));
  for (const f of past) for (const [n, list] of Object.entries(f.days)) if (Number(n) < today) rows.push(...list);
  return rows;
}

export const firstDay = () => dayNumber(EPOCH);
