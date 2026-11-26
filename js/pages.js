// Screens that are not needed for the first question. Loaded when opened.
import { NAME, QUANT_LENGTH, QUANT_SECONDS, CURVE_MIN } from './config.js';
import { dayKey, keyOf, longDate, streaks } from './day.js';
import { practicePool, index } from './bank.js';
import { store, askPersist, exportSave, importSave, allRows } from './store.js';
import { total, kindOf, wilson } from './score.js';
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
  const pool = await practicePool(getToday());
  const start = () => {
    getCurrent()?.destroy?.();
    const pick = picker(pool);
    const qs = Array.from({ length: QUANT_LENGTH }, pick);
    const used = new Set();
    const list = qs.filter((q) => !used.has(q.id) && used.add(q.id));
    paintPips([], QUANT_LENGTH);
    setCurrent(new Round(main, {
      length: list.length,
      seconds: QUANT_SECONDS,
      next: (i) => list[i] || null,
      label: (i) => `Quant mode, ${i + 1} of ${list.length}`,
      onRow: (row, q) => store.change((d) => { d.practice.seen[q.id] = (d.practice.seen[q.id] || 0) + 1; }),
      onEnd: async (rows) => {
        await ctx.kit();
        store.change((d) => { d.quant.runs.push({ at: Date.now(), rows, points: total(rows) }); });
        getCurrent()?.destroy?.();
        const best = Math.max(...store.data().quant.runs.map((r) => r.points));
        const view = resultView({
          rows, questions: list, instant: false, heading: 'Quant mode', of: list.length * 100, shareTitle: 'quant mode',
          third: () => ['Best run', signed(best)], extras: [], restart: start,
        });
        main.replaceChildren(view.el);
        setCurrent(view);
        view.start();
      },
    }));
  };
  const runs = store.data().quant.runs;
  main.replaceChildren(h('div', { class: 'page' },
    h('h1', {}, 'Quant mode'),
    h('p', { class: 'lede' }, `Ten questions, ${QUANT_SECONDS} seconds each. When the clock runs out the band drops where it is. Interviewers at trading firms ask for ranges like this, out loud and against the clock.`),
    runs.length ? h('dl', { class: 'statline' }, h('div', {}, h('dt', {}, 'Runs'), h('dd', { class: 'num' }, String(runs.length))), h('div', {}, h('dt', {}, 'Best'), h('dd', { class: 'num' }, signed(Math.max(...runs.map((r) => r.points))))), h('div', {}, h('dt', {}, 'Caught'), h('dd', { class: 'num' }, `${Math.round(100 * rate(runs.flatMap((r) => r.rows)))}%`))) : null,
    h('p', { style: 'margin-top:28px' }, h('button', { class: 'go', type: 'button', id: 'start-quant', onclick: start }, 'Start the clock'))));
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
      h('span', {}, n === today ? 'Today' : longDate(keyOf(n)), ' ', rec ? h('span', { class: 'dots', 'aria-label': `${rec.rows.filter((r) => r.hit).length} of ${rec.rows.length} caught` }, rec.rows.map((r) => h('i', { class: kindOf(r) }))) : null),
      rec ? h('span', { class: 's num' }, signed(total(rec.rows))) : h('span', { class: 's none' }, d.open?.[n] ? 'resume' : 'play'))));
  }
  main.replaceChildren(h('div', { class: 'page' }, h('h1', {}, 'Past days'),
    h('p', { class: 'lede' }, 'Catching up on a past day counts toward your calibration. Only days played on the day itself count toward the streak.'),
    h('ul', { class: 'list' }, items),
    idx.days < getToday() ? h('p', { class: 'fine', style: 'margin-top:20px' }, 'Planned days have run out, so older questions are coming round again in a new order.') : null));
}

