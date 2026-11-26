// Sound is off until the player turns it on, so the synthesizer loads only then.
import { store } from './store.js';

let synth = null;
let loading = null;
const load = () => {
  if (!loading) loading = import('./synth.js').then((m) => { synth = m.synth; });
  return loading;
};
const buzz = (p) => { try { if (store.get('haptics') !== false) navigator.vibrate?.(p); } catch { /* not supported */ } };
const VIBRATE = { grab: 6, lock: 12, thunk: 24, twang: [14, 30, 22], slip: 30 };

export const sound = new Proxy({}, {
  get(_, name) {
    return (...args) => {
      if (!store.get('sound')) { if (VIBRATE[name]) buzz(VIBRATE[name]); return; }
      if (synth) synth[name]?.(...args); else load().then(() => synth[name]?.(...args));
    };
  },
});
