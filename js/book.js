// Brand Book: your own record in one place. Nothing here compares you with other people.
import { allRows, store } from './store.js';
import { tierOf, TIERS, LEANER, wilson, total } from './score.js';
import { verdict, verdictText, rateChart, curveChart, bandAt } from './dash.js';
import { streaks, keyOf, longDate } from './day.js';
import { forDay, practiceById } from './bank.js';
import { withUnit } from './format.js';
import { HINTS } from './play.js';
import { CURVE_MIN } from './config.js';
import { h, signed, plus } from './dom.js';

const LADDER = [...TIERS.slice(0, 4), LEANER, ...TIERS.slice(4)];
const MODES = [['daily', 'Roundup'], ['practice', 'The Corral'], ['quant', 'Quick Draw'], ['duel', 'Showdown']];
const pct = (p) => `${Math.round(p * 100)}%`;
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
/** -1 when the answer fell below the loop (a guess too high), 1 when above (too low), 0 when roped. */
const sideOf = (r) => (r.hit ? 0 : r.x < r.l ? -1 : 1);
const multOf = (hints) => (hints?.scout ? HINTS.scout : 1) * HINTS.fence[hints?.fence || 0];
const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

/** The numbers the home screen and the Brand Book both lead with. */
export function headline(rows = allRows(), liveDays = [], today = 0) {
  const k = rows.filter((r) => r.hit).length;
  const days = Object.values(store.data().days).map((r) => total(r.rows));
  return { n: rows.length, k, rate: rows.length ? k / rows.length : 0, trail: streaks(liveDays, today), avgDay: days.length ? Math.round(mean(days)) : null };
}

/** Where the player stands against the 90% mark, in plain words. */
function standing(rows) {
  const w = wilson(rows.filter((r) => r.hit).length, rows.length);
  if (rows.length < 20) return { w, key: 'early', name: 'Early days', line: `Luck still swamps everything before about 20 questions. You have ${rows.length}.` };
  if (w.hi < 0.9) return { w, key: 'tight', name: 'Too tight', line: 'Your loops rope the answer less often than 90% loops should. Throw them wider.' };
  if (w.lo > 0.9) return { w, key: 'loose', name: 'Too loose', line: 'Your loops rope the answer more often than 90% loops should. You can pull them tighter for more points.' };
  return { w, key: 'mark', name: 'On the mark', line: 'Your loops rope the answer about as often as 90% loops should.' };
}

function gauge(w) {
  const at = (p) => `${((Math.min(1, Math.max(0.5, p)) - 0.5) / 0.5) * 100}%`;
  return h('div', { class: 'gauge', role: 'img', 'aria-label': `Roped ${pct(w.p)}, likely between ${pct(w.lo)} and ${pct(w.hi)}. The target is 90%.` },
    h('div', { class: 'gauge-track' },
      h('i', { class: 'gauge-band', style: `left:${at(w.lo)};right:calc(100% - ${at(w.hi)})` }),
      h('i', { class: 'gauge-goal', style: `left:${at(0.9)}` }),
      h('i', { class: 'gauge-you', style: `left:${at(w.p)}` })),
    h('div', { class: 'gauge-scale', 'aria-hidden': 'true' }, h('span', {}, '50%'), h('span', { style: `left:${at(0.9)}` }, '90%'), h('span', {}, '100%')));
}

const tile = (label, value, sub, cls = '') => h('div', { class: `num-tile ${cls}` }, h('dt', {}, label), h('dd', { class: 'num' }, value), sub ? h('p', { class: 'sub' }, sub) : null);

