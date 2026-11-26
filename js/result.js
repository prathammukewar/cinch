// The result screen: the bands lining up, the score, sharing. Loaded when a round ends.
import { NAME, SITE, API } from './config.js';
import { getKey, signedIn, clientId, call as accountCall } from './account.js';
import { store } from './store.js';
import { untilMidnight } from './day.js';
import { total, kindOf, binomCdf, hash, tierOf, TIERS, LEANER } from './score.js';
import { withUnit } from './format.js';
import { Lineup, storyImage } from './lineup.js';
import { shareText, shareOrCopy } from './share.js';
import { h, say, toast, reducedMotion, signed, plus } from './dom.js';

let sound = { finale() {}, tap() {} };
export function init(c) { sound = c.sound; }

/** One warm line about the day. */
function luckLine(hits, n) {
  if (n !== 7) return hits / n >= 0.8 ? `You roped ${hits} of ${n}. Sharp work.` : `You roped ${hits} of ${n}. Wider loops will catch more next time.`;
  return [
    'A wild one. Throw your loops wider tomorrow and watch them land.',
    'A wild one. Throw your loops wider tomorrow and watch them land.',
    'A wild one. Throw your loops wider tomorrow and watch them land.',
    'Some got away today. A little wider and they are yours.',
    'Some got away today. A little wider and they are yours.',
    'Five of seven. Solid riding.',
    'Six of seven. That is right where a sharp roper lands.',
    'Clean sweep. Every horseshoe roped.',
  ][hits];
}

export function countdown() {
  const b = h('b', { class: 'num' });
  const tick = () => {
    const s = Math.max(0, Math.floor(untilMidnight() / 1000));
    b.textContent = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((v) => String(v).padStart(2, '0')).join(':');
    if (b.isConnected || !b.dataset.seen) { b.dataset.seen = '1'; setTimeout(tick, 1000); }
  };
  tick();
  return h('p', { class: 'next' }, 'Seven new ones in ', b);
}

