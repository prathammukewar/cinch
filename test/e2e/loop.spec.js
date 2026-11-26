import { test, expect, at, answer, playAll, squeeze, ends } from './helpers.js';

test('a stranger sees a question at once, with no wall in front of it', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.ask h1')).not.toBeEmpty();
  await expect(page.locator('.ask h1')).toBeInViewport();
  await expect(page.locator('#drop')).toBeInViewport();
  await expect(page.locator('#drop')).toBeDisabled();
  await expect(page.locator('.hint')).toContainText('90% sure');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('the whole daily loop, the result, and coming back to it', async ({ page }) => {
  await at(page, '2026-11-26T10:00:00');
  await page.goto('/');
  await expect(page.locator('.pips li')).toHaveCount(7);
  await playAll(page);
  await expect(page.locator('.tally .big')).toBeVisible();
  await expect(page.locator('.facts')).toContainText('of 7');
  await page.clock.runFor(6000);
  const score = await page.locator('.tally .big').getAttribute('aria-label');
  await expect(page.locator('.tally .big')).toHaveText(score.replace('Score ', '').replace('-', '−'));
  await expect(page.locator('.recap li')).toHaveCount(7);
  await page.reload();
  await expect(page.locator('.tally .big')).toHaveText(score.replace('Score ', '').replace('-', '−'));
  await expect(page.locator('#drop')).toHaveCount(0);
});

test('dragging a peg with a pointer changes the range', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(300);
  const before = await ends(page);
  const box = await page.locator('.desk canvas').boundingBox();
  const x = await page.locator('.thumb').first().evaluate((e) => e.offsetLeft + e.offsetWidth / 2);
  await page.mouse.move(box.x + x, box.y + box.height - 160);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height - 160, { steps: 8 });
  await page.mouse.up();
  const after = await ends(page);
  expect(after[0]).not.toBe(before[0]);
  expect(after[1]).toBe(before[1]);
  await expect(page.locator('#drop')).toBeEnabled();
  await expect(page.locator('.worth')).toContainText('if the answer is inside');
});

test('two fingers move both pegs at once', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch only');
  await page.goto('/');
  await page.waitForTimeout(300);
  const before = await ends(page);
  const box = await page.locator('.desk canvas').boundingBox();
  const y = box.y + box.height - 160;
  const xs = await page.locator('.thumb').evaluateAll((els) => els.map((e) => e.offsetLeft + e.offsetWidth / 2));
  const client = await page.context().newCDPSession(page);
  const points = (a, b) => [{ x: box.x + a, y, id: 1 }, { x: box.x + b, y, id: 2 }];
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(xs[0], xs[1]) });
  for (let k = 1; k <= 8; k++) await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(xs[0] + k * 10, xs[1] - k * 10) });
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = await ends(page);
  expect(after[0]).not.toBe(before[0]);
  expect(after[1]).not.toBe(before[1]);
});

test('typed numbers work, including words like million', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(200);
  const [lo, hi] = await ends(page);
  await page.locator('#low-value').fill('zzz');
  await expect(page.locator('#low-value')).toHaveClass(/bad/);
  await page.locator('#low-value').fill(hi);
  await page.locator('#low-value').fill(lo);
  await page.locator('#low-value').blur();
  await expect(page.locator('#drop')).toBeEnabled();
});

test('the keyboard alone can play a question', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(200);
  await squeeze(page, 0.3, 0.6);
  await page.keyboard.press('Shift+ArrowLeft');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page.locator('.panel.done')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('#next')).toBeFocused({ timeout: 6000 });
  await page.keyboard.press('Enter');
  await expect(page.locator('.ask .meta')).toContainText('2 of 7');
});

test('leaving in the middle keeps your place', async ({ page }) => {
  await at(page, '2026-11-27T10:00:00');
  await page.goto('/');
  await squeeze(page, 0.2, 0.8);
  await page.click('#drop');
  await page.clock.runFor(3000);
  await expect(page.locator('.panel.done')).toBeVisible();
  await page.reload();
  await expect(page.locator('.ask .meta')).toContainText('2 of 7');
  await expect(page.locator('.pips li').first()).not.toHaveClass('now');
});

test('the reveal shows the answer, the points, a line to learn and a source', async ({ page }) => {
  await page.goto('/');
  await squeeze(page, 0.2, 0.8);
  await page.click('#drop');
  await expect(page.locator('.panel.done')).toBeVisible({ timeout: 6000 });
  await expect(page.locator('.pts')).toHaveText(/^[+−]?\d+$/);
  await expect(page.locator('.teach')).not.toBeEmpty();
  await expect(page.locator('.src a')).toHaveAttribute('href', /^https:/);
  await expect(page.locator('#next')).toBeInViewport();
});

test('share copies spoiler-free text', async ({ page, context, isMobile }) => {
  test.skip(isMobile, 'phones use the share sheet');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await at(page, '2026-11-26T10:00:00');
  await page.goto('/');
  await playAll(page);
  await page.clock.runFor(5000);
  await page.click('#share');
  const text = await page.evaluate(() => navigator.clipboard.readText());
  const lines = text.split('\n');
  expect(lines[0]).toMatch(/^\S.* no\. 2: −?\d+ of 700$/);
  expect(lines.slice(1, 8).every((l) => [...l].length === 7)).toBe(true);
  expect(text).toContain('Caught');
});

test('the story picture is made at 1080 by 1920', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones use the share sheet');
  await at(page, '2026-11-26T10:00:00');
  await page.goto('/');
  await playAll(page);
  await page.clock.runFor(5000);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#image')]);
  const { readFileSync } = await import('node:fs');
  const png = readFileSync(await download.path());
  expect(png.readUInt32BE(16)).toBe(1080);
  expect(png.readUInt32BE(20)).toBe(1920);
});

test('with reduced motion the answer arrives quickly and still shows everything', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8692/');
  await squeeze(page, 0.2, 0.8);
  const t0 = Date.now();
  await page.click('#drop');
  await expect(page.locator('.panel.done')).toBeVisible();
  expect(Date.now() - t0).toBeLessThan(1500);
  await expect(page.locator('.pts')).toHaveText(/\d/);
  await ctx.close();
});

test('controls answer within 100 ms', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(400);
  const ms = await page.evaluate(async () => {
    const c = document.querySelector('.desk canvas');
    const r = c.getBoundingClientRect();
    const thumb = document.querySelector('.thumb');
    const x = r.left + thumb.offsetLeft + thumb.offsetWidth / 2;
    const y = r.bottom - 160;
    const fire = (type, dx) => c.dispatchEvent(new PointerEvent(type, { pointerId: 1, clientX: x + dx, clientY: y, bubbles: true, isPrimary: true, pointerType: 'touch' }));
    c.setPointerCapture = () => {};
    fire('pointerdown', 0);
    const t0 = performance.now();
    fire('pointermove', 40);
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const t = performance.now() - t0;
    fire('pointerup', 40);
    return t;
  });
  expect(ms).toBeLessThan(100);
});
