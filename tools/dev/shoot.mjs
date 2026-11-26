// Screenshots of the main screens for design review: node tools/dev/shoot.mjs <outdir> [filter]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const out = process.argv[2]; const only = process.argv[3] || '';
mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const sizes = { phone: { viewport: { width: 375, height: 812 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }, desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 } };
for (const [name, opt] of Object.entries(sizes)) for (const theme of ['light', 'dark']) {
  if (only && !`${name}-${theme}`.includes(only)) continue;
  const ctx = await b.newContext({ ...opt, colorScheme: theme });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message)); p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const snap = (s) => p.screenshot({ path: `${out}/${name}-${theme}-${s}.png` });
  await p.goto('http://127.0.0.1:8691/');
  await p.waitForSelector('canvas'); await p.waitForTimeout(900);
  await snap('1-start');
  const box = await p.locator('.desk canvas').boundingBox();
  const drag = async (i, t) => {
    const g = await p.locator('.thumb').nth(i).evaluate((e) => e.offsetLeft + e.offsetWidth / 2);
    const pad = box.width > 620 ? 44 : 30; const y = box.y + box.height - 160;
    await p.mouse.move(box.x + g, y); await p.mouse.down();
    await p.mouse.move(box.x + pad + t * (box.width - 2 * pad), y, { steps: 14 }); await p.mouse.up();
  };
  const plan = [[0.36, 0.56], [0.5, 0.62], [0.3, 0.9], [0.55, 0.8], [0.2, 0.75], [0.3, 0.5], [0.2, 0.28]];
  for (let i = 0; i < 7; i++) {
    await drag(0, plan[i][0]); await drag(1, plan[i][1]);
    await p.waitForTimeout(500);
    if (i === 0) await snap('2-set');
    if (i === 2) await snap('2b-wide');
    await p.click('#drop');
    if (i < 2) { await p.waitForTimeout(700); await snap(`3-hunt${i}`); await p.waitForTimeout(950); await snap(`4-land${i}`); await p.waitForTimeout(160); await snap(`4b-land${i}`); }
    else { await p.waitForTimeout(300); await p.keyboard.press('Enter'); }
    await p.waitForTimeout(1600);
    if (i < 3 || i === 6) await snap(`5-done${i}`);
    await p.click('#next');
    await p.waitForTimeout(120);
  }
  await p.waitForTimeout(700); await snap('6-lineup-mid');
  await p.waitForTimeout(3200); await snap('6-result');
  await p.screenshot({ path: `${out}/${name}-${theme}-6-result-full.png`, fullPage: true });
  await p.click('#menu'); await p.waitForTimeout(250); await snap('7-menu'); await p.keyboard.press('Escape');
  for (const s of ['archive', 'calibration', 'scoring', 'settings', 'quant']) { await p.goto(`http://127.0.0.1:8691/#${s}`); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${name}-${theme}-8-${s}.png`, fullPage: s !== 'quant' }); }
  console.log(name, theme, errors.length ? errors : 'ok');
  await ctx.close();
}
await b.close();
