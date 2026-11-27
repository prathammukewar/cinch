// Rodeo: up to twelve riders, each on their own device, rope the same seven questions at the same time.
// The room lives on the standings server (server/rodeo.js) and talks over a WebSocket. Nobody sees
// another rider's loop until everyone has thrown or the fuse runs out; then every loop lands at once.
import { SITE, PER_DAY } from './config.js';
import { practicePool, practiceById } from './bank.js';
import { store } from './store.js';
import { api } from './result.js';
import { Round, rowOf, rulerOf, HINTS } from './play.js';
import { scoreRange, tierOf } from './score.js';
import { withUnit } from './format.js';
import { nameProblem, tidyName } from './names.js';
import { h, say, toast, plus, signed, reducedMotion } from './dom.js';
import { withEmblem } from './art.js';
import { sound } from './sound.js';
import { accountName } from './account.js';

let ctx;
export function init(c) { ctx = c; }

const MAX = 12;
const HUES = ['#c23b25', '#3d6ea8', '#3f7d3a', '#b47b12', '#7a4fa0', '#1f7f7a', '#d0612a', '#7b5134', '#b8487a', '#56657a', '#717e22', '#3b3431'];
const hex = (n) => n.toString(16).padStart(2, '0');
const rgb = (c) => [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16));
const mix = (a, b, t) => { const [x, y] = [rgb(a), rgb(b)]; return `#${x.map((v, k) => hex(Math.round(v + (y[k] - v) * t))).join('')}`; };
const lum = (c) => { const [r, g, b] = rgb(c).map((v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

/** Each rider's rope colour, the same on every device in the room. */
export function colorOf(c) {
  const color = HUES[c % HUES.length];
  return { color, dark: mix(color, '#000000', 0.45), lite: mix(color, '#ffffff', 0.55), ink: 1.05 / (lum(color) + 0.05) >= 3.6 ? '#fff' : '#1b1600' };
}
const ropeOf = (c) => { if (!c) return null; const k = colorOf(c); return { band: k.color, bandDark: k.dark, bandLite: k.lite }; };

const clean = (s) => tidyName(String(s || '').replace(/[^\p{L}\p{N} '._’-]/gu, '')).slice(0, 20);
const roomLink = (code) => `${SITE || `${location.origin}${location.pathname}`}#rodeo/${code}`;
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
const listNames = (names) => (names.length <= 1 ? names.join('') : names.length === 2 ? `${names[0]} and ${names[1]}` : names.length === 3 ? `${names[0]}, ${names[1]} and ${names[2]}` : `${names[0]}, ${names[1]} and ${names.length - 2} more`);
const nameProblemHere = (name) => (name ? nameProblem(name, { min: 2 }) : null);

/** This tab is in a room (survives a reload); this browser was in a room (offered back on a new tab). */
const SEAT_KEY = 'cinch-rodeo';
const tabRoom = () => { try { return sessionStorage.getItem(SEAT_KEY); } catch { return null; } };
const setTabRoom = (code) => { try { if (code) sessionStorage.setItem(SEAT_KEY, code); else sessionStorage.removeItem(SEAT_KEY); } catch { /* no storage */ } };
function seatFor(code) {
  try {
    const o = JSON.parse(localStorage.getItem(SEAT_KEY) || 'null');
    return o && o.code === code && Date.now() - o.at < 6 * 3600000 ? o : null;
  } catch { return null; }
}
function keepSeat(o) { try { if (o) localStorage.setItem(SEAT_KEY, JSON.stringify({ ...o, at: Date.now() })); else localStorage.removeItem(SEAT_KEY); } catch { /* no storage */ } }
function forget(code) { if (seatFor(code)) keepSeat(null); if (tabRoom() === code) setTabRoom(null); }

/** Talk to the server over plain HTTP. Throws with .status on a refusal and 0 when there is no server. */
async function call(path, body) {
  const base = api();
  if (!base) { const e = new Error('offline'); e.status = 0; throw e; }
  let res;
  try { res = await fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); } catch { const e = new Error('offline'); e.status = 0; throw e; }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'server'); e.status = res.status; throw e; }
  return data;
}

const OFFLINE = 'Rodeo needs the internet, and this browser has no connection to the server.';

export async function show(arg) {
  if (!arg) return intro();
  if (/^[A-Za-z]{4}$/.test(arg)) return enter(arg.toUpperCase());
  location.replace('#rodeo');
}

function page(title, ...kids) {
  return h('div', { class: 'page duel-page rodeo-page' }, h('h1', {}, title), ...kids);
}

function nameField() {
  return h('label', { class: 'name-field' }, h('span', {}, 'Your name'),
    h('input', { type: 'text', id: 'rodeo-name', maxlength: 20, autocomplete: 'nickname', value: clean(accountName()) || store.get('name') || '', placeholder: 'Optional', oninput: (e) => store.set('name', clean(e.target.value)) }));
}

/** The name typed in, or a reason it cannot be used. */
function typedName(msg) {
  const name = clean(document.getElementById('rodeo-name')?.value);
  const problem = nameProblemHere(name);
  if (problem) { msg.textContent = problem; document.getElementById('rodeo-name')?.focus(); return null; }
  return { name };
}

function intro() {
  ctx.paintPips([], 0);
  const msg = h('p', { class: 'room-msg', role: 'status' });
  const code = h('input', { type: 'text', id: 'room-code', maxlength: 4, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'ABCD', 'aria-label': 'Room code', oninput: (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); } });
  const start = h('button', { class: 'go', type: 'button', id: 'room-start', onclick: () => open(msg, start) }, 'Start a room');
  ctx.main.replaceChildren(withEmblem(page('Rodeo',
    h('p', { class: 'lede' }, `A live room for up to ${MAX} riders. Everyone ropes the same ${PER_DAY} questions at once.`),
    nameField(),
    h('p', { style: 'margin-top:20px' }, start),
    h('p', { class: 'or' }, 'or join a room'),
    h('div', { class: 'join-row' }, code, h('button', { class: 'go quiet', type: 'button', id: 'room-join', onclick: () => { if (code.value.length === 4) location.hash = `#rodeo/${code.value}`; else msg.textContent = 'Room codes are four letters.'; } }, 'Join')),
    msg,
    h('p', { class: 'fine', style: 'margin-top:16px' }, h('a', { href: '#duel' }, 'One on one instead'))), 'rodeo'));
  code.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.nextSibling.click(); });
}

