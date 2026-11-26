import { NAME, PER_DAY, QUANT_LENGTH, QUANT_SECONDS, CURVE_MIN, SITE } from './config.js';
import { dayKey, dayNumber, keyOf, longDate, untilMidnight, streaks } from './day.js';
import { forDay, practicePool, open, index } from './bank.js';
import { store, askPersist, exportSave, importSave, allRows } from './store.js';
import { sound } from './sound.js';
import { total, kindOf, binomCdf, hash } from './score.js';
import { withUnit } from './format.js';
import { Round } from './play.js';
import { h, $, say, toast, reducedMotion, signed, plus } from './dom.js';

const main = $('main');
let current = null; // whatever needs tearing down when the screen changes
let today = dayNumber(dayKey());

// ------------------------------------------------------------------ chrome

const ICON = {
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  on: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5"/></svg>',
};

function paintSound() {
  const on = !!store.get('sound');
  $('sound').innerHTML = on ? ICON.on : ICON.off;
  $('sound').setAttribute('aria-pressed', String(on));
  $('sound').setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
}

function paintTheme() {
  const t = store.get('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  current?.stage?.theme();
  current?.lineup?.theme();
}

function paintPips(rows, length) {
  const el = $('pips');
  el.hidden = !length || length > 10;
  if (el.hidden) return;
  el.setAttribute('aria-label', `${rows.length} of ${length} answered`);
  el.replaceChildren(...Array.from({ length }, (_, i) => h('li', { class: i < rows.length ? kindOf(rows[i]) : i === rows.length ? 'now' : '' })));
}

function drawer(open) {
  const d = $('drawer');
  $('menu').setAttribute('aria-expanded', String(open));
  d.hidden = !open;
  if (!open) return;
  const item = (href, text, sub) => h('a', { href }, text, h('span', { class: 'sub' }, sub));
  const s = streaks(liveDays(), today);
  d.replaceChildren(
    item('#today', 'Today', store.data().days[today]?.live ? 'done' : `no. ${today}`),
    item('#practice', 'Practice', 'no end'),
    item('#quant', 'Quant mode', `ten, ${QUANT_SECONDS} s each`),
    item('#archive', 'Past days', ''),
    h('hr'),
    item('#calibration', 'Your calibration', s.current > 1 ? `${s.current} day streak` : ''),
    item('#scoring', 'How scoring works', ''),
    item('#settings', 'Settings and backup', ''),
    item('#sources', 'Sources', ''),
  );
  d.querySelector('a').focus();
}

$('menu').innerHTML = ICON.menu;
$('menu').addEventListener('click', (e) => { e.stopPropagation(); drawer($('drawer').hidden); });
document.addEventListener('click', (e) => { if (!$('drawer').hidden && (!$('drawer').contains(e.target) || e.target.closest('a'))) drawer(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('drawer').hidden) { drawer(false); $('menu').focus(); } });
$('sound').addEventListener('click', () => { store.set('sound', !store.get('sound')); paintSound(); if (store.get('sound')) { sound.unlock(); sound.twang(0.5); } });
$('mark-name').textContent = NAME;
paintSound();
if (store.get('sound')) sound.unlock();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paintTheme);

const liveDays = () => Object.entries(store.data().days).filter(([, r]) => r.live).map(([n]) => Number(n));

// ------------------------------------------------------------------ router

const lazy = (name) => async (arg) => {
  const pages = await import('./pages.js');
  pages.init({ main, kit: loadResultKit, liveDays, paintTheme, paintSound, paintPips, picker, resultView, today: () => today, setCurrent: (v) => { current = v; }, getCurrent: () => current });
  return pages[name](arg);
};
const screens = { today: showToday, practice: showPractice, day: showDay, quant: lazy('showQuant'), archive: lazy('showArchive'), calibration: lazy('showCalibration'), scoring: lazy('showScoring'), settings: lazy('showSettings'), sources: lazy('showSources') };

// Screens load in order, so a slow one can never draw over the one that came after it.
let chain = Promise.resolve();
function route() {
  chain = chain.then(show, show);
  return chain;
}

