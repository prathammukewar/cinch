// Numbers in and out. Display follows the question's unit.

const BIG = [
  [1e15, 'quadrillion', 'Q'], [1e12, 'trillion', 'T'], [1e9, 'billion', 'B'], [1e6, 'million', 'M'],
];

/** Keep d significant digits without scientific notation. */
export function sig(v, d) {
  if (!v || !Number.isFinite(v)) return v;
  return Number(v.toPrecision(d));
}

function plain(v) {
  const a = Math.abs(v);
  const digits = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : Math.min(12, 2 - Math.floor(Math.log10(a || 1)));
  return trim(v.toLocaleString('en-US', { maximumFractionDigits: Math.max(0, digits), useGrouping: a >= 10000 || a >= 1000 }));
}
const trim = (s) => s.replace('-', '−');

/** The number alone. Years stay ungrouped, very large values use words. */
export function num(v, q = {}) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '';
  if (q.unit === 'year') return String(Math.round(v));
  const a = Math.abs(v);
  for (const [n, word] of BIG) {
    if (a >= n && (n > 1e6 || a >= 1e7 || sig(a / n, 4) * n === a)) return `${trim(sig(v / n, 4).toLocaleString('en-US', { maximumFractionDigits: 3 }))} ${word}`;
  }
  return plain(v);
}

const PREFIX = { 'US dollars': '$' };
const TIGHT_SUFFIX = new Set(['%', '°C', '°F']);

/** Number with its unit, for reading. */
export function withUnit(v, q) {
  const n = num(v, q);
  if (q.unit === 'year' || !q.unit) return n;
  if (PREFIX[q.unit]) return n.startsWith('−') ? `−${PREFIX[q.unit]}${n.slice(1)}` : PREFIX[q.unit] + n;
  if (TIGHT_SUFFIX.has(q.unit)) return n + q.unit;
  return `${n} ${Math.abs(v) === 1 && q.unitOne ? q.unitOne : q.unit}`;
}

/** Short label for a ruler tick or a tag. */
export function short(v, q = {}) {
  if (q.unit === 'year') return String(Math.round(v));
  const a = Math.abs(v);
  for (const [n, , letter] of BIG) if (a >= n * 0.9999) return `${trim(String(sig(v / n, 3)))}${letter}`;
  if (a >= 10000 && sig(v / 1000, 3) * 1000 === sig(v, 6)) return `${trim(String(sig(v / 1000, 3)))}K`;
  if (a >= 1000) return plain(v);
  return trim(String(sig(v, 3)));
}

const WORDS = { k: 1e3, thousand: 1e3, m: 1e6, mil: 1e6, mn: 1e6, million: 1e6, b: 1e9, bn: 1e9, billion: 1e9, t: 1e12, tn: 1e12, trillion: 1e12, q: 1e15, quadrillion: 1e15 };

/** Read typed text such as "1,200", "3.5k", "2 million", "-40", "$5". null if unreadable. */
export function parse(text) {
  if (typeof text !== 'string') return null;
  let s = text.trim().toLowerCase().replace(/[−–—]/g, '-').replace(/[,\s_$£€%]/g, '').replace(/°[cf]?$/, '');
  const m = s.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z]*)$/);
  if (!m) return null;
  const mult = m[2] ? WORDS[m[2]] : 1;
  if (!mult) return null;
  const v = Number(m[1]) * mult;
  return Number.isFinite(v) ? v : null;
}

/** Round a dragged value to something a person would say. */
export function friendly(v, ruler) {
  const { min, max, scale } = ruler;
  if (scale === 'log') {
    const span = Math.log10(max / min);
    return sig(v, span > 2.5 ? 2 : 3);
  }
  const raw = (max - min) / 400;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  let step = [1, 2, 5, 10].map((k) => k * p).find((k) => k >= raw * 0.999);
  if (ruler.whole) step = Math.max(1, step);
  return sig(Math.round(v / step) * step, 10);
}

/** Tick marks for a ruler: [{ t, value, level, label }], level 0 is the longest. */
export function ticks(ruler, q, width) {
  const out = [];
  const { min, max, scale } = ruler;
  if (scale === 'log') {
    const a = Math.floor(Math.log10(min) + 1e-9);
    const b = Math.ceil(Math.log10(max) - 1e-9);
    const span = Math.log(max / min);
    const perDecade = (width * Math.LN10) / span;
    const labels = new Set([1]);
    if (perDecade > 150) { labels.add(2); labels.add(5); } else if (perDecade > 96) labels.add(3);
    for (let d = a; d <= b; d++) {
      for (let k = 10; k < 100; k += perDecade > 130 ? (k < 20 ? 1 : k < 50 ? 2 : 5) : 10) {
        const value = sig(k * Math.pow(10, d - 1), 6);
        if (value < min * 0.99999 || value > max * 1.00001) continue;
        const lead = k / 10;
        const level = k === 10 ? 0 : lead === 5 || lead === 2 ? 1 : Number.isInteger(lead) ? 2 : 3;
        out.push({ t: Math.log(value / min) / span, value, level, label: labels.has(lead) ? short(value, q) : '' });
      }
    }
  } else {
    const target = Math.max(3, Math.floor(width / 84));
    const raw = (max - min) / target;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const major = [1, 2, 2.5, 5, 10].map((k) => k * p).find((k) => k >= raw * 0.98);
    const parts = major / p === 2.5 ? 5 : major / p === 2 ? 4 : 5;
    const minor = major / parts;
    const fine = width / ((max - min) / minor) > 26 ? 2 : 1;
    const step = minor / fine;
    for (let i = Math.ceil(min / step - 1e-9); i * step <= max + 1e-9 * Math.abs(max); i++) {
      const value = sig(i * step, 10);
      const isMajor = Math.abs(value / major - Math.round(value / major)) < 1e-6;
      const isMinor = Math.abs(value / minor - Math.round(value / minor)) < 1e-6;
      out.push({ t: (value - min) / (max - min), value, level: isMajor ? 0 : isMinor ? 2 : 3, label: isMajor ? short(value, q) : '' });
    }
  }
  return out;
}