async function open(msg, button) {
  const who = typedName(msg);
  if (!who) return;
  button.disabled = true;
  msg.textContent = 'Opening a room';
  const pool = await practicePool();
  const qs = ctx.pickSet(pool, PER_DAY);
  try {
    const room = await call('/v1/rodeo', { name: who.name, q: qs.map((q) => q.id) });
    keepSeat({ code: room.code, token: room.token, name: who.name });
    setTabRoom(room.code);
    location.hash = `#rodeo/${room.code}`;
  } catch (e) {
    button.disabled = false;
    msg.textContent = e.status === 0 ? OFFLINE : e.status === 429 ? 'Too many tries. Wait a minute.' : 'Could not open a room just now. Try again in a moment.';
  }
}

/** A room link: back into the seat this tab had, or a page to join. */
function enter(code) {
  ctx.paintPips([], 0);
  const seat = seatFor(code);
  if (!api()) { ctx.main.replaceChildren(page(`Room ${code}`, h('p', { class: 'lede' }, OFFLINE))); return; }
  if (seat && tabRoom() === code) { new Room(code, seat.token); return; }
  const msg = h('p', { class: 'room-msg', role: 'status' });
  const go = h('button', { class: 'go', type: 'button', id: 'room-join-go', onclick: () => {
    const who = typedName(msg);
    if (!who) return;
    go.disabled = true;
    msg.textContent = 'Joining';
    setTabRoom(code);
    new Room(code, null, who.name, (text) => { go.disabled = false; msg.textContent = text; setTabRoom(null); });
  } }, 'Join the room');
  const back = seat ? h('p', { style: 'margin-top:12px' }, h('button', { class: 'go quiet', type: 'button', id: 'rodeo-rejoin', onclick: () => { setTabRoom(code); new Room(code, seat.token, null, (text) => { msg.textContent = text; setTabRoom(null); }); } }, `Back in as ${seat.name || 'before'}`)) : null;
  ctx.main.replaceChildren(page(`Room ${code}`,
    h('p', { class: 'lede' }, seat ? 'You were in this room on this browser.' : 'Join the rodeo.'),
    back,
    seat ? h('p', { class: 'or' }, 'or join as someone else') : null,
    nameField(),
    h('p', { style: 'margin-top:20px' }, go), msg,
    h('p', { class: 'fine', style: 'margin-top:16px' }, h('a', { href: '#rodeo' }, 'Start your own room'))));
}

const WHY = {
  gone: 'That room has closed, or the code is wrong.',
  started: 'That rodeo has already started.',
  full: `That room is full. A room holds ${MAX} riders.`,
  removed: 'The host took you out of the room.',
  moved: 'This room is open in another tab.',
};

