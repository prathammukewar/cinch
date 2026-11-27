// Sound is on by default. Browsers keep audio locked until the first tap or key press,
// so the synthesizer loads early and wakes up on that first touch, wherever it lands.
import { store } from './store.js';

let synth = null;
let loading = null;
const load = () => {
  if (!loading) loading = import('./synth.js').then((m) => { synth = m.synth; });
  return loading;
};
const buzz = (p) => {
  // Vibration only after the player has touched the page, and never from the welcome animation.
  try { if (store.get('haptics') !== false && navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(p); } catch { /* not supported */ }
};
const VIBRATE = { grab: 5, lock: 10, thunk: 18, twang: [10, 30, 16], slip: 20, blast: 16 };

const wake = () => {
  if (!store.get('sound')) return;
  if (synth) synth.unlock(); else load().then(() => synth.unlock());
};
for (const type of ['pointerdown', 'touchend', 'keydown', 'click']) document.addEventListener(type, wake, { capture: true, passive: true });
if (store.get('sound')) {
  const early = () => load();
  if ('requestIdleCallback' in globalThis) requestIdleCallback(early, { timeout: 1500 }); else setTimeout(early, 300);
}

export const sound = new Proxy({}, {
  get(_, name) {
    return (...args) => {
      if (!store.get('sound')) { if (VIBRATE[name]) buzz(VIBRATE[name]); return; }
      if (synth) synth[name]?.(...args); else load().then(() => synth[name]?.(...args));
    };
  },
});
