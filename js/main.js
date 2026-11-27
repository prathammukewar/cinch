import { NAME, PER_DAY, QUANT_SECONDS, DAILY_SECONDS } from './config.js';
import { dayKey, dayNumber, keyOf, longDate, untilMidnight, streaks } from './day.js';
import { forDay, practicePool, open } from './bank.js';
import { total as sum, hintsFor } from './score.js';
import { store, askPersist, allRows } from './store.js';
import * as acct from './account.js';
import { sound } from './sound.js';
import { total, kindOf, tierOf } from './score.js';
import { h, $, toast, reducedMotion, signed, moreStyles } from './dom.js';

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
  el.replaceChildren(...Array.from({ length }, (_, i) => h('li', { class: i < rows.length ? `${kindOf(rows[i])} t-${tierOf(rows[i]).key}` : i === rows.length ? 'now' : '' })));
}

function drawer(open) {
  const d = $('drawer');
  $('menu').setAttribute('aria-expanded', String(open));
  d.hidden = !open;
  if (!open) return;
  const item = (href, text, sub) => h('a', { href }, text, h('span', { class: 'sub' }, sub));
  const s = streaks(liveDays(), today);
  d.replaceChildren(
    item('#home', 'Home', ''),
    item('#today', 'Today\u2019s Roundup', store.data().days[today]?.live ? 'done' : `no. ${today}`),
    item('#practice', 'The Corral', 'practice'),
    item('#draw', 'Quick Draw', `${QUANT_SECONDS} s each`),
    item('#duel', 'Showdown', 'one on one'),
    item('#rodeo', 'Rodeo', 'a live room'),
    item('#archive', 'Old Trails', 'past days'),
    h('hr'),
    item('#calibration', 'Brand Book', 'your stats'),
    item('#leaderboard', 'Leaderboard', 'top riders'),
    item('#account', 'Account', acct.signedIn() ? acct.me()?.name || 'signed in' : 'sign in'),
    item('#scoring', 'Ranch rules', 'scoring'),
    item('#settings', 'Saddlebag', 'settings, backup'),
    item('#sources', 'Sources', ''),
    item('#privacy', 'Privacy', ''),
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

const lazyDuel = async (arg) => {
  const [duel] = await Promise.all([import('./duel.js'), moreStyles(), loadResultKit()]);
  duel.init({ main, sound, pickSet, paintPips, setCurrent: (v) => { current = v; }, getCurrent: () => current, route });
  return duel.show(arg);
};
const lazyRodeo = async (arg) => {
  const [rodeo] = await Promise.all([import('./rodeo.js'), moreStyles(), loadResultKit()]);
  rodeo.init({ main, pickSet, paintPips, setCurrent: (v) => { current = v; }, getCurrent: () => current });
  return rodeo.show(arg);
};
const lazy = (name) => async (arg) => {
  const [pages] = await Promise.all([import('./pages.js'), moreStyles()]);
  pages.init({ main, kit: loadResultKit, liveDays, paintTheme, paintSound, paintPips, picker, pickSet, resultView, today: () => today, setCurrent: (v) => { current = v; }, getCurrent: () => current });
  return pages[name](arg);
};
const riders = (name) => async (arg) => {
  const [m] = await Promise.all([import('./riders.js'), moreStyles()]);
  m.init({ main });
  return m[name](arg);
};
const screens = { account: riders('showAccount'), leaderboard: riders('showLeaderboard'), privacy: riders('showPrivacy'), home: showHome, today: showToday, practice: showPractice, day: showDay, duel: lazyDuel, rodeo: lazyRodeo, draw: lazy('showQuant'), quant: lazy('showQuant'), archive: lazy('showArchive'), calibration: lazy('showCalibration'), scoring: lazy('showScoring'), settings: lazy('showSettings'), sources: lazy('showSources') };

// Screens load in order, so a slow one can never draw over the one that came after it.
let chain = Promise.resolve();
function route() {
  chain = chain.then(show, show);
  return chain;
}

let first = true;
async function show() {
  const [name, arg] = (location.hash.slice(1) || 'home').split('/');
  const render = async () => {
    current?.destroy?.();
    current = null;
    paintPips([], 0);
    drawer(false);
    scrollTo(0, 0);
    document.body.dataset.screen = screens[name] ? name : 'home';
    await (screens[name] || showHome)(arg);
  };
  try {
    // Screens cross-fade where the browser can do it; the header stays put.
    if (!first && document.startViewTransition && !reducedMotion()) {
      const vt = document.startViewTransition(render);
      vt.ready.catch(() => {}); vt.finished.catch(() => {});
      await vt.updateCallbackDone;
    }
    else await render();
    first = false;
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
  const name = (location.hash.slice(1) || 'home').split('/')[0];
  if ((name === 'today' || name === 'home') && !current?.isRound) route();
// Signed in: pull this account's record in from other devices, then keep it in step.
if (acct.signedIn()) acct.refresh().then(() => acct.sync()).catch(() => {});
  else toast('A new day is ready');
}, 5000);

// -------------------------------------------------------------------- home

async function showHome() {
  today = dayNumber(dayKey());
  const d = store.data();
  const done = d.days[today];
  const draft = d.open?.[today];
  const s = streaks(liveDays(), today);
  const fresh = !Object.keys(d.days).length && !draft;
  const canvas = h('canvas', { class: 'hero', 'aria-hidden': 'true' });
  const word = h('h1', { class: 'wordmark' }, NAME);
  const [playText, playPlain] = done ? ['See today\u2019s roundup', 'Your result'] : draft?.rows?.length ? ['Back in the saddle', `${draft.rows.length} of ${PER_DAY} done`] : ['Saddle up', `Play today\u2019s ${PER_DAY}`];
  const play = h('button', { class: 'go big', type: 'button', id: 'play', onclick: () => { sound.tap(); if (!store.data().seenHowTo && !store.data().seenIntro && !done && !draft) howTo(true); else location.hash = '#today'; } }, h('span', { class: 'say' }, playText), h('small', { class: 'plain' }, playPlain));
  const state = done
    ? h('p', { class: 'home-state' }, `You scored ${signed(total(done.rows))} today and roped ${done.rows.filter((r) => r.hit).length} of ${done.rows.length}. `, nextIn())
    : s.current > 1 ? h('p', { class: 'home-state' }, `${s.current} days on the trail. Keep it going.`) : fresh ? h('p', { class: 'home-state' }, 'About three minutes. No sign-up.') : null;
  const mode = (href, name, plain) => h('a', { class: 'mode', href }, h('b', {}, name), h('small', {}, plain));
  const book = allRows();
  const roped = book.filter((r) => r.hit).length;
  const dayScores = Object.values(store.data().days).map((r) => total(r.rows));
  const stat = (value, label) => h('span', {}, h('b', {}, value), h('small', {}, label));
  const statsTile = h('a', { class: 'mode stats', href: '#calibration', id: 'home-stats' },
    h('span', { class: 'names' }, h('b', {}, 'Brand Book'), h('small', {}, 'Your stats')),
    book.length
      ? h('span', { class: 'nums' }, stat(`${Math.round((100 * roped) / book.length)}%`, 'roped'), dayScores.length ? stat(String(Math.round(dayScores.reduce((a, b) => a + b, 0) / dayScores.length)), 'avg day') : stat(`${s.current}`, 'day trail'))
      : h('span', { class: 'nums empty' }, h('small', {}, 'After your first round')));
  const boardNum = h('span', { class: 'nums' }, stat('\u2013', 'today'));
  const boardTile = h('a', { class: 'mode stats', href: '#leaderboard', id: 'home-board' },
    h('span', { class: 'names' }, h('b', {}, 'Leaderboard'), h('small', {}, 'Top riders')), boardNum);
  if (acct.apiBase()) {
    acct.call(`/v1/leaderboard?view=today&day=${today}${acct.signedIn() ? '' : `&client=${acct.clientId()}`}`).then((d) => {
      boardNum.replaceChildren(d.you ? stat(`#${d.you.rank}`, 'today') : stat(String(d.players), d.players === 1 ? 'rider today' : 'riders today'));
    }).catch(() => boardNum.replaceChildren(stat('Top', 'riders')));
  } else boardNum.replaceChildren(stat('Top', 'riders'));
  const view = h('section', { class: 'home', 'aria-label': 'Welcome' },
    h('div', { class: 'hero-box' }, canvas),
    word,
    h('p', { class: 'tag' }, 'Seven numbers a day. Throw a loop you are 90% sure will rope each one.'),
    h('div', { class: 'home-actions' }, play, h('button', { class: 'go quiet', type: 'button', id: 'howto-open', onclick: () => howTo(false) }, 'How to rope')),
    state,
    h('nav', { class: 'modes', 'aria-label': 'More ways to play' },
      statsTile,
      boardTile,
      mode('#practice', 'The Corral', 'Practice'),
      mode('#draw', 'Quick Draw', 'Speed round'),
      mode('#duel', 'Showdown', 'Play a friend'),
      mode('#rodeo', 'Rodeo', 'Play a group'),
      mode('#archive', 'Old Trails', 'Past days')),
    h('p', { class: 'home-date' }, `Roundup No. ${today}`, h('span', { 'aria-hidden': 'true' }, ' \u00b7 '), longDate(keyOf(today))));
  main.replaceChildren(view);
  const { Hero } = await import('./hero.js');
  const hero = new Hero(canvas, {
    reduced: reducedMotion(), sound,
    onTight: (t) => { word.style.fontStretch = `${(138 - 38 * t).toFixed(1)}%`; },
  });
  canvas.addEventListener('pointerdown', () => { sound.unlock(); hero.play(); });
  current = { destroy: () => hero.destroy(), theme: () => hero.theme() };
  requestAnimationFrame(() => hero.play());
  // Warm the game code while the player reads.
  (globalThis.requestIdleCallback || setTimeout)(() => { import('./play.js'); forDay(today).catch(() => {}); });
}

function nextIn() {
  const b = h('b', { class: 'num' });
  const tick = () => {
    const s = Math.max(0, Math.floor(untilMidnight() / 1000));
    b.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':');
    if (b.isConnected || !b.dataset.seen) { b.dataset.seen = '1'; setTimeout(tick, 1000); }
  };
  tick();
  return h('span', {}, 'New ones in ', b, '.');
}

async function howTo(thenPlay) {
  const [m] = await Promise.all([import('./hero.js'), moreStyles()]);
  m.howTo(thenPlay, { sound, h, store, reducedMotion });
}

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
  const [questions, { Round }] = await Promise.all([forDay(n), import('./play.js')]);
  const draft = store.data().open?.[n];
  const rows = draft && draft.rows.every((r, i) => r.id === questions[i]?.id) ? draft.rows : [];
  if (rows.length >= PER_DAY) return finish(n, rows, draft.live);
  const started = draft ? draft.live : live;
  paintPips(rows, PER_DAY);
  current = new Round(main, {
    rows,
    length: PER_DAY,
    seconds: DAILY_SECONDS,
    costs: hintsFor(n),
    next: (i) => questions[i] || null,
    label: (i) => `${n === today ? 'Roundup' : `Roundup No. ${n}`}, ${i + 1} of ${PER_DAY}`,
    onRow: (row, q, all) => {
      store.change((d) => { d.open = { ...(d.open || {}), [n]: { rows: all, live: started } }; });
    },
    onEnd: (all) => finish(n, all, started),
  });
  // A first visit needs no focus ring on the heading.
  return undefined;
}

