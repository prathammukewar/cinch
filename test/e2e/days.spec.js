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

test('a live Roundup result says how you did against other riders', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cinch-api', `${location.origin}/standings`));
  let sent = null;
  await page.route('**/standings/v1/score', async (route) => {
    sent = JSON.parse(route.request().postData());
    await route.fulfill({ json: { day: sent.day, riders: 120, better: 63, roped: [80, 70, 60, 50, 40, 30, 20], qriders: 118, qbetter: [91, 12, 50, 0, 100, 47, 66] } });
  });
  await at(page, '2026-11-26T09:00:00');
  await page.goto('/#today');
  await playAll(page);
  await expect(page.locator('#standing')).toHaveText('You did better than 63% of the 120 players today.');
  await expect(page.locator('.recap .crowd').first()).toHaveText('Better than 91% of players on this one \u00b7 80% roped it');
  await page.locator('.spot').nth(1).focus();
  await expect(page.locator('.peek-crowd')).toHaveText('Better than 12% of players on this one');
  expect(sent.day).toBe(2);
  expect(sent.hits).toMatch(/^[01]{7}$/);
  expect(sent.client).toMatch(/^[a-z0-9]{12,24}$/);
  expect(Object.keys(sent).sort()).toEqual(['client', 'day', 'hits', 'points', 'score']);
  expect(sent.points).toHaveLength(7);
  expect(sent.points.reduce((a, b) => a + b, 0)).toBe(sent.score);
});

test('a past day played live shows how it compared, without posting again', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cinch-api', `${location.origin}/standings`));
  let posts = 0;
  await page.route('**/standings/v1/score', (route) => { posts++; route.fulfill({ json: { day: 2, riders: 40, better: 55, roped: [1, 2, 3, 4, 5, 6, 7], qriders: 40, qbetter: [10, 20, 30, 40, 50, 60, 70] } }); });
  await page.route('**/standings/v1/day/2?**', (route) => route.fulfill({ json: { day: 2, riders: 41, better: 52, roped: [1, 2, 3, 4, 5, 6, 7], qriders: 41, qbetter: [11, 21, 31, 41, 51, 61, 71] } }));
  await at(page, '2026-11-26T09:00:00');
  await page.goto('/#today');
  await playAll(page);
  await expect(page.locator('#standing')).toContainText('55%');
  await page.clock.setSystemTime(new Date('2026-11-28T09:00:00'));
  await page.goto('/#day/2');
  await page.reload();
  await expect(page.locator('#standing')).toHaveText('You did better than 52% of the 41 players that day.');
  await expect(page.locator('.recap .crowd').first()).toContainText('Better than 11% of players on this one');
  expect(posts).toBe(1);
});
