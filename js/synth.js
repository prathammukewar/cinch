// Short synthesized sounds, loaded only once sound is switched on.
import { store } from './store.js';

let ctx = null;
let out = null;
let lastDrag = 0;

function ready() {
  if (!store.get('sound')) return false;
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    out.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return true;
}

function tone({ f, to, type = 'sine', dur = 0.12, gain = 0.2, at = 0, attack = 0.003 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise({ dur = 0.06, gain = 0.2, freq = 1200, q = 1, at = 0, type = 'bandpass', to }) {
  const t = ctx.currentTime + at;
  const n = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t);
}

/** Plucked string (Karplus-Strong): a short noise burst through a tuned, damped delay. */
function pluck(freq, { dur = 0.9, gain = 0.5, damp = 0.985, at = 0, bend = 0 } = {}) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * dur);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const size = Math.max(2, Math.round(sr / freq));
  const ring = new Float32Array(size);
  for (let i = 0; i < size; i++) ring[i] = (Math.random() * 2 - 1) * (i < size * 0.5 ? 1 : 0.5);
  let p = 0;
  for (let i = 0; i < n; i++) {
    const next = (p + 1) % size;
    d[i] = ring[p];
    ring[p] = (ring[p] + ring[next]) * 0.5 * damp;
    p = next;
  }
  const s = ctx.createBufferSource();
  s.buffer = buf;
  const t = ctx.currentTime + at;
  if (bend) {
    s.playbackRate.setValueAtTime(1 + bend, t);
    s.playbackRate.exponentialRampToValueAtTime(1, t + 0.12);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g); g.connect(out);
  s.start(t);
}

const buzz = (p) => { try { if (store.get('haptics') !== false) navigator.vibrate?.(p); } catch { /* not supported */ } };

export const synth = {
  unlock() { ready(); },
  grab() { buzz(6); if (ready()) noise({ dur: 0.025, gain: 0.16, freq: 900 }); },
  drag(tension) {
    const now = performance.now();
    if (now - lastDrag < 38) return;
    lastDrag = now;
    if (ready()) noise({ dur: 0.014, gain: 0.07 + tension * 0.05, freq: 1400 + tension * 2600, q: 5 });
  },
  release(tension) { if (ready()) pluck(70 + tension * 120, { dur: 0.28, gain: 0.12 + tension * 0.12, damp: 0.95 }); },
  lock() { buzz(12); if (ready()) { tone({ f: 190, to: 90, dur: 0.09, gain: 0.28, type: 'triangle' }); noise({ dur: 0.03, gain: 0.14, freq: 2400 }); } },
  tick(t) { if (ready()) tone({ f: 620 + t * 360, dur: 0.028, gain: 0.07, type: 'square' }); },
  thunk() { buzz(24); if (ready()) { tone({ f: 150, to: 52, dur: 0.18, gain: 0.5 }); noise({ dur: 0.05, gain: 0.3, freq: 700 }); } },
  twang(tight) {
    buzz([14, 30, 22]);
    if (!ready()) return;
    const f = 96 + tight * 130;
    pluck(f, { dur: 0.7 + tight * 0.7, gain: 0.6, damp: 0.984 + tight * 0.01, bend: 0.5 });
    pluck(f * 1.5, { dur: 0.5 + tight * 0.5, gain: 0.26 + tight * 0.14, damp: 0.985, at: 0.012, bend: 0.4 });
    if (tight > 0.6) pluck(f * 2, { dur: 1, gain: 0.26, damp: 0.991, at: 0.05 });
  },
  slip() { buzz(30); if (ready()) noise({ dur: 0.09, gain: 0.3, freq: 900, to: 3800, q: 2 }); },
  fly() {
    if (!ready()) return;
    pluck(150, { dur: 0.4, gain: 0.42, damp: 0.95, bend: 1.3 });
    tone({ f: 340, to: 90, dur: 0.4, gain: 0.1, type: 'sawtooth', attack: 0.02 });
  },
  count(i) { if (ready()) tone({ f: 480 + i * 24, dur: 0.03, gain: 0.05, type: 'triangle' }); },
  line(i, hit) { if (ready()) { if (hit) pluck(110 * Math.pow(2, [0, 2, 4, 7, 9, 12, 14][i % 7] / 12), { dur: 0.7, gain: 0.36, damp: 0.989 }); else tone({ f: 120, to: 70, dur: 0.16, gain: 0.2, type: 'triangle' }); } },
  finale(score) { if (ready() && score > 300) [0, 4, 7, 12].forEach((s, i) => pluck(196 * Math.pow(2, s / 12), { dur: 1.4, gain: 0.3, damp: 0.993, at: i * 0.07 })); },
};
