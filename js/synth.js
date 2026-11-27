// The ranch's sounds: recorded foley (wood, leather, rope, metal and bells, from Kenney's CC0 packs,
// see tools/sfx.py) and a plucked guitar and a whip crack made here, all played in a small wooden room.
// Loaded only once sound is switched on.
import { store } from './store.js';
import { SPRITE } from './sprite.js';

let ctx = null;
let out = null;
let room = null;
let guitar = null;
let lastDrag = 0;

// The recordings start downloading as soon as this file loads, and are decoded once audio is allowed.
let sprite = null;
let decoding = null;
const fetched = fetch('sfx/ranch.mp3').then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
function decodeSprite() {
  if (!decoding) {
    decoding = fetched
      .then((b) => b && new Promise((resolve) => ctx.decodeAudioData(b, resolve, () => resolve(null))))
      .then((buf) => { sprite = buf; });
  }
  return decoding;
}

// Guitar strings, in hertz.
const N = { E2: 82.41, B2: 123.47, E3: 164.81, G3: 196, Gs3: 207.65, A3: 220, B3: 246.94, D4: 293.66, E4: 329.63 };

function ready() {
  if (!store.get('sound') || document.hidden) return false;
  if (!ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.25;
    comp.connect(ctx.destination);
    out = ctx.createGain();
    out.gain.value = 0.8;
    out.connect(comp);
    // A small wooden room: a short, dark reverb tail made from fading noise.
    const len = Math.floor(ctx.sampleRate * 1.2);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4) * Math.min(1, i / 120);
    }
    const verb = ctx.createConvolver();
    verb.buffer = ir;
    const dark = ctx.createBiquadFilter();
    dark.type = 'lowpass'; dark.frequency.value = 3600;
    room = ctx.createGain();
    room.gain.value = 0.32;
    room.connect(verb); verb.connect(dark); dark.connect(comp);
    // The guitar's amp: no mud, a bit of bite around 2.5 kHz, and a little grit.
    const low = ctx.createBiquadFilter(); low.type = 'highpass'; low.frequency.value = 75;
    const bite = ctx.createBiquadFilter(); bite.type = 'peaking'; bite.frequency.value = 2500; bite.gain.value = 5; bite.Q.value = 0.9;
    const grit = ctx.createWaveShaper();
    grit.curve = Float32Array.from({ length: 1024 }, (_, i) => { const x = i / 511.5 - 1; return Math.tanh(1.8 * x) / Math.tanh(1.8); });
    guitar = ctx.createGain();
    const wet = ctx.createGain(); wet.gain.value = 0.7;
    guitar.connect(low); low.connect(bite); bite.connect(grit); grit.connect(out); grit.connect(wet); wet.connect(room);
    document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); });
  }
  decodeSprite();
  if (ctx.state === 'suspended') {
    // Resuming needs a tap or key press. Sounds scheduled now play the moment it resumes.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
    ctx.resume();
    return true;
  }
  return ctx.state === 'running';
}

/** One recorded sound from the sprite. from and len cut a short grain out of a longer sound. */
function play(name, { at = 0, gain = 0.4, rate = 1, wet = 0.2, from = 0, len } = {}) {
  const s = SPRITE[name];
  if (!sprite || !s) return;
  const t = ctx.currentTime + at + 0.005;
  // Each sound has 40 ms of silence ahead of it in the file; skip nearly all of it.
  from += 0.035;
  const dur = Math.max(0.02, Math.min(len ?? s[1], s[1] - from));
  const src = ctx.createBufferSource();
  src.buffer = sprite;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  if (len) {
    // A grain fades in and out so it never clicks.
    const end = t + dur / rate;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.setValueAtTime(gain, Math.max(t + 0.01, end - 0.025)); g.gain.linearRampToValueAtTime(0, end);
  } else g.gain.value = gain;
  src.connect(g); g.connect(out);
  if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(room); }
  src.start(t, s[0] + from, dur);
}

// A plucked string (Karplus-Strong): a burst of noise circulating in a delay as long as one period,
// softened a little on every pass, the way a real string loses its top end as it rings.
const strings = new Map();
function stringBuffer(f, dur, bright) {
  const key = `${f}|${dur}|${bright}`;
  if (strings.has(key)) return strings.get(key);
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * dur);
  const period = Math.max(2, Math.round(sr / f - 0.5));
  const buf = ctx.createBuffer(1, n, sr);
  const y = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < period; i++) { last += (Math.random() * 2 - 1 - last) * (0.3 + 0.65 * bright); y[i] = last; }
  // Picked near the bridge: take away a copy of the burst a seventh of the string along.
  const pick = Math.max(1, Math.round(period * 0.14));
  for (let i = period - 1; i >= pick; i--) y[i] -= 0.85 * y[i - pick];
  const keep = Math.pow(0.001, 1 / (dur * f));
  for (let i = period; i < n; i++) y[i] = keep * 0.5 * (y[i - period] + y[Math.max(0, i - period - 1)]);
  let peak = 0;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(y[i]));
  const fade = Math.floor(sr * 0.05);
  for (let i = 0; i < n; i++) y[i] = (y[i] / (peak || 1)) * (i > n - fade ? (n - i) / fade : 1);
  strings.set(key, buf);
  return buf;
}

