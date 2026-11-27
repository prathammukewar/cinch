// Showdown: one player ropes seven questions and sends a link; a friend ropes the same seven
// and both see who won. Everything travels in the link, so there is no server.
import { SITE, PER_DAY } from './config.js';
import { practicePool, practiceById } from './bank.js';
import { store } from './store.js';
import { total } from './score.js';
import { withUnit } from './format.js';
import { h, say, toast, signed, plus } from './dom.js';
import { withEmblem } from './art.js';
import { accountName } from './account.js';

let ctx;
export function init(c) { ctx = c; }

const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export function decode(code) {
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(code.replace(/-/g, '+').replace(/_/g, '/')))));
    if (o.v !== 1 || !Array.isArray(o.q) || !Array.isArray(o.p) || o.q.length !== o.p.length || o.q.length > 10) return null;
    if (!o.q.every((x) => typeof x === 'string' && x.length < 60) || !o.p.every((x) => Number.isFinite(x))) return null;
    if (o.o && (!Array.isArray(o.o.p) || o.o.p.length !== o.q.length)) return null;
    return o;
  } catch { return null; }
}
export const encode = enc;

const link = (code) => `${SITE || `${location.origin}${location.pathname}`}#duel/${code}`;
const clean = (s) => String(s || '').replace(/[^\p{L}\p{N} '.-]/gu, '').trim().slice(0, 20);
// Signed in, the account's name is filled in; a name typed here counts for this game.
let typed = null;
const startName = () => clean(accountName()) || clean(store.get('name'));
const myName = () => (typed ?? startName()) || 'A friend';

export async function show(code) {
  if (!code) return intro();
  // Side by side rooms moved to the Rodeo, which holds a whole group.
  if (code === 'side') { location.replace('#rodeo'); return; }
  if (code === 'same') return sameIntro();
  if (code === 'send') return sendIntro();
  if (/^[A-Za-z]{4}$/.test(code)) { location.replace(`#rodeo/${code.toUpperCase()}`); return; }
  const o = decode(code);
  if (!o) {
    ctx.main.replaceChildren(page('Showdown', h('p', {}, 'That Showdown link is broken or cut short. Ask for it again, or start your own.'), startButton()));
    return;
  }
  const mine = store.data().duels?.[o.d];
  if (o.o) return compare(o, mine?.sent);
  if (mine?.sent && mine.sent.n === o.n && JSON.stringify(mine.sent.p) === JSON.stringify(o.p)) {
    ctx.main.replaceChildren(page('Showdown', h('p', {}, 'This is your own challenge. Send the link to a friend, and when they send theirs back, open it here to see who won.'), shareButtons(o), h('p', { style: 'margin-top:12px' }, h('a', { href: '#home' }, 'Home'))));
    return;
  }
  const qs = await practiceById(o.q);
  if (qs.some((q) => !q)) {
    ctx.main.replaceChildren(page('Showdown', h('p', {}, 'Some of these questions are no longer in the game, so this Showdown cannot be played. Start a new one instead.'), startButton()));
    return;
  }
  ctx.main.replaceChildren(page('Showdown',
    h('p', { class: 'big-line' }, `${clean(o.n) || 'A friend'} scored `, h('b', { class: 'num' }, signed(total(o.p.map((p) => ({ points: p }))))), ` on these ${o.q.length} questions.`),
    
    nameField(),
    h('p', { style: 'margin-top:24px' }, h('button', { class: 'go', type: 'button', id: 'duel-go', onclick: () => play(qs, o) }, 'Take the challenge'))));
}

function page(title, ...kids) {
  return h('div', { class: 'page duel-page' }, h('h1', {}, title), ...kids);
}

function nameField(label = 'Your name') {
  typed = null;
  return h('label', { class: 'name-field' }, h('span', {}, label),
    h('input', { type: 'text', id: 'duel-name', maxlength: 20, autocomplete: 'nickname', value: startName(), placeholder: 'Optional', oninput: (e) => { typed = clean(e.target.value); store.set('name', typed); } }));
}

function startButton() {
  return h('p', { style: 'margin-top:24px' }, h('button', { class: 'go', type: 'button', id: 'duel-start', onclick: start }, 'Start a Showdown'));
}

function intro() {
  ctx.paintPips([], 0);
  const way = (id, href, title, text) => h('a', { class: 'way', id, href }, h('b', {}, title), h('span', {}, text));
  ctx.main.replaceChildren(withEmblem(page('Showdown',
    h('p', { class: 'lede' }, `Two riders, the same ${PER_DAY} questions, one winner.`),
    h('div', { class: 'ways' },
      way('way-side', '#rodeo', 'Rodeo', 'Two or more devices, live. Up to 12 riders.'),
      way('way-same', '#duel/same', 'Same saddle', 'One device, take turns.'),
      way('way-send', '#duel/send', 'Send a challenge', 'Send a link. They play later.'))), 'showdown'));
}

function sendIntro() {
  ctx.main.replaceChildren(page('Send a challenge',
    h('p', { class: 'lede' }, `Rope ${PER_DAY}, then send the link.`),
    nameField(), startButton(), back()));
}

const back = () => h('p', { class: 'fine', style: 'margin-top:16px' }, h('a', { href: '#duel' }, 'Other ways to play'));

function sameIntro() {
  const field = (id, label, value, placeholder) => h('label', { class: 'name-field' }, h('span', {}, label),
    h('input', { type: 'text', id, maxlength: 20, autocomplete: 'off', value, placeholder }));
  ctx.paintPips([], 0);
  ctx.main.replaceChildren(page('Same saddle',
    h('p', { class: 'lede' }, 'Take turns on one device.'),
    field('rider-1', 'First rider', startName(), 'Rider 1'),
    field('rider-2', 'Second rider', clean(store.get('name2')), 'Rider 2'),
    h('p', { style: 'margin-top:24px' }, h('button', { class: 'go', type: 'button', id: 'side-start', onclick: () => {
      const a = clean(document.getElementById('rider-1').value) || 'Rider 1';
      let b = clean(document.getElementById('rider-2').value) || 'Rider 2';
      if (b === a) b = `${b} 2`;
      store.set('name', a === 'Rider 1' ? store.get('name') || '' : a);
      store.set('name2', b === 'Rider 2' ? store.get('name2') || '' : b);
      startSide([a, b]);
    } }, 'Saddle up')),
    back()));
}

async function startSide(names) {
  const [{ PairRound }, pool] = await Promise.all([import('./pair.js'), practicePool()]);
  ctx.getCurrent()?.destroy?.();
  const qs = ctx.pickSet(pool, PER_DAY);
  ctx.paintPips([], qs.length);
  const round = new PairRound(ctx.main, {
    names,
    length: qs.length,
    seconds: 30,
    next: (i) => qs[i] || null,
    label: (i) => `Same saddle, ${i + 1} of ${qs.length}`,
    lastText: 'See who won',
    onRow: (pair, q) => store.change((d) => { d.practice.seen[q.id] = (d.practice.seen[q.id] || 0) + 1; }),
    onEnd: () => {
      ctx.getCurrent()?.destroy?.();
      sideResult(names, qs, round.pairs);
    },
  });
  ctx.setCurrent(round);
}

function sideResult(names, qs, pairs) {
  const left = { name: names[0], p: pairs.map((p) => p[0].points) };
  const right = { name: names[1], p: pairs.map((p) => p[1].points) };
  const [lt, rt] = [sum(left.p), sum(right.p)];
  const verdict = lt === rt ? 'A dead heat.' : `${lt > rt ? left.name : right.name} wins by ${Math.abs(lt - rt)}.`;
  ctx.paintPips([], 0);
  ctx.main.replaceChildren(board({ qs, left, right, leftLabel: left.name, verdict, actions: [
    h('button', { class: 'go wide', type: 'button', id: 'side-again', onclick: () => startSide(names) }, 'Rematch'),
    h('a', { class: 'go quiet wide', href: '#duel' }, 'Other ways to play'),
    h('a', { class: 'go quiet wide', href: '#home' }, 'Home')] }));
  say(`Same saddle. ${verdict}`);
}

const sum = (p) => p.reduce((s, x) => s + x, 0);

/** Two riders' scores, question by question. */
function board({ qs, left, right, leftLabel, verdict, actions }) {
  const [lt, rt] = [sum(left.p), sum(right.p)];
  return h('section', { class: 'page duel-page' },
    h('p', { class: 'day' }, 'Showdown'),
    h('div', { class: 'vs' },
      h('div', { class: `side${lt >= rt ? ' won' : ''}` }, h('span', { class: 'who' }, leftLabel), h('b', { class: 'num' }, signed(lt))),
      h('span', { class: 'v', 'aria-hidden': 'true' }, 'vs'),
      h('div', { class: `side${rt >= lt ? ' won' : ''}` }, h('span', { class: 'who' }, right.name), h('b', { class: 'num' }, signed(rt)))),
    h('p', { class: 'verdict-line' }, verdict),
    h('ol', { class: 'duel-rows' }, left.p.map((x, i) => {
      const q = qs[i];
      const y = right.p[i];
      return h('li', {},
        h('span', { class: 'qq' }, q ? q.question : 'A question no longer in the game'),
        h('span', { class: 'aa' }, q ? withUnit(q.answer, q) : ''),
        h('span', { class: `pp num${x > y ? ' won' : ''}` }, plus(x)),
        h('span', { class: 'bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.max(0, x)}%` }), h('i', { class: 'them', style: `width:${Math.max(0, y)}%` })),
        h('span', { class: `pp num${y > x ? ' won' : ''}` }, plus(y)));
    })),
    h('div', { class: 'actions' }, ...actions));
}

async function start() {
  const pool = await practicePool();
  const qs = ctx.pickSet(pool, PER_DAY);
  play(qs, null);
}

async function play(qs, them) {
  const { Round } = await import('./play.js');
  ctx.paintPips([], qs.length);
  const id = them?.d || Math.random().toString(36).slice(2, 10);
  const round = new Round(ctx.main, {
    length: qs.length,
    seconds: 30,
    next: (i) => qs[i] || null,
    label: (i) => `Showdown, ${i + 1} of ${qs.length}`,
    lastText: them ? 'See who won' : 'Finish and get the link',
    onRow: (row, q) => store.change((d) => { d.practice.rows.push({ ...row, mode: 'duel' }); d.practice.seen[q.id] = (d.practice.seen[q.id] || 0) + 1; }),
    onEnd: (rows) => {
      ctx.getCurrent()?.destroy?.();
      const me = { v: 1, d: id, n: myName(), q: qs.map((q) => q.id), p: rows.map((r) => r.points), c: rows.map((r) => (r.hit ? 1 : 0)).join('') };
      if (them) {
        const result = { ...me, o: { n: clean(them.n) || 'A friend', p: them.p, c: them.c || '' } };
        store.change((d) => { d.duels = { ...(d.duels || {}), [id]: { at: Date.now(), result } }; });
        location.hash = `#duel/${enc(result)}`;
      } else {
        store.change((d) => { d.duels = { ...(d.duels || {}), [id]: { at: Date.now(), sent: me } }; });
        sent(me, qs, rows);
      }
    },
  });
  ctx.setCurrent(round);
}

function sent(me, qs, rows) {
  const score = total(rows);
  ctx.paintPips([], 0);
  ctx.main.replaceChildren(page('Showdown',
    h('p', { class: 'big-line' }, 'You scored ', h('b', { class: 'num' }, signed(score)), ` and roped ${rows.filter((r) => r.hit).length} of ${rows.length}.`),
    h('p', {}, 'Send the link to a friend.'),
    shareButtons(me),
    h('ol', { class: 'recap' }, rows.map((r, i) => h('li', {}, h('span', { class: 'qq' }, qs[i].question), h('span', { class: 'pp num' }, plus(r.points)), h('span', { class: 'aa' }, withUnit(qs[i].answer, qs[i])))))));
  say(`You scored ${score}. Send the link to a friend.`);
}

function shareButtons(me) {
  const url = link(enc(me));
  const text = `${me.n} challenges you to a Cinch Showdown. ${total(me.p.map((p) => ({ points: p })))} to beat.`;
  return h('div', { class: 'actions' },
    h('button', { class: 'go wide', type: 'button', id: 'duel-send', onclick: async () => {
      if (matchMedia('(pointer: coarse)').matches && navigator.share) { try { await navigator.share({ text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Link copied'); } catch { toast('Copying is blocked in this browser'); }
    } }, 'Send the challenge'),
    h('input', { class: 'link-box', type: 'text', readonly: true, value: url, 'aria-label': 'Challenge link', onfocus: (e) => e.target.select() }));
}

async function compare(o, mineSent) {
  const qs = await practiceById(o.q);
  const a = { name: clean(o.n) || 'A friend', p: o.p, c: o.c || '' };
  const b = { name: clean(o.o.n) || 'A friend', p: o.o.p, c: o.o.c || '' };
  // From the viewer's side: if this browser sent the challenge, they are b.
  const youAreB = mineSent && JSON.stringify(mineSent.p) === JSON.stringify(b.p);
  const youAreA = !youAreB && store.data().duels?.[o.d]?.result;
  const [left, right] = youAreB ? [b, a] : [a, b];
  const [lt, rt] = [sum(left.p), sum(right.p)];
  const you = youAreA || youAreB;
  const verdict = lt === rt ? 'A dead heat.' : you ? (lt > rt ? `You win by ${lt - rt}.` : `${right.name} wins by ${rt - lt}.`) : `${lt > rt ? left.name : right.name} wins by ${Math.abs(lt - rt)}.`;
  const reply = { ...o };
  ctx.paintPips([], 0);
  ctx.main.replaceChildren(board({ qs, left, right, leftLabel: you ? 'You' : left.name, verdict, actions: [
    youAreA ? h('button', { class: 'go wide', type: 'button', id: 'duel-reply', onclick: async () => {
      const url = link(enc(reply));
      if (matchMedia('(pointer: coarse)').matches && navigator.share) { try { await navigator.share({ text: `Showdown result: ${verdict}`, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
      try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast('Copying is blocked in this browser'); }
    } }, 'Send the result back') : null,
    h('button', { class: 'go quiet wide', type: 'button', id: 'duel-again', onclick: start }, 'New Showdown'),
    h('a', { class: 'go quiet wide', href: '#home' }, 'Home')] }));
  say(`Showdown. ${verdict}`);
}
