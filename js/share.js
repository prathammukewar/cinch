import { NAME, SITE } from './config.js';

import { tierOf } from './score.js';

/** One emoji per named throw. Older emoji only, so every phone shows them. */
export const ICONS = { dead: '\u{1F3AF}', ringer: '\u{1F514}', hogtied: '\u{1F437}', roped: '\u{1F920}', leaner: '\u{1F90F}', snagged: '\u{1F3A3}', dust: '\u{1F4A8}', tumble: '\u{1F335}' };

/** The emoji for one throw. It shows how well the throw went and never the answer. */
export const iconOf = (row) => ICONS[tierOf(row).key];

export function shareText({ title, score, of, rows }) {
  const hits = rows.filter((r) => r.hit).length;
  const hinted = rows.filter((r) => r.hints).length;
  const head = [`${NAME} ${title}`, `${score} of ${of}`, `roped ${hits} of ${rows.length}`, hinted ? `${hinted} with hints` : ''].filter(Boolean).join(' \u00b7 ');
  return [head, rows.map(iconOf).join(''), SITE].join('\n');
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