document.addEventListener('round:row', (e) => { if (current?.length) paintPips(e.detail, current.length); acct.syncSoon(); });

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

async function showResult(n, { instant }) {
  await loadResultKit();
  const rec = store.data().days[n];
  const questions = await forDay(n);
  const rows = rec.rows;
  const isToday = n === today;
  paintPips(rows, PER_DAY);
  const view = K.resultView({
    rows, questions, instant,
    heading: isToday ? `Roundup No. ${n}` : `Roundup No. ${n}, ${longDate(keyOf(n))}`,
    of: PER_DAY * 100,
    shareTitle: `Roundup No. ${n}`,
    third: () => { const s = streaks(liveDays(), today); return ['On the trail', s.current === 1 ? '1 day' : `${s.current} days`]; },
    extras: [
      h('a', { class: 'go quiet', href: '#duel' }, 'Showdown'),
      h('a', { class: 'go quiet', href: '#practice' }, 'The Corral'),
      h('a', { class: 'go quiet', href: '#calibration', id: 'result-stats' }, 'Your stats'),
    ],
    foot: isToday ? K.countdown() : null,
    standings: rec.live ? { day: n, post: isToday } : null,
  });
  main.replaceChildren(view.el);
  current = view;
  view.start();
}

let kit = null;
const K = {};
async function loadResultKit() {
  if (!kit) kit = Promise.all([import('./result.js'), moreStyles()]).then(([m]) => { m.init({ sound }); Object.assign(K, m); return m; });
  return kit;
}
const resultView = (o) => K.resultView(o);