export function showCalibration() {
  const rows = allRows();
  const live = liveDays();
  const s = streaks(live, getToday());
  const page = h('div', { class: 'page' }, h('h1', {}, 'Your calibration'));
  if (!rows.length) {
    page.append(h('p', { class: 'lede' }, 'Nothing to measure yet. Play today’s seven and the first numbers appear here.'), h('p', { style: 'margin-top:24px' }, h('a', { class: 'go', href: '#today' }, 'Play today')));
    main.replaceChildren(page);
    return;
  }
  const w = wilson(rows.filter((r) => r.hit).length, rows.length);
  const days = Object.values(store.data().days).map((r) => total(r.rows));
  page.append(
    h('p', {}, verdictText(verdict(rows))),
    h('dl', { class: 'statline' },
      stat('Caught', `${Math.round(w.p * 100)}%`), stat('95% band', `${Math.round(w.lo * 100)} to ${Math.round(w.hi * 100)}%`), stat('Questions', String(rows.length)),
      days.length ? stat('Average day', signed(Math.round(days.reduce((a, b) => a + b, 0) / days.length))) : null,
      stat('Streak', `${s.current}`), stat('Best streak', `${s.best}`)),
    h('h2', {}, 'Catch rate over time'));
  const rc = rateChart(rows);
  page.append(rc ? h('figure', { html: rc }) : h('p', { class: 'fine' }, 'This chart starts at 11 questions.'));
  if (rc) page.lastChild.append(h('figcaption', {}, 'Share caught over your last 50 questions. The shaded part is where luck alone could have put it.'));
  page.append(h('h2', {}, 'Calibration curve'));
  const cc = curveChart(rows);
  if (cc) {
    page.append(h('figure', { html: cc }));
    page.lastChild.append(h('figcaption', {}, `Each range is read as the middle 90% of a bell curve on the ruler, so narrower slices of it can be checked too. On the dashed line, claims match results. With ${rows.length} questions the band at 90% is about ${bandAt(rows.length)} points either side.`));
  } else {
    page.append(h('p', { class: 'fine' }, `The curve appears at ${CURVE_MIN} questions. You have ${rows.length}. At ${CURVE_MIN} the band is still about ${bandAt(CURVE_MIN)} points either side, and at 100 about ${bandAt(100)}.`));
  }
  const cats = byCategory(rows);
  page.append(h('h2', {}, 'By category'));
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
    h('p', { class: 'lede' }, 'Every answer comes from a source you can open, linked under the answer. Each number was read from the source by a script, then fetched and read a second time before it went in.'),
    h('ul', { class: 'credits' }, list.map((c) => h('li', {}, h('span', {}, c.name), h('span', { class: 'fine' }, `${c.licence}, ${c.n} ${c.n === 1 ? 'question' : 'questions'}`)))),
    h('h2', {}, 'Notices'),
    h('p', {}, 'The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at "', h('a', { href: 'https://www.retrosheet.org' }, 'www.retrosheet.org'), '".'),
    h('p', {}, 'Animal ages, pregnancies and weights come from AnAge: Tacutu R. et al. (2018), Human Ageing Genomic Resources, Nucleic Acids Research 46(D1):D1083-D1090.'),
    h('p', {}, 'Food figures are from USDA FoodData Central. World figures are from World Bank Open Data and from FAO through Our World in Data, both under CC BY 4.0. Wikidata facts are CC0 and were each checked against the matching English Wikipedia article.'),
    h('p', {}, 'Fonts: Anybody and Familjen Grotesk, both under the SIL Open Font License.'),
    h('p', { class: 'foot' }, 'Spot a wrong number? The source link on each answer is the place to start.')));
}

export function showScoring() {
  const rows = window.PROOF || [];
  main.replaceChildren(h('div', { class: 'page' },
    h('h1', {}, 'How scoring works'),
    h('p', {}, 'Every question starts at 100 points. You lose 1 point for each 1% of the ruler your range covers. If the answer falls outside, you lose 20 more for each 1% it misses by.'),
    h('p', {}, 'So a tight catch is worth close to 100, the whole ruler is worth 0, and a confident miss costs you. There is no cap and no floor, because either one would reward gambling.'),
    h('h2', {}, 'Why honest ranges win'),
    h('p', {}, 'Tightening one end by 1% of the ruler always earns 1 point. It costs 20 times the gap when the answer turns out to lie past that end. That trade is worth making only while you are at least 95% sure the answer is not beyond that end. Do it on both sides and you are left with a 90% range.'),
    h('p', {}, 'Statisticians call this the interval score, written up by Gneiting and Raftery in 2007 and by Winkler before them. Wide-ranging numbers use a ruler where each step multiplies, so being off by a factor of two costs the same at any size.'),
    h('div', { id: 'proof' }),
    h('h2', {}, 'About luck'),
    h('p', {}, 'A perfectly calibrated player still misses one question in ten. They catch all seven on 48% of days, six on 37%, five on 12%, and fewer on 3%. One day tells you almost nothing. After 100 questions your catch rate is known to about 6 points either side, and after 220 to about 4.'),
    h('p', {}, 'That is why the dashboard only makes a call at 20, 50, 100, 200 and 350 questions. Checked that way, about 1 perfectly calibrated player in 40 is ever told their ranges look narrow.'),
    h('h2', {}, 'The ruler'),
    h('p', {}, 'Each ruler is long enough to leave real doubt, and the answer is placed on it at random, so the middle is no more likely than anywhere else.'),
    h('h2', {}, 'Where the numbers come from'),
    h('p', {}, 'Every question links to its source. Answers were checked against that source when the question was written, and the date is shown when a number can change. If one looks wrong, please report it.'),
    h('p', { class: 'foot' }, 'Made by Pratham Mukewar.')));
  fetch('data/proof.json').then((r) => r.json()).then((p) => {
    $('proof')?.replaceChildren(
      h('p', { style: 'margin-top:14px' }, `The same simulated player, the same ${p.questions.toLocaleString('en-US')} questions, different habits:`),
      h('table', { class: 'maths' },
        h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Habit'), h('th', { scope: 'col' }, 'Caught'), h('th', { scope: 'col' }, 'Points a day'))),
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
  main.replaceChildren(h('div', { class: 'page' }, h('h1', {}, 'Settings'),
    h('div', { class: 'set' }, h('div', {}, 'Theme'), seg('theme', [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']])),
    h('div', { class: 'set' }, h('div', {}, 'Sound'), seg('sound', [[false, 'Off'], [true, 'On']])),
    h('div', { class: 'set' }, h('div', {}, 'Vibration', h('p', {}, 'On phones that support it')), seg('haptics', [[false, 'Off'], [true, 'On']])),
    h('h2', {}, 'Your data'),
    h('p', {}, 'Scores and streaks live in this browser and nowhere else. ', keep),
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

