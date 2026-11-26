// Side by side: two riders on two devices rope the same questions at the same time.
// A room on the standings server passes each loop to the other rider once both have roped.
import { Round, HINTS } from './play.js';
import { PairRound, ROPES } from './pair.js';
import { h, say } from './dom.js';
import { sound } from './sound.js';
import { api } from './result.js';

const POLL = 1200;
const PATIENCE = 45000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Talk to the room server. Throws with .status on a refusal and 'offline' when there is no server. */
export async function call(path, body) {
  const base = api();
  if (!base) { const e = new Error('offline'); e.status = 0; throw e; }
  const res = await fetch(`${base}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'server'); e.status = res.status; throw e; }
  return data;
}

export class LiveRound extends PairRound {
  get room() { return this.opts.room; }

  ask() {
    this.pairs ||= [];
    this.passing = false;
    this.waiting = false;
    this.turn = 1;
    this.seat = this.room.seat;
    this.picks = [];
    this.gaveUp = false;
    this.worthKey = null;
    this.ui.panel.classList.remove('pair');
    this.root.querySelector('.play')?.classList.remove('waiting');
    for (const side of ['low', 'high']) this.ui[side].input.disabled = false;
    Round.prototype.ask.call(this);
    this.paintSeat();
  }

  paintSeat() {
    const u = this.ui;
    this.stage.setRope(ROPES[this.seat]);
    u.meta.textContent = `${this.label(this.rows.length)} · vs ${this.names[1 - this.seat]}`;
    u.go.textContent = 'Lock it in';
    this.root.querySelector('.play').dataset.seat = String(this.seat);
  }

  slideKey(e, i) { if (!this.waiting) super.slideKey(e, i); }

  typed(i) { if (!this.waiting) super.typed(i); }

  lock(timeUp) {
    if (this.locked || this.dead) return;
    if (!this.touched && !timeUp) return;
    this.locked = true;
    this.waiting = true;
    clearInterval(this.timer);
    const i = this.rows.length;
    const mine = this.pick();
    this.picks[this.seat] = mine;
    this.stage.phase = 'wait';
    sound.lock();
    const u = this.ui;
    u.go.disabled = true;
    this.paintHints();
    for (const side of ['low', 'high']) u[side].input.disabled = true;
    this.root.querySelector('.play').classList.add('waiting');
    const other = this.names[1 - this.seat];
    this.waitLine(`Waiting for ${other}`);
    say(`Locked in. Waiting for ${other}.`);
    this.exchange(i, mine);
  }

  waitLine(text, extra) {
    this.ui.worth.replaceChildren(h('span', { class: 'wait-line' }, text, h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'))), extra || '');
  }

  async exchange(i, mine) {
    const { code, token } = this.room;
    const q = this.q;
    // Send this loop until the server has it. The other rider's loop only comes back after that.
    for (let tries = 0; !this.dead; tries++) {
      try {
        await call(`/v1/room/${code}/pick`, { token, i, lo: mine.low, hi: mine.high, fence: mine.hint.fence, scout: mine.hint.scout });
        break;
      } catch (e) {
        if (e.status === 404) { this.lost('This room has closed.'); return; }
        if (tries === 2) this.waitLine('Connection trouble. Trying again');
        await sleep(POLL);
      }
    }
    const started = Date.now();
    let offered = false;
    while (!this.dead && this.q === q) {
      try {
        const s = await call(`/v1/room/${code}?token=${encodeURIComponent(token)}`);
        const p = s.picks.find((x) => x.seat !== this.seat && x.i === i);
        if (p) { this.arrive(p); return; }
      } catch (e) {
        if (e.status === 404) { this.lost('This room has closed.'); return; }
      }
      if (this.gaveUp) { this.arrive(null); return; }
      if (!offered && Date.now() - started > PATIENCE) {
        offered = true;
        const other = this.names[1 - this.seat];
        this.waitLine(`Still waiting for ${other}`, h('button', { class: 'chip', type: 'button', id: 'stop-waiting', onclick: () => { this.gaveUp = true; } }, 'Go on without them'));
      }
      await sleep(POLL);
    }
  }

  /** The other rider's loop is in, or they left and count as a loop around the whole rail. */
  arrive(p) {
    if (this.dead) return;
    const q = this.q;
    const other = 1 - this.seat;
    if (p) {
      const hint = { fence: p.fence, scout: !!p.scout };
      this.picks[other] = { low: p.lo, high: p.hi, hint, view: hint.fence ? q.trims[hint.fence - 1] : [0, 1], mult: (hint.scout ? HINTS.scout : 1) * HINTS.fence[hint.fence] };
    } else {
      this.picks[other] = { low: q.min, high: q.max, hint: { fence: 0, scout: false }, view: [0, 1], mult: 1, missing: true };
    }
    this.waiting = false;
    this.root.querySelector('.play')?.classList.remove('waiting');
    this.revealBoth();
  }

  lost(text) {
    this.waiting = false;
    this.waitLine(text, h('a', { class: 'chip', href: '#duel' }, 'Back to Showdown'));
    say(text);
  }
}