function pluck(f, { at = 0, gain = 0.2, dur = 1.6, bright = 0.6, bend, vibrato } = {}) {
  const t = ctx.currentTime + at + 0.005;
  const src = ctx.createBufferSource();
  src.buffer = stringBuffer(f, dur, bright);
  if (bend) { src.playbackRate.setValueAtTime(1, t + 0.05); src.playbackRate.linearRampToValueAtTime(bend, t + 0.55); }
  if (vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.6;
    depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(0.012, t + 0.5);
    lfo.connect(depth); depth.connect(src.playbackRate);
    lfo.start(t); lfo.stop(t + dur);
  }
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g); g.connect(guitar);
  src.start(t);
}

/** Notes strummed downward, a hair apart. */
const strum = (notes, { at = 0, gap = 0.026, gain = 0.15, dur = 2 } = {}) => notes.forEach((f, i) => pluck(f, { at: at + i * gap, gain, dur, bright: 0.5 }));

/** Filtered noise: a fuse hiss, the puff of a blast, the wind. sweep moves the filter as it fades. */
let hiss = null;
function noise({ at = 0, gain = 0.05, attack = 0.01, decay = 0.4, freq = 2400, q = 0.8, type = 'bandpass', sweep, wet = 0.3 }) {
  if (!hiss) {
    hiss = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = hiss.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at + 0.005;
  const src = ctx.createBufferSource();
  src.buffer = hiss;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + attack + decay);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  src.connect(f); f.connect(g); g.connect(out);
  if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(room); }
  src.start(t, Math.random() * 0.5); src.stop(t + attack + decay + 0.05);
}

