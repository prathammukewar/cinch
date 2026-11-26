// The corral: a fence rail, two posts, a lasso, and the horseshoe that lands on the answer.
import { Spring, clamp, lerp, easeOut, easeIn } from './spring.js';
import { palette, fit, bandPath, strokeRubber, drawPin, drawPeg, drawRuler, dimension, tag, pointsBand, DISPLAY, TEXT } from './draw.js';
import { ticks, short, withUnit, friendly, sig } from './format.js';
import { toUnit, fromUnit, FADE } from './score.js';

let SWEEP = 1.3; // seconds the shoe hunts along the rail; shorter once the player knows the game
export function quickerReveals(on) { SWEEP = on ? 0.85 : 1.3; }
const HOLD = 0.14;
const FALL = 0.13;

export class Stage {
  constructor(canvas, { onChange, onGrab, sound, reduced }) {
    this.canvas = canvas;
    this.onChange = onChange;
    this.onGrab = onGrab;
    this.sound = sound;
    this.reduced = reduced;
    this.pal = palette();
    this.t = [0, 1];
    this.values = [null, null];
    this.lean = [new Spring(0, { k: 160, d: 9 }), new Spring(0, { k: 160, d: 9 })];
    this.press = [new Spring(0, { k: 420, d: 18 }), new Spring(0, { k: 420, d: 18 })];
    this.sag = new Spring(60, { k: 120, d: 8 });
    this.sway = new Spring(0, { k: 90, d: 7 });
    this.modes = [0, 1, 2].map((i) => new Spring(0, { k: 260 * (i + 1) ** 2, d: 5 + i * 3 }));
    this.back = [0, 1, 2].map((i) => new Spring(0, { k: 230 * (i + 1) ** 2, d: 6 + i * 3 }));
    this.pinWobble = new Spring(0, { k: 520, d: 7 });
    this.quake = new Spring(0, { k: 700, d: 18 });
    this.dots = [];
    this.rings = [];
    this.active = -1;
    this.phase = 'set';
    this.drags = new Map();
    this.running = false;
    this.last = 0;
    this.frame = this.frame.bind(this);
    this.bind();
    this.observer = new ResizeObserver(() => this.layout());
    this.observer.observe(canvas);
    this.layout();
  }

  destroy() {
    this.observer.disconnect();
    this.abort?.abort();
    this.running = false;
    this.dead = true;
  }

  // ------------------------------------------------------------ layout

  layout() {
    const { ctx, w, h } = fit(this.canvas);
    if (!w || !h) return;
    this.ctx = ctx; this.w = w; this.h = h;
    const big = w > 620;
    this.pad = big ? 44 : 30;
    this.rulerH = big ? 84 : 72;
    this.top = h - this.rulerH - 4;
    const room = this.top;
    this.post = clamp(room * 0.52, 92, 190); // peg height above the rule
    this.pegW = big ? 28 : 26;
    this.pegH = big ? 40 : 38;
    this.grip = this.post - this.pegH / 2 - 13; // where the band sits on the peg
    this.pinLen = 32; // horseshoe height
    this.hover = Math.max(this.pinLen + 30, this.top - this.post - this.pegH / 2 - 18);
    this.marks = this.ruler ? ticks(this.ruler, this.q, w - this.pad * 2) : [];
    this.sag.target = this.sagFor();
    this.wake();
  }

  theme() { this.pal = palette(); this.wake(); }

  x(t) { return this.pad + t * (this.w - this.pad * 2); }
  unX(px) { return clamp((px - this.pad) / (this.w - this.pad * 2), 0, 1); }

  // ------------------------------------------------------------ question

  setQuestion(q, ruler, start = [0, 1]) {
    this.q = q;
    this.full = ruler;
    this.ruler = ruler;
    this.view = [0, 1];
    this.zoom = null;
    this.landmarks = [];
    this.worthNow = null;
    this.phase = 'set';
    this.flyer = null; this.close = null; this.result = null; this.pin = null; this.pinSettled = false;
    this.dots = []; this.rings = []; this.tumble = null;
    this.gapAlpha = 0;
    this.marks = ticks(ruler, q, this.w - this.pad * 2);
    this.setUnits(start[0], start[1], true);
    this.sag.set(this.sagFor() * 0.4); this.sag.target = this.sagFor();
    this.modes[0].kick(this.reduced ? 0 : 260);
    this.wake();
  }