async function show() {
  const [name, arg] = (location.hash.slice(1) || 'today').split('/');
  current?.destroy?.();
  current = null;
  paintPips([], 0);
  drawer(false);
  scrollTo(0, 0);
  try {
    await (screens[name] || showToday)(arg);
  } catch (err) {
    main.replaceChildren(h('div', { class: 'center' }, h('div', {},
      h('p', {}, 'The questions did not load. Check your connection and try again.'),
      h('p', { style: 'margin-top:16px' }, h('button', { class: 'btn', type: 'button', onclick: route }, 'Try again')))));
    console.error(err);
  }
}
addEventListener('hashchange', route);

// A new day while the page is open: finish what is on screen, then offer the new one.
setInterval(() => {
  const n = dayNumber(dayKey());
  if (n === today) return;
  today = n;
  const name = (location.hash.slice(1) || 'today').split('/')[0];
  if (name === 'today' && !(current instanceof Round)) route();
  else toast('A new day is ready');
}, 5000);

// ------------------------------------------------------------------- daily

async function showToday() {
  today = dayNumber(dayKey());
  if (store.data().days[today]) return showResult(today, { instant: true });
  return playDay(today, true);
}

async function showDay(arg) {
  const n = Number(arg);
  if (!Number.isInteger(n) || n > today || n < 1) { location.hash = '#archive'; return undefined; }
  if (store.data().days[n]) return showResult(n, { instant: true });
  return playDay(n, n === today);
}

async function playDay(n, live) {
  const questions = await forDay(n);
  const draft = store.data().open?.[n];
  const rows = draft && draft.rows.every((r, i) => r.id === questions[i]?.id) ? draft.rows : [];
  if (rows.length >= PER_DAY) return finish(n, rows, draft.live);
  const started = draft ? draft.live : live;
  paintPips(rows, PER_DAY);
  current = new Round(main, {
    rows,
    length: PER_DAY,
    next: (i) => questions[i] || null,
    label: (i) => `${n === today ? 'Today' : `No. ${n}`}, ${i + 1} of ${PER_DAY}`,
    onRow: (row, q, all) => {
      store.change((d) => { d.open = { ...(d.open || {}), [n]: { rows: all, live: started } }; });
    },
    onEnd: (all) => finish(n, all, started),
  });
  // A first visit needs no focus ring on the heading.
  return undefined;
}

document.addEventListener('round:row', (e) => { if (current?.length) paintPips(e.detail, current.length); });

function finish(n, rows, live) {
  store.change((d) => {
    d.days[n] = { key: keyOf(n), live: !!live, rows, at: Date.now() };
    if (d.open) { const { [n]: _, ...rest } = d.open; d.open = Object.keys(rest).length ? rest : null; }
  });
  askPersist();
  current?.destroy?.();
  current = null;
  return showResult(n, { instant: false });
}

const ODDS = { 7: 47.8, 6: 37.2, 5: 12.4 };

function luckLine(hits, n) {
  const miss = n - hits;
  if (n === 7) {
    if (hits === 7) return `All seven. A perfectly calibrated player does that on ${Math.round(ODDS[7])}% of days, so one clean day says little.`;
    if (hits === 6) return 'Six of seven is as close to 90% as a single day can get.';
    if (hits === 5) return 'Five of seven. A perfectly calibrated player has a day like this about one time in eight.';
    const p = binomCdf(hits, 7, 0.9);
    return `${cap(words(hits))} of seven. A perfectly calibrated player does this badly on ${p < 0.005 ? 'fewer than 1' : `about ${Math.round(p * 100)}`}% of days. One day still cannot tell you much.`;
  }
  return miss === 1 ? `${hits} of ${n} is what 90% ranges should catch on average.` : `You caught ${hits} of ${n}. Short runs swing a lot.`;
}
const words = (k) => ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven'][k] || String(k);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

