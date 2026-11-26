// Does every question fit small phones? node tools/dev/fit.mjs, with the dev server on 8691.
// Puts each daily and practice question on the play screen and reports how far the page scrolls.
import { chromium } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
const D = new URL('../../data/', import.meta.url).pathname;
const daily = readdirSync(D).filter((f) => /^20\d\d-\d\d\.json$/.test(f)).flatMap((f) => Object.values(JSON.parse(readFileSync(D + f, 'utf8')).days).flat()).map((q) => ({ question: q.question, unit: q.unit, as_of: q.as_of }));
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [w, hgt] of [[320, 568], [360, 640], [375, 667], [390, 844]]) {
  await page.setViewportSize({ width: w, height: hgt });
  await page.goto('http://localhost:8691/#practice');
  await page.reload();
  await page.waitForTimeout(1500);
  const out = await page.evaluate(async (daily) => {
    const { practicePool } = await import('/js/bank.js');
    const qs = [...(await practicePool()), ...daily];
    const note = document.querySelector('.ask .note');
    const bare = new Set(['US dollars', '%', '°C', '°F']);
    const ask = document.querySelector('.ask'); const h1 = ask.querySelector('h1');
    const res = [];
    for (const q of qs) {
      const t = q.question; h1.textContent = t; ask.classList.toggle('long', t.length > 78); ask.classList.toggle('longer', t.length > 95);
      const said = q.unit && t.toLowerCase().includes(q.unit.toLowerCase().split(' ')[0].replace(/s$/, ''));
      note.textContent = [q.unit && q.unit !== 'year' && !said && !bare.has(q.unit) ? `Answer in ${q.unit}.` : '', q.as_of ? `${q.as_of}.` : ''].filter(Boolean).join(' ');
      await new Promise((r) => requestAnimationFrame(() => r()));
      res.push([document.documentElement.scrollHeight - innerHeight, q.question + ' | ' + note.textContent]);
    }
    return res.sort((a, b) => b[0] - a[0]);
  }, daily);
  const dist = {}; for (const r of out) dist[r[0]] = (dist[r[0]] || 0) + 1;
  console.log(`${w}x${hgt}`, 'worst', out[0][0], out[0][1].slice(0, 90), '| spread', JSON.stringify(dist), '| over limit', out.filter((r) => r[0] > (hgt < 600 ? 60 : 1)).length);
}
await browser.close();
