// A first-time player on a phone: plays today with typical narrow ranges and screenshots each answer.
import { chromium } from '@playwright/test';
const out = process.argv[2];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const p = await ctx.newPage();
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
const t0 = Date.now();
await p.goto('http://127.0.0.1:8691/');
await p.waitForSelector('#low-value');
for (let i = 0; i < 7; i++) {
  // A newcomer's guess: the right size, too sure of it.
  const q = await p.evaluate(() => document.querySelector('.ask h1').textContent);
  const truth = await p.evaluate(async () => {
    const { forDay } = await import('/js/bank.js'); const { dayNumber, dayKey } = await import('/js/day.js');
    const qs = await forDay(dayNumber(dayKey())); return qs.find((x) => x.question === document.querySelector('.ask h1').textContent);
  });
  const guess = truth.scale === 'log' ? truth.answer * Math.pow(10, (i % 3 - 1) * 0.35) : truth.answer + (i % 3 - 1) * (truth.max - truth.min) * 0.08;
  const half = truth.scale === 'log' ? 1.6 : (truth.max - truth.min) * 0.04;
  const lo = truth.scale === 'log' ? guess / half : guess - half;
  const hi = truth.scale === 'log' ? guess * half : guess + half;
  const fmt = (v) => String(Number(v.toPrecision(3)));
  await p.fill('#low-value', fmt(Math.max(truth.min, lo))); await p.fill('#high-value', fmt(Math.min(truth.max, hi)));
  await p.locator('#high-value').blur();
  if (i === 0) await p.screenshot({ path: `${out}/ft-${i}-set.png` });
  await p.click('#drop');
  await p.waitForSelector('.panel.done');
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${out}/ft-${i}-answer.png` });
  console.log(i + 1, q.slice(0, 60), '|', await p.locator('.pts').textContent(), '|', await p.locator('.why b').textContent());
  await p.click('#next');
}
await p.waitForTimeout(4200);
await p.screenshot({ path: `${out}/ft-result.png` });
console.log('seconds', ((Date.now() - t0) / 1000).toFixed(0), 'errors', errors);
await b.close();