  /** Show only part of the full ruler, a and b as shares of it. Animated as a zoom. */
  trimTo(a, b) {
    const from = [...this.view];
    this.view = [a, b];
    if (this.reduced) { this.applyView(a, b); return; }
    this.zoom = { from, to: [a, b], t: 0 };
    this.wake();
  }

  applyView(a, b) {
    const f = this.full;
    const sub = { min: fromUnit(a, f), max: fromUnit(b, f), scale: f.scale };
    this.ruler = sub;
    this.marks = ticks(sub, this.q, this.w - this.pad * 2);
    this.t = this.values.map((v) => toUnit(Math.min(sub.max, Math.max(sub.min, v)), sub));
    if (this.t[1] - this.t[0] < 0.004) this.t = [Math.max(0, this.t[0] - 0.01), Math.min(1, this.t[1] + 0.01)];
    this.values = this.t.map((t, i) => (this.values[i] >= sub.min && this.values[i] <= sub.max ? this.values[i] : this.valueAt(t)));
    this.settle(true);
  }

  /** Known values of the same kind, drawn as small signposts on the rail. */
  setLandmarks(list) { this.landmarks = list.map((m) => ({ ...m, age: 0 })); this.wake(); }

  sagFor() {
    const w = this.t[1] - this.t[0];
    const maxSag = Math.max(24, this.grip - 16);
    return 1 + maxSag * Math.pow(w, 1.55);
  }

  /** 0 slack, 1 tight */
  get tension() { return clamp(1 - (this.t[1] - this.t[0]) / 0.75, 0, 1); }

  setUnits(l, u, silent) {
    this.t = [clamp(Math.min(l, u), 0, 1), clamp(Math.max(l, u), 0, 1)];
    this.values = this.t.map((t) => this.valueAt(t));
    this.settle(silent);
  }

  /** Exact values, for typed entry. */
  setValues(low, high) {
    this.values = [Math.min(low, high), Math.max(low, high)];
    this.t = this.values.map((v) => toUnit(v, this.ruler));
    this.kickBand(14);
    this.settle();
  }

  valueAt(t) {
    const { min, max } = this.ruler;
    if (t <= 0) return min;
    if (t >= 1) return max;
    return clamp(friendly(fromUnit(t, this.ruler), this.ruler), min, max);
  }

  settle(silent) {
    const ten = this.tension;
    this.sag.k = lerp(90, 620, ten); this.sag.d = lerp(6, 15, ten);
    this.sag.target = this.sagFor();
    if (!silent) this.onChange?.(this.values, this.t);
    this.wake();
  }

  kickBand(v) {
    if (this.reduced) return;
    this.modes[0].kick(v * 12); this.modes[1].kick(v * 6);
    this.back[0].kick(v * 9); this.back[1].kick(-v * 5);
  }

  movePeg(i, t) {
    const gap = 0.004;
    const old = this.t[i];
    const next = i === 0 ? clamp(t, 0, this.t[1] - gap) : clamp(t, this.t[0] + gap, 1);
    if (next === old) return;
    this.t[i] = next;
    const before = this.values[i];
    this.values[i] = this.valueAt(next);
    const dx = (next - old) * (this.w - this.pad * 2);
    if (!this.reduced) {
      this.lean[i].kick(clamp(dx * 0.22, -3, 3));
      this.modes[0].kick(clamp(Math.abs(dx) * 10, 0, 90));
      this.modes[1].kick(clamp(dx * 7, -70, 70));
      this.sway.kick(clamp(-dx * 8, -120, 120));
    }
    if (before !== this.values[i]) this.sound?.drag(this.tension);
    this.settle();
  }

  nudge(i, steps) {
    const before = this.values[i];
    let t = this.t[i];
    for (let k = 0; k < 40; k++) {
      t = clamp(t + steps * 0.004, 0, 1);
      if (this.valueAt(t) !== before || t <= 0 || t >= 1) break;
    }
    this.movePeg(i, t);
  }

  // ------------------------------------------------------------ pointers