export function resultView({ rows, questions, instant, heading, of, shareTitle, third, extras, foot, restart, restartText = 'Go again', standings }) {
  const score = total(rows);
  const hits = rows.filter((r) => r.hit).length;
  const avgWidth = rows.reduce((s, r) => s + r.width, 0) / rows.length;
  const big = h('div', { class: 'big num', 'aria-label': `Score ${score}` }, instant || reducedMotion() ? signed(score) : '0');
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const peek = h('div', { class: 'peek', role: 'status', hidden: true });
  const verdictOf = (r) => tierOf(r).name;
  const ladder = [...TIERS.slice(0, 4), LEANER, ...TIERS.slice(4)];
  const counts = new Map();
  for (const r of rows) { const k = tierOf(r).key; counts.set(k, (counts.get(k) || 0) + 1); }
  const brands = h('ul', { class: 'brands', 'aria-label': 'Your throws by name' }, ladder.filter((t) => counts.has(t.key)).map((t, i) =>
    h('li', { class: `tier-pill t-${t.key}`, style: `animation-delay:${0.9 + i * 0.12}s` }, t.name, counts.get(t.key) > 1 ? h('span', { class: 'x' }, `\u00d7${counts.get(t.key)}`) : null)));
  const spots = h('ol', { class: 'spots', 'aria-label': 'Your loops, one per question' }, rows.map((r, i) => h('li', {}, h('button', {
    type: 'button', class: 'spot', 'data-i': String(i),
    'aria-label': questions[i] ? `${i + 1}. ${questions[i].question} ${verdictOf(r)}, ${r.points} points` : `${i + 1}`,
  }))));
  const box = h('div', { class: 'lineup' }, canvas, spots, peek);
  if (rows.length > 7) box.style.minHeight = `${rows.length * 46 + 44}px`;
  const t3 = third();

  const text = () => shareText({ title: shareTitle, score, of, rows });
  const el = h('section', { class: 'result', 'aria-label': 'Result' },
    h('div', { class: 'tally' }, h('p', { class: 'day' }, heading), big, h('p', { class: 'of' }, `of ${of}`),
      h('p', { class: 'standing', id: 'standing', role: 'status', hidden: !standings || !api() }, '')),
    box,
    brands,
    h('dl', { class: 'facts' },
      h('div', {}, h('dt', {}, 'Roped'), h('dd', { class: 'num' }, `${hits} of ${rows.length}`)),
      h('div', {}, h('dt', {}, 'Loop size'), h('dd', { class: 'num' }, `${Math.round(avgWidth * 100)}%`)),
      h('div', {}, h('dt', {}, t3[0]), h('dd', { class: 'num' }, t3[1]))),
    h('div', { class: 'actions' },
      h('button', { class: 'go wide', type: 'button', id: 'share', onclick: async () => { const r = await shareOrCopy(text()); if (r === 'copied') toast('Copied'); if (r === 'failed') toast('Copying is blocked in this browser'); } }, 'Share result'),
      h('button', { class: 'go quiet wide', type: 'button', id: 'image', onclick: () => saveImage({ rows, score, of, shareTitle, hits }) }, 'Picture for stories'),
      ...(restart ? [h('button', { class: 'go quiet wide', type: 'button', id: 'again', onclick: restart }, restartText)] : []),
      ...extras),
    h('div', { class: 'says' },
      h('p', { class: 'cheer' }, luckLine(hits, rows.length))),
    h('p', { class: 'fine maths-link' }, h('a', { href: '#scoring' }, 'How scoring works')),
    foot,
    h('ol', { class: 'recap' }, rows.map((r, i) => {
      const q = questions[i];
      if (!q) return null;
      return h('li', {}, h('span', { class: 'qq' }, q.question), h('span', { class: `pp num t-${tierOf(r).key}`, title: verdictOf(r) }, plus(r.points)),
        h('span', { class: 'aa' }, `${withUnit(q.answer, q)}. You said ${withUnit(r.lo, q)} to ${withUnit(r.hi, q)}. `, h('a', { href: q.source_url, target: '_blank', rel: 'noopener noreferrer' }, q.source_name)));
    })));

  const lineup = new Lineup(canvas, rows, { reduced: reducedMotion(), sound, instant });
  // Hover, focus or tap a loop to see its question, your loop and the answer.
  let shown = -1;
  let crowd = null;
  const open = (i) => {
    const q = questions[i];
    const r = rows[i];
    if (!q || shown === i) return;
    shown = i;
    lineup.highlight(i);
    peek.replaceChildren(
      h('p', { class: 'peek-q' }, q.question),
      h('dl', {}, h('div', {}, h('dt', {}, 'Your loop'), h('dd', {}, `${withUnit(r.lo, q)} to ${withUnit(r.hi, q)}`)), h('div', {}, h('dt', {}, 'Answer'), h('dd', {}, withUnit(q.answer, q)))),
      h('p', { class: `peek-v${r.hit ? ' hit' : ''}` }, h('b', { class: `tier-pill t-${tierOf(r).key}` }, verdictOf(r)), ` ${plus(r.points)}${r.hints ? ' with hints' : ''}`),
      crowd?.qbetter?.[i] != null ? h('p', { class: 'peek-crowd' }, `Better than ${crowd.qbetter[i]}% of players`) : '');
    const step = (box.clientHeight - 44) / rows.length;
    const y = 22 + step * (i + 0.5);
    peek.hidden = false;
    const below = y < box.clientHeight / 2;
    peek.style.top = below ? `${y + step / 2}px` : 'auto';
    peek.style.bottom = below ? 'auto' : `${box.clientHeight - y + step / 2}px`;
  };
  const close = () => { shown = -1; peek.hidden = true; lineup.highlight(-1); };
  spots.addEventListener('pointerover', (e) => { const b = e.target.closest('.spot'); if (b && e.pointerType === 'mouse') open(Number(b.dataset.i)); });
  spots.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') close(); });
  spots.addEventListener('focusin', (e) => { const b = e.target.closest('.spot'); if (b) open(Number(b.dataset.i)); });
  spots.addEventListener('focusout', (e) => { if (!spots.contains(e.relatedTarget)) close(); });
  let lastPointer = 'mouse';
  spots.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });
  spots.addEventListener('click', (e) => {
    const b = e.target.closest('.spot');
    if (!b) return;
    const i = Number(b.dataset.i);
    if (lastPointer === 'mouse') { open(i); return; }
    if (shown === i) close(); else { shown = -1; open(i); }
  });
  return {
    el,
    lineup,
    start: () => {
      say(`Score ${score} of ${of}. Roped ${hits} of ${rows.length}.`);
      lineup.start(() => { if (!instant && !reducedMotion()) countUp(big, score); });
      if (standings) loadStandings(el, standings, score, rows, (s) => { crowd = s; if (shown >= 0) { const i = shown; shown = -1; open(i); } });
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
  const blob = await storyImage({ rows, name: NAME, title: shareTitle, score, of: `of ${of}`, line: `Roped ${hits} of ${rows.length}`, address: SITE.replace(/^https?:\/\//, '') });
  const file = new File([blob], `${NAME.toLowerCase()}-${shareTitle.replace(/[^a-z0-9]+/gi, '-')}.png`, { type: 'image/png' });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e?.name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  h('a', { href: url, download: file.name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Picture saved');
}


/** The standings server. 'off' in localStorage turns it off for this browser (the tests use it). */
export const api = () => { try { const o = localStorage.getItem('cinch-api'); return o === 'off' ? '' : o || API; } catch { return API; } };


/** Post today's score once and show where it stands among today's riders. Silent if offline. */
/** Where this Roundup puts you on today's leaderboard, or how to get on it. */
async function boardLine(el, day, s) {
  const tally = el.querySelector('.tally');
  if (!tally) return;
  const line = h('p', { class: 'board-line' });
  tally.append(line);
  if (!signedIn()) { line.append(h('a', { href: '#account', id: 'result-join' }, 'Join the leaderboard'), '.'); return; }
  if (!s.counted) { line.append('Your account already has today\u2019s Roundup from another device.'); return; }
  try {
    const d = await accountCall(`/v1/leaderboard?view=today&day=${day}`);
    if (!d.you) return;
    line.append(d.you.listed ? `#${d.you.rank} of ${d.players} on today\u2019s ` : 'You are hidden from the ', h('a', { href: '#leaderboard', id: 'result-board' }, 'leaderboard'), '.');
  } catch { line.remove(); }
}

/** How this round compares with everyone who played the same day: overall and on each question. */
async function loadStandings(el, { day, post }, score, rows, done) {
  const base = api();
  if (!base) return;
  const line = el.querySelector('#standing');
  const points = rows.map((r) => r.points);
  try {
    // The loops go up, not the score: the server works the score out itself.
    const key = getKey();
    const res = post
      ? await fetch(`${base}/v1/score`, {
        method: 'POST', headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({ day, client: clientId(), loops: rows.map((r) => ({ lo: r.lo, hi: r.hi, fence: r.hints?.fence || 0, scout: !!r.hints?.scout })) }),
      })
      : await fetch(`${base}/v1/day/${day}?score=${score}&pts=${points.join(',')}`);
    if (!res.ok) { if (line) line.hidden = true; return; }
    const s = await res.json();
    if (!line) return;
    const when = post ? 'today' : 'that day';
    line.textContent = s.riders > 1 && s.better !== null
      ? `You did better than ${s.better}% of the ${s.riders.toLocaleString('en-US')} players ${when}.`
      : post ? 'You are the first player today. Come back later to see how you compare.' : 'You were the only player that day.';
    line.hidden = false;
    el.querySelectorAll('.recap li').forEach((li, i) => {
      const parts = [];
      if (s.qbetter?.[i] != null) parts.push(`Better than ${s.qbetter[i]}% of players`);
      if (s.riders > 1 && s.roped?.[i] !== undefined) parts.push(`${s.roped[i]}% roped it`);
      if (parts.length) li.append(h('span', { class: 'crowd' }, parts.join(' \u00b7 ')));
    });
    say(line.textContent);
    if (post) boardLine(el, day, s);
    done?.(s);
  } catch { if (line) line.hidden = true; }
}
