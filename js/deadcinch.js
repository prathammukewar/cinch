// A throw worth 96 or more is a Dead cinch: old cow-country talk for a sure thing, after the saddle
// cinch pulled so tight it cannot slip. It gets its own moment: a gold brand stamped over the rail,
// sparks, and how rare it was. Loaded only when one happens.
import { allRows } from './store.js';
import { tierOf } from './score.js';

const CSS = `
.cm { position: fixed; inset: 0; z-index: 40; pointer-events: none; overflow: hidden; }
.cm > * { position: absolute; left: var(--cx); top: var(--cy); }
.cm .flash { width: 150vmax; height: 150vmax; margin: -75vmax; border-radius: 50%; background: radial-gradient(closest-side, rgba(255, 228, 140, .8), rgba(255, 196, 70, .28) 38%, transparent 70%); animation: cm-flash 1.7s ease-out both; }
.cm .ring { width: 130px; height: 130px; margin: -65px; border-radius: 50%; border: 5px solid #f2c443; animation: cm-ring .9s ease-out .1s both; }
.cm .ring.r2 { border-width: 2px; animation-delay: .24s; }
.cm .bit { width: 7px; height: 13px; margin: -6px -3px; border-radius: 2px; background: linear-gradient(#ffe68e, #cf9314); animation: cm-bit 1.6s cubic-bezier(.2, .7, .4, 1) var(--d) both; }
.cm .bit.s { width: 9px; height: 9px; margin: -4px; border-radius: 50%; background: radial-gradient(#fffbe6, #f2c443 60%, transparent 70%); }
.cm .stamp { width: min(360px, 80vw); aspect-ratio: 5 / 3; translate: -50% -50%; display: grid; place-content: center; justify-items: center; gap: 4px; animation: cm-stamp 2.5s cubic-bezier(.2, .9, .3, 1.1) both; }
.cm .stamp svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; filter: drop-shadow(0 12px 22px rgba(60, 30, 0, .4)); }
.cm .stamp b { position: relative; font: 800 clamp(22px, 6.4vw, 34px)/1 var(--display); font-stretch: 100%; color: #3a2008; text-transform: uppercase; letter-spacing: .5px; text-shadow: 0 1.5px 0 rgba(255, 245, 210, .7); }
.cm .stamp small { position: relative; font: 700 12.5px var(--text); letter-spacing: 3px; text-transform: uppercase; color: #6a4410; }
.cm .stamp .shine { position: absolute; inset: 0; clip-path: ellipse(48% 46% at 50% 50%); overflow: hidden; }
.cm .stamp .shine::after { content: ''; position: absolute; inset: -20% auto -20% 0; width: 30%; background: linear-gradient(100deg, transparent, rgba(255, 255, 255, .75), transparent); translate: -120% 0; rotate: 12deg; animation: cm-shine 1s ease-in-out .5s both; }
.cm .count { width: 90vw; margin-left: -45vw; margin-top: min(122px, 29vw); text-align: center; font: 600 16px var(--text); color: var(--ink); text-shadow: 0 0 12px var(--paper), 0 0 4px var(--paper); animation: cm-count 2.5s ease both; }
@keyframes cm-flash { 0% { opacity: 0; transform: scale(.15); } 12% { opacity: 1; } 100% { opacity: 0; transform: scale(1); } }
@keyframes cm-ring { from { opacity: 1; transform: scale(.4); } to { opacity: 0; transform: scale(5.5); } }
@keyframes cm-bit { 0% { opacity: 0; transform: none; } 6% { opacity: 1; } 55% { opacity: 1; transform: translate(var(--x), var(--y)) rotate(var(--r)); } 100% { opacity: 0; transform: translate(calc(var(--x) * 1.15), calc(var(--y) + 110px)) rotate(calc(var(--r) * 2.2)); } }
@keyframes cm-stamp { 0% { opacity: 0; transform: scale(2.8) rotate(-17deg); } 13% { opacity: 1; transform: scale(.88) rotate(-5deg); } 19% { transform: scale(1.06) rotate(-7deg); } 25%, 80% { opacity: 1; transform: scale(1) rotate(-6deg); } 100% { opacity: 0; transform: translateY(-26px) scale(.96) rotate(-6deg); } }
@keyframes cm-shine { to { translate: 420% 0; } }
@keyframes cm-count { 0%, 24% { opacity: 0; transform: translateY(8px); } 34%, 82% { opacity: 1; transform: none; } 100% { opacity: 0; } }
.play.cinched > .desk, .play.cinched > .ask { animation: cm-shake .44s .08s both; }
@keyframes cm-shake { 20% { translate: -7px 3px; } 40% { translate: 6px -3px; } 60% { translate: -3px 2px; } 80% { translate: 2px -1px; } }
@media (prefers-reduced-motion: reduce) {
  .cm .flash, .cm .ring, .cm .bit, .cm .stamp .shine { display: none; }
  .cm .stamp, .cm .count { animation: cm-still 2.5s both; transform: rotate(-6deg); }
  .cm .count { transform: none; }
  .play.cinched > * { animation: none; }
}
@keyframes cm-still { 0%, 100% { opacity: 0; } 8%, 86% { opacity: 1; } }
`;
document.head.append(Object.assign(document.createElement('style'), { textContent: CSS }));