  bind() {
    this.abort = new AbortController();
    const opt = { signal: this.abort.signal };
    const c = this.canvas;
    c.style.touchAction = 'pan-y';
    c.addEventListener('pointerdown', (e) => {
      if (this.phase !== 'set') { this.skip(); return; }
      const p = this.local(e);
      const pick = this.pick(p);
      if (pick === null) return;
      e.preventDefault();
      c.setPointerCapture(e.pointerId);
      const taken = [...this.drags.values()].map((d) => d.part);
      let part = pick;
      if (part === 'band' && taken.length) return;
      if (taken.includes(part) && part !== 'band') part = part === 0 ? 1 : 0;
      if (taken.includes(part)) return;
      const offset = part === 'band' ? 0 : p.x - this.x(this.t[part]);
      const jump = Math.abs(offset) > 34;
      this.drags.set(e.pointerId, { part, offset: jump ? 0 : offset, x: p.x });
      if (part !== 'band') {
        this.active = part;
        this.press[part].target = 1;
        if (jump) this.movePeg(part, this.unX(p.x));
      } else {
        this.kickBand(8);
      }
      this.sound?.grab();
      this.onGrab?.();
      this.wake();
    }, opt);
    c.addEventListener('pointermove', (e) => {
      const d = this.drags.get(e.pointerId);
      const p = this.local(e);
      if (!d) {
        if (e.pointerType === 'mouse' && this.phase === 'set') {
          const pick = this.pick(p);
          c.style.cursor = pick === null ? 'default' : 'grab';
        }
        return;
      }
      c.style.cursor = 'grabbing';
      if (d.part === 'band') {
        const dt = (p.x - d.x) / (this.w - this.pad * 2);
        d.x = p.x;
        const move = clamp(dt, -this.t[0], 1 - this.t[1]);
        if (move) {
          this.t = [this.t[0] + move, this.t[1] + move];
          this.values = this.t.map((t) => this.valueAt(t));
          this.sway.kick(clamp(-move * 900, -160, 160));
          this.lean[0].kick(move * 30); this.lean[1].kick(move * 30);
          this.settle();
        }
      } else {
        this.movePeg(d.part, this.unX(p.x - d.offset));
      }
    }, opt);
    const up = (e) => {
      const d = this.drags.get(e.pointerId);
      if (!d) return;
      this.drags.delete(e.pointerId);
      if (d.part !== 'band') this.press[d.part].target = 0;
      c.style.cursor = 'grab';
      this.kickBand(6 + 10 * this.tension);
      this.sound?.release(this.tension);
      this.wake();
    };
    c.addEventListener('pointerup', up, opt);
    c.addEventListener('pointercancel', up, opt);
  }

  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * this.w, y: ((e.clientY - r.top) / r.height) * this.h };
  }

  pick({ x, y }) {
    if (y < this.top - this.post - 70) return null;
    const xs = this.t.map((t) => this.x(t));
    const d = xs.map((px) => Math.abs(px - x));
    const near = d[0] === d[1] ? (x < xs[0] ? 0 : 1) : d[0] < d[1] ? 0 : 1;
    if (d[near] <= 30) {
      // When the pegs sit close together, grab the one on the side you touched.
      if (xs[1] - xs[0] < 40) return x < (xs[0] + xs[1]) / 2 ? 0 : 1;
      return near;
    }
    if (x > xs[0] && x < xs[1]) return 'band';
    return x < xs[0] ? 0 : 1;
  }

  // ------------------------------------------------------------ reveal

  /** Resolves at each beat: 'land' when the pin lands, then when the show is over. */
  reveal(result, { onLand } = {}) {
    // The result comes in shares of the full rail. After Fence in the rail on screen is shorter.
    const [a, b] = this.view;
    const inView = (t) => (t - a) / (b - a);
    this.result = { ...result, l: inView(result.l), u: inView(result.u), x: inView(result.x) };
    result = this.result;
    this.phase = 'reveal';
    this.drags.clear();
    this.active = -1;
    this.press.forEach((p) => { p.target = 0; });
    this.canvas.style.cursor = 'default';
    this.clock = 0;
    this.landed = false;
    this.onLand = onLand;
    this.lastTick = null;
    const xa = this.x(result.x);
    const from = result.x < 0.5 ? 1 : -1;
    const reach = Math.max(xa, this.w - xa) + 30;
    this.pin = { x: from > 0 ? this.w + 40 : -40, y: this.hover, ghost: [] };
    this.sweep = { xa, reach: reach * from, f: 1.25, k: 2.7 };
    if (!this.reduced) {
      this.press.forEach((p) => p.kick(16));
      this.sound?.lock();
    }
    this.wake();
    return new Promise((resolve) => { this.done = resolve; });
  }

  skip() {
    if (this.phase !== 'reveal') return;
    if (!this.landed) this.clock = SWEEP + HOLD + FALL;
    this.wake();
  }

  land() {
    this.landed = true;
    this.landClock = 0;
    const r = this.result;
    const x = this.x(r.x);
    this.pin.x = x; this.pin.y = this.top + 1;
    this.pinSettled = true;
    if (!this.reduced) {
      this.pinWobble.kick(5);
      this.quake.kick(90);
      this.rings.push({ x, y: this.top, age: 0, color: this.pal.mute, size: 46 });
    }
    this.sound?.thunk();
    this.tierExtras(r, x);
    if (r.hit) {
      const tight = clamp(1 - r.width / 0.6, 0.1, 1);
      this.close = this.reduced ? new Spring(1) : new Spring(0, { k: 620, d: 22 });
      this.close.target = 1;
      this.closeFrom = this.t.map((t) => this.x(t));
      if (!this.reduced) {
        this.modes[0].kick(300); this.modes[1].kick(520 * tight);
        this.burst(x, this.top - 18, Math.round(10 + 60 * tight), tight);
        this.rings.push({ x, y: this.top - 16, age: -0.06, color: this.pal.band, size: 70 + 190 * tight });
      }
      setTimeout(() => this.sound?.twang(tight), this.reduced ? 0 : 70);
    } else {
      this.missNear = r.side < 0 ? 0 : 1;
      this.slip = this.reduced ? 1 : 0;
      this.sound?.slip();
      if (this.reduced) this.flyer = null;
    }
    this.onLand?.(r);
  }

  /** The top and bottom of the ladder get their own show on the rail. */
  tierExtras(r, x) {
    const t = r.tier;
    if (!t || this.reduced) { if (t) setTimeout(() => this.sound?.tier?.(t), 260); return; }
    if (t === 'dead') {
      const gold = ['#f7d35c', '#e2a52b', '#fff3c4', '#c98a12'];
      setTimeout(() => {
        if (this.dead) return;
        this.burst(x, this.top - 20, 110, 1, gold);
        [0, 0.12, 0.26].forEach((d, i) => this.rings.push({ x, y: this.top - 16, age: -d, color: gold[i], size: 120 + 90 * i }));
        this.wake();
      }, 180);
    } else if (t === 'ringer') {
      setTimeout(() => {
        if (this.dead) return;
        [0, 0.14].forEach((d) => this.rings.push({ x, y: this.top - 16, age: -d, color: '#2fb3a3', size: 110 }));
        this.wake();
      }, 160);
    } else if (t === 'leaner') {
      this.pinWobble.kick(14);
    } else if (t === 'tumble') {
      const ltr = r.x > 0.5;
      this.tumble = { age: 0, life: 2.3, from: ltr ? -30 : this.w + 30, to: ltr ? this.w + 30 : -30, spin: ltr ? 7 : -7 };
    }
    setTimeout(() => this.sound?.tier?.(t), 260);
  }

  burst(x, y, n, power, palette) {
    const colors = palette || [this.pal.pin, this.pal.band, this.pal.ink, this.pal.paper];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.5;
      const v = 180 + Math.random() * 520 * (0.5 + power * 0.6);
      this.dots.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 2.2 + Math.random() * 2.6,
        spin: Math.random() * 6, vs: (Math.random() - 0.5) * 22, age: 0, life: 0.9 + Math.random() * 0.8, color: colors[i % 4],
      });
    }
  }

  launch() {
    const i = this.missNear;
    const x = this.x(this.t[i]);
    const dir = i === 0 ? -1 : 1;
    const ten = this.tension;
    const size = 24 + 26 * (1 - ten);
    this.flyer = {
      x, y: this.top - this.grip, vx: dir * (320 + 420 * ten), vy: -(420 + 300 * ten), a: 0, va: dir * (9 + 8 * ten), r: size, age: 0,
    };
    this.lean[i].kick(dir * 9);
    this.sound?.fly();
  }

  // ------------------------------------------------------------ frame

  wake() {
    if (this.running || this.dead || !this.w) return;
    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (this.dead) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    const busy = this.update(dt);
    this.draw();
    if (busy) requestAnimationFrame(this.frame);
    else this.running = false;
  }

  update(dt) {
    const all = [...this.lean, ...this.press, this.sag, this.sway, ...this.modes, ...this.back, this.pinWobble, this.quake];
    if (this.close) all.push(this.close);
    let busy = this.drags.size > 0;
    for (const s of all) {
      if (this.reduced) s.set(s.target); else s.step(dt);
      if (!s.resting) busy = true; else s.set(s.target);
    }
    for (const d of this.dots) {
      d.age += dt; d.vy += 1500 * dt; d.vx *= 1 - 1.6 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.spin += d.vs * dt;
    }
    this.dots = this.dots.filter((d) => d.age < d.life && d.y < this.h + 20);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < 0.7);
    if (this.tumble) { this.tumble.age += dt; if (this.tumble.age >= this.tumble.life) this.tumble = null; }
    if (this.dots.length || this.rings.length || this.tumble) busy = true;

    if (this.zoom) {
      busy = true;
      const z = this.zoom;
      z.t = Math.min(1, z.t + dt / 0.55);
      const e = 1 - Math.pow(1 - z.t, 3);
      this.applyView(lerp(z.from[0], z.to[0], e), lerp(z.from[1], z.to[1], e));
      if (z.t >= 1) { this.zoom = null; this.onChange?.(this.values, this.t); }
    }
    for (const m of this.landmarks) if (m.age < 1) { m.age = Math.min(1, m.age + dt / 0.4); busy = true; }
    if (this.phase === 'reveal') {
      busy = true;
      this.clock += dt;
      if (!this.landed) {
        const end = this.reduced ? 0.3 : SWEEP + HOLD + FALL;
        if (!this.reduced) this.movePin();
        if (this.clock >= end) this.land();
      } else {
        this.landClock += dt;
        if (!this.result.hit) {
          if (!this.reduced && this.slip < 1) {
            this.slip = Math.min(1, this.landClock / 0.11);
            if (this.slip >= 1) this.launch();
          }
          this.gapAlpha = this.reduced ? 1 : easeOut((this.landClock - 0.25) / 0.35);
        }
        if (this.flyer) {
          const f = this.flyer;
          f.age += dt; f.vy += 1500 * dt; f.x += f.vx * dt; f.y += f.vy * dt; f.a += f.va * dt;
          if (f.y > this.h + 140 || f.x < -220 || f.x > this.w + 220) this.flyer = null;
        }
        const over = this.reduced ? 0.15 : this.result.hit ? 0.75 : 0.85;
        if (this.landClock > over && this.done) { const d = this.done; this.done = null; d(); }
        if (this.landClock > 2.4 && !this.flyer) { this.phase = 'done'; }
      }
    }
    return busy;
  }

  movePin() {
    const p = this.pin;
    const t = this.clock;
    const s = this.sweep;
    p.ghost.unshift([p.x, p.y]);
    p.ghost.length = Math.min(p.ghost.length, 4);
    if (t < SWEEP) {
      const blend = easeOut((t - SWEEP + 0.3) / 0.3);
      const raw = s.xa + s.reach * Math.cos(2 * Math.PI * s.f * t) * Math.exp(-s.k * t);
      p.x = lerp(raw, s.xa, blend);
      p.y = this.hover;
      const mark = Math.floor(this.unX(p.x) * 16);
      if (mark !== this.lastTick) { this.lastTick = mark; this.sound?.tick(t / SWEEP); }
    } else if (t < SWEEP + HOLD) {
      p.x = s.xa;
      p.y = this.hover - 9 * easeOut((t - SWEEP) / HOLD);
    } else {
      p.y = lerp(this.hover - 9, this.top + 1, easeIn((t - SWEEP - HOLD) / FALL));
    }
  }

  draw() {
    const { ctx, w, h, pal } = this;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(0, this.quake.v * 0.35);
    drawRuler(ctx, pal, { w, top: this.top, h: this.rulerH, pad: this.pad, marks: this.marks });
    const xs = this.t.map((t) => this.x(t));
    const after = this.landed && this.phase !== 'set';

    // What each spot on the rule would score: solid inside the range, fading outside it.
    const worth = this.worthNow ?? 1 - (this.t[1] - this.t[0]);
    pointsBand(ctx, pal, xs[0], xs[1], this.top + 1, this.rulerH - 1, (after ? 0.1 : 0.12) + 0.3 * Math.max(0, worth), FADE);
    this.drawLandmarks(after);
    for (const r of this.rings) this.drawRing(r);
    if (this.phase === 'reveal' && !this.landed) this.drawPinShadow();

    const closed = this.close ? this.close.v : 0;
    const wrapped = this.close && closed > 0.97 && this.landClock > 0.05;
    if (wrapped && this.pinSettled) this.drawWrap(true);
    if (this.pinSettled && this.result) this.drawAnswerPin();
    this.drawPegs(xs, after);
    if (!this.flyer && !wrapped && !(this.result && !this.result.hit && this.slip >= 1 && after)) this.drawBand(xs, closed, after);
    if (after && !this.result.hit && this.slip >= 1 && this.reduced) this.drawLooseBand(xs);
    if (wrapped && this.pinSettled) this.drawWrap(false);
    if (this.pin && !this.pinSettled) this.drawHuntingPin();
    if (this.flyer) this.drawFlyer();
    for (const d of this.dots) this.drawDot(d);
    if (this.tumble) this.drawTumble();
    if (!after) this.drawLandmarkTags();
    if (after && !this.result.hit && this.gapAlpha > 0) this.drawGap(xs);
    if (this.phase === 'set') this.drawTags(xs);
    if (after) this.drawAnswerTag();
    ctx.restore();
  }

  /** Dashed stems sit under the rope. Their name tags go on top while you set the loop. */
  drawLandmarks(after) {
    const { ctx, pal } = this;
    for (const m of this.landmarkSpots()) {
      ctx.save();
      ctx.globalAlpha = m.e;
      ctx.strokeStyle = pal.mute;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(m.x, this.top + 2); ctx.lineTo(m.x, m.y); ctx.stroke();
      ctx.restore();
    }
    if (after) this.drawLandmarkTags();
  }

  drawLandmarkTags() {
    const { ctx, pal, w } = this;
    for (const m of this.landmarkSpots()) {
      ctx.save();
      ctx.globalAlpha = m.e;
      tag(ctx, m.text, m.x, m.y, { fill: pal.card || pal.paper, ink: pal.ink, font: m.font, w, h: 20, padX: 6, border: pal.line });
      ctx.restore();
    }
  }

  /** Where each landmark sits. A tag that would overlap the one before it steps up a row. */
  landmarkSpots() {
    const { ctx, w } = this;
    const { min, max } = this.ruler;
    const font = `600 12px ${TEXT}`;
    ctx.font = font;
    const spots = this.landmarks
      .filter((m) => m.value > min && m.value < max)
      .map((m) => {
        const text = `${m.label} ${short2(m.value, this.q)}`;
        const x = this.x(toUnit(m.value, this.ruler));
        const tw = ctx.measureText(text).width + 12;
        const left = clamp(x - tw / 2, 4, w - tw - 4);
        return { text, x, left, right: left + tw, e: this.reduced ? 1 : 1 - Math.pow(1 - m.age, 3), font };
      })
      .sort((a, b) => a.x - b.x);
    let prev = null;
    for (const m of spots) {
      m.row = prev && m.left < prev.right + 4 && prev.row === 0 ? 1 : 0;
      m.y = this.top - 22 - 8 * m.e - m.row * 24;
      prev = m;
    }
    return spots;
  }

  drawTumble() {
    const { ctx, pal } = this;
    const t = this.tumble;
    const p = t.age / t.life;
    const x = lerp(t.from, t.to, p);
    const y = this.top - 13 - Math.abs(Math.sin(t.age * 5.2)) * 22 * (1 - p * 0.6);
    ctx.save();
    ctx.globalAlpha = clamp(Math.min(p * 8, (1 - p) * 6), 0, 1);
    ctx.translate(x, y);
    ctx.rotate(t.age * t.spin);
    ctx.strokeStyle = pal.tumble || '#9b7b52';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = i * 0.7;
      ctx.beginPath();
      ctx.ellipse(0, 0, 13 - (i % 3) * 2, 8 + (i % 4) * 1.5, a, 0.3 * i, 0.3 * i + 4.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawPegs(xs, after) {
    const { ctx, pal } = this;
    // Pegs set close together splay apart at the top like tweezers, so both stay easy to grab.
    const spread = Math.max(0, (this.pegW + 10 - (xs[1] - xs[0])) / 2);
    xs.forEach((x, i) => {
      const s = this.press[i].v;
      const len = this.post + 7 - s * 5;
      const splay = Math.asin(Math.min(0.9, spread / len)) * (i === 0 ? -1 : 1);
      ctx.save();
      ctx.globalAlpha = after ? lerp(1, 0.24, clamp(this.landClock / 0.25, 0, 1)) : 1;
      drawPeg(ctx, {
        x, y: this.top + 7, len, w: this.pegW * (1 + 0.1 * s), h: this.pegH * (1 + 0.1 * s), pal,
        lean: splay + clamp(this.lean[i].v * 0.1, -0.35, 0.35), squash: clamp(s, 0, 1) * 0.4,
      });
      ctx.restore();
    });
  }

  drawBand(xs, closed, after) {
    const { ctx, pal } = this;
    let [xl, xr] = xs;
    let y = this.top - this.grip;
    let sag = Math.max(0, this.sag.v);
    let r = lerp(8, 5.5, this.tension);
    if (this.close) {
      const px = this.x(this.result.x);
      xl = lerp(this.closeFrom[0], px - 5, closed);
      xr = lerp(this.closeFrom[1], px + 5, closed);
      y = lerp(y, this.top - 16, clamp(closed, 0, 1));
      sag *= clamp(1 - closed, 0, 1);
      r = lerp(r, 5, clamp(closed, 0, 1));
      if (xr < xl) [xl, xr] = [xr, xl];
    } else if (after && this.result && !this.result.hit) {
      const near = this.missNear;
      const e = easeIn(this.slip);
      if (near === 0) xr = lerp(xr, xl, e); else xl = lerp(xl, xr, e);
      sag *= 1 - e;
    }
    const lim = (v) => clamp(v, -34, 34);
    bandPath(ctx, {
      xl, xr, yl: y, yr: y, sag, r, sway: clamp(this.sway.v, -26, 26),
      modes: this.modes.map((m) => lim(m.v * 0.4)), back: this.back.map((m) => lim(m.v * 0.4)),
    });
    strokeRubber(ctx, pal, lerp(6.4, 4.4, this.tension));
  }

  drawWrap(behind) {
    const { ctx, pal } = this;
    const x = this.x(this.result.x);
    const t = this.landClock;
    const amp = this.reduced ? 0 : 0.7 * Math.exp(-4.2 * t) * Math.cos(t * 46);
    const lean = this.pinWobble.v * 0.05;
    ctx.save();
    ctx.translate(x, this.top);
    ctx.rotate(lean);
    for (let i = 0; i < 3; i++) {
      const y = -16 + (i - 1) * 7 + amp * 3 * (i - 1);
      const rx = 19 * (1 + amp * (i === 1 ? 1 : -0.6));
      const ry = 6 * (1 - amp * 0.6);
      ctx.beginPath();
      ctx.ellipse(0, y, Math.max(6, rx), Math.max(2, ry), (i - 1) * 0.14 + amp * 0.2, behind ? Math.PI : 0, behind ? Math.PI * 2 : Math.PI);
      strokeRubber(ctx, pal, 5);
    }
    ctx.restore();
  }

  drawLooseBand(xs) {
    const { ctx, pal } = this;
    const i = this.missNear;
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.ellipse(xs[i] + (i === 0 ? -1 : 1) * 34, this.top - this.grip - 30, 24, 13, 0.5, 0, Math.PI * 2);
    strokeRubber(ctx, pal, 5);
    ctx.restore();
  }

  drawAnswerPin() {
    const { ctx, pal } = this;
    drawPin(ctx, { x: this.x(this.result.x), y: this.top + 1, r: 13, color: pal.pin, dark: pal.pinDark, lite: '#fff', lean: this.pinWobble.v * 0.05 });
  }

  drawHuntingPin() {
    const { ctx, pal } = this;
    this.pin.ghost.forEach(([x, y], i) => {
      drawPin(ctx, { x, y, r: 13, color: pal.pin, dark: pal.pinDark, lite: '#fff', alpha: 0.14 - i * 0.03 });
    });
    const last = this.pin.ghost[0];
    const vx = last ? this.pin.x - last[0] : 0;
    // The shoe swings as it hunts and turns over once as it falls.
    const falling = this.clock > SWEEP + HOLD ? (this.clock - SWEEP - HOLD) / FALL : 0;
    drawPin(ctx, { x: this.pin.x, y: this.pin.y, r: 13, color: pal.pin, dark: pal.pinDark, lite: '#fff', lean: clamp(-vx * 0.03, -0.6, 0.6) + falling * Math.PI * 2 });
  }

  drawPinShadow() {
    const { ctx, pal } = this;
    const p = this.pin;
    const near = clamp((p.y - this.hover) / (this.top - this.hover), 0, 1);
    ctx.fillStyle = pal.ink;
    ctx.globalAlpha = 0.16 + near * 0.3;
    ctx.beginPath();
    ctx.ellipse(p.x, this.top + 10, 13 - near * 6, 4 - near * 1.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawRing(r) {
    const { ctx } = this;
    if (r.age < 0) return;
    const t = r.age / 0.7;
    ctx.globalAlpha = (1 - t) * 0.8;
    ctx.strokeStyle = r.color;
    ctx.lineWidth = 3 * (1 - t) + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, 8 + r.size * easeOut(t), 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  drawDot(d) {
    const { ctx, pal } = this;
    ctx.save();
    ctx.globalAlpha = clamp((d.life - d.age) * 3, 0, 1);
    ctx.translate(d.x, d.y);
    ctx.scale(1, Math.max(0.15, Math.abs(Math.cos(d.spin))));
    ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(0, 0, d.r, 0, Math.PI * 2);
    ctx.fill();
    if (d.color === pal.paper) { ctx.strokeStyle = pal.line; ctx.lineWidth = 0.8; ctx.stroke(); }
    ctx.restore();
  }

  drawFlyer() {
    const { ctx, pal } = this;
    const f = this.flyer;
    const wob = Math.cos(f.age * 34) * 0.34 * Math.exp(-1.2 * f.age);
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.a);
    ctx.beginPath();
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = f.r * (1 + wob * Math.cos(2 * a) + 0.1 * Math.sin(3 * a + f.age * 20));
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r * 0.62;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    strokeRubber(ctx, pal, 5.5);
    ctx.restore();
  }

  drawGap(xs) {
    const { ctx, pal } = this;
    const a = xs[this.missNear];
    const b = this.x(this.result.x);
    if (Math.abs(a - b) < 7) return;
    ctx.globalAlpha = this.gapAlpha;
    const end = lerp(a, b, this.gapAlpha);
    dimension(ctx, a, end, this.top - 16, pal.band, 9);
    ctx.globalAlpha = 1;
  }

  valueFont(px = 15) { return `650 ${px}px ${DISPLAY}`; }

  drawTags(xs) {
    const { ctx, pal, w } = this;
    const y = this.top - this.post - this.pegH / 2 - 11;
    const font = this.valueFont();
    const texts = this.values.map((v) => short2(v, this.q));
    if (xs[1] - xs[0] < 96) {
      tag(ctx, texts[0] === texts[1] ? texts[0] : `${texts[0]} to ${texts[1]}`, (xs[0] + xs[1]) / 2, y - 10, { fill: pal.ink, ink: pal.paper, font, w });
      return;
    }
    tag(ctx, texts[0], xs[0], y, { fill: pal.ink, ink: pal.paper, font, w });
    tag(ctx, texts[1], xs[1], y, { fill: pal.ink, ink: pal.paper, font, w });
  }

  drawAnswerTag() {
    const { ctx, pal, w } = this;
    const x = this.x(this.result.x);
    const up = this.reduced ? 1 : easeOut(this.landClock / 0.22);
    ctx.globalAlpha = up;
    const y = this.top - this.pinLen - 16 - 8 * up;
    tag(ctx, withUnit(this.q.answer, this.q), x, y, { fill: pal.pin, ink: pal.pinInk || '#1b1600', font: this.valueFont(17), w, padX: 10, h: 30 });
    ctx.globalAlpha = 1;
  }
}

function short2(v, q) {
  if (q.unit === 'US dollars') return `$${short(v, q)}`;
  if (q.unit === '%' || q.unit === '°C' || q.unit === '°F') return `${short(v, q)}${q.unit}`;
  return short(Number.isFinite(v) ? sig(v, 4) : v, q);
}
