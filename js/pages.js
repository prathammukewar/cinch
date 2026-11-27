// Screens that are not needed for the first question. Loaded when opened.
import { NAME, QUANT_LENGTH, QUANT_SECONDS, CURVE_MIN } from './config.js';
import { dayKey, keyOf, longDate, streaks } from './day.js';
import { practicePool, index } from './bank.js';
import { store, askPersist, exportSave, importSave, allRows } from './store.js';
import { total, kindOf, wilson, tierOf, TIERS, LEANER, HINTS } from './score.js';
import { ICONS } from './share.js';
import * as acct from './account.js';

const LADDER = {
  dead: '96 to 100 points',
  ringer: '81 to 95',
  hogtied: '61 to 80',
  roped: '41 to 60',
  leaner: '41 or more on a near miss',
  snagged: '21 to 40',
  dust: '1 to 20',
  tumble: '0',
};
import { Round } from './play.js';
import { verdict, verdictText, byCategory, rateChart, curveChart, bandAt } from './dash.js';
import { h, $, toast, signed, plus } from './dom.js';

let main, ctx;
export function init(c) { ctx = c; main = c.main; }
const liveDays = () => ctx.liveDays();
const paintTheme = () => ctx.paintTheme();
const paintSound = () => ctx.paintSound();
const paintPips = (...a) => ctx.paintPips(...a);
const picker = (pool) => ctx.picker(pool);
const resultView = (o) => ctx.resultView(o);
const setCurrent = (v) => ctx.setCurrent(v);
const getCurrent = () => ctx.getCurrent();
const getToday = () => ctx.today();

export async function showQuant() {
  const pool = await practicePool();
  const start = () => {
    getCurrent()?.destroy?.();
    const list = ctx.pickSet(pool, QUANT_LENGTH);
    paintPips([], QUANT_LENGTH);
    setCurrent(new Round(main, {
      length: list.length,
      seconds: QUANT_SECONDS,
      next: (i) => list[i] || null,
      label: (i) => `Quick Draw, ${i + 1} of ${list.length}`,
      lastText: 'See your Quick Draw',
      onRow: (row, q) => store.change((d) => { d.practice.seen[q.id] = (d.practice.seen[q.id] || 0) + 1; }),
      onEnd: async (rows) => {
        await ctx.kit();
        store.change((d) => { d.quant.runs.push({ at: Date.now(), rows, points: total(rows) }); });
        getCurrent()?.destroy?.();
        const best = Math.max(...store.data().quant.runs.map((r) => r.points));
        const view = resultView({
          rows, questions: list, instant: false, heading: 'Quick Draw', of: list.length * 100, shareTitle: 'Quick Draw',
          third: () => ['Best draw', signed(best)], extras: [h('a', { class: 'go quiet', href: '#home' }, 'Home')], restart: start, restartText: 'Draw again',
        });
        main.replaceChildren(view.el);
        setCurrent(view);
        view.start();
      },
    }));
  };
  const runs = store.data().quant.runs;
  main.replaceChildren(h('div', { class: 'page' },
    h('h1', {}, 'Quick Draw'),
    h('p', { class: 'lede' }, `Ten questions, ${QUANT_SECONDS} seconds each.`),
    runs.length ? h('dl', { class: 'statline' }, h('div', {}, h('dt', {}, 'Draws'), h('dd', { class: 'num' }, String(runs.length))), h('div', {}, h('dt', {}, 'Best'), h('dd', { class: 'num' }, signed(Math.max(...runs.map((r) => r.points))))), h('div', {}, h('dt', {}, 'Roped'), h('dd', { class: 'num' }, `${Math.round(100 * rate(runs.flatMap((r) => r.rows)))}%`))) : null,
    h('p', { style: 'margin-top:28px' }, h('button', { class: 'go', type: 'button', id: 'start-quant', onclick: start }, 'Light the fuse'))));
}
const rate = (rows) => (rows.length ? rows.filter((r) => r.hit).length / rows.length : 0);

