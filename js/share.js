import { NAME, SITE } from './config.js';

const CELL = 0.11;
const reach = (d) => Math.min(3, Math.max(1, Math.ceil(d / CELL - 1e-9)));

/**
 * One row of symbols, always centred on the answer, so it gives nothing away.
 * Yellow is a catch, a cross is a miss, red is how far your band reached.
 */
export function symbolRow(row) {
  const cells = Array(7).fill('⬜');
  if (row.hit) {
    const a = reach(row.x - row.l);
    const b = reach(row.u - row.x);
    for (let i = 3 - a; i <= 3 + b; i++) cells[i] = '🟥';
    cells[3] = '🟡';
  } else {
    const dir = row.x < row.l ? 1 : -1;
    const gap = dir > 0 ? row.l - row.x : row.x - row.u;
    const start = Math.min(3, 1 + Math.floor(gap / CELL));
    const len = Math.max(1, Math.round((row.u - row.l) / CELL));
    for (let i = 0; i < len && start + i <= 3; i++) cells[3 + dir * (start + i)] = '🟥';
    cells[3] = '❌';
  }
  return cells.join('');
}

export function shareText({ title, score, of, rows }) {
  const hits = rows.filter((r) => r.hit).length;
  const head = `${NAME} ${title}: ${String(score).replace('-', '−')} of ${of}`;
  const tail = `Caught ${hits} of ${rows.length}`;
  return [head, ...rows.map(symbolRow), tail, SITE].filter(Boolean).join('\n');
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
