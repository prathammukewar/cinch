import { NAME, SITE } from './config.js';

const CELL = 0.11;
const reach = (d) => Math.min(3, Math.max(1, Math.ceil(d / CELL - 1e-9)));
const GREEN = '\u{1F7E9}';
const ORANGE = '\u{1F7E7}';
const RED = '\u{1F7E5}';
const SHOE = '\u{1F7E1}';
const MISS = '\u274c';
const EMPTY = '\u2b1c';

/**
 * One row of seven symbols, always centred on the answer, so it gives nothing away.
 * The coloured cells are your loop: green when it roped the answer, orange when it
 * nearly did, red when it missed.
 */
export function symbolRow(row) {
  const cells = Array(7).fill(EMPTY);
  if (row.hit) {
    const a = reach(row.x - row.l);
    const b = reach(row.u - row.x);
    for (let i = 3 - a; i <= 3 + b; i++) cells[i] = GREEN;
    cells[3] = SHOE;
  } else {
    const dir = row.x < row.l ? 1 : -1;
    const gap = dir > 0 ? row.l - row.x : row.x - row.u;
    const start = Math.min(3, 1 + Math.floor(gap / CELL));
    const len = Math.max(1, Math.round((row.u - row.l) / CELL));
    const color = row.points >= 10 ? ORANGE : RED;
    for (let i = 0; i < len && start + i <= 3; i++) cells[3 + dir * (start + i)] = color;
    cells[3] = MISS;
  }
  return cells.join('');
}

export function shareText({ title, score, of, rows }) {
  const hits = rows.filter((r) => r.hit).length;
  const hinted = rows.filter((r) => r.hints).length;
  const head = `${NAME} ${title}: roped ${hits} of ${rows.length}, ${String(score).replace('-', '\u2212')} points`;
  return [head, ...rows.map(symbolRow), hinted ? `${hinted} with hints` : '', SITE].filter(Boolean).join('\n');
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.style.cssText = 'position:fixed;opacity:0';
    document.body.append(t);
    t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  }
}

/** Phone share sheet when there is one, otherwise the clipboard. */
export async function shareOrCopy(text) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  if (coarse && navigator.share) {
    try { await navigator.share({ text }); return 'shared'; } catch (e) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  return (await copy(text)) ? 'copied' : 'failed';
}