async function showResult(n, { instant }) {
  await loadResultKit();
  const rec = store.data().days[n];
  const questions = await forDay(n);
  const rows = rec.rows;
  const isToday = n === today;
  paintPips(rows, PER_DAY);
  const view = resultView({
    rows, questions, instant,
    heading: isToday ? `Today, no. ${n}` : `No. ${n}, ${longDate(keyOf(n))}`,
    of: PER_DAY * 100,
    shareTitle: `no. ${n}`,
    third: () => { const s = streaks(liveDays(), today); return ['Streak', s.current === 1 ? '1 day' : `${s.current} days`]; },
    extras: [
      h('a', { class: 'go quiet', href: '#practice' }, 'Practice'),
      h('a', { class: 'go quiet', href: isToday ? '#archive' : '#archive' }, 'Past days'),
    ],
    foot: isToday ? countdown() : null,
  });
  main.replaceChildren(view.el);
  current = view;
  view.start();
}

let kit = null;
async function loadResultKit() {
  if (!kit) kit = Promise.all([import('./lineup.js'), import('./share.js'), import('./stats.js')]).then(([l, sh, st]) => ({ ...l, ...sh, ...st }));
  return kit.then((k) => { Object.assign(K, k); });
}
const K = {};

function countdown() {
  const b = h('b', { class: 'num' });
  const tick = () => {
    const s = Math.max(0, Math.floor(untilMidnight() / 1000));
    b.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':');
    if (b.isConnected || !b.dataset.seen) { b.dataset.seen = '1'; setTimeout(tick, 1000); }
  };
  tick();
  return h('p', { class: 'next' }, 'Seven new ones in ', b);
}

export function resultView({ rows, questions, instant, heading, of, shareTitle, third, extras, foot, restart }) {
  const score = total(rows);
  const hits = rows.filter((r) => r.hit).length;
  const avgWidth = rows.reduce((s, r) => s + r.width, 0) / rows.length;
  const sim = K.calibratedTotals(rows.map((r) => r.width), { seed: hash(rows.map((r) => r.id).join()) });
  const big = h('div', { class: 'big num', 'aria-label': `Score ${score}` }, instant || reducedMotion() ? signed(score) : '0');
  const canvas = h('canvas', { role: 'img', 'aria-label': `Your ${rows.length} bands lined up on the answers. ${rows.map((r, i) => `${i + 1}: ${kindOf(r) === 'miss' ? 'miss' : `${kindOf(r)} catch`}`).join(', ')}.` });
  const box = h('div', { class: 'lineup' }, canvas);
  if (rows.length > 7) box.style.minHeight = `${rows.length * 46 + 44}px`;
  const t3 = third();

  const text = () => K.shareText({ title: shareTitle, score, of, rows });
  const el = h('section', { class: 'result', 'aria-label': 'Result' },
    h('div', { class: 'tally' }, h('p', { class: 'day' }, heading), big, h('p', { class: 'of' }, `of ${of}. A shrug scores 0.`)),
    box,
    h('dl', { class: 'facts' },
      h('div', {}, h('dt', {}, 'Caught'), h('dd', { class: 'num' }, `${hits} of ${rows.length}`)),
      h('div', {}, h('dt', {}, 'Usual width'), h('dd', { class: 'num' }, `${Math.round(avgWidth * 100)}%`)),
      h('div', {}, h('dt', {}, t3[0]), h('dd', { class: 'num' }, t3[1]))),
    h('div', { class: 'actions' },
      h('button', { class: 'go wide', type: 'button', id: 'share', onclick: async () => { const r = await K.shareOrCopy(text()); if (r === 'copied') toast('Copied'); if (r === 'failed') toast('Copying is blocked in this browser'); } }, 'Share result'),
      h('button', { class: 'go quiet wide', type: 'button', id: 'image', onclick: () => saveImage({ rows, score, of, shareTitle, hits }) }, 'Picture for stories'),
      ...(restart ? [h('button', { class: 'go quiet wide', type: 'button', onclick: restart }, 'Go again')] : []),
      ...extras),
    h('div', { class: 'says' },
      h('p', {}, luckLine(hits, rows.length)),
      h('p', { class: 'fine' }, `Simulated comparison: a perfectly calibrated player using ranges as wide as yours lands between ${signed(sim.p10)} and ${signed(sim.p90)} on most days, with ${signed(sim.p50)} in the middle. That is a simulation, not other people.`)),
    h('details', { class: 'maths' }, h('summary', {}, 'Where the score comes from'),
      h('div', {}, h('p', {}, 'Each question starts at 100. You lose 1 point for every 1% of the ruler your range covers, and 20 for every 1% the answer misses it by.'),
        h('p', { class: 'fine', style: 'margin-top:8px' }, 'That rule pays best, on average, when your ranges really are 90% ranges. ', h('a', { href: '#scoring' }, 'See the proof')))),
    foot,
    h('ol', { class: 'recap' }, rows.map((r, i) => {
      const q = questions[i];
      if (!q) return null;
      return h('li', {}, h('span', { class: 'qq' }, q.question), h('span', { class: `pp num${r.points < 0 ? ' miss' : ''}` }, plus(r.points)),
        h('span', { class: 'aa' }, `${withUnit(q.answer, q)}. You said ${withUnit(r.lo, q)} to ${withUnit(r.hi, q)}. `, h('a', { href: q.source_url, target: '_blank', rel: 'noopener noreferrer' }, q.source_name)));
    })));

  const lineup = new K.Lineup(canvas, rows, { reduced: reducedMotion(), sound, instant });
  return {
    el,
    lineup,
    start: () => {
      say(`Score ${score} of ${of}. Caught ${hits} of ${rows.length}.`);
      lineup.start(() => { if (!instant && !reducedMotion()) countUp(big, score); });
    },
    destroy: () => lineup.destroy(),
  };
}

