// Shared drawing for the ranch: the fence rail, the posts, the lasso and the horseshoe.
import { clamp, lerp } from './spring.js';

export function palette(el = document.documentElement) {
  const s = getComputedStyle(el);
  const g = (n) => s.getPropertyValue(n).trim();
  return {
    paper: g('--paper'), ink: g('--ink'), mute: g('--mute'), line: g('--line'),
    band: g('--band'), bandDark: g('--band-dark'), bandLite: g('--band-lite'),
    pin: g('--pin'), pinDark: g('--pin-dark'), steel1: g('--steel-1'), steel2: g('--steel-2'), steelInk: g('--steel-ink'),
    peg: g('--peg'), pegLite: g('--peg-lite'), shade: g('--shade'), card: g('--card'),
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

/** Stroke the current path as twisted rope: dark edge, body, twist marks, sheen. */
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
  ctx.setLineDash([width * 0.7, width * 0.9]);
  ctx.lineCap = 'butt';
  ctx.strokeStyle = pal.bandDark;
  ctx.globalAlpha *= 0.45;
  ctx.lineWidth = width * 0.75;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(0, -width * 0.22);
  ctx.strokeStyle = pal.bandLite;
  ctx.lineWidth = Math.max(1, width * 0.16);
  ctx.globalAlpha *= 0.6;
  ctx.stroke();
  ctx.restore();
}

/**
 * The horseshoe. (x, y) is where it rests; it stands open end down, about 2.5r tall.
 * len is kept for callers that measure from the tip and is not needed here.
 */
export function drawPin(ctx, { x, y, r, color, dark, lite, lean = 0, alpha = 1 }) {
  const H = r * 2.5;
  const W = r * 2.3;
  const t = r * 0.62;
  const cy = -H + W / 2;
  const shoe = () => {
    ctx.beginPath();
    ctx.moveTo(-W / 2, 0);
    ctx.lineTo(-W / 2, cy);
    ctx.arc(0, cy, W / 2, Math.PI, 0);
    ctx.lineTo(W / 2, 0);
    ctx.lineTo(W / 2 - t, 0);
    ctx.lineTo(W / 2 - t, cy);
    ctx.arc(0, cy, W / 2 - t, 0, Math.PI, true);
    ctx.lineTo(-W / 2 + t, 0);
    ctx.closePath();
  };
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.save(); ctx.translate(1.2, 1.6); shoe(); ctx.fillStyle = dark; ctx.fill(); ctx.restore();
  shoe(); ctx.fillStyle = color; ctx.fill();
  ctx.strokeStyle = lite; ctx.globalAlpha *= 0.7; ctx.lineWidth = Math.max(1, r * 0.14);
  ctx.beginPath(); ctx.arc(0, cy, W / 2 - t * 0.35, Math.PI * 1.15, Math.PI * 1.55); ctx.stroke();
  ctx.globalAlpha /= 0.7;
  ctx.fillStyle = dark;
  for (const k of [-0.9, -0.55, 0.55, 0.9]) {
    const ang = -Math.PI / 2 + k;
    const rr = W / 2 - t / 2;
    ctx.beginPath(); ctx.arc(Math.cos(ang) * rr, cy + Math.sin(ang) * rr, Math.max(0.8, r * 0.1), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** A fence post: a wooden pole with a capped top you grab. (x, y) is its foot. */
export function drawPeg(ctx, { x, y, len, w, h, pal, lean = 0, squash = 0 }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  const pole = Math.max(5, w * 0.34);
  ctx.fillStyle = pal.shade;
  ctx.fillRect(-pole / 2 + 1.5, -len + h * 0.3, pole, len - h * 0.3);
  ctx.fillStyle = pal.peg;
  ctx.fillRect(-pole / 2, -len + h * 0.3, pole, len - h * 0.3);
  ctx.translate(0, -len);
  ctx.scale(1 + squash * 0.12, 1 - squash * 0.1);
  ctx.fillStyle = pal.shade;
  ctx.beginPath(); ctx.roundRect(-w / 2 + 1.5, -h / 2 + 2, w, h, [w * 0.5, w * 0.5, 4, 4]); ctx.fill();
  ctx.fillStyle = pal.peg;
  ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, [w * 0.5, w * 0.5, 4, 4]); ctx.fill();
  ctx.strokeStyle = pal.pegLite;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-w * 0.18, -h * 0.28); ctx.quadraticCurveTo(-w * 0.05, 0, -w * 0.2, h * 0.36);
  ctx.moveTo(w * 0.16, -h * 0.2); ctx.quadraticCurveTo(w * 0.28, h * 0.05, w * 0.14, h * 0.38);
  ctx.stroke();
  ctx.restore();
}

export function drawRuler(ctx, pal, { w, top, h, pad, marks }) {
  // A split-rail fence rail: warm wood, grain, carved notches, burned numbers.
  const g = ctx.createLinearGradient(0, top, 0, top + h);
  g.addColorStop(0, pal.steel1);
  g.addColorStop(1, pal.steel2);
  ctx.fillStyle = pal.shade;
  ctx.fillRect(0, top + h, w, 4);
  ctx.fillStyle = g;
  ctx.fillRect(0, top, w, h);
  ctx.save();
  ctx.strokeStyle = pal.steelInk;
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const y0 = top + h * (0.58 + i * 0.1);
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 24) ctx.lineTo(x, y0 + Math.sin(x / (57 + i * 13) + i) * 2.2);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = pal.peg;
  ctx.fillRect(0, top, w, 2);
  ctx.restore();
  const inner = w - pad * 2;
  const lens = [26, 18, 12, 7];
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let lastRight = -Infinity;
  ctx.font = `600 ${w > 620 ? 15 : 13}px ${TEXT}`;
  for (const m of marks) {
    const x = Math.round(pad + m.t * inner) + 0.5;
    const a = m.level === 0 ? 0.95 : m.level === 1 ? 0.8 : m.level === 2 ? 0.6 : 0.4;
    ctx.globalAlpha = a * 0.6;
    ctx.strokeStyle = pal.pegLite;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x + 1, top + 2); ctx.lineTo(x + 1, top + 2 + lens[m.level]); ctx.stroke();
    ctx.globalAlpha = a;
    ctx.strokeStyle = pal.steelInk;
    ctx.lineWidth = m.level === 0 ? 2 : 1.2;
    ctx.beginPath(); ctx.moveTo(x, top + 2); ctx.lineTo(x, top + 2 + lens[m.level]); ctx.stroke();
    if (m.label) {
      const tw = ctx.measureText(m.label).width;
      const cx = clamp(x, tw / 2 + 5, w - tw / 2 - 5);
      if (cx - tw / 2 > lastRight + 9) {
        ctx.globalAlpha = m.level === 0 ? 1 : 0.75;
        ctx.fillStyle = pal.steelInk;
        ctx.fillText(m.label, cx, top + 47);
        lastRight = cx + tw / 2;
      }
    }
    ctx.globalAlpha = 1;
  }
}

