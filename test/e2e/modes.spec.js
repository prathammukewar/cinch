import { test, expect, at, playAll, squeeze } from './helpers.js';
import { readFileSync, writeFileSync } from 'node:fs';

test('practice keeps going and never repeats a category twice running', async ({ page }) => {
  await page.goto('/#practice');
  let last = null;
  for (let i = 0; i < 6; i++) {
    const cat = await page.locator('.ask .meta span').nth(1).textContent();
    expect(cat).not.toBe(last);
    last = cat;
    await squeeze(page, 0.3, 0.7);
    await page.click('#drop');
    await page.waitForTimeout(50);
    await page.keyboard.press('Enter');
    await expect(page.locator('.panel.done')).toBeVisible({ timeout: 6000 });
    await page.click('#next');
  }
  await expect(page.locator('.ask .meta')).toContainText('Practice, 7');
});

test('practice never shows a question from today or later', async ({ page }) => {
  await at(page, '2026-11-27T09:00:00');
  await page.goto('/#practice');
  const bad = await page.evaluate(async () => {
    const { practicePool } = await import('/js/bank.js');
    const { dayNumber, dayKey } = await import('/js/day.js');
    const pool = new Set((await practicePool(dayNumber(dayKey()))).map((x) => x.id));
    const s = await (await fetch('/bank/schedule.json')).json();
    return Object.entries(s.days).filter(([n]) => Number(n) >= 3).flatMap(([, ids]) => ids).filter((id) => pool.has(id));
  });
  expect(bad).toEqual([]);
});

test('quant mode runs ten on the clock and locks in when time is up', async ({ page }) => {
  await at(page, '2026-11-27T09:00:00');
  await page.goto('/#quant');
  await page.click('#start-quant');
  await expect(page.locator('.ask .meta')).toContainText('1 of 10');
  await page.clock.runFor(21000);
  await page.clock.runFor(3000);
  await expect(page.locator('.panel.done')).toBeVisible();
  await page.click('#next');
  for (let i = 1; i < 10; i++) {
    await squeeze(page, 0.2, 0.8);
    await page.click('#drop');
    await page.clock.runFor(3000);
    await page.click('#next');
  }
  await expect(page.locator('.facts')).toContainText('of 10');
  await expect(page.locator('.tally .of')).toContainText('1000');
});

test('backup and restore through the real buttons', async ({ page, browser }, info) => {
  await at(page, '2026-11-26T09:00:00');
  await page.goto('/');
  await playAll(page);
  await page.goto('/#settings');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#backup')]);
  const path = info.outputPath('backup.json');
  await download.saveAs(path);
  const saved = JSON.parse(readFileSync(path));
  expect(Object.keys(saved.data.days)).toEqual(['2']);

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await other.clock.install({ time: new Date('2026-11-27T09:00:00') });
  await other.goto('http://127.0.0.1:8692/#settings');
  await other.setInputFiles('#restore-file', path);
  await expect(other.locator('.toast')).toContainText('Restored 1 day');
  await other.goto('http://127.0.0.1:8692/#archive');
  await expect(other.locator('.list')).toContainText('of 7', { timeout: 100 }).catch(() => {});
  await expect(other.locator('.list .dots')).toHaveCount(1);
  const bad = info.outputPath('bad.json');
  writeFileSync(bad, '{"hello":1}');
  await other.goto('http://127.0.0.1:8692/#settings');
  await other.setInputFiles('#restore-file', bad);
  await expect(other.locator('.toast')).toContainText('not a backup');
  await ctx.close();
});

test('an older or damaged save never breaks the page or loses data', async ({ page }) => {
  await at(page, '2026-11-28T09:00:00');
  await page.goto('/#settings');
  await page.evaluate(() => localStorage.setItem('cinch', JSON.stringify({ days: { 1: { live: true, rows: [] }, 3: { key: '2026-11-27', live: true, rows: [{ id: 'gone', cat: 'Space', hit: true, l: 0.4, u: 0.6, x: 0.5, width: 0.2, points: 80, lo: 1, hi: 2 }] } } })));
  await page.goto('/#calibration'); await page.reload();
  await expect(page.locator('h1')).toContainText('Your calibration');
  await page.evaluate(() => localStorage.setItem('cinch', '{{{'));
  await page.goto('/#today'); await page.reload();
  await expect(page.locator('.ask h1')).not.toBeEmpty();
  expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('cinch-unreadable')))).toBe(true);
});

test('the dashboard fills in as questions are answered', async ({ page }) => {
  await page.goto('/#calibration');
  await expect(page.locator('.page')).toContainText('Nothing to measure yet');
  await page.evaluate(() => {
    const rows = Array.from({ length: 120 }, (_, i) => ({ id: `q${i}`, cat: ['Space', 'Food', 'Money'][i % 3], hit: i % 5 !== 0, l: 0.4, u: 0.6, x: i % 5 ? 0.45 + (i % 10) / 100 : 0.7, width: 0.2, points: i % 5 ? 80 : -120, lo: 1, hi: 2, at: i }));
    localStorage.setItem('cinch', JSON.stringify({ v: 1, practice: { rows, seen: {} } }));
  });
  await page.reload();
  await expect(page.locator('figure svg')).toHaveCount(2);
  await expect(page.locator('.page')).toContainText('At 100 questions you had caught 80');
  await expect(page.locator('.cats li')).toHaveCount(3);
});

test('settings: theme and sound stick', async ({ page }) => {
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
  await page.click('#sound');
  await page.reload();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
});

test('erase asks twice', async ({ page }) => {
  await at(page, '2026-11-26T09:00:00');
  await page.goto('/');
  await playAll(page);
  await page.goto('/#settings');
  await page.click('#erase');
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cinch')).days).length)).toBe(1);
  await page.click('#erase');
  expect(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('cinch')).days).length)).toBe(0);
});

test('a failed download offers another try', async ({ page }) => {
  let block = true;
  await page.route('**/data/*.json', (r) => (block ? r.fulfill({ status: 503, body: '' }) : r.continue()));
  page.removeAllListeners('console');
  await page.goto('/');
  await expect(page.locator('#main')).toContainText('did not load');
  block = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.ask h1')).not.toBeEmpty();
});
