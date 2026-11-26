// One round of questions, shared by every mode.
import { Stage } from './stage.js';
import { sound } from './sound.js';
import { scoreRange, toUnit, TIGHT } from './score.js';
import { num, withUnit, parse } from './format.js';
import { h, $, say, reducedMotion, plus } from './dom.js';
import { store } from './store.js';

const PRE = { 'US dollars': '$' };
const SUF = { '%': '%', '°C': '°C', '°F': '°F' };

export const rulerOf = (q) => ({ min: q.min, max: q.max, scale: q.scale });

/** What gets saved for one answered question. */
export function rowOf(q, r, low, high) {
  return { id: q.id, cat: q.category, lo: low, hi: high, l: r5(r.l), u: r5(r.u), x: r5(r.x), hit: r.hit, width: r5(r.width), points: r.points, at: Date.now() };
}
const r5 = (v) => Math.round(v * 1e5) / 1e5;

export class Round {
  /**
   * next(i) -> question or null, rows: already answered rows,
   * label(i) -> text at the top, onRow(row, q), onEnd(rows), seconds: time limit per question
   */
  constructor(root, { next, rows = [], length = 0, label, onRow, onEnd, lastText = 'See how you did', seconds = 0, quickNext = false }) {
    Object.assign(this, { root, next, rows, length, label, onRow, onEnd, lastText, seconds, quickNext });
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
      return h('div', { class: `end ${side}` }, h('label', { for: `${side}-value` }, text), h('div', { class: 'field' }, pre, input, suf));
    };
    u.meta = h('span');
    u.tag = h('span');
    u.q = h('h1', { tabindex: '-1' });
    u.note = h('p', { class: 'note' });
    u.canvas = h('canvas', { 'aria-hidden': 'true' });
    u.hint = h('p', { class: 'hint gone' });
    u.thumbs = ['Low end', 'High end'].map((name, i) => h('div', { class: 'thumb', role: 'slider', tabindex: '0', 'aria-label': name, 'data-i': String(i) }));
    u.worth = h('p', { class: 'worth', 'aria-live': 'off' });
    u.go = h('button', { class: 'go', type: 'button', id: 'drop', onclick: () => this.lock() }, 'Drop the pin');
    u.pts = h('div', { class: 'pts num' });
    u.why = h('div', { class: 'why' });
    u.teach = h('p', { class: 'teach' });
    u.src = h('p', { class: 'src' });
    u.on = h('button', { class: 'go', type: 'button', id: 'next', onclick: () => this.advance() }, 'Next');
    u.panel = h('section', { class: 'panel', 'aria-label': 'Your range' },
      h('div', { class: 'before' }, h('div', { class: 'ends' }, end('low', 'Low'), end('high', 'High')), u.worth, u.go),
      h('div', { class: 'after' }, h('div', { class: 'verdict' }, u.pts, u.why), h('div', { class: 'teach-wrap' }, u.teach, u.src), u.on));
    u.timer = this.seconds ? h('div', { class: 'timer', 'aria-hidden': 'true' }, h('i')) : null;
    u.ask = h('section', { class: 'ask', 'aria-label': 'Question' }, h('div', { class: 'meta' }, u.meta, u.tag), u.q, u.note);
    const desk = h('div', { class: 'desk' }, u.canvas, u.hint, u.thumbs);
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
      input.addEventListener('input', () => this.typed(i));
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
    this.typedHigh = false;
    u.panel.classList.remove('done');
    u.meta.textContent = this.label(this.rows.length);
    u.tag.textContent = q.category;
    u.q.textContent = q.question;
    u.ask.classList.toggle('long', q.question.length > 78);
    const said = q.unit && q.question.toLowerCase().includes(q.unit.toLowerCase().split(' ')[0].replace(/s$/, ''));
    u.note.textContent = [q.unit && q.unit !== 'year' && !said && !PRE[q.unit] && !SUF[q.unit] ? `Answer in ${q.unit}.` : '', q.as_of ? `${q.as_of}.` : ''].filter(Boolean).join(' ');
    for (const side of ['low', 'high']) {
      u[side].pre.textContent = PRE[q.unit] || '';
      u[side].suf.textContent = SUF[q.unit] || '';
      u[side].input.setAttribute('aria-label', `${side === 'low' ? 'Low' : 'High'} end${q.unit ? `, in ${q.unit}` : ''}`);
    }
    u.ask.classList.remove('rise'); void u.ask.offsetWidth; u.ask.classList.add('rise');
    const teach = !store.data().seenIntro && this.rows.length === 0;
    const second = store.data().newcomer && this.rows.length === 1;
    u.hint.textContent = teach ? 'Slide both pegs in until you are 90% sure the answer is between them.' : second ? 'Tighter is worth more. A miss costs 20 points for every 1% of the ruler.' : '';
    u.hint.classList.toggle('gone', !teach && !second);
    this.stage.setQuestion(q, rulerOf(q));
    u.go.disabled = true;
    this.show();
    this.worth();
    if (this.seconds) this.startTimer();
    if (this.rows.length) u.q.focus({ preventScroll: true });
    say(`${u.meta.textContent}. ${q.question} ${u.note.textContent}`);
  }

  startTimer() {
    clearInterval(this.timer);
    const bar = this.ui.timer.firstChild;
    const end = performance.now() + this.seconds * 1000;
    const tick = () => {
      const left = Math.max(0, end - performance.now()) / (this.seconds * 1000);
      bar.style.transform = `scaleX(${left})`;
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
    this.show();
    const u = this.ui;
    this.placeThumbs();
    if (this.touched) u.go.disabled = false;
    this.worth();
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

  worth() {
    const [l, u2] = this.stage.values.map((v) => toUnit(v, rulerOf(this.q)));
    const w = Math.round(100 - 100 * (u2 - l));
    const el = this.ui.worth;
    if (!this.touched) { el.replaceChildren('Drag the pegs, or tap a number to type it.'); return; }
    el.replaceChildren(h('b', { class: 'num' }, plus(w)), ' if the answer is inside', h('span', { class: 'cost' }, '\u221220 for every 1% of the ruler it misses by'));
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
    const r = scoreRange(low, high, q.answer, rulerOf(q));
    const row = rowOf(q, r, low, high);
    this.rows = [...this.rows, row];
    this.onRow?.(row, q, this.rows);
    if (!store.data().seenIntro) store.change((d) => { d.seenIntro = true; d.newcomer = true; });
    this.stage.reveal(r, { onLand: () => { if (!this.dead) this.landed(q, r, row); } }).then(() => { if (!this.dead) this.settle(); });
  }

  landed(q, r) {
    const u = this.ui;
    u.panel.classList.add('done');
    u.pts.classList.toggle('miss', r.points < 0);
    const label = r.hit ? (r.width <= TIGHT ? 'Tight catch' : 'Caught') : r.side < 0 ? 'Below your range' : 'Above your range';
    u.why.replaceChildren(h('b', {}, label), explain(q, r));
    u.teach.textContent = q.explainer;
    u.src.replaceChildren('Source: ', h('a', { href: q.source_url, target: '_blank', rel: 'noopener noreferrer' }, q.source_name));
    const last = this.length && this.rows.length >= this.length;
    u.on.textContent = last ? this.lastText : 'Next question';
    for (const el of [u.why, u.teach.parentElement]) { el.classList.remove('rise'); void el.offsetWidth; el.classList.add('rise'); }
    if (!r.hit && !store.data().sawMiss) {
      store.change((d) => { d.sawMiss = true; });
      u.hint.textContent = 'A 90% range should miss about one question in ten. Misses cost the most when you were sure.';
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
    if (!this.locked) return;
    if (this.length && this.rows.length >= this.length) { this.onEnd?.(this.rows); return; }
    this.ask();
  }
}

/** One short line on where the points came from. */
export function explain(q, r) {
  const cover = Math.round(r.width * 100);
  if (r.hit) return `You covered ${cover}% of the ruler`;
  const by = r.gap * 100;
  const gap = by < 0.1 ? 'under 0.1%' : by < 10 ? `${by.toFixed(1)}%` : `${Math.round(by)}%`;
  return `Missed by ${gap} of the ruler`;
}
