// Everything the player does lives in this browser. The shape carries a version
// and old shapes are upgraded on load, never thrown away.
import { STORE_KEY } from './config.js';

const VERSION = 1;
const fresh = () => ({
  v: VERSION,
  settings: { sound: false, haptics: true, theme: 'auto' },
  days: {},     // day number -> { key, live, rows: [...], at }
  open: null,   // today's unfinished round
  practice: { rows: [], seen: {} },
  quant: { runs: [] },
  seenIntro: false,
});

// Upgrades by version number. Each returns the next shape.
const upgrades = {};

let data = null;
let memoryOnly = false;
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return fresh();
    return upgrade(JSON.parse(raw));
  } catch (err) {
    try {
      // Unreadable data is set aside, not overwritten.
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) localStorage.setItem(`${STORE_KEY}-unreadable-${Date.now()}`, raw);
    } catch { memoryOnly = true; }
    return fresh();
  }
}

export function upgrade(d) {
  if (!d || typeof d !== 'object') throw new Error('not a save');
  let cur = d;
  while ((cur.v || 0) < VERSION && upgrades[cur.v || 0]) cur = upgrades[cur.v || 0](cur);
  const base = fresh();
  return {
    ...base, ...cur, v: Math.max(VERSION, cur.v || 0),
    settings: { ...base.settings, ...cur.settings },
    days: cur.days && typeof cur.days === 'object' ? cur.days : {},
    practice: { ...base.practice, ...cur.practice },
    quant: { ...base.quant, ...cur.quant },
  };
}

function load() { if (!data) data = read(); return data; }

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data));
    memoryOnly = false;
  } catch { memoryOnly = true; }
  listeners.forEach((f) => f());
}

export const store = {
  get(name) { return load().settings[name]; },
  set(name, value) { load().settings[name] = value; save(); },
  data() { return load(); },
  change(fn) { fn(load()); save(); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  get memoryOnly() { load(); return memoryOnly; },
  reset() { data = fresh(); save(); },
  reload() { data = null; return load(); },
};

/** Ask the browser not to clear this site's data. Called after the first finished day. */
export async function askPersist() {
  try {
    if (!navigator.storage?.persist) return null;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return null; }
}

export function exportSave() {
  return JSON.stringify({ app: STORE_KEY, saved: new Date().toISOString(), data: load() }, null, 1);
}

/** Merge a backup into the current save. Never removes a day that is already here. */
export function importSave(text) {
  const parsed = JSON.parse(text);
  const incoming = upgrade(parsed && parsed.app === STORE_KEY ? parsed.data : null);
  const cur = load();
  let added = 0;
  for (const [n, rec] of Object.entries(incoming.days)) {
    if (!/^-?\d+$/.test(n) || !rec || !Array.isArray(rec.rows)) continue;
    const mine = cur.days[n];
    if (!mine) { cur.days[n] = rec; added++; } else if (rec.live && !mine.live) cur.days[n] = rec;
  }
  const have = new Set(cur.practice.rows.map((r) => `${r.id}@${r.at}`));
  for (const r of incoming.practice.rows || []) if (r && !have.has(`${r.id}@${r.at}`)) cur.practice.rows.push(r);
  cur.practice.rows.sort((a, b) => (a.at || 0) - (b.at || 0));
  cur.practice.seen = { ...incoming.practice.seen, ...cur.practice.seen };
  const runs = new Set(cur.quant.runs.map((r) => r.at));
  for (const r of incoming.quant.runs || []) if (r && !runs.has(r.at)) cur.quant.runs.push(r);
  cur.quant.runs.sort((a, b) => a.at - b.at);
  if (!cur.open && incoming.open) cur.open = incoming.open;
  save();
  return { days: added };
}

/** Every answered question, oldest first: the raw material for the dashboard. */
export function allRows() {
  const d = load();
  const rows = [];
  for (const rec of Object.values(d.days)) for (const r of rec.rows) rows.push({ ...r, mode: 'daily', at: r.at || rec.at || 0 });
  for (const r of d.practice.rows) rows.push({ ...r, mode: 'practice' });
  for (const run of d.quant.runs) for (const r of run.rows) rows.push({ ...r, mode: 'quant', at: r.at || run.at });
  return rows.sort((a, b) => (a.at || 0) - (b.at || 0));
}
