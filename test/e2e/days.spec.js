import { test, expect, at, playAll, squeeze, next } from './helpers.js';

const q = (page) => page.locator('.ask h1').textContent();

test('everyone gets the same questions on a day, and new ones the next', async ({ browser }) => {
  const open = async (iso, tz) => {
    const ctx = await browser.newContext({ timezoneId: tz });
    const page = await ctx.newPage();
    await page.clock.install({ time: new Date(iso) });
    await page.goto('http://127.0.0.1:8692/#today');
    const t = await q(page);
    await ctx.close();
    return t;
  };
  const ny = await open('2026-11-28T12:00:00-05:00', 'America/New_York');
  expect(await open('2026-11-28T23:58:00-05:00', 'America/New_York')).toBe(ny);
  expect(await open('2026-11-28T12:00:00+09:00', 'Asia/Tokyo')).toBe(ny);
  expect(await open('2026-11-29T00:02:00-05:00', 'America/New_York')).not.toBe(ny);
  // the same instant is already the 29th in Tokyo
  expect(await open('2026-11-28T20:00:00-05:00', 'Asia/Tokyo')).not.toBe(ny);
});

test('midnight during a round does not swap the questions', async ({ page }) => {
  await at(page, '2026-11-28T23:59:40');
  await page.goto('/#today');
  const first = await q(page);
  await squeeze(page, 0.2, 0.8);
  await page.clock.runFor(25000);
  expect(await q(page)).toBe(first);
  await page.click('#drop');
  await page.clock.runFor(3000);
  await expect(page.locator('.panel.done')).toBeVisible();
  await page.clock.runFor(40000);
  expect(await q(page)).toBe(first);
  await page.goto('/#today');
  await page.reload();
  expect(await q(page)).not.toBe(first);
});

test('streaks grow day by day, survive a reload and break after a gap', async ({ page }) => {
  await at(page, '2026-11-26T09:00:00');
  await page.goto('/#today');
  await playAll(page);
  await expect(page.locator('.facts')).toContainText('1 day');
  await page.clock.setSystemTime(new Date('2026-11-27T09:00:00'));
  await page.goto('/#archive'); await page.reload();
  await page.goto('/#today');
  await playAll(page);
  await expect(page.locator('.facts')).toContainText('2 days');
  await page.reload();
  await expect(page.locator('.facts')).toContainText('2 days');
  await page.clock.setSystemTime(new Date('2026-11-30T09:00:00'));
  await page.goto('/#archive'); await page.reload();
  await page.goto('/#today');
  await playAll(page);
  await expect(page.locator('.facts')).toContainText('1 day');
});

test('past days can be played, count for calibration, and do not touch the streak', async ({ page }) => {
  await at(page, '2026-11-29T09:00:00');
  await page.goto('/#archive');
  await expect(page.locator('.list li')).toHaveCount(5);
  await page.locator('.list a', { hasText: 'play' }).last().click();
  await expect(page.locator('.ask .meta')).toContainText('No. 1');
  await playAll(page);
  await expect(page.locator('.facts')).toContainText('0 days');
  await page.goto('/#calibration');
  await expect(page.locator('.statline')).toContainText('7');
});

test('days beyond the plan and before the start still work', async ({ page }) => {
  await at(page, '2028-03-02T09:00:00');
  await page.goto('/#today');
  await expect(page.locator('.ask h1')).not.toBeEmpty();
  await page.goto('/#archive');
  await expect(page.locator('.list li')).toHaveCount(60);
  await page.goto('/#day/99999');
  await expect(page.locator('h1')).toContainText('Old Trails');
});

test('a clock set before the launch still gives questions', async ({ page }) => {
  await at(page, '2026-11-01T09:00:00');
  await page.goto('/#today');
  await expect(page.locator('.ask h1')).not.toBeEmpty();
});
