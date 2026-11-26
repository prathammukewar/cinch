// Shared drawing: the palette, the rubber band, the pegs, the pin and the ruler.
import { clamp, lerp } from './spring.js';

export function palette(el = document.documentElement) {
  const s = getComputedStyle(el);
  const g = (n) => s.getPropertyValue(n).trim();
  return {
    paper: g('--paper'), ink: g('--ink'), mute: g('--mute'), line: g('--line'),
    band: g('--band'), bandDark: g('--band-dark'), bandLite: g('--band-lite'),
    pin: g('--pin'), pinDark: g('--pin-dark'), steel1: g('--steel-1'), steel2: g('--steel-2'), steelInk: g('--steel-ink'),
    peg: g('--peg'), pegLite: g('--peg-lite'), shade: g('--shade'),
  };
}

export const DISPLAY = 'Anybody, "Arial Narrow", sans-serif';
export const TEXT = '"Familjen Grotesk", system-ui, sans-serif';

/** Size a canvas to its box at device resolution and return a context in CSS pixels. */
export function fit(canvas, maxRatio = 2) {
  const r = Math.min(maxRatio, globalThis.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * r) || canvas.height !== Math.round(h * r)) {
    canvas.width = Math.round(w * r);
    canvas.height = Math.round(h * r);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(r, 0, 0, r, 0, 0);
  return { ctx, w, h };
}

/**
 * Closed outline of a band around two posts.
 * shape: { xl, xr, y, sag, modes: [a1, a2, a3], back: [b1, b2, b3], r }
 */
export function bandPath(ctx, { xl, xr, yl, yr, sag, modes, back, r, sway = 0 }) {
  const n = clamp(Math.round((xr - xl) / 8), 6, 44);
  const at = (s, m, depth, off) => {
    const x = lerp(xl, xr, s) + sway * Math.sin(Math.PI * s);
    const base = lerp(yl, yr, s) + depth * 4 * s * (1 - s) + off;
    const wave = m[0] * Math.sin(Math.PI * s) + m[1] * Math.sin(2 * Math.PI * s) + m[2] * Math.sin(3 * Math.PI * s);
    return [x, base + wave];
  };
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const [x, y] = at(i / n, back, sag * 0.62, -r);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.arc(xr, yr, r, -Math.PI / 2, Math.PI / 2);
  for (let i = n; i >= 0; i--) {
    const [x, y] = at(i / n, modes, sag, r);
    ctx.lineTo(x, y);
  }
  ctx.arc(xl, yl, r, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}

/** Stroke the current path as rubber: dark edge, body, highlight. */
export function strokeRubber(ctx, pal, width) {
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = pal.bandDark;
  ctx.lineWidth = width + 2;
  ctx.stroke();
  ctx.strokeStyle = pal.band;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.save();
  ctx.translate(0, -width * 0.2);
  ctx.strokeStyle = pal.bandLite;
  ctx.lineWidth = Math.max(1, width * 0.18);
  ctx.globalAlpha *= 0.75;
  ctx.stroke();
  ctx.restore();
}

/** A ball-headed pin or peg. (x, y) is the tip, the head sits `len` above it. */
export function drawPin(ctx, { x, y, len, r, color, dark, lite, lean = 0, needle, squash = 0, alpha = 1 }) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.strokeStyle = needle;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -len + r * 0.4);
  ctx.stroke();
  ctx.translate(0, -len);
  ctx.scale(1 + squash * 0.2, 1 - squash * 0.2);
  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(-r * 0.06, -r * 0.1, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lite;
  ctx.beginPath();
  ctx.ellipse(-r * 0.36, -r * 0.42, r * 0.26, r * 0.17, -0.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A clamp-style peg: needle with a ribbed grip on top. (x, y) is the tip. */
export function drawPeg(ctx, { x, y, len, w, h, pal, lean = 0, squash = 0 }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.strokeStyle = pal.peg;
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -len + h * 0.3);
  ctx.stroke();
  ctx.translate(0, -len);
  ctx.scale(1 + squash * 0.12, 1 - squash * 0.1);
  ctx.fillStyle = pal.peg;
  ctx.beginPath();
  ctx.roundRect(-w / 2, -h / 2, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = pal.paper;
  ctx.globalAlpha *= 0.5;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const k of [-1, 0, 1]) { ctx.moveTo(k * w * 0.2, -h * 0.24); ctx.lineTo(k * w * 0.2, h * 0.24); }
  ctx.stroke();
  ctx.restore();
}

export function drawRuler(ctx, pal, { w, top, h, pad, marks }) {
  const g = ctx.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0, pal.steel1);
  g.addColorStop(1, pal.steel2);
  ctx.fillStyle = pal.shade;
  ctx.fillRect(0, top + h, w, 3);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, h);
  ctx.fillStyle = pal.steelInk;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(0, top, w, 1);
  ctx.globalAlpha = 1;
  const inner = w - pad * 2;
  const lens = [30, 20, 14, 8];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let lastRight = -Infinity;
  ctx.font = `600 ${w > 620 ? 15 : 13}px ${TEXT}`;
  for (const m of marks) {
    const x = Math.round(pad + m.t * inner) + 0.5;
    ctx.strokeStyle = pal.steelInk;
    ctx.globalAlpha = m.level === 0 ? 1 : m.level === 1 ? 0.85 : m.level === 2 ? 0.6 : 0.4;
    ctx.lineWidth = m.level === 0 ? 1.6 : 1;
    ctx.beginPath();
    ctx.moveTo(x, top + 1);
    ctx.lineTo(x, top + 1 + lens[m.level]);
    ctx.stroke();
    if (m.label) {
      const tw = ctx.measureText(m.label).width;
      const cx = clamp(x, tw / 2 + 5, w - tw / 2 - 5);
      if (cx - tw / 2 > lastRight + 9) {
        ctx.globalAlpha = m.level === 0 ? 1 : 0.7;
        ctx.fillStyle = pal.steelInk;
        ctx.fillText(m.label, cx, top + 50);
        lastRight = cx + tw / 2;
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** Engineering dimension line with arrowheads. */
export function dimension(ctx, x1, x2, y, color, reach = 10) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x1, y); ctx.lineTo(x2, y);
  ctx.moveTo(x1, y - reach); ctx.lineTo(x1, y + reach);
  ctx.moveTo(x2, y - reach); ctx.lineTo(x2, y + reach);
  ctx.stroke();
  const a = Math.min(7, Math.abs(x2 - x1) / 3);
  const d = Math.sign(x2 - x1) || 1;
  for (const [x, s] of [[x1, d], [x2, -d]]) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + s * a, y - a * 0.5);
    ctx.lineTo(x + s * a, y + a * 0.5);
    ctx.fill();
  }
}

/** Small tag with a pointer, used for peg values and the answer. */
export function tag(ctx, text, x, y, { fill, ink, font, w, align = 'center', padX = 8, h = 26, pointer = true }) {
  ctx.font = font;
  const tw = ctx.measureText(text).width + padX * 2;
  let left = align === 'center' ? x - tw / 2 : align === 'right' ? x - tw + 12 : x - 12;
  left = clamp(left, 4, w - tw - 4);
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(left, y - h, tw, h, 5);
  if (pointer) {
    const px = clamp(x, left + 9, left + tw - 9);
    ctx.moveTo(px - 5, y); ctx.lineTo(px, y + 6); ctx.lineTo(px + 5, y);
  }
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + padX, y - h / 2 + 1);
  return { left, right: left + tw };
}
