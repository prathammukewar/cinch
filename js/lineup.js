// The closing picture: every band slides until all the pins share one plumb line.
import { Spring, clamp, lerp, easeOut } from './spring.js';
import { palette, fit, bandPath, strokeRubber, dimension, drawPin, DISPLAY } from './draw.js';

const flat = [0, 0, 0];

/** Draw rows into any context. mix: 0 as played on the rule, 1 lined up. */
export function paintRows(ctx, pal, rows, { x0, y0, w, h, mix = () => 1, shake = () => 0, plumb = 1, thick = 1, highlight = -1 }) {
  const n = rows.length;
  const step = h / n;
  const cx = x0 + w / 2;
  const pad = 16 * thick;
  const scale = w * 0.86;
  const r = clamp(step * 0.14, 4, 9) * thick;
  const head = clamp(step * 0.17, 5, 9.5) * thick;

  if (highlight >= 0) {
    ctx.fillStyle = pal.line;
    ctx.beginPath();
    ctx.roundRect(x0 + 4, y0 + step * highlight + 2, w - 8, step - 4, 10);
    ctx.fill();
  }
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0 - head * 3, w, h + head * 6);
  ctx.clip();
  rows.forEach((row, i) => {
    const y = y0 + step * (i + 0.5);
    const m = mix(i);
    const at = (t) => lerp(x0 + pad + t * (w - pad * 2), cx + (t - row.x) * scale, m);
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y);
    ctx.stroke();
    const xl = at(row.l);
    const xr = at(row.u);
    ctx.save();
    const a = shake(i);
    const tight = clamp(1 - row.width / 0.6, 0, 1);
    if (!row.hit) ctx.globalAlpha = 0.42;
    bandPath(ctx, {
      xl, xr: Math.max(xr, xl + 1), yl: y, yr: y, sag: row.hit ? (1 - tight) * step * 0.13 : 0, r: r * (row.hit ? 1 : 0.8),
      modes: [a * step * 0.3, 0, a * step * 0.12], back: [-a * step * 0.25, 0, 0],
    });
    strokeRubber(ctx, pal, (row.hit ? 4.4 : 3) * thick);
    ctx.restore();
    const px = at(row.x);
    if (!row.hit) {
      const edge = row.x < row.l ? xl - r : xr + r;
      if (Math.abs(edge - px) > 12 * thick) dimension(ctx, edge, px + (row.x < row.l ? head : -head), y, pal.mute, 4 * thick);
    }
  });
  if (plumb > 0) {
    ctx.strokeStyle = pal.pinDark;
    ctx.lineWidth = 2 * thick;
    ctx.beginPath();
    ctx.moveTo(cx, y0 - head * 2);
    ctx.lineTo(cx, y0 - head * 2 + (h + head * 4) * plumb);
    ctx.stroke();
  }
  rows.forEach((row, i) => {
    const y = y0 + step * (i + 0.5);
    const m = mix(i);
    const px = lerp(x0 + pad + row.x * (w - pad * 2), cx, m);
    drawPin(ctx, { x: px, y: y + head * 1.15, r: head * 0.95, color: row.hit ? pal.pin : pal.paper, dark: row.hit ? pal.pinDark : pal.mute, lite: '#fff' });
  });
  ctx.restore();
}

export class Lineup {
  constructor(canvas, rows, { reduced, sound, instant }) {
    this.canvas = canvas;
    this.rows = rows;
    this.sound = sound;
    this.pal = palette();
    this.still = reduced || instant;
    this.mix = rows.map(() => new Spring(this.still ? 1 : 0, { k: 130, d: 15 }));
    this.hum = rows.map(() => new Spring(0, { k: 900, d: 9 }));
    this.plumb = this.still ? 1 : 0;
    this.clock = 0;
    this.next = 0;
    this.frame = this.frame.bind(this);
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(canvas);
  }

  start(onDone) {
    this.onDone = onDone;
    if (this.still) { this.draw(); onDone?.(); return; }
    this.draw();
    this.last = 0;
    requestAnimationFrame(this.frame);
  }

  frame(now) {
    if (this.dead) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 1 / 60;
    this.last = now;
    this.clock += dt;
    while (this.next < this.rows.length && this.clock > 0.35 + this.next * 0.13) {
      this.mix[this.next].target = 1;
      this.hum[this.next].kick(this.rows[this.next].hit ? 24 : 7);
      this.sound?.line(this.next, this.rows[this.next].hit);
      this.next++;
    }
    let busy = this.next < this.rows.length;
    for (const s of [...this.mix, ...this.hum]) { s.step(dt); if (!s.resting) busy = true; else s.set(s.target); }
    const from = 0.35 + this.rows.length * 0.13 + 0.25;
    if (this.clock > from) {
      this.plumb = easeOut((this.clock - from) / 0.45);
      if (!this.told) { this.told = true; this.onDone?.(); }
    } else busy = true;
    if (this.plumb < 1) busy = true;
    this.draw();
    if (busy) requestAnimationFrame(this.frame);
  }

  theme() { this.pal = palette(); this.draw(); }

  highlight(i) { this.hl = i; this.draw(); }

  draw() {
    const { ctx, w, h } = fit(this.canvas);
    if (!w) return;
    ctx.clearRect(0, 0, w, h);
    paintRows(ctx, this.pal, this.rows, { x0: 0, y0: 22, w, h: h - 44, mix: (i) => this.mix[i].v, shake: (i) => this.hum[i].v, plumb: this.plumb, highlight: this.hl ?? -1 });
  }

  destroy() { this.dead = true; this.observer.disconnect(); }
}

/** Portrait picture for stories, 1080 by 1920. */
export async function storyImage({ rows, name, title, score, of, line, address }) {
  await Promise.all([document.fonts.load('700 80px Anybody'), document.fonts.load('500 40px "Familjen Grotesk"')]).catch(() => {});
  const pal = palette();
  const c = document.createElement('canvas');
  c.width = 1080; c.height = 1920;
  const ctx = c.getContext('2d');
  ctx.fillStyle = pal.paper;
  ctx.fillRect(0, 0, 1080, 1920);
  for (let i = 0; i <= 1920; i += 40) {
    const big = i % 200 === 0;
    ctx.globalAlpha = big ? 0.5 : 0.22;
    ctx.strokeStyle = pal.line;
    ctx.lineWidth = big ? 2.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(0, i); ctx.lineTo(1080, i);
    if (i <= 1080) { ctx.moveTo(i, 0); ctx.lineTo(i, 1920); }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = pal.ink;
  ctx.font = `700 64px ${DISPLAY}`;
  ctx.fillText(name, 540, 250);
  ctx.fillStyle = pal.mute;
  ctx.font = '500 42px "Familjen Grotesk", sans-serif';
  ctx.fillText(title, 540, 318);
  ctx.fillStyle = pal.ink;
  ctx.font = `760 250px ${DISPLAY}`;
  ctx.fillText(String(score).replace('-', '−'), 540, 570);
  ctx.fillStyle = pal.mute;
  ctx.font = '500 42px "Familjen Grotesk", sans-serif';
  ctx.fillText(of, 540, 640);
  paintRows(ctx, pal, rows, { x0: 60, y0: 730, w: 960, h: 800, thick: 2.1 });
  ctx.fillStyle = pal.ink;
  ctx.font = '600 46px "Familjen Grotesk", sans-serif';
  ctx.fillText(line, 540, 1640);
  if (address) {
    ctx.fillStyle = pal.mute;
    ctx.font = '500 40px "Familjen Grotesk", sans-serif';
    ctx.fillText(address, 540, 1712);
  }
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