// A gold oval with a rope ring inside it, like a buckle or a brand on leather.
const BADGE = '<svg viewBox="0 0 500 300" aria-hidden="true"><defs>'
  + '<linearGradient id="cm-g" x2="0" y2="1"><stop offset="0" stop-color="#fff0b0"/><stop offset=".42" stop-color="#f2c443"/><stop offset="1" stop-color="#c58a10"/></linearGradient></defs>'
  + '<ellipse cx="250" cy="150" rx="242" ry="142" fill="url(#cm-g)" stroke="#3a2008" stroke-width="6"/>'
  + '<ellipse cx="250" cy="150" rx="226" ry="127" fill="none" stroke="#fff3c4" stroke-width="2" opacity=".7"/>'
  + '<ellipse cx="250" cy="150" rx="208" ry="110" fill="none" stroke="#3a2008" stroke-width="13"/>'
  + '<ellipse cx="250" cy="150" rx="208" ry="110" fill="none" stroke="#c89d5e" stroke-width="8"/>'
  + '<ellipse cx="250" cy="150" rx="208" ry="110" fill="none" stroke="#f6e0b0" stroke-width="2.6" stroke-dasharray="7 8"/>'
  + [60, 440].map((x) => `<path transform="translate(${x} 150) scale(.75)" d="M0-15L4.4-4.6 15.6-4.6 6.6 2.2 9.8 13.2 0 6.6-9.8 13.2-6.6 2.2-15.6-4.6-4.4-4.6Z" fill="#3a2008"/>`).join('')
  + '</svg>';

const ordinal = (n) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';
  return `${n}${s}`;
};

/** How many Dead cinches this player has thrown, out of how many throws, counting the round on screen. */
function tally(roundRows) {
  const seen = new Set();
  let all = 0;
  let dead = 0;
  for (const r of [...allRows(), ...roundRows]) {
    const k = `${r.id}@${r.at}`;
    if (seen.has(k)) continue;
    seen.add(k);
    all += 1;
    if (tierOf(r).key === 'dead') dead += 1;
  }
  return { all, dead: Math.max(1, dead) };
}

/** Stamp the brand over the rail. */
export function celebrate(play, roundRows = []) {
  if (!play?.isConnected) return;
  const desk = play.querySelector('.desk');
  const box = (desk || play).getBoundingClientRect();
  const { all, dead } = tally(roundRows);
  const line = dead === 1 ? 'Your first one' : `Your ${ordinal(dead)} in ${all.toLocaleString()} throws`;
  const bits = Array.from({ length: 28 }, (_, i) => {
    const a = (i / 28) * Math.PI * 2 + (i % 2) * 0.11;
    const r = 120 + ((i * 37) % 110);
    return `<i class="bit${i % 3 ? '' : ' s'}" style="--x:${Math.round(Math.cos(a) * r)}px;--y:${Math.round(Math.sin(a) * r * 0.75 - 30)}px;--r:${(i * 83) % 360}deg;--d:${((i % 5) * 0.03).toFixed(2)}s"></i>`;
  }).join('');
  const el = document.createElement('div');
  el.className = 'cm';
  el.setAttribute('aria-hidden', 'true');
  el.style.setProperty('--cx', `${Math.round(box.left + box.width / 2)}px`);
  el.style.setProperty('--cy', `${Math.round(box.top + box.height * 0.46)}px`);
  el.innerHTML = `<i class="flash"></i><i class="ring"></i><i class="ring r2"></i>${bits}`
    + `<div class="stamp">${BADGE}<span class="shine"></span><b>Dead cinch</b><small>A sure thing</small></div><p class="count">${line}</p>`;
  document.body.append(el);
  play.classList.add('cinched');
  setTimeout(() => { el.remove(); play.classList.remove('cinched'); }, 2600);
}