export async function showArchive() {
  const idx = await index();
  const d = store.data();
  const items = [];
  const today = getToday();
  for (let n = today; n >= Math.max(1, today - 59); n--) {
    const rec = d.days[n];
    items.push(h('li', {}, h('a', { href: n === today ? '#today' : `#day/${n}` },
      h('span', { class: 'n num' }, String(n)),
      h('span', {}, n === today ? 'Today' : longDate(keyOf(n)), ' ', rec ? h('span', { class: 'dots', 'aria-label': `${rec.rows.filter((r) => r.hit).length} of ${rec.rows.length} caught` }, rec.rows.map((r) => h('i', { class: `${kindOf(r)} t-${tierOf(r).key}` }))) : null),
      rec ? h('span', { class: 's num' }, signed(total(rec.rows))) : h('span', { class: 's none' }, d.open?.[n] ? 'resume' : 'play'))));
  }
  main.replaceChildren(h('div', { class: 'page' }, h('h1', {}, 'Old Trails'),
    h('p', { class: 'lede' }, 'Every earlier Roundup.'),
    h('ul', { class: 'list' }, items),
    idx.days < getToday() ? h('p', { class: 'fine', style: 'margin-top:20px' }, 'Older questions are coming round again.') : null));
}

export async function showCalibration() {
  const { showBook } = await import('./book.js');
  showBook(main, { liveDays: liveDays(), today: getToday() });
}
const stat = (k, v) => h('div', {}, h('dt', {}, k), h('dd', { class: 'num' }, v));

export async function showSources() {
  const list = await fetch('data/credits.json').then((r) => r.json()).catch(() => []);
  main.replaceChildren(h('div', { class: 'page' },
    h('h1', {}, 'Sources'),
    h('p', { class: 'lede' }, 'Every answer links to its source.'),
    h('ul', { class: 'credits' }, list.map((c) => h('li', {}, h('span', {}, c.name), h('span', { class: 'fine' }, `${c.licence}, ${c.n} ${c.n === 1 ? 'question' : 'questions'}`)))),
    h('h2', {}, 'Notices'),
    h('p', {}, 'The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at "', h('a', { href: 'https://www.retrosheet.org' }, 'www.retrosheet.org'), '".'),
    h('p', {}, 'Animal ages, pregnancies and weights come from AnAge: Tacutu R. et al. (2018), Human Ageing Genomic Resources, Nucleic Acids Research 46(D1):D1083-D1090.'),
    h('p', {}, 'Food figures are from USDA FoodData Central. World figures are from World Bank Open Data and from FAO through Our World in Data, both under CC BY 4.0. Wikidata facts are CC0 and were each checked against the matching English Wikipedia article.'),
    h('p', {}, 'Fonts: Anybody and Familjen Grotesk, both under the SIL Open Font License.'),
    h('p', { class: 'foot' }, 'Spot a wrong number? The source link on each answer is the place to start.')));
}

export function showScoring() {
  const ladder = [...TIERS.slice(0, 4), LEANER, ...TIERS.slice(4)];
  main.replaceChildren(h('div', { class: 'page' },
    h('h1', {}, 'Ranch rules'),
    h('p', { class: 'lede' }, 'Set a loop you are 90% sure holds the answer. Tighter loops score more.'),
    h('h2', {}, 'Points'),
    h('p', {}, 'Inside your loop: 100 minus the share of the rail it covers. Just outside, the points fade to zero. Never below zero.'),
    h('h2', {}, 'Hints'),
    h('p', {}, `Fence in shortens the rail to a stretch that holds the answer, somewhere in it: ${Math.round(HINTS.fence[1] * 100)}% of the points, or ${Math.round(HINTS.fence[2] * 100)}% twice. Scout shows two known numbers of the same kind: ${Math.round(HINTS.scout * 100)}%.`),
    h('h2', {}, 'Names for a throw'),
    h('ul', { class: 'ladder' }, ladder.map((t) => h('li', {}, h('span', { class: `tier-pill t-${t.key}` }, t.name), ' ', LADDER[t.key]))),
    h('p', {}, 'In a shared result: ', ladder.map((t) => `${ICONS[t.key]} ${t.name}`).join(', '), '.'),
    h('h2', {}, 'The rail'),
    h('p', {}, 'Rails of the same kind are the same length: a factor of 100 for big numbers, 150 years, 1,000 degrees, 0 to 100%.'),
    h('h2', {}, 'Sources'),
    h('p', {}, 'Every answer links to its source. Spot a wrong one? ', h('a', { href: 'https://github.com/prathammukewar/cinch/issues/new?title=Wrong%20number', target: '_blank', rel: 'noopener noreferrer' }, 'Report it'), '.'),
    h('p', { class: 'foot' }, 'Made by Pratham Mukewar.')));
}

