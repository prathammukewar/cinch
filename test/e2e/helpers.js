import { test as base, expect } from '@playwright/test';

/** A page that fails the test on any error, with an optional fixed clock. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
    // Tests never send scores to the real standings server.
    await page.addInitScript(() => { try { if (!localStorage.getItem('cinch-api')) localStorage.setItem('cinch-api', 'off'); } catch { /* no storage */ } });
    await page.route('https://cinch-standings.cinchgame.workers.dev/**', (route) => route.fulfill({ status: 204 }));
    await use(page);
    expect(errors).toEqual([]);
  },
});
export { expect };

export async function at(page, iso) { await page.clock.install({ time: new Date(iso) }); }

/** Type a range, drop the pin, skip the show and wait for the result. */
export async function answer(page, low, high) {
  await page.locator('#low-value').fill(String(low));
  await page.locator('#high-value').fill(String(high));
  await page.locator('#high-value').blur();
  await page.click('#drop');
  await page.waitForTimeout(60);
  await page.keyboard.press('Enter');
  await expect(page.locator('.panel.done')).toBeVisible({ timeout: 6000 });
}

/** Ruler ends of the question on screen, read from the slider values. */
export async function ends(page) {
  return page.evaluate(() => [document.getElementById('low-value').value, document.getElementById('high-value').value]);
}

/** Play every question on screen with the middle of the ruler. */
export async function playAll(page, n = 7) {
  for (let i = 0; i < n; i++) {
    await squeeze(page, 0.3, 0.7);
    await page.click('#drop');
    await page.waitForTimeout(60);
    await page.keyboard.press('Enter');
    await expect(page.locator('.panel.done')).toBeVisible({ timeout: 6000 });
    await next(page);
  }
}

/** Go to the next question and wait until it is on screen. */
export async function next(page) {
  const before = await page.locator('.ask .meta span').first().textContent();
  await page.click('#next');
  await expect(page.locator('.panel')).not.toHaveClass(/done/, { timeout: 4000 }).catch(() => {});
  await expect(page.locator('.play')).not.toHaveClass(/leaving|entering/).catch(() => {});
  return before;
}

/** Move both pegs with the keyboard. */
export async function squeeze(page, l, u) {
  await page.locator('.thumb').first().focus();
  const press = async (key, times) => { for (let i = 0; i < times; i++) await page.keyboard.press(key); };
  await press('PageUp', Math.round(l * 10));
  await page.locator('.thumb').nth(1).focus();
  await press('PageDown', Math.round((1 - u) * 10));
}