function numbers(rows, live, today) {
  const days = Object.entries(store.data().days).map(([n, r]) => ({ n: Number(n), score: total(r.rows), live: r.live }));
  const best = days.reduce((b, d) => (!b || d.score > b.score ? d : b), null);
  const s = streaks(live, today);
  const last = rows.slice(-20);
  const lastRate = last.filter((r) => r.hit).length / Math.max(1, last.length);
  const rate = rows.filter((r) => r.hit).length / rows.length;
  const dead = rows.filter((r) => tierOf(r).key === 'dead').length;
  const trend = rows.length >= 30 ? (lastRate > rate + 0.02 ? `up from ${pct(rate)} overall` : lastRate < rate - 0.02 ? `down from ${pct(rate)} overall` : `about the same as overall`) : null;
  return h('dl', { class: 'num-grid' },
    tile('Questions', rows.length.toLocaleString('en-US'), 'answered in every mode'),
    tile('Roundups', String(days.length), `${days.filter((d) => d.live).length} on their own day`),
    tile('On the trail', plural(s.current, 'day'), `Longest ${plural(s.best, 'day')}`),
    tile('Average day', days.length ? signed(Math.round(mean(days.map((d) => d.score)))) : '–', 'of 700'),
    tile('Best day', best ? signed(best.score) : '–', best ? `No. ${best.n}, ${longDate(keyOf(best.n)).replace(/^\w+, /, '')}` : 'Play a Roundup'),
    tile('Per question', plus(Math.round(mean(rows.map((r) => r.points)))), 'points on average'),
    tile('Dead ringers', String(dead), dead ? 'loops of 96 points or more' : 'none yet', dead ? 'gold' : ''),
    tile('Last 20', pct(lastRate), trend || `roped of the last ${last.length}`));
}

/** Every throw by its name, as one bar, with a legend that counts them. */
function throws(rows) {
  const counts = new Map(LADDER.map((t) => [t.key, 0]));
  for (const r of rows) counts.set(tierOf(r).key, counts.get(tierOf(r).key) + 1);
  const shown = LADDER.filter((t) => counts.get(t.key));
  const tipOf = (t) => `${t.name}: ${plural(counts.get(t.key), 'throw')}, ${pct(counts.get(t.key) / rows.length)}`;
  return h('div', { class: 'throws' },
    h('div', { class: 'tierbar' }, shown.map((t) => h('span', { class: `tseg t-${t.key}`, tabindex: '0', 'data-tip': tipOf(t), 'aria-label': tipOf(t), style: `flex-grow:${counts.get(t.key)}` }))),
    h('ul', { class: 'tier-legend' }, shown.map((t) => h('li', {}, h('span', { class: `tier-pill t-${t.key}` }, t.name), h('span', { class: 'num' }, `${counts.get(t.key)}`), h('span', { class: 'fine' }, pct(counts.get(t.key) / rows.length))))));
}

/** One bar per Roundup played, newest on the right, with your average marked. Each bar opens its day. */
function roundups() {
  const days = Object.entries(store.data().days).map(([n, r]) => ({ n: Number(n), score: total(r.rows), hits: r.rows.filter((x) => x.hit).length, len: r.rows.length, live: r.live })).sort((a, b) => a.n - b.n).slice(-30);
  if (days.length < 2) return h('p', { class: 'fine' }, days.length ? 'One Roundup so far. Your days line up here from the second one.' : 'Play a Roundup and your days line up here.');
  const W = 720; const H = 220; const L = 40; const R = 12; const T = 14; const B = 28;
  const slot = (W - L - R) / days.length;
  const bw = Math.min(28, slot * 0.7);
  const y = (v) => T + (1 - Math.max(0, v) / 700) * (H - T - B);
  const avg = mean(days.map((d) => d.score));
  let g = '';
  for (const v of [0, 350, 700]) g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
  days.forEach((d, i) => {
    const x = L + slot * i + (slot - bw) / 2;
    const tip = `No. ${d.n}, ${longDate(keyOf(d.n)).replace(/^\w+, /, '')}: ${d.score} points, roped ${d.hits} of ${d.len}${d.live ? '' : ', played later'}`;
    g += `<a href="#day/${d.n}" data-tip="${tip}" aria-label="${tip}"><rect class="day-bar${d.live ? '' : ' late'}" x="${x.toFixed(1)}" y="${y(d.score).toFixed(1)}" width="${bw.toFixed(1)}" height="${(y(0) - y(d.score)).toFixed(1)}" rx="3"/></a>`;
  });
  g += `<line x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}" stroke="var(--ink)" stroke-width="1.5" stroke-dasharray="5 4"/><text class="strong" x="${W - R}" y="${y(avg) - 6}" text-anchor="end">average ${Math.round(avg)}</text>`;
  g += `<text x="${L}" y="${H - 6}">No. ${days[0].n}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">No. ${days[days.length - 1].n}</text>`;
  return h('figure', { html: `<svg class="chart days-chart" viewBox="0 0 ${W} ${H}" role="group" aria-label="Your last ${days.length} Roundups, average ${Math.round(avg)}">${g}</svg>` });
}

