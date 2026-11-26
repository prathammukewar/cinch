// Welcome screen and How to play, phone and desktop, light and dark: node tools/dev/home.mjs <outdir>
import { chromium } from '@playwright/test';
const out = process.argv[2];
const b = await chromium.launch();
for (const [name, opt] of Object.entries({ phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, desktop: { viewport: { width: 1366, height: 860 } } })) for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ ...opt, colorScheme: theme });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://127.0.0.1:8691/');
  await p.waitForTimeout(250); await p.screenshot({ path: `${out}/${name}-${theme}-a-home-early.png` });
  await p.waitForTimeout(2600); await p.screenshot({ path: `${out}/${name}-${theme}-b-home.png` });
  await p.click('#play'); await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${name}-${theme}-c-howto.png` });
  await p.click('#howto-go'); await p.waitForTimeout(120); await p.screenshot({ path: `${out}/${name}-${theme}-d-transition.png` });
  await p.waitForTimeout(900); await p.screenshot({ path: `${out}/${name}-${theme}-e-question.png` });
  console.log(name, theme, errors);
  await ctx.close();
}
await b.close();
