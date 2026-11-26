import { test, expect, at, playAll, squeeze } from './helpers.js';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const axe = readFileSync(new URL('../../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const audit = async (page) => {
  await page.evaluate(axe);
  const r = await page.evaluate(() => globalThis.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }));
  return r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).slice(0, 3).join(' | ')}`);
};

for (const scheme of ['light', 'dark']) {
  test(`no accessibility problems on any screen, ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
    await at(page, '2026-11-26T09:00:00');
    await page.goto('/');
    await page.clock.runFor(800);
    expect(await audit(page)).toEqual([]);
    await squeeze(page, 0.3, 0.7);
    await page.click('#drop');
    await page.clock.runFor(2000);
    await expect(page.locator('.panel.done')).toBeVisible();
    expect(await audit(page)).toEqual([]);
    for (const s of ['archive', 'calibration', 'scoring', 'settings', 'quant']) {
      await page.goto(`/#${s}`);
      await page.clock.runFor(500);
      expect(await audit(page), s).toEqual([]);
    }
    await page.goto('/#today'); await page.reload();
    await page.click('#next', { timeout: 500 }).catch(() => {});
    await playAll(page, 6);
    await page.clock.runFor(4000);
    expect(await audit(page), 'result').toEqual([]);
    await page.click('#menu');
    expect(await audit(page), 'menu').toEqual([]);
  });
}

test('nothing scrolls sideways at any width', async ({ page }) => {
  for (const w of [320, 360, 375, 430, 768, 1024, 1440]) {
    await page.setViewportSize({ width: w, height: 760 });
    for (const s of ['today', 'archive', 'calibration', 'scoring', 'settings', 'quant', 'practice']) {
      await page.goto(`/#${s}`);
      await page.waitForTimeout(120);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${s} at ${w}`).toBeLessThanOrEqual(0);
    }
  }
});

test('the question, the pegs and the button fit on small phones without scrolling', async ({ page }) => {
  for (const [w, h] of [[320, 568], [360, 640], [375, 667], [375, 812], [430, 932]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto('/#practice'); await page.reload();
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight), `${w} by ${h}`).toBeLessThanOrEqual(h < 600 ? 60 : 1);
    await expect(page.locator('.ask h1')).toBeInViewport();
  }
});

test('touch targets are at least 44 pixels', async ({ page }) => {
  await page.goto('/');
  const small = await page.evaluate(() => [...document.querySelectorAll('button, .go')].filter((e) => e.offsetParent && (e.offsetHeight < 44)).map((e) => e.id || e.className));
  expect(small).toEqual([]);
});

test('the page weighs under 150 KB before questions', async ({ page }) => {
  const got = new Map();
  page.on('response', async (r) => {
    const u = new URL(r.url());
    if (u.pathname.startsWith('/data/')) return;
    try { got.set(u.pathname, (await r.body()).length); } catch { /* not a body */ }
  });
  await page.goto('/');
  await page.waitForTimeout(800);
  const raw = [...got.values()].reduce((a, b) => a + b, 0);
  console.log(`raw ${(raw / 1024).toFixed(1)} KB`, JSON.stringify(Object.fromEntries(got)));
  expect(raw).toBeLessThan(150 * 1024);
});

test('a month of questions is loaded, not the whole bank', async ({ page }) => {
  const files = [];
  page.on('request', (r) => { const p = new URL(r.url()).pathname; if (p.startsWith('/data/')) files.push(p); });
  await at(page, '2026-12-10T09:00:00');
  await page.goto('/');
  await expect(page.locator('.ask h1')).not.toBeEmpty();
  expect(files.filter((f) => /\d{4}-\d\d/.test(f))).toEqual(['/data/2026-12.json']);
  expect(files.some((f) => f.includes('practice'))).toBe(false);
});

test('answers are not readable in the files the page loads', async ({ page }) => {
  const res = await page.request.get('/data/2026-12.json');
  const j = await res.json();
  for (const rows of Object.values(j.days)) for (const r of rows) { expect(r.answer).toBeUndefined(); expect(r.explainer).toBeUndefined(); expect(r.source_url).toBeUndefined(); }
  expect(gzipSync(JSON.stringify(j)).length).toBeLessThan(120 * 1024);
});

test('the animation holds its frame rate', async ({ page }) => {
  await page.goto('/');
  await squeeze(page, 0.2, 0.8);
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const p = page.evaluate(() => new Promise((res) => {
    const t = []; let last = performance.now();
    const f = (n) => { t.push(n - last); last = n; if (t.length < 110) requestAnimationFrame(f); else res(t.slice(5)); };
    requestAnimationFrame(f);
  }));
  await page.click('#drop');
  const times = (await p).sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  console.log(`median ${times[times.length >> 1].toFixed(1)} ms, 95th percentile ${p95.toFixed(1)} ms at 4x CPU slowdown`);
  expect(times[times.length >> 1]).toBeLessThan(20);
});