/** Plain sentences about how you throw, each only once there is enough to say it. */
function habits(rows) {
  const out = [];
  const misses = rows.filter((r) => !r.hit);
  if (misses.length >= 5) {
    const low = misses.filter((r) => sideOf(r) > 0).length / misses.length;
    out.push(low >= 0.62 ? `When you miss, the answer is above your loop ${pct(low)} of the time. Your guesses run low, so lean higher.`
      : low <= 0.38 ? `When you miss, the answer is below your loop ${pct(1 - low)} of the time. Your guesses run high, so lean lower.`
        : `Your misses land on both sides about evenly (${pct(low)} above, ${pct(1 - low)} below), so your guesses are not leaning one way.`);
  }
  out.push(`Your loops cover ${pct(mean(rows.map((r) => r.width)))} of the rail on average.`);
  if (rows.length >= 30) {
    const sorted = [...rows].sort((a, b) => a.width - b.width);
    const third = Math.floor(sorted.length / 3);
    const rate = (a) => a.filter((r) => r.hit).length / a.length;
    out.push(`Your tightest third of loops rope ${pct(rate(sorted.slice(0, third)))} of the time, your widest third ${pct(rate(sorted.slice(-third)))}.`);
  }
  let run = 0; let best = 0;
  for (const r of rows) { run = r.hit ? run + 1 : 0; best = Math.max(best, run); }
  if (best >= 3) out.push(`Your longest run of ropes in a row is ${best}.`);
  const hinted = rows.filter((r) => r.hints);
  if (hinted.length) {
    const cost = Math.round(hinted.reduce((s, r) => s + (r.points / multOf(r.hints) - r.points), 0));
    out.push(`You used hints on ${plural(hinted.length, 'question')} (${pct(hinted.length / rows.length)}) and gave up about ${plural(cost, 'point')} for them.`);
  }
  return h('ul', { class: 'habits' }, out.map((t) => h('li', {}, t)));
}