export function showSettings() {
  const seg = (name, options) => {
    const wrap = h('div', { class: 'seg', role: 'group', 'aria-label': name });
    const paint = () => wrap.replaceChildren(...options.map(([v, text]) => h('button', { type: 'button', 'aria-pressed': String(store.get(name) === v), onclick: () => { store.set(name, v); paint(); paintTheme(); paintSound(); } }, text)));
    paint();
    return wrap;
  };
  const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, id: 'restore-file', onchange: async (e) => {
    try {
      const { days } = importSave(await e.target.files[0].text());
      toast(days ? `Restored ${days} ${days === 1 ? 'day' : 'days'}` : 'Restored, nothing new');
      paintTheme(); paintSound();
    } catch { toast('That file is not a backup from this game'); }
    e.target.value = '';
  } });
  const keep = h('p', {}, '');
  (async () => {
    const ok = await navigator.storage?.persisted?.().catch(() => null);
    keep.textContent = store.memoryOnly ? 'This browser is blocking storage, so nothing is kept after you close the page.' : ok ? '' : 'Browsers can clear it after a long time away, so keep a backup.';
  })();
  main.replaceChildren(h('div', { class: 'page' }, h('h1', {}, 'Saddlebag'), h('p', { class: 'lede' }, 'Settings and backups.'),
    h('div', { class: 'set' }, h('div', {}, 'Theme'), seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])),
    h('div', { class: 'set' }, h('div', {}, 'Sound'), seg('sound', [[false, 'Off'], [true, 'On']])),
    h('div', { class: 'set' }, h('div', {}, 'Vibration', h('p', {}, 'On phones that support it')), seg('haptics', [[false, 'Off'], [true, 'On']])),
    h('h2', {}, 'Account'),
    h('div', { class: 'set' }, h('div', {}, acct.signedIn() ? `Signed in as ${acct.me()?.name || 'your account'}` : 'Not signed in', h('p', {}, acct.signedIn() ? 'Name, leaderboard, sign-in key, data' : 'Sync devices and join the leaderboard')), h('a', { class: 'btn', href: '#account', id: 'settings-account' }, acct.signedIn() ? 'Manage' : 'Set up')),
    h('h2', {}, 'Your data'),
    h('p', {}, 'Your record lives in this browser. ', h('a', { href: '#privacy' }, 'Privacy'), '. ', keep),
    h('div', { class: 'set', style: 'margin-top:12px' }, h('div', {}, 'Back up', h('p', {}, 'Saves everything to one file')), h('button', { class: 'btn', type: 'button', id: 'backup', onclick: backup }, 'Save file')),
    h('div', { class: 'set' }, h('div', {}, 'Restore', h('p', {}, 'Adds a backup to what is here and removes nothing')), h('button', { class: 'btn', type: 'button', id: 'restore', onclick: () => file.click() }, 'Choose file'), file),
    h('div', { class: 'set' }, h('div', {}, 'Ask the browser to keep it'), h('button', { class: 'btn', type: 'button', onclick: async () => { const ok = await askPersist(); toast(ok ? 'It will be kept' : 'The browser did not agree'); } }, 'Ask')),
    h('div', { class: 'set' }, h('div', {}, 'Erase everything on this device', h('p', {}, acct.signedIn() ? 'Cannot be undone. Also signs this device out; your account stays on the server.' : 'Cannot be undone')), h('button', { class: 'btn', type: 'button', id: 'erase', onclick: (e) => {
      const b = e.currentTarget;
      if (b.dataset.sure) { store.reset(); acct.signOut(); paintTheme(); paintSound(); toast('Erased'); b.textContent = 'Erase'; delete b.dataset.sure; } else { b.dataset.sure = '1'; b.textContent = 'Really erase'; setTimeout(() => { if (b.dataset.sure) { delete b.dataset.sure; b.textContent = 'Erase'; } }, 4000); }
    } }, 'Erase')),
  ));
}

function backup() {
  const url = URL.createObjectURL(new Blob([exportSave()], { type: 'application/json' }));
  h('a', { href: url, download: `${NAME.toLowerCase()}-backup-${dayKey()}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Backup saved');
}

