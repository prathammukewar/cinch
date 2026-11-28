// Calm, synthesized sounds: soft mallets and glass chimes on a pentatonic scale, in a small room.
// Loaded only once sound is switched on.
import { store } from './store.js';

let ctx = null;
let out = null;
let room = null;
let lastDrag = 0;

// D major pentatonic, so any notes that overlap still agree with each other.
const SCALE = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.26, 739.99, 880.0, 987.77, 1174.66, 1318.51];
const note = (i) => SCALE[Math.max(0, Math.min(SCALE.length - 1, Math.round(i)))];

function ready() {
  if (!store.get('sound') || document.hidden) return false;
  if (!ctx && navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
  if (!ctx) {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    out = ctx.createGain();
    out.gain.value = 0.7;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass'; soften.frequency.value = 5200; soften.Q.value = 0.4;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.3;
    out.connect(soften); soften.connect(comp); comp.connect(ctx.destination);
    // A quiet room: two filtered echoes feeding back into each other.
    room = ctx.createGain();
    room.gain.value = 0.22;
    const d1 = ctx.createDelay(1); d1.delayTime.value = 0.137;
    const d2 = ctx.createDelay(1); d2.delayTime.value = 0.211;
    const fb = ctx.createGain(); fb.gain.value = 0.42;
    const dark = ctx.createBiquadFilter(); dark.type = 'lowpass'; dark.frequency.value = 2200;
    room.connect(d1); d1.connect(d2); d2.connect(dark); dark.connect(fb); fb.connect(d1);
    dark.connect(soften);
    document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); });
  }
  if (ctx.state === 'suspended') {
    // Resuming needs a tap or key press. Notes scheduled now play the moment it resumes.
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return false;
    ctx.resume();
    return true;
  }
  return ctx.state === 'running';
}

/** A partial: one sine with a soft attack and a long natural fade. */
function partial(f, { at = 0, gain = 0.1, attack = 0.004, decay = 0.4, wet = 0.5, type = 'sine', glide }) {
  const t = ctx.currentTime + at + 0.005;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + decay * 0.8);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  o.connect(g); g.connect(out);
  if (wet) { const s = ctx.createGain(); s.gain.value = wet; g.connect(s); s.connect(room); }
  o.start(t); o.stop(t + attack + decay + 0.05);
}

/** Wooden mallet: a fundamental and a quick, quiet fourth harmonic. */
function mallet(f, gain = 0.08, decay = 0.35, at = 0) {
  partial(f, { at, gain, decay, wet: 0.35 });
  partial(f * 4, { at, gain: gain * 0.18, decay: decay * 0.25, wet: 0.2 });
}

/** Glass chime: a bell-like inharmonic partial over a long tail. */
function chime(f, gain = 0.07, at = 0, decay = 1.6) {
  partial(f, { at, gain, decay, attack: 0.006, wet: 0.8 });
  partial(f * 2.756, { at, gain: gain * 0.25, decay: decay * 0.45, wet: 0.8 });
  partial(f * 5.4, { at, gain: gain * 0.06, decay: decay * 0.2, wet: 0.6 });
}

/** Filtered noise: a fuse hiss or the puff of a blast. sweep moves the filter to that frequency as it fades. */
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

