// Sound is off until the player turns it on, so the synthesizer loads only then.
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
const VIBRATE = { grab: 5, lock: 10, thunk: 18, twang: [10, 30, 16], slip: 20 };

export const sound = new Proxy({}, {
  get(_, name) {
    return (...args) => {
      if (!store.get('sound')) { if (VIBRATE[name]) buzz(VIBRATE[name]); return; }
      if (synth) synth[name]?.(...args); else load().then(() => synth[name]?.(...args));
    };
  },
});
