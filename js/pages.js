// Screens that are not needed for the first question. Loaded when opened.
import { NAME, QUANT_LENGTH, QUANT_SECONDS, CURVE_MIN } from './config.js';
import { dayKey, keyOf, longDate, streaks } from './day.js';
import { practicePool, index } from './bank.js';
import { store, askPersist, exportSave, importSave, allRows } from './store.js';
import { total, kindOf, wilson, tierOf, TIERS, LEANER } from './score.js';
import { ICONS } from './share.js';

const LADDER = {
  dead: '96 to 100 points. A hair-thin loop right on the answer, no hints.',
  ringer: '81 to 95 points, roped.',
  hogtied: '61 to 80 points, roped.',
  roped: '41 to 60 points, roped.',
  leaner: '41 points or more on a near miss. The shoe is leaning on the stake.',
  snagged: '21 to 40 points.',
  dust: '1 to 20 points.',
  tumble: 'No points this time.',
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
    h('p', { class: 'lede' }, `Ten questions, ${QUANT_SECONDS} seconds each. When the fuse burns out, your loop is pitched wherever it is. Fast hands, honest loops.`),
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
    h('p', { class: 'lede' }, 'Every earlier Roundup. Riding an old trail counts in your Brand Book, but only days played on the day keep you on the trail.'),
    h('ul', { class: 'list' }, items),
    idx.days < getToday() ? h('p', { class: 'fine', style: 'margin-top:20px' }, 'Planned days have run out, so older questions are coming round again in a new order.') : null));
}

