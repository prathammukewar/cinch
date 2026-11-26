// One round of questions, shared by every mode.
import { Stage, quickerReveals } from './stage.js';
import { sound } from './sound.js';
import { scoreRange, toUnit, tierOf, PERFECT, HINTS } from './score.js';
import { num, withUnit, parse } from './format.js';
import { h, $, say, reducedMotion, plus } from './dom.js';
import { store } from './store.js';

const PRE = { 'US dollars': '$' };
const SUF = { '%': '%', '°C': '°C', '°F': '°F' };

export const rulerOf = (q) => ({ min: q.min, max: q.max, scale: q.scale });

export { HINTS };
export const DIFFICULTY = { 1: 'Tenderfoot', 2: 'Wrangler', 3: 'Trail boss' };
const multiplier = (h) => (h.scout ? HINTS.scout : 1) * HINTS.fence[h.fence];

/** What gets saved for one answered question. */
export function rowOf(q, r, low, high, hints) {
  const row = { id: q.id, cat: q.category, lo: low, hi: high, l: r5(r.l), u: r5(r.u), x: r5(r.x), hit: r.hit, width: r5(r.width), points: r.points, at: Date.now() };
  if (hints && (hints.scout || hints.fence)) row.hints = { ...hints };
  return row;
}
const r5 = (v) => Math.round(v * 1e5) / 1e5;

export class Round {
  /**
   * next(i) -> question or null, rows: already answered rows,
   * label(i) -> text at the top, onRow(row, q), onEnd(rows), seconds: time limit per question
   */
  constructor(root, opts) {
    const { next, rows = [], length = 0, label, onRow, onEnd, lastText = 'See your roundup', seconds = 0, quickNext = false } = opts;
    Object.assign(this, { root, next, rows, length, label, onRow, onEnd, lastText, seconds, quickNext, opts });
    this.isRound = true;
    this.build();
    this.ask();
  }

  destroy() {
    this.dead = true;
    clearInterval(this.timer);
    this.stage?.destroy();
    document.removeEventListener('keydown', this.onKey);
  }