/** Topics, each opening a card with the detail behind its line. */
function topics(rows, peek) {
  const map = new Map();
  for (const r of rows) { const c = map.get(r.cat) || []; c.push(r); map.set(r.cat, c); }
  const list = [...map.entries()].map(([cat, rs]) => ({ cat, rows: rs, k: rs.filter((r) => r.hit).length, mean: mean(rs.map((r) => r.points)) })).sort((a, b) => b.mean - a.mean);
  return h('ul', { class: 'cats topics' }, list.map((c) => {
    const p = c.k / c.rows.length;
    return h('li', {}, h('button', { type: 'button', class: 'topic', 'aria-expanded': 'false', 'data-cat': c.cat, onclick: (e) => peek(c, e.currentTarget, true), onpointerenter: (e) => { if (e.pointerType === 'mouse') peek(c, e.currentTarget); }, onfocus: (e) => peek(c, e.currentTarget) },
      h('span', { class: 'name' }, c.cat),
      h('span', { class: 'track', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(p * 100)}%` }), h('b', { class: 'goal' })),
      h('span', { class: 'v num' }, `${pct(p)} · ${plus(Math.round(c.mean))}`)));
  }));
}

/** The best throw in a topic, with its question, loaded only when its card opens. */
async function questionOf(r) {
  try {
    if (r.mode === 'daily' && r.day) return (await forDay(r.day)).find((q) => q?.id === r.id) || null;
    return (await practiceById([r.id]))[0] || null;
  } catch { return null; }
}

function topicCard(c) {
  const rs = c.rows;
  const w = wilson(c.k, rs.length);
  const misses = rs.filter((r) => !r.hit);
  const low = misses.filter((r) => sideOf(r) > 0).length;
  const counts = new Map();
  for (const r of rs) counts.set(tierOf(r).key, (counts.get(tierOf(r).key) || 0) + 1);
  const best = rs.reduce((b, r) => (!b || r.points > b.points ? r : b), null);
  const bestLine = h('p', { class: 'best' }, h('span', { class: `tier-pill t-${tierOf(best).key}` }, tierOf(best).name), ` ${plus(best.points)}`);
  questionOf(best).then((q) => { if (q) bestLine.append(h('span', { class: 'bq' }, `${q.question} ${withUnit(q.answer, q)}.`)); });
  return [
    h('p', { class: 'peek-q' }, c.cat),
    h('dl', {},
      h('div', {}, h('dt', {}, 'Roped'), h('dd', {}, `${c.k} of ${rs.length}`)),
      h('div', {}, h('dt', {}, 'Likely true rate'), h('dd', {}, `${pct(w.lo)} to ${pct(w.hi)}`)),
      h('div', {}, h('dt', {}, 'Per question'), h('dd', {}, plus(Math.round(c.mean)))),
      h('div', {}, h('dt', {}, 'Loop size'), h('dd', {}, pct(mean(rs.map((r) => r.width)))))),
    misses.length >= 3 ? h('p', { class: 'lean' }, low / misses.length >= 0.62 ? `Misses here mostly fall above your loop: you guess low on ${c.cat.toLowerCase()}.` : low / misses.length <= 0.38 ? `Misses here mostly fall below your loop: you guess high on ${c.cat.toLowerCase()}.` : 'Misses here fall on both sides.') : null,
    h('div', { class: 'tierbar mini', 'aria-hidden': 'true' }, LADDER.filter((t) => counts.get(t.key)).map((t) => h('span', { class: `tseg t-${t.key}`, style: `flex-grow:${counts.get(t.key)}` }))),
    h('p', { class: 'fine' }, 'Best throw here'),
    bestLine,
  ];
}

function modes(rows) {
  const lines = MODES.map(([key, name]) => [name, rows.filter((r) => r.mode === key)]).filter(([, rs]) => rs.length);
  if (lines.length < 2) return null;
  return h('table', { class: 'modes-table' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Way to play'), h('th', { scope: 'col' }, 'Questions'), h('th', { scope: 'col' }, 'Roped'), h('th', { scope: 'col' }, 'Per question'))),
    h('tbody', {}, lines.map(([name, rs]) => h('tr', {}, h('th', { scope: 'row' }, name), h('td', { class: 'num' }, String(rs.length)), h('td', { class: 'num' }, pct(rs.filter((r) => r.hit).length / rs.length)), h('td', { class: 'num' }, plus(Math.round(mean(rs.map((r) => r.points)))))))));
}

/** One floating note for every [data-tip] on the page: hover with a mouse, focus with keys, tap on a phone. */
function tips(page) {
  const tip = h('div', { class: 'tip', role: 'tooltip', hidden: true });
  page.append(tip);
  let on = null;
  const show = (el) => {
    on = el;
    tip.textContent = el.getAttribute('data-tip');
    tip.hidden = false;
    const a = el.getBoundingClientRect(); const box = page.getBoundingClientRect();
    const left = Math.min(Math.max(8, a.left + a.width / 2 - box.left - tip.offsetWidth / 2), box.width - tip.offsetWidth - 8);
    tip.style.left = `${left}px`;
    tip.style.top = `${a.top - box.top - tip.offsetHeight - 8}px`;
  };
  const hide = () => { on = null; tip.hidden = true; };
  page.addEventListener('pointerover', (e) => { const el = e.target.closest('[data-tip]'); if (el && e.pointerType === 'mouse') show(el); });
  page.addEventListener('pointerout', (e) => { if (e.pointerType === 'mouse' && on && !on.contains(e.relatedTarget)) hide(); });
  page.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el) show(el); });
  page.addEventListener('focusout', hide);
  page.addEventListener('click', (e) => {
    const el = e.target.closest('[data-tip]');
    if (!el || e.pointerType === 'mouse' || !matchMedia('(pointer: coarse)').matches) return;
    // On a phone the first tap on a bar shows its note; a second tap follows its link.
    if (on !== el) { e.preventDefault(); show(el); }
  });
}

export function showBook(main, { liveDays, today }) {
  const rows = allRows();
  const page = h('div', { class: 'page book' }, h('h1', {}, 'Brand Book'), h('p', { class: 'lede' }, 'Your stats: how true your loops run, and how you throw.'));
  if (!rows.length) {
    page.append(h('p', { class: 'lede' }, 'Nothing in the book yet. Ride today’s Roundup and your first marks appear here.'), h('p', { style: 'margin-top:24px' }, h('a', { class: 'go', href: '#today' }, 'Saddle up')));
    main.replaceChildren(page);
    return;
  }
  const st = standing(rows);
  page.append(
    h('section', { class: `book-hero s-${st.key}` },
      h('div', { class: 'hero-num' }, h('b', { class: 'num' }, pct(st.w.p)), h('span', {}, `of your loops roped the answer. The aim is 90%.`)),
      h('p', { class: 'state' }, h('span', { class: 'state-pill' }, st.name), ` ${st.line}`),
      gauge(st.w),
      h('p', { class: 'fine' }, verdictText(verdict(rows)))),
    numbers(rows, liveDays, today),
    h('div', { class: 'book-row' },
      h('section', {}, h('h2', {}, 'Your throws'), throws(rows), h('h2', {}, 'How you throw'), habits(rows)),
      h('section', {}, h('h2', {}, 'Your Roundups'), roundups())));

  const peekBox = h('div', { class: 'peek topic-peek', role: 'status', hidden: true });
  let open = null;
  let openedAt = 0;
  const peek = (c, btn, toggle) => {
    // A tap focuses the topic and then clicks it: the click right after the focus must not close what it opened.
    if (toggle && open === btn && performance.now() - openedAt > 350) { close(); return; }
    if (open === btn) return;
    openedAt = performance.now();
    open?.setAttribute('aria-expanded', 'false');
    open = btn;
    btn.setAttribute('aria-expanded', 'true');
    peekBox.replaceChildren(...topicCard(c).filter(Boolean));
    peekBox.hidden = false;
    const wrap = btn.closest('.topics-wrap');
    const b = btn.getBoundingClientRect(); const w = wrap.getBoundingClientRect();
    peekBox.style.top = `${b.bottom - w.top + 6}px`;
  };
  const close = () => { open?.setAttribute('aria-expanded', 'false'); open = null; peekBox.hidden = true; };
  const list = topics(rows, peek);
  const wrap = h('div', { class: 'topics-wrap' }, list, peekBox);
  wrap.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') close(); });
  page.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  const m = modes(rows);
  page.append(h('div', { class: 'book-row' },
    h('section', {}, h('h2', {}, 'By topic'), h('p', { class: 'fine' }, 'Share of loops that roped the answer, and points per question. The mark on each bar is 90%. Hover or tap a topic for more.'), wrap),
    m ? h('section', {}, h('h2', {}, 'By way to play'), m) : null));

  const rc = rateChart(rows);
  const cc = curveChart(rows);
  page.append(h('div', { class: 'book-row' },
    h('section', {}, h('h2', {}, 'Roped over time'),
      rc ? h('figure', { html: rc }, ) : h('p', { class: 'fine' }, 'This chart starts at 11 questions.'),
      rc ? h('p', { class: 'fine' }, 'Share of answers roped over your last 50 questions. The shaded part is where luck alone could have put it.') : null),
    h('section', {}, h('h2', {}, 'How sure your loops really are'),
      cc ? h('figure', { class: 'curve', html: cc }) : h('p', { class: 'fine' }, `This chart appears at ${CURVE_MIN} questions. You have ${rows.length}.`),
      cc ? h('p', { class: 'fine' }, `Each loop is read as the middle 90% of a bell curve on the rail, so narrower slices of it can be checked too. On the dashed line, your loops are exactly as sure as they should be. With ${rows.length} questions the shading at 90% is about ${bandAt(rows.length)} points either side.`) : null)));
  tips(page);
  main.replaceChildren(page);
}