const buzz = (p) => {
  // Vibration only after the player has touched the page, and never from the welcome animation.
  try { if (store.get('haptics') !== false && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(p); } catch { /* not supported */ }
};

export const synth = {
  unlock() { ready(); },
  tap() { if (ready()) mallet(note(10), 0.035, 0.12); },
  grab() { buzz(5); if (ready()) mallet(note(8), 0.045, 0.16); },
  drag(tension) {
    const now = performance.now();
    if (now - lastDrag < 70) return;
    lastDrag = now;
    if (ready()) mallet(note(4 + tension * 10), 0.018, 0.09);
  },
  release(tension) { if (ready()) mallet(note(3 + tension * 6), 0.04, 0.5); },
  lock() { buzz(10); if (ready()) { chime(note(10), 0.045); chime(note(12), 0.04, 0.09); } },
  tick(t) { if (ready()) mallet(note(9 + t * 6), 0.016, 0.1); },
  thunk() { buzz(18); if (ready()) { partial(150, { gain: 0.16, decay: 0.32, glide: 82, wet: 0.25 }); mallet(note(0), 0.05, 0.5); } },
  twang(tight) {
    buzz([10, 30, 16]);
    if (!ready()) return;
    const chord = tight > 0.6 ? [5, 7, 9, 12, 14] : tight > 0.3 ? [5, 7, 9, 12] : [5, 7, 9];
    chord.forEach((n, i) => chime(note(n), 0.055 - i * 0.004, 0.02 + i * 0.075));
    partial(note(0), { gain: 0.08, decay: 0.9, wet: 0.5 });
  },
  slip() { buzz(20); if (ready()) partial(note(8), { gain: 0.05, decay: 0.55, glide: note(3), wet: 0.6, type: 'triangle' }); },
  fly() { if (ready()) { mallet(note(4), 0.05, 0.6); mallet(note(1), 0.04, 0.8, 0.14); } },
  /** The fuse catches. */
  fizz(big) { if (ready()) noise({ gain: big ? 0.05 : 0.035, attack: 0.03, decay: big ? 0.5 : 0.38, freq: 3800, sweep: 1600, q: 1.2 }); },
  /** Time is up: a pop, or the dynamite going off. */
  blast(big) {
    buzz(big ? [30, 20, 40] : 16);
    if (!ready()) return;
    noise({ gain: big ? 0.16 : 0.07, attack: 0.004, decay: big ? 0.7 : 0.3, freq: big ? 1800 : 2600, sweep: 160, type: 'lowpass', q: 0.7, wet: 0.5 });
    partial(big ? 92 : 140, { gain: big ? 0.2 : 0.09, decay: big ? 0.55 : 0.25, glide: big ? 40 : 70, wet: 0.3 });
  },
  count(i) { if (ready() && i % 2 === 0) mallet(note(9 + (i % 6)), 0.012, 0.07); },
  line(i, hit) { if (ready()) { if (hit) chime(note(7 + (i % 7)), 0.04, 0, 1.1); else mallet(note(2), 0.035, 0.4); } },
  finale(score) {
    if (!ready() || score <= 0) return;
    const n = score > 500 ? 6 : score > 300 ? 5 : 4;
    [5, 7, 9, 12, 14, 16].slice(0, n).forEach((s, i) => chime(note(s), 0.045, i * 0.11, 2.2));
  },
  /** A short extra sting for the named throws at the top and bottom of the ladder. */
  tier(key) {
    if (!ready()) return;
    if (key === 'dead') {
      buzz([12, 40, 12, 40, 24]);
      [7, 9, 12, 14, 16, 19, 21].forEach((s, i) => chime(note(s), 0.05 - i * 0.003, i * 0.07, 2.6));
      chime(note(24), 0.03, 0.55, 3);
    } else if (key === 'ringer') {
      chime(note(14), 0.05, 0, 2); chime(note(19), 0.04, 0.14, 2.2);
    } else if (key === 'hogtied') {
      mallet(note(9), 0.04, 0.2); mallet(note(12), 0.04, 0.25, 0.09);
    } else if (key === 'leaner') {
      mallet(note(7), 0.04, 0.18); mallet(note(6), 0.035, 0.3, 0.16);
    } else if (key === 'tumble') {
      partial(note(4), { gain: 0.035, decay: 1.2, glide: note(0), wet: 0.8, type: 'triangle' });
    }
  },
  hello() { if (ready()) [7, 9, 12].forEach((s, i) => chime(note(s), 0.035, i * 0.12, 1.8)); },
};