/** A measuring line with arrowheads, for how far a miss was. */
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
export function tag(ctx, text, x, y, { fill, ink, font, w, align = 'center', padX = 8, h = 26, pointer = true, border }) {
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
  if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.stroke(); }
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, left + padX, y - h / 2 + 1);
  return { left, right: left + tw };
}

/** Colour with transparency, from a #rrggbb token. */
export function tint(hex, a) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/**
 * The points you would get, painted on the ruler: solid across your range, fading to
 * nothing half a range-width outside it (the same curve the score uses).
 */
export function pointsBand(ctx, pal, xl, xr, top, h, strength, fade = 0.5) {
  const reach = Math.max(0.5, fade * (xr - xl));
  const a = xl - reach;
  const b = xr + reach;
  const span = b - a || 1;
  const g = ctx.createLinearGradient(a, 0, b, 0);
  for (const f of [0, 0.25, 0.5, 0.75]) {
    const alpha = strength * f * f;
    g.addColorStop(((1 - f) * reach) / span * 0 + (f * reach) / span, tint(pal.band, alpha));
    g.addColorStop(1 - (f * reach) / span, tint(pal.band, alpha));
  }
  g.addColorStop(reach / span, tint(pal.band, strength));
  g.addColorStop(1 - reach / span, tint(pal.band, strength));
  ctx.fillStyle = g;
  ctx.fillRect(a, top, b - a, h);
  ctx.fillStyle = tint(pal.band, Math.min(1, strength * 2.4));
  ctx.fillRect(xl, top, xr - xl, 3);
}
