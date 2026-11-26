// Calendar days are the player's own. A day is a plain YYYY-MM-DD key, and all
// arithmetic runs on UTC midnights of that key, so clock changes cannot shift it.
import { EPOCH } from './config.js';

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date of a Date, as YYYY-MM-DD. */
export function dayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const serial = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

export function dayNumber(key) { return serial(key) - serial(EPOCH) + 1; }

export function keyOf(number) {
  const d = new Date((serial(EPOCH) + number - 1) * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export const addDays = (key, n) => keyOf(dayNumber(key) + n);

/** Milliseconds until the next local midnight. */
export function untilMidnight(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;
}

export function longDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Current and best streak from a set of day numbers played on their own day. */
export function streaks(days, today) {
  const set = new Set(days);
  let cur = 0;
  let at = set.has(today) ? today : today - 1;
  while (set.has(at)) { cur++; at--; }
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of [...set].sort((a, b) => a - b)) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current: cur, best };
}