export function showCalibration() {
  const rows = allRows();
  const live = liveDays();
  const s = streaks(live, getToday());
  const page = h('div', { class: 'page' }, h('h1', {}, 'Brand Book'), h('p', { class: 'lede' }, 'How true your loops run. A 90% loop should rope the answer nine times in ten.'));
  if (!rows.length) {
    page.append(h('p', { class: 'lede' }, 'Nothing in the book yet. Ride today\u2019s Roundup and your first marks appear here.'), h('p', { style: 'margin-top:24px' }, h('a', { class: 'go', href: '#today' }, 'Saddle up')));
    main.replaceChildren(page);
    return;
  }
  const w = wilson(rows.filter((r) => r.hit).length, rows.length);
  const days = Object.values(store.data().days).map((r) => total(r.rows));
  page.append(
    h('p', {}, verdictText(verdict(rows))),
    h('dl', { class: 'statline' },
      stat('Roped', `${Math.round(w.p * 100)}%`), stat('True rate, likely', `${Math.round(w.lo * 100)} to ${Math.round(w.hi * 100)}%`), stat('Questions', String(rows.length)),
      days.length ? stat('Average day', signed(Math.round(days.reduce((a, b) => a + b, 0) / days.length))) : null,
      stat('On the trail', `${s.current}`), stat('Longest trail', `${s.best}`)),
    h('h2', {}, 'Roped over time'));
  const rc = rateChart(rows);
  page.append(rc ? h('figure', { html: rc }) : h('p', { class: 'fine' }, 'This chart starts at 11 questions.'));
  if (rc) page.lastChild.append(h('figcaption', {}, 'Share of answers roped over your last 50 questions. The shaded part is where luck alone could have put it.'));
  page.append(h('h2', {}, 'How true your loops run'));
  const cc = curveChart(rows);
  if (cc) {
    page.append(h('figure', { html: cc }));
    page.lastChild.append(h('figcaption', {}, `Each loop is read as the middle 90% of a bell curve on the rail, so narrower slices of it can be checked too. On the dashed line, your loops are exactly as sure as they should be. With ${rows.length} questions the shading at 90% is about ${bandAt(rows.length)} points either side.`));
  } else {
    page.append(h('p', { class: 'fine' }, `This chart appears at ${CURVE_MIN} questions. You have ${rows.length}. At ${CURVE_MIN} it is still about ${bandAt(CURVE_MIN)} points either side, and at 100 about ${bandAt(100)}.`));
  }
  const cats = byCategory(rows);
  page.append(h('h2', {}, 'By trail'));
  const known = cats.filter((c) => c.enough);
  if (known.length >= 2) page.append(h('p', { class: 'fine' }, `Best so far is ${known[0].cat.toLowerCase()} at ${plus(Math.round(known[0].mean))} a question, and the costliest is ${known[known.length - 1].cat.toLowerCase()} at ${plus(Math.round(known[known.length - 1].mean))}. The mark on each bar is 90%.`));
  else page.append(h('p', { class: 'fine' }, 'Best and worst appear once two categories have six questions each. The mark on each bar is 90%.'));
  page.append(h('ul', { class: 'cats' }, cats.map((c) => h('li', {}, h('span', {}, c.cat), h('span', { class: 'track', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.round(c.p * 100)}%` })), h('span', { class: 'v num' }, `${c.k} of ${c.n}, ${plus(Math.round(c.mean))}`)))));
  main.replaceChildren(page);
}
const stat = (k, v) => h('div', {}, h('dt', {}, k), h('dd', { class: 'num' }, v));

export async function showSources() {
  const list = await fetch('data/credits.json').then((r) => r.json()).catch(() => []);
  main.replaceChildren(h('div', { class: 'page' },
    h('h1', {}, 'Sources'),
    h('p', { class: 'lede' }, 'Every answer comes from a source you can open, linked under the answer. Each number was read from its source, then fetched and read a second time before it went in.'),
    h('ul', { class: 'credits' }, list.map((c) => h('li', {}, h('span', {}, c.name), h('span', { class: 'fine' }, `${c.licence}, ${c.n} ${c.n === 1 ? 'question' : 'questions'}`)))),
    h('h2', {}, 'Notices'),
    h('p', {}, 'The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at "', h('a', { href: 'https://www.retrosheet.org' }, 'www.retrosheet.org'), '".'),
    h('p', {}, 'Animal ages, pregnancies and weights come from AnAge: Tacutu R. et al. (2018), Human Ageing Genomic Resources, Nucleic Acids Research 46(D1):D1083-D1090.'),
    h('p', {}, 'Food figures are from USDA FoodData Central. World figures are from World Bank Open Data and from FAO through Our World in Data, both under CC BY 4.0. Wikidata facts are CC0 and were each checked against the matching English Wikipedia article.'),
    h('p', {}, 'Fonts: Anybody and Familjen Grotesk, both under the SIL Open Font License.'),
    h('p', { class: 'foot' }, 'Spot a wrong number? The source link on each answer is the place to start.')));
}

export function showScoring() {
  main.replaceChildren(h('div', { class: 'page' },
    h('h1', {}, 'Ranch rules'),
    h('p', { class: 'lede' }, 'Seven numbers a day. For each one, set a loop on the rail that you are 90% sure will rope the answer. Then the horseshoe is pitched.'),
    h('h2', {}, 'Points'),
    h('p', {}, 'If the horseshoe lands inside your loop, you score 100 minus the share of the rail the loop covers. A loop over a tenth of the rail is worth 90. A loop over the whole rail is worth 0.'),
    h('p', {}, 'Just outside the loop the points fade away, reaching nothing once the shoe is half a loop\u2019s width beyond the edge. A tight loop is worth more, and its points fade faster. You can never score below zero. The glow on the rail shows all of this while you set your loop.'),
    h('h2', {}, 'Hints'),
    h('p', {}, 'Fence in shortens the rail to a stretch that holds the answer, and from then on your loop is measured against that shorter rail. A loop around the whole fenced stretch scores 0, so the fence never pays for a blind guess. Fencing once keeps 85% of the points, twice keeps 70%. Scout marks two known numbers of the same kind on the rail and keeps 85%. The answer can sit between them or outside them. Hints never change your Brand Book record of how often your loops hold the answer.'),
    h('h2', {}, 'Names for a throw'),
    h('ul', { class: 'ladder' }, [...TIERS.slice(0, 4), LEANER, ...TIERS.slice(4)].map((t) => h('li', {}, h('span', { class: `tier-pill t-${t.key}` }, t.name), ' ', LADDER[t.key]))),
    h('p', {}, 'When you share a result, each throw shows as one emoji, in this order from best to nothing: ', [...TIERS.slice(0, 4), LEANER, ...TIERS.slice(4)].map((t) => `${ICONS[t.key]} ${t.name}`).join(', '), '.'),
    h('h2', {}, 'Honest loops'),
    h('p', {}, 'The goal is a loop that ropes the answer nine times in ten. On questions you know something about, that is also close to the best-scoring loop. On questions you are very unsure of, a slightly tighter loop pays a little more on average, because points cannot go below zero. The Brand Book keeps you honest: it tracks how often your 90% loops really hold the answer.'),
    h('div', { id: 'proof' }),
    h('h2', {}, 'About luck'),
    h('p', {}, 'A perfectly judged 90% loop still misses one time in ten. It ropes all seven on 48% of days, six on 37%, five on 12%, and fewer on 3%. After 100 questions your rate is known to about 6 points either side, and after 220 to about 4. The Brand Book only makes a call at 20, 50, 100, 200 and 350 questions.'),
    h('h2', {}, 'The rail'),
    h('p', {}, 'Each rail is long enough to leave real doubt, and the answer sits on it at random, so the middle is no hint. Rails for numbers of every size step up by multiples, so being off by a factor of two looks the same at any size.'),
    h('h2', {}, 'Where the numbers come from'),
    h('p', {}, 'Every answer links to its source and was read from it twice. If one looks wrong, ', h('a', { href: 'https://github.com/prathammukewar/cinch/issues/new?title=Wrong%20number', target: '_blank', rel: 'noopener noreferrer' }, 'report it here'), '.'),
    h('p', { class: 'foot' }, 'Made by Pratham Mukewar.')));
  fetch('data/proof.json').then((r) => r.json()).then((p) => {
    $('proof')?.replaceChildren(
      h('p', { style: 'margin-top:14px' }, `The same simulated player on ${p.questions.toLocaleString('en-US')} questions, with different habits:`),
      h('table', { class: 'maths' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Habit'), h('th', { scope: 'col' }, 'Roped'), h('th', { scope: 'col' }, 'Points a day'))),
        h('tbody', {}, p.rows.map((r, i) => h('tr', { class: i === 0 ? 'us' : '' }, h('td', {}, r.name), h('td', {}, `${Math.round(r.hitRate * 100)}%`), h('td', {}, signed(Math.round(r.perDay))))))));
  }).catch(() => {});
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
    keep.textContent = store.memoryOnly ? 'This browser is blocking storage, so nothing will be kept after you close the page.' : ok ? 'This browser has agreed to keep your data.' : 'This browser may clear your data if you stay away for a long time. A backup file is the safe copy.';
  })();
  main.replaceChildren(h('div', { class: 'page' }, h('h1', {}, 'Saddlebag'), h('p', { class: 'lede' }, 'Settings, and a safe copy of your record.'),
    h('div', { class: 'set' }, h('div', {}, 'Theme'), seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])),
    h('div', { class: 'set' }, h('div', {}, 'Sound'), seg('sound', [[false, 'Off'], [true, 'On']])),
    h('div', { class: 'set' }, h('div', {}, 'Vibration', h('p', {}, 'On phones that support it')), seg('haptics', [[false, 'Off'], [true, 'On']])),
    h('h2', {}, 'Your data'),
    h('p', {}, 'Your scores, streaks and loops live in this browser. When you finish a Roundup on its own day, three things go to the standings so you can see how you did against other riders: the day, your score, and which of the seven you roped, under a random id made in this browser. No name and no account. Visits to the site are counted by Cloudflare Web Analytics, which sets no cookies and does not follow you to other sites. ', keep),
    h('div', { class: 'set', style: 'margin-top:12px' }, h('div', {}, 'Back up', h('p', {}, 'Saves everything to one file')), h('button', { class: 'btn', type: 'button', id: 'backup', onclick: backup }, 'Save file')),
    h('div', { class: 'set' }, h('div', {}, 'Restore', h('p', {}, 'Adds a backup to what is here and removes nothing')), h('button', { class: 'btn', type: 'button', id: 'restore', onclick: () => file.click() }, 'Choose file'), file),
    h('div', { class: 'set' }, h('div', {}, 'Ask the browser to keep it'), h('button', { class: 'btn', type: 'button', onclick: async () => { const ok = await askPersist(); toast(ok ? 'It will be kept' : 'The browser did not agree'); } }, 'Ask')),
    h('div', { class: 'set' }, h('div', {}, 'Erase everything', h('p', {}, 'Cannot be undone')), h('button', { class: 'btn', type: 'button', id: 'erase', onclick: (e) => {
      const b = e.currentTarget;
      if (b.dataset.sure) { store.reset(); paintTheme(); paintSound(); toast('Erased'); b.textContent = 'Erase'; delete b.dataset.sure; } else { b.dataset.sure = '1'; b.textContent = 'Really erase'; setTimeout(() => { if (b.dataset.sure) { delete b.dataset.sure; b.textContent = 'Erase'; } }, 4000); }
    } }, 'Erase')),
  ));
}

function backup() {
  const url = URL.createObjectURL(new Blob([exportSave()], { type: 'application/json' }));
  h('a', { href: url, download: `${NAME.toLowerCase()}-backup-${dayKey()}.json` }).click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast('Backup saved');
}