// ------------------------------------------------------------ the connection

class Line {
  constructor(code, hello, { onMessage, onDown, onUp }) {
    Object.assign(this, { code, hello, onMessage, onDown, onUp, tries: 0 });
    this.open();
  }

  open() {
    if (this.stopped) return;
    let ws;
    try { ws = new WebSocket(`${api().replace(/^http/, 'ws')}/v1/rodeo/${this.code}`); } catch { this.onDown?.(9); return; }
    this.ws = ws;
    ws.onopen = () => { this.tries = 0; ws.send(JSON.stringify(this.hello())); this.onUp?.(); };
    ws.onmessage = (e) => {
      let m;
      try { m = JSON.parse(e.data); } catch { return; }
      if (m.t === 'refused') this.stopped = true;
      this.onMessage(m);
    };
    ws.onclose = () => {
      if (this.ws !== ws || this.stopped) return;
      this.onDown?.(this.tries);
      this.timer = setTimeout(() => this.open(), Math.min(8000, 400 * 2 ** this.tries++));
    };
  }

  send(o) {
    if (this.ws?.readyState !== 1) return false;
    this.ws.send(JSON.stringify(o));
    return true;
  }

  close() {
    this.stopped = true;
    clearTimeout(this.timer);
    try { this.ws?.close(1000); } catch { /* closed */ }
  }
}

// ------------------------------------------------------------ the room

/** Points for one loop, worked out the same way on every device. p is [lo, hi, fence, scout]. */
function resultOf(q, p) {
  const hint = { fence: [1, 2].includes(p[2]) && q.trims?.[p[2] - 1] ? p[2] : 0, scout: !!p[3] };
  const view = hint.fence ? q.trims[hint.fence - 1] : [0, 1];
  const r = scoreRange(p[0], p[1], q.answer, rulerOf(q), view);
  const m = (hint.scout ? HINTS.scout : 1) * HINTS.fence[hint.fence];
  r.points = Math.round(r.exact * m);
  r.fenced = hint.fence > 0;
  r.tier = tierOf(r).key;
  return { r, row: rowOf(q, r, p[0], p[1], hint, m) };
}

/** Every rider's points on every question shown so far. */
function scoreAll(qs, s) {
  return s.shown.map((picks, i) => {
    const q = qs[i];
    const out = {};
    for (const r of s.riders) out[r.seat] = picks?.[r.seat] && q ? resultOf(q, picks[r.seat]) : null;
    return out;
  });
}

function totals(qs, s) {
  const table = scoreAll(qs, s);
  const list = s.riders.map((r) => ({ ...r, total: table.reduce((t, row) => t + (row[r.seat]?.r.points || 0), 0), roped: table.filter((row) => row[r.seat]?.r.hit).length, pts: table.map((row) => row[r.seat]) }));
  list.sort((a, b) => b.total - a.total || a.seat - b.seat);
  list.forEach((x, k) => { x.rank = k && list[k - 1].total === x.total ? list[k - 1].rank : k + 1; });
  return list;
}

class Room {
  constructor(code, token, name, onRefused) {
    Object.assign(this, { code, token, name, onRefused, s: null, round: null, screen: null, skew: 0, qsKey: null });
    ctx.getCurrent()?.destroy?.();
    ctx.setCurrent(this);
    this.line = new Line(code, () => ({ t: 'hello', token: this.token || undefined, name: this.name || undefined }), {
      onMessage: (m) => this.message(m),
      onDown: (n) => { if (this.s) this.net(n > 1 ? 'Still trying to reach the room' : 'Connection lost. Reconnecting'); else if (n >= 2) this.fail(OFFLINE); },
      onUp: () => this.net(null),
    });
  }

  get stage() { return this.round?.stage; }
  get length() { return this.round ? this.s.q.length : 0; }
  get isRound() { return !!this.round; }
  get me() { return this.s?.riders.find((r) => r.seat === this.seat); }
  get isHost() { return this.s && this.s.host === this.seat; }
  serverNow() { return Date.now() + this.skew; }
  send(o) { return this.line.send(o); }

  destroy() {
    this.dead = true;
    this.round?.destroy();
    this.round = null;
    this.line.close();
    this.banner?.remove();
  }