/** A low sine that drops: the body of a boom. */
function thump(f, { at = 0, gain = 0.15, decay = 0.4, glide }) {
  const t = ctx.currentTime + at + 0.005;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(f, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + decay * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  o.connect(g); g.connect(out);
  o.start(t); o.stop(t + decay + 0.05);
}

/** A whip: the crack is a tiny sonic boom, a bright snap with a short ringing tail. */
function crack(at = 0) {
  noise({ at, gain: 0.32, attack: 0.001, decay: 0.035, freq: 2800, type: 'highpass', q: 0.6, wet: 0.6 });
  noise({ at: at + 0.006, gain: 0.08, attack: 0.002, decay: 0.16, freq: 3600, sweep: 1500, q: 1.4, wet: 0.7 });
  thump(220, { at, gain: 0.08, decay: 0.06, glide: 120 });
}

const buzz = (p) => {
  // Vibration only after the player has touched the page, and never from the welcome animation.
  try { if (store.get('haptics') !== false && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(p); } catch { /* not supported */ }
};

export const synth = {
  unlock() { ready(); },
  /** A knock on wood for buttons. */
  tap() { if (ready()) play('tap', { gain: 0.32, wet: 0.08 }); },
  /** Hands on a post: leather. */
  grab() { buzz(5); if (ready()) play('grab', { gain: 0.55, wet: 0.08 }); },
  /** The rope creaks as a post moves, higher as the loop tightens. */
  drag(tension) {
    const now = performance.now();
    if (now - lastDrag < 90) return;
    lastDrag = now;
    if (ready()) play('creak', { gain: 0.1 + tension * 0.2, rate: 0.85 + tension * 0.45, from: Math.random() * 0.4, len: 0.1, wet: 0.04 });
  },
  release(tension) { if (ready()) play('settle', { gain: 0.2 + tension * 0.25, rate: 0.92 + tension * 0.25, wet: 0.12 }); },
  /** The loop is thrown. */
  lock() { buzz(10); if (ready()) play('swish', { gain: 0.6, rate: 1.12, wet: 0.18 }); },
  /** The shoe passing the notches. */
  tick(t) { if (ready()) play('tick', { gain: 0.06 + t * 0.05, rate: 1.1 + t * 0.5, wet: 0.04 }); },
  /** The shoe lands in the dirt. */
  thunk() { buzz(18); if (ready()) { play('thud', { gain: 0.8, wet: 0.12 }); play('soft', { gain: 0.25, at: 0.06, rate: 0.8 }); } },
  /** Roped: the shoe rings on the stake and a guitar answers, more of it the tighter the loop. */
  twang(tight) {
    buzz([10, 30, 16]);
    if (!ready()) return;
    play('clank', { gain: 0.5, rate: 0.9 + tight * 0.25, wet: 0.3 });
    if (tight > 0.55) play('bell', { gain: 0.16 + (tight - 0.55) * 0.4, at: 0.03, rate: 1 + tight * 0.15, wet: 0.5 });
    const notes = tight > 0.6 ? [N.E3, N.B3, N.E4] : tight > 0.3 ? [N.E3, N.B3] : [N.E3];
    notes.forEach((f, i) => pluck(f, { at: 0.05 + i * 0.075, gain: 0.2 - i * 0.025, dur: 1.4, bright: 0.7 }));
  },
  /** A miss: the shoe clatters off and a string sags. */
  slip() {
    buzz(20);
    if (!ready()) return;
    play('clatter', { gain: 0.45, rate: 0.92, wet: 0.25 });
    pluck(N.B2, { at: 0.08, gain: 0.16, dur: 1.2, bright: 0.45, bend: 0.84 });
  },
  fly() { if (ready()) play('swish2', { gain: 0.45, rate: 1.2, wet: 0.2 }); },
  /** The fuse catches. */
  fizz(big) { if (ready()) noise({ gain: big ? 0.05 : 0.035, attack: 0.03, decay: big ? 0.5 : 0.38, freq: 3800, sweep: 1600, q: 1.2 }); },
  /** Time is up: a pop, or the dynamite going off with rock and grit coming down. */
  blast(big) {
    buzz(big ? [30, 20, 40] : 16);
    if (!ready()) return;
    noise({ gain: big ? 0.18 : 0.08, attack: 0.004, decay: big ? 0.8 : 0.3, freq: big ? 2000 : 2600, sweep: 140, type: 'lowpass', q: 0.7, wet: 0.5 });
    thump(big ? 90 : 140, { gain: big ? 0.22 : 0.1, decay: big ? 0.6 : 0.25, glide: big ? 38 : 70 });
    play('rubble', { gain: big ? 0.55 : 0.25, at: 0.05, rate: big ? 0.8 : 1.05, wet: 0.35 });
  },
  /** Points counting up: tin clinks. */
  count(i) { if (ready() && i % 2 === 0) play('count', { gain: 0.11, rate: 1 + (i % 8) * 0.035, wet: 0.06 }); },
  /** The results, one row at a time: a bell for each catch. */
  line(i, hit) {
    if (!ready()) return;
    if (hit) play('bell', { gain: 0.2, rate: 0.92 + (i % 7) * 0.06, wet: 0.45 });
    else play('soft', { gain: 0.35, wet: 0.1 });
  },
  /** The round is over: a strummed chord, fuller for a bigger score. */
  finale(score) {
    if (!ready() || score <= 0) return;
    if (score > 300) strum([N.E2, N.B2, N.E3, N.Gs3, N.B3, N.E4], { gain: score > 500 ? 0.16 : 0.13, dur: 2.4 });
    else strum([N.E2, N.B2, N.E3, N.G3, N.B3], { gain: 0.11, dur: 2 });
    if (score > 500) play('bell-big', { gain: 0.3, at: 0.18, wet: 0.55 });
  },
  /** A short extra sting for the named throws at the top and bottom of the ladder. */
  tier(key) {
    if (!ready()) return;
    if (key === 'dead') {
      // A Dead cinch: a whip crack, a run up the strings, a held high note and the bell.
      buzz([12, 40, 12, 40, 24]);
      crack(0);
      [N.E3, N.G3, N.A3, N.B3, N.D4].forEach((f, i) => pluck(f, { at: 0.1 + i * 0.06, gain: 0.18, dur: 0.8, bright: 0.75 }));
      pluck(N.E4, { at: 0.42, gain: 0.26, dur: 2.6, bright: 0.8, vibrato: true });
      pluck(N.E2, { at: 0.42, gain: 0.16, dur: 2.6, bright: 0.4 });
      play('bell-ring', { gain: 0.32, at: 0.42, wet: 0.6 });
    } else if (key === 'ringer') {
      play('bell-big', { gain: 0.36, wet: 0.55 });
      pluck(N.E4, { at: 0.05, gain: 0.16, dur: 1.6, bright: 0.7 });
    } else if (key === 'hogtied') {
      play('buckle', { gain: 0.5, wet: 0.15 });
    } else if (key === 'leaner') {
      play('knock', { gain: 0.4, wet: 0.15 }); play('knock', { gain: 0.3, at: 0.13, rate: 0.9, wet: 0.15 });
    } else if (key === 'tumble') {
      noise({ gain: 0.05, attack: 0.35, decay: 1.3, freq: 450, sweep: 1300, q: 2.5, wet: 0.6 });
    }
  },
  /** Someone joins a Rodeo room. */
  hello() { if (ready()) strum([N.E3, N.B3, N.E4], { gap: 0.05, gain: 0.12, dur: 1.4 }); },
};
