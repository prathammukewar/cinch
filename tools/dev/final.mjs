// Final screenshots: phone and desktop, light and dark. node tools/dev/final.mjs <outdir>
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const out = process.argv[2];
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const sizes = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, desktop: { viewport: { width: 1366, height: 860 }, deviceScaleFactor: 1 } };
for (const [name, opt] of Object.entries(sizes)) for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ ...opt, colorScheme: theme });
  const p = await ctx.newPage();
  await p.clock.install({ time: new Date('2026-11-27T10:00:00') });
  const snap = (s) => p.screenshot({ path: `${out}/${name}-${theme}-${s}.png` });
  await p.goto('http://127.0.0.1:8691/');
  await p.waitForSelector('#low-value'); await p.clock.runFor(1500);
  await snap('1-first-look');
  const plan = [[0, 0, 0.09], [0, 0, 0.07], [0, 0, 0.12], [0, 0, 0.08], [0, 0, 0.1], [0, 0, 0.06], [0, 0, 0.11]];
  for (let i = 0; i < 7; i++) {
    // A fair player: about the right size, sometimes off, ranges of honest width.
    const truth = await p.evaluate(async () => {
      const { forDay } = await import('/js/bank.js'); const { dayNumber, dayKey } = await import('/js/day.js');
      const qs = await forDay(dayNumber(dayKey())); return qs.find((x) => x.question === document.querySelector('.ask h1').textContent);
    });
    const off = [0.15, -0.3, 0.05, 0.55, -0.1, 0.2, -0.05][i];
    const log = truth.scale === 'log';
    const span = log ? Math.log10(truth.max / truth.min) : truth.max - truth.min;
    const mid = log ? truth.answer * Math.pow(10, off * span * 0.25) : truth.answer + off * span * 0.25;
    const half = log ? Math.pow(10, span * plan[i][2]) : span * plan[i][2];
    const lo = Math.max(truth.min, log ? mid / half : mid - half);
    const hi = Math.min(truth.max, log ? mid * half : mid + half);
    const fmt = (v) => String(Number(v.toPrecision(3)));
    await p.fill('#low-value', fmt(lo)); await p.fill('#high-value', fmt(hi)); await p.locator('#high-value').blur();
    await p.clock.runFor(800);
    if (i === 0) await snap('2-band-set');
    await p.click('#drop');
    if (i === 0) { await p.clock.runFor(700); await snap('3-pin-hunting'); await p.clock.runFor(820); await snap('4-landing'); }
    await p.clock.runFor(2500);
    if (i < 3) await snap(`5-answer-${i + 1}`);
    await p.click('#next');
  }
  await p.clock.runFor(900); await snap('6-bands-lining-up');
  await p.clock.runFor(4000); await snap('7-result');
  await p.screenshot({ path: `${out}/${name}-${theme}-7-result-full.png`, fullPage: true });
  for (const s of ['calibration', 'archive', 'quant', 'settings']) { await p.goto(`http://127.0.0.1:8691/#${s}`); await p.clock.runFor(800); await snap(`8-${s}`); }
  await ctx.close();
}
await b.close();