  /** Before the first state, a refusal or a dead line goes back to the join page; after, it gets its own page. */
  fail(text) {
    if (this.dead) return;
    if (!this.s && this.onRefused) { this.destroy(); ctx.setCurrent(null); this.onRefused(text); return; }
    this.destroy();
    ctx.paintPips([], 0);
    ctx.main.replaceChildren(page('Rodeo', h('p', { class: 'lede', id: 'rodeo-closed' }, text),
      h('div', { class: 'actions' }, h('a', { class: 'go wide', href: '#rodeo' }, 'Start a room'), h('a', { class: 'go quiet wide', href: '#home' }, 'Home'))));
    say(text);
  }

  net(text) {
    if (!text) { this.banner?.remove(); this.banner = null; return; }
    if (!this.banner) { this.banner = h('p', { class: 'rodeo-net', role: 'status' }); document.body.append(this.banner); }
    this.banner.replaceChildren(text, h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));
  }

  message(m) {
    if (this.dead) return;
    if (m.t === 'welcome') {
      this.seat = m.seat;
      this.token = m.token;
      keepSeat({ code: this.code, token: m.token, name: this.name || seatFor(this.code)?.name || '' });
      setTabRoom(this.code);
    } else if (m.t === 'refused') {
      if (m.why !== 'moved') forget(this.code);
      this.fail(WHY[m.why] || WHY.gone);
    } else if (m.t === 'state') {
      this.skew = m.now - Date.now();
      this.s = m;
      this.paint(m);
    }
  }

  async questions(ids) {
    const key = ids.join(',');
    if (this.qsKey !== key) { this.qsKey = key; this.qsLoad = practiceById(ids); }
    return this.qsLoad;
  }

  async paint(s) {
    if (s.phase === 'lobby') { this.endRound(); this.lobby(s); return; }
    const qs = await this.questions(s.q);
    if (this.dead || this.s !== s) return;
    if (qs.some((q) => !q)) { this.fail('This room uses questions this version of the game does not have. Reload the page and try again.'); return; }
    this.qs = qs;
    if (s.phase === 'done') {
      if (this.screen !== 'final') { this.endRound(); this.final(s); } else this.paintFinal(s);
      return;
    }
    if (!this.round) {
      this.screen = 'round';
      ctx.paintPips([], qs.length);
      this.round = new RodeoRound(ctx.main, { room: this, qs, length: qs.length, seconds: s.seconds, next: (i) => qs[i] || null, label: (i) => `Rodeo, ${i + 1} of ${qs.length}`, lastText: 'See the standings' });
    } else this.round.sync(s);
  }

  endRound() {
    this.round?.destroy();
    this.round = null;
  }

  // ---------------------------------------------------------- lobby

  lobby(s) {
    if (this.screen !== 'lobby') {
      this.screen = 'lobby';
      ctx.paintPips([], 0);
      const url = roomLink(this.code);
      this.els = {
        lede: h('p', { class: 'lede' }),
        count: h('span', { class: 'count num' }),
        list: h('ol', { class: 'posse', id: 'posse' }),
        foot: h('div', { class: 'lobby-foot' }),
      };
      ctx.main.replaceChildren(page('Rodeo',
        this.els.lede,
        h('p', { class: 'room-code', id: 'room-code-show', 'aria-label': `Room code ${this.code.split('').join(' ')}` }, this.code),
        h('div', { class: 'actions' },
          h('button', { class: 'go wide quiet', type: 'button', id: 'room-send', onclick: () => shareRoom(this.code, url) }, 'Send the link'),
          h('input', { class: 'link-box', type: 'text', readonly: true, value: url, 'aria-label': 'Room link', onfocus: (e) => e.target.select() })),
        h('h2', { class: 'posse-head' }, 'Riders ', this.els.count),
        this.els.list,
        this.els.foot,
        h('p', { class: 'fine', style: 'margin-top:20px' }, h('button', { class: 'linkish', type: 'button', id: 'rodeo-leave', onclick: () => this.leave() }, 'Leave the room'))));
      say(`Room ${this.code}. ${this.isHost ? 'Send the code to your riders.' : 'You are in.'}`);
    }
    const here = s.riders.filter((r) => r.on);
    const host = s.riders.find((r) => r.seat === s.host);
    this.els.lede.textContent = this.isHost ? 'Send the code to your riders.' : 'You are in.';
    this.els.count.textContent = `${s.riders.length} of ${s.max}`;
    this.els.list.replaceChildren(...s.riders.map((r) => h('li', { class: `${r.seat === this.seat ? 'you' : ''}${r.on ? '' : ' away'}`, style: `--c:${colorOf(r.c).color}` },
      h('span', { class: 'dot', 'aria-hidden': 'true' }),
      h('span', { class: 'nm' }, r.name),
      h('span', { class: 'tags' }, [r.seat === this.seat ? 'you' : '', r.seat === s.host ? 'host' : '', r.on ? '' : 'away'].filter(Boolean).join(', ')),
      this.isHost && r.seat !== this.seat ? h('button', { class: 'chip kick', type: 'button', 'aria-label': `Remove ${r.name}`, onclick: () => this.send({ t: 'kick', seat: r.seat }) }, 'Remove') : null)));
    const focusStart = document.activeElement?.id === 'rodeo-go';
    if (this.isHost) {
      const go = h('button', { class: 'go', type: 'button', id: 'rodeo-go', disabled: here.length < 2, onclick: () => { sound.tap(); this.send({ t: 'start' }); } }, 'Start the rodeo');
      this.els.foot.replaceChildren(h('p', { style: 'margin-top:20px' }, go),
        h('p', { class: 'fine' }, here.length < 2 ? 'Waiting for one more rider to join.' : `${s.q.length} questions, ${s.seconds} seconds each.`));
      if (focusStart) go.focus();
    } else {
      this.els.foot.replaceChildren(h('p', { class: 'wait-line', style: 'margin-top:20px' }, host ? `Waiting for ${host.name} to start` : 'Waiting for the host', h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))));
    }
  }

  leave() {
    this.send({ t: 'leave' });
    forget(this.code);
    this.destroy();
    ctx.setCurrent(null);
    location.hash = '#rodeo';
  }

  // ---------------------------------------------------------- the end

  final(s) {
    this.screen = 'final';
    ctx.paintPips([], 0);
    const list = totals(this.qs, s);
    const me = list.find((r) => r.seat === this.seat);
    const top = list.filter((r) => r.rank === 1);
    const second = list.find((r) => r.rank > 1);
    const names = (rs) => listNames(rs.map((r) => (r.seat === this.seat ? 'you' : r.name)));
    let verdict;
    let lead = '';
    if (me?.rank === 1 && top.length === 1) { verdict = 'You win.'; if (second) lead = `By ${me.total - second.total} point${me.total - second.total === 1 ? '' : 's'}, with ${me.total}.`; }
    else if (me?.rank === 1) { verdict = 'A tie for first.'; lead = `${names(top).replace(/^you/, 'You')} on ${me.total}.`; }
    else {
      verdict = me ? `You came ${ordinal(me.rank)} of ${list.length}.` : `${names(top)} won.`;
      lead = top.length === 1 ? `${top[0].name} wins with ${top[0].total}.` : `${names(top)} tie for first with ${top[0].total}.`;
    }
    this.els = { foot: h('div', { class: 'actions' }) };
    const table = scoreAll(this.qs, s);
    ctx.main.replaceChildren(h('section', { class: 'page duel-page rodeo-end' },
      h('p', { class: 'day' }, `Rodeo ${this.code}`),
      h('h1', { class: 'verdict-line', id: 'rodeo-verdict' }, verdict),
      lead ? h('p', { class: 'lede' }, lead) : null,
      h('ol', { class: 'standings', id: 'standings' }, list.map((r) => h('li', { class: `${r.seat === this.seat ? 'you' : ''}${r.rank === 1 ? ' first' : ''}`, style: `--c:${colorOf(r.c).color}` },
        h('span', { class: 'rk num' }, ordinal(r.rank)),
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        h('span', { class: 'nm' }, r.name, r.gone ? h('small', {}, ' left') : null),
        h('span', { class: 'dd' }, `roped ${r.roped} of ${this.qs.length}`),
        h('span', { class: 'sc num' }, signed(r.total))))),
      h('h2', { class: 'posse-head' }, 'Question by question'),
      h('ol', { class: 'rodeo-rows' }, this.qs.map((q, i) => {
        const row = table[i] || {};
        const best = Math.max(0, ...Object.values(row).map((x) => x?.r.points || 0));
        const winners = s.riders.filter((r) => best > 0 && row[r.seat]?.r.points === best).map((r) => (r.seat === this.seat ? 'you' : r.name));
        const mine = row[this.seat];
        return h('li', {},
          h('span', { class: 'qq' }, q.question),
          h('span', { class: 'aa' }, withUnit(q.answer, q)),
          h('span', { class: 'best' }, winners.length ? `Best: ${listNames(winners)}, ${plus(best)}` : 'Nobody roped it'),
          h('span', { class: 'pp num' }, h('small', {}, 'you '), mine ? plus(mine.r.points) : '0'));
      })),
      this.els.foot));
    this.paintFinal(s);
    say(`Rodeo over. ${verdict} ${lead}`);
  }

  paintFinal(s) {
    const host = s.riders.find((r) => r.seat === s.host);
    const again = this.isHost
      ? h('button', { class: 'go wide', type: 'button', id: 'rodeo-again', onclick: async (e) => {
        e.target.disabled = true;
        const qs = ctx.pickSet(await practicePool(), PER_DAY);
        this.send({ t: 'again', q: qs.map((q) => q.id) });
      } }, 'Play again')
      : h('p', { class: 'wait-line' }, host ? `${host.name} can start another round` : 'Waiting for the host');
    this.els.foot.replaceChildren(again,
      h('button', { class: 'go quiet wide', type: 'button', id: 'rodeo-leave', onclick: () => this.leave() }, 'Leave the room'),
      h('a', { class: 'go quiet wide', href: '#home', onclick: () => { this.send({ t: 'leave' }); forget(this.code); } }, 'Home'));
  }
}

