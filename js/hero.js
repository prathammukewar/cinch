// The welcome scene: a slack band tightens, the pin drops, the band cinches. Also draws the
// still pictures in How to play.
import { Spring, clamp, lerp, easeIn, easeOut } from './spring.js';
import { palette, fit, bandPath, strokeRubber, drawPin, drawPeg, dimension, pointsBand } from './draw.js';

const PIN = 0.47;

export class Hero {
  constructor(canvas, { reduced, sound, onTight } = {}) {
    this.canvas = canvas;
    this.reduced = reduced;
    this.sound = sound;
    this.onTight = onTight;
    this.pal = palette();
    this.frame = this.frame.bind(this);
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(canvas);
    this.reset();
  }

  reset() {
    this.t = 0;
    this.pegs = [new Spring(0.04, { k: 70, d: 11 }), new Spring(0.96, { k: 70, d: 11 })];
    this.sag = new Spring(0, { k: 60, d: 5 });
    this.sway = new Spring(0, { k: 80, d: 5 });
    this.wob = new Spring(0, { k: 520, d: 6 });
    this.close = null;
    this.pinY = -1;
    this.dots = [];
    this.rings = [];
    this.landed = false;
    this.cued = false;
  }

  play() {
    this.reset();
    if (this.reduced) {
      this.pegs.forEach((p, i) => p.set(i ? 0.6 : 0.35));
      this.landed = true;
      this.close = new Spring(1);
      this.pinY = 1;
      this.draw();
      this.onTight?.(1);
      return;
    }
    this.sag.v = -30; this.sag.target = 1;
    this.running = true;
    this.last = 0;
    requestAnimationFrame(this.frame);
  }

  destroy() { this.dead = true; this.observer.disconnect(); }
  theme() { this.pal = palette(); this.draw(); }

  frame(now) {
    if (this.dead) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.t += dt;
    const t = this.t;
    if (t > 0.55 && !this.cued) {
      this.cued = true;
      this.pegs[0].target = 0.35; this.pegs[1].target = 0.6;
      this.sway.kick(-40);
      this.sound?.release?.(0.6);
    }
    const tight = clamp(1 - (this.pegs[1].v - this.pegs[0].v - 0.25) / 0.67, 0, 1);
    this.onTight?.(tight);
    this.sag.target = lerp(1, 0.12, tight);
    // The pin waits, then falls.
    if (t > 1.25 && !this.landed) {
      this.pinY = Math.min(1, easeIn((t - 1.25) / 0.2));
      if (this.pinY >= 1) this.land();
    }
    let busy = !this.landed || t < 3.2;
    for (const s of [...this.pegs, this.sag, this.sway, this.wob, ...(this.close ? [this.close] : [])]) { s.step(dt); if (!s.resting) busy = true; }
    for (const d of this.dots) { d.age += dt; d.vy += 1300 * dt; d.x += d.vx * dt; d.y += d.vy * dt; }
    this.dots = this.dots.filter((d) => d.age < d.life);
    for (const r of this.rings) r.age += dt;
    this.rings = this.rings.filter((r) => r.age < 0.7);
    if (this.dots.length || this.rings.length) busy = true;
    this.draw();
    if (busy) requestAnimationFrame(this.frame);
    else this.running = false;
  }

  land() {
    this.landed = true;
    this.landT = this.t;
    this.close = new Spring(0, { k: 560, d: 20 });
    this.close.target = 1;
    this.wob.kick(10);
    this.sound?.thunk?.();
    setTimeout(() => this.sound?.twang?.(0.8), 60);
    const { w, h } = this.geom();
    const x = this.x(PIN, w);
    const colors = [this.pal.pin, this.pal.band, this.pal.ink];
    for (let i = 0; i < 26; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
      const v = 160 + Math.random() * 360;
      this.dots.push({ x, y: h * 0.48, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 1.8 + Math.random() * 2.2, age: 0, life: 0.7 + Math.random() * 0.5, color: colors[i % 3] });
    }
    this.rings.push({ x, y: h * 0.48, age: 0 });
  }