  build() {
    this.ui = {};
    const u = this.ui;
    const end = (side, text) => {
      const input = h('input', { type: 'text', inputmode: 'decimal', autocomplete: 'off', spellcheck: 'false', id: `${side}-value`, class: 'num', enterkeyhint: 'done' });
      const pre = h('span', { class: 'pre', 'aria-hidden': 'true' });
      const suf = h('span', { class: 'suf', 'aria-hidden': 'true' });
      u[side] = { input, pre, suf };
      const field = h('div', { class: 'field', onclick: (e) => { if (e.target !== input) input.focus(); } }, pre, input, suf);
      return h('div', { class: `end ${side}` }, h('label', { for: `${side}-value` }, text), field);
    };
    u.meta = h('span');
    u.tag = h('span');
    u.q = h('h1', { tabindex: '-1' });
    u.note = h('p', { class: 'note' });
    u.canvas = h('canvas', { 'aria-hidden': 'true' });
    u.hint = h('p', { class: 'hint gone' });
    u.thumbs = ['Low post', 'High post'].map((name, i) => h('div', { class: 'thumb', role: 'slider', tabindex: '0', 'aria-label': name, 'data-i': String(i) }));
    u.worth = h('p', { class: 'worth', 'aria-live': 'off' });
    u.scout = h('button', { class: 'chip help', type: 'button', id: 'hint-scout', onclick: () => this.useScout() });
    u.fence = h('button', { class: 'chip help', type: 'button', id: 'hint-fence', onclick: () => this.useFence() });
    u.hints = h('div', { class: 'helps', role: 'group', 'aria-label': 'Hints' }, u.fence, u.scout);
    u.go = h('button', { class: 'go', type: 'button', id: 'drop', onclick: () => this.lock() }, 'Pitch the shoe');
    u.pts = h('div', { class: 'pts num' });
    u.why = h('div', { class: 'why' });
    u.teach = h('p', { class: 'teach' });
    u.src = h('p', { class: 'src' });
    u.on = h('button', { class: 'go', type: 'button', id: 'next', onclick: () => this.advance() }, 'Next one');
    u.panel = h('section', { class: 'panel', 'aria-label': 'Your range' },
      h('div', { class: 'before' }, h('div', { class: 'ends' }, end('low', 'Low'), end('high', 'High')), u.worth, u.go),
      h('div', { class: 'after' }, h('div', { class: 'verdict' }, u.pts, u.why), h('div', { class: 'teach-wrap' }, u.teach, u.src), u.on));
    u.timer = this.seconds ? h('div', { class: 'fuse', role: 'progressbar', 'aria-label': 'Seconds left', 'aria-valuemin': '0', 'aria-valuemax': String(this.seconds) }, h('i'), h('b')) : null;
    u.ask = h('section', { class: 'ask', 'aria-label': 'Question' }, h('div', { class: 'meta' }, u.meta, u.tag), u.q, u.note);
    const desk = h('div', { class: 'desk' }, u.canvas, u.hint, u.hints, u.thumbs);
    this.root.replaceChildren(h('div', { class: 'play' }, u.timer, u.ask, desk, u.panel));

    this.stage = new Stage(u.canvas, {
      reduced: reducedMotion(),
      sound,
      onChange: (values, t) => this.changed(values, t),
      onGrab: () => { this.touched = true; u.hint.classList.add('gone'); sound.unlock(); document.activeElement?.blur?.(); },
    });

    for (const [i, side] of ['low', 'high'].entries()) {
      const { input } = u[side];
      input.addEventListener('focus', () => { input.select(); });
      input.addEventListener('input', () => { fitWidth(input); this.typed(i); });
      input.addEventListener('blur', () => { input.classList.remove('bad'); this.show(); });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); this.touch(); this.stage.nudge(i, e.key === 'ArrowUp' ? 1 : -1); this.show(); }
        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (i === 0 && !this.typedHigh) u.high.input.focus(); else { input.blur(); u.go.focus(); } }
      });
      u.thumbs[i].addEventListener('keydown', (e) => this.slideKey(e, i));
    }
    this.onKey = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (this.stage.phase === 'reveal' && (e.key === ' ' || e.key === 'Enter')) {
        if (!this.stage.landed) { e.preventDefault(); this.stage.skip(); }
      }
    };
    document.addEventListener('keydown', this.onKey);
  }

  ask() {
    const q = this.next(this.rows.length);
    if (!q) { this.onEnd?.(this.rows); return; }
    const u = this.ui;
    this.q = q;
    this.locked = false;
    this.touched = false;
    this.hint = { scout: false, fence: 0 };
    this.typedHigh = false;
    u.panel.classList.remove('done');
    u.meta.textContent = this.label(this.rows.length);
    u.tag.textContent = `${q.category} \u00b7 ${DIFFICULTY[q.difficulty] || ''}`;
    u.q.textContent = q.question;
    u.ask.classList.toggle('long', q.question.length > 78);
    u.ask.classList.toggle('longer', q.question.length > 95);
    const said = q.unit && q.question.toLowerCase().includes(q.unit.toLowerCase().split(' ')[0].replace(/s$/, ''));
    u.note.textContent = [q.unit && q.unit !== 'year' && !said && !PRE[q.unit] && !SUF[q.unit] ? `Answer in ${q.unit}.` : '', q.as_of ? `${q.as_of}.` : ''].filter(Boolean).join(' ');
    for (const side of ['low', 'high']) {
      u[side].pre.textContent = PRE[q.unit] || '';
      u[side].suf.textContent = SUF[q.unit] || '';
      u[side].input.setAttribute('aria-label', `${side === 'low' ? 'Low' : 'High'} end${q.unit ? `, in ${q.unit}` : ''}`);
    }
    const teach = !store.data().seenIntro && this.rows.length === 0;
    const second = store.data().newcomer && this.rows.length === 1;
    u.hint.textContent = teach ? 'Pull the two posts in until you are 90% sure the answer is between them.' : second ? 'A tighter loop is worth more, but its points fade faster outside it.' : '';
    u.hint.classList.toggle('gone', !teach && !second);
    quickerReveals(this.rows.length >= 2);
    this.stage.setQuestion(q, rulerOf(q));
    this.paintHints();
    u.go.disabled = true;
    this.show();
    this.worth();
    if (this.seconds) this.startTimer();
    this.nudged = false;
    if (this.rows.length) u.q.focus({ preventScroll: true });
    say(`${u.meta.textContent}. ${q.question} ${u.note.textContent}`);
  }

  startTimer() {
    clearInterval(this.timer);
    const fuse = this.ui.timer;
    const total = this.seconds * 1000;
    let left = total;
    let last = performance.now();
    let lastTick = null;
    const tick = () => {
      const now = performance.now();
      if (!document.hidden) left -= now - last;
      last = now;
      const f = Math.max(0, left) / total;
      fuse.style.setProperty('--left', f.toFixed(4));
      fuse.classList.toggle('short', left < 5000);
      const s = Math.ceil(left / 1000);
      fuse.setAttribute('aria-valuenow', String(Math.max(0, s)));
      if (left < 5000 && s !== lastTick && s > 0) { lastTick = s; sound.tick(1 - s / 5); if (s === 5) say('Five seconds left'); }
      if (left <= 0) { clearInterval(this.timer); this.lock(true); }
    };
    tick();
    this.timer = setInterval(tick, 100);
  }

  touch() { this.touched = true; this.ui.hint.classList.add('gone'); }

  slideKey(e, i) {
    const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
    const big = { PageUp: 0.1, PageDown: -0.1 }[e.key];
    if (step) {
      e.preventDefault(); this.touch();
      if (e.shiftKey) this.stage.movePeg(i, this.stage.t[i] + step * 0.05); else this.stage.nudge(i, step);
    } else if (big) { e.preventDefault(); this.touch(); this.stage.movePeg(i, this.stage.t[i] + big); } else if (e.key === 'Home') { e.preventDefault(); this.touch(); this.stage.movePeg(i, i === 0 ? 0 : this.stage.t[0]); } else if (e.key === 'End') { e.preventDefault(); this.touch(); this.stage.movePeg(i, i === 1 ? 1 : this.stage.t[1]); } else if (e.key === 'Enter') { e.preventDefault(); this.lock(); }
  }

  typed(i) {
    const u = this.ui;
    const side = i === 0 ? 'low' : 'high';
    const v = parse(u[side].input.value);
    const ok = v !== null && (this.q.scale !== 'log' || v > 0);
    u[side].input.classList.toggle('bad', !ok && u[side].input.value.trim() !== '');
    if (!ok) return;
    if (i === 1) this.typedHigh = true;
    this.touch();
    const other = this.stage.values[1 - i];
    const c = Math.min(this.q.max, Math.max(this.q.min, v));
    this.editing = side;
    // While one end is being typed the other stays put. Crossed ends swap on their own.
    if ((i === 0 && c <= other) || (i === 1 && c >= other)) this.stage.setValues(i === 0 ? c : other, i === 0 ? other : c);
    this.editing = null;
  }

  changed(values, t) {
    if (!this.frameQueued) {
      this.frameQueued = true;
      requestAnimationFrame(() => { this.frameQueued = false; if (!this.dead) this.show(); });
    }
    const u = this.ui;
    this.placeThumbs();
    if (this.touched) u.go.disabled = false;
    this.worth();
    if (!this.nudged && !store.data().seenIntro && this.rows.length === 0 && t[1] - t[0] < 0.12) {
      this.nudged = true;
      u.hint.textContent = 'Most people make their first loop too tight. Ninety percent sure means you would be surprised to miss.';
      u.hint.classList.remove('gone');
    }
  }

  show() {
    const u = this.ui;
    const vals = this.stage.values;
    const longest = Math.max(...vals.map((v) => num(v, this.q).length));
    const spread = this.stage.t[1] - this.stage.t[0];
    ['low', 'high'].forEach((side, i) => {
      const text = num(vals[i], this.q);
      const { input } = u[side];
      if (document.activeElement !== input) input.value = text;
      // Numbers stretch with the band: wide when it is slack, narrow when it is tight.
      const room = Math.max(90, (input.parentElement.clientWidth || 150) - (PRE[this.q.unit] || SUF[this.q.unit] ? 26 : 2));
      const full = matchMedia('(min-width: 760px)').matches ? 46 : 34;
      const fits = room / (Math.max(3, longest) * full * 0.0064);
      const wide = Math.max(50, Math.min(128, 62 + spread * 66, fits));
      input.style.setProperty('--w', `${wide.toFixed(1)}%`);
      input.style.fontSize = `${Math.max(18, Math.min(full, full * (fits / 50))).toFixed(1)}px`;
      fitWidth(input);
      const el = u.thumbs[i];
      el.setAttribute('aria-valuemin', '0');
      el.setAttribute('aria-valuemax', '100');
      el.setAttribute('aria-valuenow', String(Math.round(this.stage.t[i] * 100)));
      el.setAttribute('aria-valuetext', withUnit(vals[i], this.q));
    });
    this.placeThumbs();
  }

  /** Keyboard targets sit over the peg grips, so the focus ring circles the grip. */
  placeThumbs() {
    const st = this.stage;
    if (!st.w) return;
    const spread = Math.max(0, (st.pegW + 10 - (st.x(st.t[1]) - st.x(st.t[0]))) / 2);
    this.ui.thumbs.forEach((el, i) => {
      el.style.left = `${st.x(st.t[i]) + (i ? spread : -spread)}px`;
      el.style.top = `${st.top - st.post - st.pegH / 2 - 5}px`;
      el.style.height = `${st.pegH + 10}px`;
    });
  }

  paintHints() {
    const u = this.ui;
    const q = this.q;
    const pct = (m) => `\u2212${Math.round((1 - m) * 100)}%`;
    const f = this.hint.fence;
    u.fence.hidden = !q.trims?.length;
    u.fence.disabled = f >= 2 || this.locked;
    u.fence.textContent = f >= 2 ? 'Fenced in' : f === 1 ? `Fence in more ${pct(HINTS.fence[2])}` : `Fence in ${pct(HINTS.fence[1])}`;
    u.fence.setAttribute('aria-label', f >= 2 ? 'Fenced in twice' : `Fence in: shorten the rail around the answer. You keep ${Math.round(HINTS.fence[f + 1] * 100)}% of the points`);
    u.scout.hidden = !q.marks?.length;
    u.scout.disabled = this.hint.scout || this.locked;
    u.scout.textContent = this.hint.scout ? 'Scouted' : `Scout ${pct(HINTS.scout)}`;
    u.scout.setAttribute('aria-label', this.hint.scout ? 'Scouted' : 'Scout: mark known numbers of the same kind on the rail. Costs 15% of the points');
  }

  useScout() {
    if (this.hint.scout || this.locked || !this.q.marks?.length) return;
    this.hint.scout = true;
    sound.tap();
    this.stage.setLandmarks(this.q.marks);
    this.paintHints();
    this.worth();
    say(`Landmarks: ${this.q.marks.map((m) => `${m.label}, ${withUnit(m.value, this.q)}`).join('; ')}`);
  }

  useFence() {
    const f = this.hint.fence;
    if (f >= 2 || this.locked || !this.q.trims?.[f]) return;
    this.hint.fence = f + 1;
    sound.release(0.4);
    this.stage.trimTo(...this.q.trims[f]);
    this.touch();
    this.paintHints();
    this.worth();
    say('The rail is shorter now, and the answer is still on it.');
  }

  get mult() { return multiplier(this.hint); }

  /** The stretch of the rail still showing, as shares of the full rail. Loops are measured against it. */
  get view() { return this.hint.fence ? this.q.trims[this.hint.fence - 1] : [0, 1]; }

  worth() {
    const [a, b] = this.view;
    const [l, u2] = this.stage.values.map((v) => Math.min(1, Math.max(0, (toUnit(v, rulerOf(this.q)) - a) / (b - a))));
    const base = Math.round(PERFECT * (1 - (u2 - l)));
    const m = this.mult;
    const w = Math.round(base * m);
    this.stage.worthNow = (1 - (u2 - l)) * m;
    const el = this.ui.worth;
    const key = `${this.touched}|${w}|${m}`;
    if (key === this.worthKey) return;
    this.worthKey = key;
    if (!this.touched) { el.replaceChildren('Drag the posts, or tap a number to type it.'); return; }
    el.replaceChildren(h('b', { class: 'num' }, plus(w)), m < 1 ? ` if it lands inside (${Math.round(m * 100)}% with hints)` : ' if it lands inside', h('span', { class: 'cost' }, 'Fades to nothing just outside. The tighter the loop, the faster.'));
  }

  lock(timeUp) {
    if (this.locked || this.dead) return;
    if (!this.touched && !timeUp) return;
    this.locked = true;
    clearInterval(this.timer);
    sound.unlock();
    document.activeElement?.blur?.();
    const u = this.ui;
    u.go.disabled = true;
    u.hint.classList.add('gone');
    const [low, high] = this.stage.values;
    const q = this.q;
    const r = scoreRange(low, high, q.answer, rulerOf(q), this.view);
    r.points = Math.round(r.exact * this.mult);
    r.fenced = this.hint.fence > 0;
    r.tier = tierOf(r).key;
    const row = rowOf(q, r, low, high, this.hint);
    this.paintHints();
    this.rows = [...this.rows, row];
    this.onRow?.(row, q, this.rows);
    if (!store.data().seenIntro) store.change((d) => { d.seenIntro = true; d.newcomer = true; });
    this.stage.reveal(r, { onLand: () => { if (!this.dead) this.landed(q, r, row); } }).then(() => { if (!this.dead) this.settle(); });
  }

  landed(q, r) {
    const u = this.ui;
    u.panel.classList.add('done');
    const tier = tierOf(r);
    const label = tier.name;
    u.pts.className = `pts num t-${tier.key}`;
    u.why.replaceChildren(h('b', { class: `tier t-${tier.key}` }, label), explain(q, r, this.rows[this.rows.length - 1].lo, this.rows[this.rows.length - 1].hi));
    u.teach.textContent = q.explainer;
    u.src.replaceChildren('Source: ', h('a', { href: q.source_url, target: '_blank', rel: 'noopener noreferrer' }, q.source_name));
    const last = this.length && this.rows.length >= this.length;
    u.on.textContent = last ? this.lastText : 'Next one';
    for (const el of [u.why, u.teach.parentElement]) { el.classList.remove('rise'); void el.offsetWidth; el.classList.add('rise'); }
    if (!r.hit && !store.data().sawMiss) {
      store.change((d) => { d.sawMiss = true; });
      u.hint.textContent = 'A 90% range should miss about one question in ten. Wider loops are safer.';
      u.hint.classList.remove('gone');
    }
    u.on.style.visibility = 'visible';
    this.count(r.points);
    say(`${withUnit(q.answer, q)}. ${label}. ${r.points} points. ${q.explainer}`);
    document.dispatchEvent(new CustomEvent('round:row', { detail: this.rows }));
  }

  settle() { this.ui.on.focus({ preventScroll: true }); }

  count(to) {
    const el = this.ui.pts;
    if (reducedMotion()) { el.textContent = plus(to); return; }
    const t0 = performance.now();
    const dur = 420 + Math.min(500, Math.abs(to) * 3);
    let lastShown = null;
    const step = (now) => {
      if (this.dead) return;
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      const v = Math.round(to * e);
      if (v !== lastShown) { el.textContent = plus(v); if (to > 0 && v % 5 === 0) sound.count(v / 5); lastShown = v; }
      el.style.fontStretch = `${84 + 34 * Math.sin(Math.PI * e) * (to > 0 ? 1 : -0.6)}%`;
      if (t < 1) requestAnimationFrame(step); else el.style.fontStretch = '';
    };
    el.textContent = '0';
    requestAnimationFrame(step);
  }

  advance() {
    if (!this.locked || this.moving) return;
    sound.tap();
    if (this.length && this.rows.length >= this.length) { this.onEnd?.(this.rows); return; }
    if (reducedMotion()) { this.ask(); return; }
    // The old question slides away, the new one slides in from the right.
    const play = this.root.querySelector('.play');
    this.moving = true;
    play.classList.add('leaving');
    setTimeout(() => {
      this.moving = false;
      if (this.dead) return;
      play.classList.remove('leaving');
      play.classList.add('entering');
      this.ask();
      void play.offsetWidth;
      play.classList.remove('entering');
    }, 170);
  }
}

/** A number box as wide as its number, so a $ or % sits right against the digits. */
function fitWidth(input) { input.style.width = `${Math.max(1, input.value.length) + 0.35}ch`; }

/** One short line on where the points came from. */
export function explain(q, r, low, high) {
  const cover = Math.round(r.width * 100);
  if (r.hit) return `Your loop covered ${cover}% of the ${r.fenced ? 'fenced ' : ''}rail`;
  const edge = r.side < 0 ? Math.min(low, high) : Math.max(low, high);
  if (q.scale === 'log' && edge > 0) {
    const k = r.side < 0 ? edge / q.answer : q.answer / edge;
    const times = k >= 10 ? Math.round(k) : k.toFixed(1);
    return r.side < 0 ? `Your range was ${times}\u00d7 too high` : `Your range was ${times}\u00d7 too low`;
  }
  const off = withUnit(Math.abs(q.answer - edge), q.unit === 'year' ? { unit: 'years' } : q);
  return r.side < 0 ? `It was ${off} below your range` : `It was ${off} above your range`;
}