async function shareRoom(code, url) {
  const text = `Join my Cinch rodeo: ${code}`;
  if (matchMedia('(pointer: coarse)').matches && navigator.share) { try { await navigator.share({ text, url }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('Link copied'); } catch { toast('Copying is blocked in this browser'); }
}

// ------------------------------------------------------------ one round, played live

class RodeoRound extends Round {
  get room() { return this.opts.room; }
  get qs() { return this.opts.qs; }

  build() {
    super.build();
    this.ui.strip = h('ol', { class: 'posse-strip', 'aria-hidden': 'true' });
    this.ui.ask.querySelector('.meta').after(this.ui.strip);
    this.ui.nextLine = h('p', { class: 'next-line', role: 'status' });
    const wrap = h('div', { class: 'on-wrap' });
    this.ui.on.replaceWith(wrap);
    wrap.append(this.ui.on, this.ui.nextLine);
    this.root.querySelector('.play').classList.add('rodeo');
  }

  destroy() {
    clearInterval(this.ticker);
    super.destroy();
  }

  /** My rows so far, one per question shown, so the pips and the question number line up. */
  myRows(upTo) {
    const table = scoreAll(this.qs, this.room.s);
    return this.qs.slice(0, upTo).map((q, i) => table[i]?.[this.room.seat]?.row || { id: q.id, cat: q.category, lo: q.min, hi: q.max, l: 0, u: 1, x: 0, hit: false, width: 1, points: 0, missing: true, at: Date.now() });
  }

  ask() {
    const s = this.room.s;
    this.i = s.i;
    this.revealed = false;
    this.sentReady = false;
    this.mine = null;
    this.moving = false;
    clearInterval(this.ticker);
    this.rows = this.myRows(s.i);
    const u = this.ui;
    u.panel.classList.remove('pair');
    u.on.disabled = false;
    u.nextLine.textContent = '';
    this.root.querySelector('.play')?.classList.remove('waiting');
    for (const side of ['low', 'high']) u[side].input.disabled = false;
    super.ask();
    const me = this.room.me;
    u.go.textContent = 'Lock it in';
    this.waitText = null;
    this.stage.setRope(ropeOf(me?.c || 0));
    this.root.querySelector('.play').style.setProperty('--seat', colorOf(me?.c || 0).color);
    ctx.paintPips(this.rows, this.qs.length);
    this.sync(s);
  }

  /** The fuse burns on the room's clock, so every rider runs out at the same moment. */
  startTimer() {
    clearInterval(this.timer);
    const fuse = this.fuse;
    fuse.start();
    const tick = () => {
      const left = Math.min(fuse.total, this.room.s.ends - this.room.serverNow());
      fuse.paint(left, { quiet: this.locked });
      if (left <= 0) { clearInterval(this.timer); this.lock(true); }
    };
    tick();
    this.timer = setInterval(tick, 100);
  }

  sync(s) {
    if (this.dead || this.moving) return;
    if (s.i !== this.i) { this.goTo(); return; }
    this.paintStrip(s);
    const me = this.room.me;
    if (s.phase === 'play') {
      if (me?.thrown && !this.locked) this.lock(true, true);
      else if (this.locked && !me?.thrown && this.mine) this.sendPick();
      if (this.locked) this.paintWait(s);
    } else if (!this.revealed && s.shown[this.i]) this.revealAll(s);
    else if (this.revealed) this.paintReady(s);
  }

  paintStrip(s) {
    const u = this.ui;
    const here = s.riders.filter((r) => !r.gone);
    u.strip.replaceChildren(...here.map((r) => h('li', { class: `${s.phase === 'play' ? (r.thrown ? 'in' : '') : r.ready ? 'in' : ''}${r.on ? '' : ' away'}${r.seat === this.room.seat ? ' me' : ''}`, style: `--c:${colorOf(r.c).color}`, title: r.name })));
    const thrown = here.filter((r) => r.thrown).length;
    u.meta.textContent = `${this.label(this.i)}${s.phase === 'play' ? ` · ${thrown} of ${here.length} thrown` : ''}`;
  }

  slideKey(e, i) { if (!this.locked) super.slideKey(e, i); }

  typed(i) { if (!this.locked) super.typed(i); }

  pick() {
    const [low, high] = this.stage.values;
    return { low, high, hint: { ...this.hint } };
  }

  /** quiet: the room already has this rider's loop (a reload mid-question), so just wait. */
  lock(timeUp, quiet) {
    if (this.locked || this.dead || this.revealed) return;
    if (!this.touched && !timeUp) return;
    this.locked = true;
    clearInterval(this.timer);
    this.fuse?.stop();
    this.showContext(false);
    const u = this.ui;
    u.go.disabled = true;
    this.paintHints();
    for (const side of ['low', 'high']) u[side].input.disabled = true;
    this.root.querySelector('.play').classList.add('waiting');
    this.stage.phase = 'wait';
    if (!quiet) {
      sound.lock();
      this.mine = this.pick();
      this.sendPick();
      if (!store.data().seenIntro) store.change((d) => { d.seenIntro = true; d.newcomer = true; });
    }
    this.paintWait(this.room.s);
  }

  sendPick() {
    const m = this.mine;
    this.room.send({ t: 'pick', i: this.i, lo: m.low, hi: m.high, fence: m.hint.fence, scout: m.hint.scout });
  }

  paintWait(s) {
    const left = s.riders.filter((r) => r.on && !r.gone && !r.thrown && r.seat !== this.room.seat).map((r) => r.name);
    const text = left.length ? `Waiting for ${listNames(left)}` : 'Everyone is in';
    if (text === this.waitText) return;
    this.waitText = text;
    this.ui.worth.replaceChildren(h('span', { class: 'wait-line' }, text, h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))));
  }

  /** Every loop is in, or time is up: score them all, show the others on the rail, and pitch. */
  revealAll(s) {
    this.revealed = true;
    this.locked = true;
    this.waitText = null;
    clearInterval(this.timer);
    this.fuse?.stop();
    this.showContext(false);
    sound.unlock();
    document.activeElement?.blur?.();
    const u = this.ui;
    u.go.disabled = true;
    u.hint.classList.add('gone');
    this.root.querySelector('.play')?.classList.remove('waiting');
    u.worth.replaceChildren('Everyone is in');
    const q = this.q;
    const picks = s.shown[this.i] || {};
    const results = s.riders.map((r) => ({ rider: r, got: picks[r.seat] ? resultOf(q, picks[r.seat]) : null }));
    const mine = results.find((x) => x.rider.seat === this.room.seat)?.got;
    this.rows = this.myRows(this.i + 1);
    if (mine) {
      const row = { ...mine.row, mode: 'rodeo', room: this.room.code };
      store.change((d) => {
        if (d.practice.rows.some((x) => x.mode === 'rodeo' && x.room === row.room && x.id === row.id)) return;
        d.practice.rows.push(row);
        d.practice.seen[q.id] = (d.practice.seen[q.id] || 0) + 1;
      });
    }
    this.paintHints();
    this.stage.setGhosts(results.filter((x) => x.got && x.rider.seat !== this.room.seat).map((x) => ({ l: x.got.r.l, u: x.got.r.u, name: x.rider.name, ...colorOf(x.rider.c) })));
    let shown = mine?.r;
    if (!shown) {
      // No loop from this rider: the posts go back to the ends of the rail and the shoe still lands.
      this.stage.setValues(q.min, q.max);
      shown = scoreRange(q.min, q.max, q.answer, rulerOf(q), [0, 1]);
      shown.points = 0;
      shown.tier = tierOf(shown).key;
    }
    this.stage.reveal(shown, { onLand: () => { if (!this.dead) this.landed(q, results, !!mine); } }).then(() => { if (!this.dead) this.settle(); });
  }

  landed(q, results, threw) {
    const u = this.ui;
    const s = this.room.s;
    u.panel.classList.add('done', 'pair');
    u.pts.textContent = '';
    const order = [...results].sort((a, b) => (b.got?.r.points ?? -1) - (a.got?.r.points ?? -1) || a.rider.seat - b.rider.seat);
    const meAt = order.findIndex((x) => x.rider.seat === this.room.seat);
    // Big rooms show the top of the list and your own line, so the panel stays short.
    const keep = order.length <= 6 ? order : order.filter((x, k) => k < 4 || k === meAt);
    const lines = keep.map((x) => {
      const t = x.got ? tierOf(x.got.r) : null;
      return h('li', { class: `rider${x.rider.seat === this.room.seat ? ' me' : ''}`, style: `--c:${colorOf(x.rider.c).color}` },
        h('span', { class: 'who' }, h('i', { class: 'dot', 'aria-hidden': 'true' }), x.rider.seat === this.room.seat ? 'You' : x.rider.name),
        t ? h('b', { class: `tier t-${t.key}` }, t.name) : h('b', { class: 'tier none' }, 'No throw'),
        h('span', { class: 'num' }, x.got ? plus(x.got.r.points) : '0'));
    });
    const list = totals(this.qs, s);
    const me = list.find((r) => r.seat === this.room.seat);
    const leader = list[0];
    const standing = !me ? '' : me.rank === 1 ? (list.filter((r) => r.rank === 1).length > 1 ? `Tied for first with ${me.total}.` : `You lead with ${me.total}.`) : `You are ${ordinal(me.rank)} of ${list.length} with ${me.total}. ${leader.name} leads with ${leader.total}.`;
    u.why.replaceChildren(...[
      h('p', { class: 'answer-line' }, withUnit(q.answer, q)),
      h('ul', { class: 'pair-res rodeo-res' }, lines),
      order.length > keep.length ? h('p', { class: 'more-riders' }, `and ${order.length - keep.length} more`) : null,
      h('p', { class: 'so-far' }, standing)].filter(Boolean));
    u.teach.textContent = q.explainer;
    u.src.replaceChildren('Source: ', h('a', { href: q.source_url, target: '_blank', rel: 'noopener noreferrer' }, q.source_name));
    u.on.textContent = this.i + 1 >= this.qs.length ? this.lastText : 'Next one';
    for (const el of [u.why, u.teach.parentElement]) { el.classList.remove('rise'); void el.offsetWidth; el.classList.add('rise'); }
    u.on.style.visibility = 'visible';
    const mineLine = threw ? `You: ${tierOf(results.find((x) => x.rider.seat === this.room.seat).got.r).name}, ${results.find((x) => x.rider.seat === this.room.seat).got.r.points} points.` : 'You did not throw.';
    say(`${withUnit(q.answer, q)}. ${mineLine} ${standing} ${q.explainer}`);
    document.dispatchEvent(new CustomEvent('round:row', { detail: this.rows }));
    clearInterval(this.ticker);
    this.ticker = setInterval(() => this.paintReady(this.room.s), 500);
    this.paintReady(s);
  }

  /** After the answer: who is ready for the next one, and how long until it starts anyway. */
  paintReady(s) {
    if (!this.revealed || s.phase !== 'show' || s.i !== this.i) return;
    const u = this.ui;
    const sec = Math.max(0, Math.ceil((s.nextAt - this.room.serverNow()) / 1000));
    const waiting = s.riders.filter((r) => r.on && !r.gone && !r.ready && r.seat !== this.room.seat).map((r) => r.name);
    const last = this.i + 1 >= this.qs.length;
    if (this.sentReady) {
      u.on.disabled = true;
      u.on.textContent = waiting.length ? `Waiting for ${listNames(waiting)}` : 'Starting';
    }
    u.nextLine.textContent = sec > 0 ? `${last ? 'Standings' : 'Next question'} in ${sec} s` : '';
  }

  advance() {
    if (!this.revealed || this.sentReady) return;
    sound.tap();
    this.sentReady = true;
    this.room.send({ t: 'next', i: this.i });
    this.paintReady(this.room.s);
  }

  /** The room moved to the next question: the old one slides away, the new one slides in. */
  goTo() {
    clearInterval(this.ticker);
    const play = this.root.querySelector('.play');
    if (reducedMotion() || !play) { this.ask(); return; }
    this.moving = true;
    play.classList.add('leaving');
    setTimeout(() => {
      if (this.dead) return;
      play.classList.remove('leaving');
      play.classList.add('entering');
      this.moving = false;
      this.ask();
      void play.offsetWidth;
      play.classList.remove('entering');
    }, 170);
  }
}
