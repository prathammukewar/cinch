// The fuse over every timed question. It smoulders, catches fire for the last stretch, and
// spits sparks through the final seconds while the count jumps and the screen edges pulse.
// Quick Draw's fuse is lit from the first second and burns down to a bundle of dynamite.
import { h, say } from './dom.js';
import { sound } from './sound.js';

const WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five'];
const SPARKS = 8;
const STICKS = '<svg viewBox="0 0 40 28" aria-hidden="true"><g class="sticks"><rect x="2" y="2" width="30" height="8" rx="4"/><rect x="2" y="18" width="30" height="8" rx="4"/><rect x="5" y="10" width="30" height="8" rx="4"/></g><rect class="tie" x="14" y="1" width="5" height="26" rx="1.5"/></svg>';

export class Fuse {
  /** dynamite: Quick Draw's look. */
  constructor(seconds, { dynamite = false } = {}) {
    this.total = seconds * 1000;
    this.dynamite = dynamite;
    // The last 5 seconds, or the last 30% of a short fuse, are the hurry.
    this.short = Math.min(5000, Math.round(this.total * 0.3 / 1000) * 1000);
    this.lit = dynamite ? Infinity : Math.max(this.short, this.total / 3);
    this.num = h('em', { class: 'secs', 'aria-hidden': 'true' });
    this.el = h('div', { class: `fuse${dynamite ? ' dynamite' : ''}`, role: 'progressbar', 'aria-label': 'Seconds left', 'aria-valuemin': '0', 'aria-valuemax': String(seconds) },
      dynamite ? h('span', { class: 'stick', html: STICKS }) : null,
      h('span', { class: 'track' }, h('i', { class: 'cord' }), h('b', { class: 'spark' }, Array.from({ length: SPARKS }, () => h('i')))),
      this.num);
  }

  /** A fresh fuse for the next question. */
  start() {
    this.shown = null;
    this.caught = false;
    this.el.classList.remove('spent', 'out', 'short', 'lit');
    this.el.parentElement?.classList.remove('hurry', 'boom');
    this.paint(this.total);
  }

  /** Draw the fuse with this many milliseconds left. quiet: no sound and no pulse, as when this rider has thrown already. */
  paint(left, { quiet = false } = {}) {
    const el = this.el;
    const play = el.parentElement;
    el.style.setProperty('--left', (Math.max(0, Math.min(this.total, left)) / this.total).toFixed(4));
    const lit = left <= this.lit;
    const short = left <= this.short && left > 0;
    el.classList.toggle('lit', lit);
    el.classList.toggle('short', short);
    if (lit && !this.caught) {
      this.caught = true;
      if (!quiet && left > 0) sound.fizz(this.dynamite);
    }
    const s = Math.max(0, Math.ceil(left / 1000));
    el.setAttribute('aria-valuenow', String(s));
    if (s !== this.shown) {
      this.shown = s;
      this.num.textContent = String(s);
      if (short) {
        this.num.classList.remove('pop');
        void this.num.offsetWidth;
        this.num.classList.add('pop');
        const from = this.short / 1000;
        if (!quiet) {
          sound.tick(1 - s / from);
          if (s === from && WORDS[s]) say(`${WORDS[s]} seconds left`);
        }
      }
    }
    play?.classList.toggle('hurry', short && !quiet);
    if (left <= 0 && !el.classList.contains('out')) {
      el.classList.add('out');
      play?.classList.remove('hurry');
      if (!quiet) {
        play?.classList.add('boom');
        sound.blast(this.dynamite);
      }
    }
  }

  /** The loop is thrown: the spark goes out where it stands. */
  stop() {
    this.el.classList.add('spent');
    this.el.parentElement?.classList.remove('hurry');
  }
}