function countUp(el, to) {
  const t0 = performance.now();
  const dur = 1100;
  const step = (now) => {
    const t = Math.min(1, (now - t0) / dur);
    const e = 1 - Math.pow(1 - t, 4);
    el.textContent = signed(Math.round(to * e));
    el.style.setProperty('--w', `${60 + 50 * e + 26 * Math.exp(-5 * t) * Math.sin(t * 22)}%`);
    if (t < 1) requestAnimationFrame(step); else { el.style.setProperty('--w', '100%'); sound.finale(to); }
  };
  requestAnimationFrame(step);
}

async function saveImage({ rows, score, of, shareTitle, hits }) {
  const blob = await K.storyImage({ rows, name: NAME, title: shareTitle, score, of: `of ${of}`, line: `Caught ${hits} of ${rows.length}`, address: SITE.replace(/^https?:\/\//, '') });
  const file = new File([blob], `${NAME.toLowerCase()}-${shareTitle.replace(/[^a-z0-9]+/gi, '-')}.png`, { type: 'image/png' });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  h('a', { href: url, download: file.name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Picture saved');
}

// ------------------------------------------------------- practice and quant

async function showPractice() {
  const pool = await practicePool(today);
  const pick = picker(pool);
  current = new Round(main, {
    next: () => pick(),
    label: (i) => `Practice, ${i + 1}`,
    onRow: (row, q) => store.change((d) => {
      d.practice.rows.push(row);
      d.practice.seen[q.id] = (d.practice.seen[q.id] || 0) + 1;
      if (d.practice.rows.length > 5000) d.practice.rows.splice(0, d.practice.rows.length - 5000);
    }),
  });
}

/** Least-seen questions first, never the same category twice running. */
function picker(pool) {
  let lastCat = null;
  const played = new Set(Object.values(store.data().days).flatMap((r) => r.rows.map((x) => x.id)));
  return () => {
    const seen = store.data().practice.seen;
    const cost = (q) => (seen[q.id] || 0) * 2 + (played.has(q.id) ? 1 : 0);
    const low = Math.min(...pool.map(cost));
    let list = pool.filter((q) => cost(q) === low);
    const other = list.filter((q) => q.category !== lastCat);
    if (other.length) list = other;
    const q = list[Math.floor(Math.random() * list.length)];
    lastCat = q.category;
    store.change((d) => { d.practice.seen[q.id] = d.practice.seen[q.id] || 0; });
    pool = pool.filter((p) => p !== q).concat(q);
    return open(q);
  };
}

// ----------------------------------------------------------------- archive

// --------------------------------------------------------------- dashboard

// ------------------------------------------------------------------- pages

// ------------------------------------------------------------------- start

route();