  geom() { return { w: this.canvas.clientWidth, h: this.canvas.clientHeight }; }
  x(t, w) { return 18 + t * (w - 36); }

  draw() {
    const { ctx, w, h } = fit(this.canvas);
    if (!w) return;
    paintScene(ctx, this.pal, w, h, {
      l: this.pegs[0].v, u: this.pegs[1].v, sag: this.sag.v, sway: this.sway.v, close: this.close?.v ?? 0,
      pin: this.pinY, wob: this.wob.v, dots: this.dots, rings: this.rings, since: this.landed ? this.t - this.landT : 0,
    });
  }
}

/** One frame of the little scene. pose fields: l, u (0 to 1), sag, close (0 to 1), pin (-1 hidden, 0 to 1 falling), miss */
export function paintScene(ctx, pal, w, h, s) {
  const top = h - 30;
  const x = (t) => 18 + t * (w - 36);
  ctx.clearRect(0, 0, w, h);
  // ruler
  const g = ctx.createLinearGradient(0, top, 0, h);
  g.addColorStop(0, pal.steel1); g.addColorStop(1, pal.steel2);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(0, top, w, 26, 4); ctx.fill();
  ctx.strokeStyle = pal.steelInk; ctx.lineWidth = 1;
  for (let i = 0; i <= 40; i++) {
    const px = Math.round(x(i / 40)) + 0.5;
    ctx.globalAlpha = i % 10 === 0 ? 0.9 : i % 5 === 0 ? 0.6 : 0.35;
    ctx.beginPath(); ctx.moveTo(px, top + 1); ctx.lineTo(px, top + (i % 10 === 0 ? 14 : i % 5 === 0 ? 10 : 6)); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const post = h * 0.5;
  const grip = post - 20;
  const xl = x(s.l); const xr = x(s.u); const xp = x(s.pinAt ?? PIN);
  pointsBand(ctx, pal, xl, xr, top, 26, 0.12 + 0.3 * (1 - (s.u - s.l)));
  for (const r of s.rings || []) {
    const t = r.age / 0.7;
    ctx.globalAlpha = (1 - t) * 0.7; ctx.strokeStyle = pal.band; ctx.lineWidth = 2.5 * (1 - t) + 0.5;
    ctx.beginPath(); ctx.arc(xp, top - grip * 0.45, 8 + 90 * easeOut(t), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
  }
  const faded = s.close > 0.05 || s.miss;
  [xl, xr].forEach((px) => {
    ctx.save(); ctx.globalAlpha = faded ? 0.3 : 1;
    drawPeg(ctx, { x: px, y: top + 4, len: post + 4, w: 18, h: 26, pal });
    ctx.restore();
  });
  const pinLen = post * 0.75;
  const pinTipY = s.pin < 0 ? null : lerp(top - post - 40, top + 1, clamp(s.pin, 0, 1));
  if (s.miss) {
    ctx.save(); ctx.globalAlpha = 0.8;
    bandPath(ctx, { xl, xr, yl: top - grip, yr: top - grip, sag: 4, r: 5, modes: [0, 0, 0], back: [0, 0, 0] });
    strokeRubber(ctx, pal, 4.5); ctx.restore();
    dimension(ctx, xr + 6, xp - 9, top - 12, pal.band, 6);
  } else if (s.close > 0.97) {
    const amp = 0.6 * Math.exp(-4 * (s.since || 9)) * Math.cos((s.since || 0) * 44);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(xp, top - 11 + (i - 1) * 5.5, 14 * (1 + amp * (i === 1 ? 1 : -0.5)), 4.4, (i - 1) * 0.15, 0, Math.PI * 2);
      strokeRubber(ctx, pal, 4);
    }
  } else {
    const c = clamp(s.close, 0, 1);
    const a = lerp(xl, xp - 4, c); const b = lerp(xr, xp + 4, c);
    const y = lerp(top - grip, top - 11, c);
    bandPath(ctx, { xl: a, xr: Math.max(b, a + 1), yl: y, yr: y, sag: Math.max(0, s.sag) * post * 0.55 * (1 - c), r: lerp(6, 4.5, c), sway: clamp(s.sway || 0, -20, 20) * 0.4, modes: [0, 0, 0], back: [0, 0, 0] });
    strokeRubber(ctx, pal, 5);
  }
  if (pinTipY !== null) drawPin(ctx, { x: xp, y: pinTipY, r: 9, color: pal.pin, dark: pal.pinDark, lite: '#fff', lean: (s.wob || 0) * 0.05 + (s.pin > 0 && s.pin < 1 ? s.pin * Math.PI * 2 : 0) });
  for (const d of s.dots || []) {
    ctx.globalAlpha = clamp((d.life - d.age) * 3, 0, 1); ctx.fillStyle = d.color;
    ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Still pictures for How to play. */
export function drawPose(canvas, pose) {
  const { ctx, w, h } = fit(canvas);
  const pal = palette();
  const poses = {
    set: { l: 0.22, u: 0.72, sag: 0.45, close: 0, pin: -1 },
    catch: { l: 0.3, u: 0.62, sag: 0, close: 1, pin: 1, since: 9, pinAt: 0.46 },
    miss: { l: 0.18, u: 0.46, sag: 0, close: 0, pin: 1, miss: true, pinAt: 0.8 },
  };
  paintScene(ctx, pal, w, h, poses[pose]);
}

// ---------------------------------------------------------------- How to play

let sheet = null;
let closer = () => {};
export function howTo(thenPlay, { sound, h, store, reducedMotion }) {
  closer = () => closeSheet(reducedMotion);
  if (!sheet) {
    const step = (pose, title, text) => {
      const c = h('canvas', { class: 'pose', 'aria-hidden': 'true' });
      return { el: h('li', {}, c, h('div', {}, h('h3', {}, title), h('p', {}, text))), draw: () => drawPose(c, pose) };
    };
    const steps = [
      step('set', 'Set your loop', 'Drag the posts until you are 90% sure the answer is between them.'),
      step('catch', 'Rope it', 'Land inside and you score. Tighter loops score more.'),
      step('miss', 'Or nearly', 'A near miss still scores a little.'),
    ];
    const go = h('button', { class: 'go', type: 'button', id: 'howto-go' }, 'Got it');
    sheet = h('dialog', { class: 'sheet', id: 'howto', 'aria-labelledby': 'howto-title' },
      h('h2', { id: 'howto-title' }, 'How to rope'),
      h('ol', { class: 'steps' }, steps.map((x) => x.el)),
      h('p', { class: 'fine' }, 'Seven new questions every midnight.'),
      go);
    sheet.draws = steps;
    sheet.addEventListener('click', (e) => { if (e.target === sheet) closer(); });
    sheet.addEventListener('cancel', (e) => { e.preventDefault(); closer(); });
    go.addEventListener('click', () => {
      sound.tap();
      // Starting the game closes the sheet at once so the first question is ready to touch.
      if (sheet.thenPlay) { sheet.close(); location.hash = '#today'; } else closer();
    });
    document.body.append(sheet);
  }
  sheet.thenPlay = thenPlay;
  sheet.querySelector('#howto-go').textContent = thenPlay ? 'Saddle up' : 'Got it';
  sheet.classList.remove('closing');
  sheet.showModal();
  sheet.draws.forEach((x) => x.draw());
  store.change((d) => { d.seenHowTo = true; });
}

function closeSheet(reducedMotion) {
  if (!sheet?.open) return;
  if (reducedMotion()) { sheet.close(); return; }
  sheet.classList.add('closing');
  setTimeout(() => { sheet.close(); sheet.classList.remove('closing'); }, 170);
}