// ------------------------------------------------------- practice and quant

async function showPractice() {
  const [pool, { Round }] = await Promise.all([practicePool(), import('./play.js')]);
  const set = pickSet(pool, PER_DAY);
  const n = (store.data().practice.sets?.length || 0) + 1;
  paintPips([], set.length);
  current = new Round(main, {
    length: set.length,
    next: (i) => set[i] || null,
    label: (i) => `The Corral, set ${n}, ${i + 1} of ${set.length}`,
    lastText: 'See how the set went',
    onRow: (row, q) => store.change((d) => {
      d.practice.rows.push(row);
      d.practice.seen[q.id] = (d.practice.seen[q.id] || 0) + 1;
      if (d.practice.rows.length > 5000) d.practice.rows.splice(0, d.practice.rows.length - 5000);
    }),
    onEnd: async (rows) => {
      await loadResultKit();
      store.change((d) => { (d.practice.sets ||= []).push({ at: Date.now(), rows, points: sum(rows) }); });
      current?.destroy?.();
      const best = Math.max(...store.data().practice.sets.map((r) => r.points));
      const view = K.resultView({
        rows, questions: set, instant: false, heading: `The Corral, set ${n}`, of: set.length * 100, shareTitle: `Corral set ${n}`,
        third: () => ['Best set', signed(best)], extras: [h('a', { class: 'go quiet', href: '#duel' }, 'Showdown'), h('a', { class: 'go quiet', href: '#home' }, 'Home')],
        restart: () => route(), restartText: 'Rope another seven',
      });
      main.replaceChildren(view.el);
      current = view;
      view.start();
    },
  });
}

/**
 * A set of practice questions: least seen first, an easy start and a hard finish,
 * no category twice.
 */
function pickSet(pool, n) {
  const seen = store.data().practice.seen;
  const order = [...pool].sort(() => Math.random() - 0.5).sort((a, b) => (seen[a.id] || 0) - (seen[b.id] || 0));
  const want = n === 7 ? [1, 2, 2, 2, 2, 3, 3] : [1, 1, 2, 2, 2, 2, 3, 2, 3, 3].slice(0, n);
  const out = [];
  const cats = new Set();
  for (const d of want) {
    const q = order.find((x) => !out.includes(x) && !cats.has(x.category) && x.difficulty === d)
      || order.find((x) => !out.includes(x) && !cats.has(x.category))
      || order.find((x) => !out.includes(x));
    if (!q) break;
    out.push(q); cats.add(q.category);
  }
  return out.map(open);
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
