// Same saddle: two riders share one phone. Each ropes the question in secret, the phone
// changes hands, and one horseshoe lands for both loops. Who goes first swaps every question.
import { Round, rowOf, rulerOf } from './play.js';
import { scoreRange, tierOf } from './score.js';
import { withUnit } from './format.js';
import { h, say, plus } from './dom.js';
import { sound } from './sound.js';

/** Rider one keeps the red rope; rider two gets a blue one. */
export const ROPES = [null, { band: '#3d6ea8', bandDark: '#1f3f66', bandLite: '#9dbde3' }];
export const MARKS = [{ color: '#c23b25', dark: '#7f2112', lite: '#f08a6e' }, { color: '#3d6ea8', dark: '#1f3f66', lite: '#9dbde3' }];

export class PairRound extends Round {
  get names() { return this.opts.names; }

  ask() {
    this.pairs ||= [];
    this.passing = false;
    this.turn = 0;
    this.seat = this.rows.length % 2;
    this.picks = [];
    this.ui.panel.classList.remove('pair');
    super.ask();
    this.paintSeat();
  }

  paintSeat() {
    const u = this.ui;
    this.stage.setRope(ROPES[this.seat]);
    u.meta.textContent = `${this.label(this.rows.length)} · ${this.names[this.seat]}’s turn`;
    u.go.textContent = this.turn === 0 ? 'Lock it in' : 'Pitch the shoe';
    this.root.querySelector('.play').dataset.seat = String(this.seat);
  }

  pick() {
    const [low, high] = this.stage.values;
    return { low, high, hint: { ...this.hint }, view: this.view, mult: this.mult };
  }

  lock(timeUp) {
    if (this.locked || this.dead || this.passing) return;
    if (!this.touched && !timeUp) return;
    if (this.turn === 0) {
      clearInterval(this.timer);
      this.fuse?.stop();
      this.showContext(false);
      this.picks[this.seat] = this.pick();
      sound.lock();
      this.handOff();
      return;
    }
    this.locked = true;
    clearInterval(this.timer);
    this.fuse?.stop();
    this.showContext(false);
    this.picks[this.seat] = this.pick();
    this.revealBoth();
  }

  /** Both loops are in: score them, show the other rider's loop on the rail, and pitch. */
  revealBoth() {
    sound.unlock();
    document.activeElement?.blur?.();
    const u = this.ui;
    u.go.disabled = true;
    u.hint.classList.add('gone');
    const q = this.q;
    const results = this.picks.map((p) => {
      const r = scoreRange(p.low, p.high, q.answer, rulerOf(q), p.view);
      r.points = Math.round(r.exact * p.mult);
      r.fenced = p.hint.fence > 0;
      r.tier = tierOf(r).key;
      return r;
    });
    const pair = results.map((r, i) => rowOf(q, r, this.picks[i].low, this.picks[i].high, this.picks[i].hint, this.picks[i].mult));
    this.pairs = [...this.pairs, pair];
    const best = pair[0].points >= pair[1].points ? pair[0] : pair[1];
    this.rows = [...this.rows, best];
    this.onRow?.(pair, q);
    this.paintHints();
    const other = 1 - this.seat;
    if (!this.picks[other].missing) this.stage.setGhost({ l: results[other].l, u: results[other].u, name: this.names[other], ...MARKS[other] });
    // The show on the rail celebrates the better of the two throws.
    const shown = { ...results[this.seat], tier: tierOf(best).key };
    this.stage.reveal(shown, { onLand: () => { if (!this.dead) this.landed(q, results); } }).then(() => { if (!this.dead) this.settle(); });
  }

  handOff() {
    this.passing = true;
    const next = 1 - this.seat;
    const go = h('button', { class: 'go', type: 'button', id: 'handoff-go', onclick: () => this.takeOver(next, cover) }, `I’m ${this.names[next]}, my turn`);
    const cover = h('div', { class: 'handoff', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'handoff-title' },
      h('p', { class: 'done-line' }, `${this.names[this.seat]} has roped it.`),
      h('h2', { id: 'handoff-title' }, `Pass the phone to ${this.names[next]}`),
      go);
    this.root.querySelector('.play').append(cover);
    go.focus({ preventScroll: true });
    say(`${this.names[this.seat]} has roped it. Pass the phone to ${this.names[next]}.`);
  }

  takeOver(next, cover) {
    if (this.dead) return;
    cover.remove();
    sound.tap();
    this.passing = false;
    this.turn = 1;
    this.seat = next;
    this.touched = false;
    this.typedHigh = false;
    this.hint = { scout: false, fence: 0 };
    this.stage.setQuestion(this.q, rulerOf(this.q));
    this.paintHints();
    this.ui.go.disabled = true;
    this.show();
    this.worth();
    if (this.seconds) this.startTimer();
    this.paintSeat();
    this.ui.q.focus({ preventScroll: true });
    say(`${this.names[next]}’s turn. ${this.q.question}`);
  }

  landed(q, results) {
    const u = this.ui;
    u.panel.classList.add('done', 'pair');
    u.pts.textContent = '';
    const totals = [0, 1].map((s) => this.pairs.reduce((t, p) => t + p[s].points, 0));
    const lines = [0, 1].map((s) => {
      const t = tierOf(results[s]);
      return h('li', { class: `rider r${s}` }, h('span', { class: 'who' }, this.names[s]), h('b', { class: `tier t-${t.key}` }, t.name), h('span', { class: 'num' }, plus(results[s].points)));
    });
    u.why.replaceChildren(
      h('p', { class: 'answer-line' }, withUnit(q.answer, q)),
      h('ul', { class: 'pair-res' }, lines),
      h('p', { class: 'so-far' }, `So far: ${this.names[0]} ${totals[0]}, ${this.names[1]} ${totals[1]}`));
    u.teach.textContent = q.explainer;
    u.src.replaceChildren('Source: ', h('a', { href: q.source_url, target: '_blank', rel: 'noopener noreferrer' }, q.source_name));
    const last = this.length && this.rows.length >= this.length;
    u.on.textContent = last ? this.lastText : 'Next one';
    for (const el of [u.why, u.teach.parentElement]) { el.classList.remove('rise'); void el.offsetWidth; el.classList.add('rise'); }
    u.on.style.visibility = 'visible';
    say(`${withUnit(q.answer, q)}. ${[0, 1].map((s) => `${this.names[s]}: ${tierOf(results[s]).name}, ${results[s].points} points`).join('. ')}. ${q.explainer}`);
    document.dispatchEvent(new CustomEvent('round:row', { detail: this.rows }));
  }
}
