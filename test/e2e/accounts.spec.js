import { test, expect, playAll, next, audit } from './helpers.js';
import { backend } from '../backend.js';

/** Points this page at the real server code, running in the test over a throwaway database. */
async function serve(page, b) {
  await page.addInitScript(() => localStorage.setItem('cinch-api', `${location.origin}/standings`));
  await page.route('**/standings/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const res = await b.fetch(new Request(`https://api.test${url.pathname.replace('/standings', '')}${url.search}`, { method: req.method(), headers: { ...req.headers(), origin: url.origin }, body: req.postData() ?? undefined }));
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
}

async function makeAccount(page, name, listed = true) {
  await page.goto('/#account');
  await page.fill('#acct-name', name);
  if (listed) await page.check('#acct-listed');
  await page.click('#acct-create');
  await expect(page.locator('#acct-key-show')).toBeVisible();
  const key = (await page.locator('#acct-key-show').textContent()).trim();
  await page.click('#acct-saved');
  await expect(page.locator('h1')).toHaveText(name);
  return key;
}

test('make an account, keep the key out of backups, and land on the leaderboard after a Roundup', async ({ page }) => {
  test.setTimeout(90000);
  const b = backend();
  await serve(page, b);
  const key = await makeAccount(page, 'Ana Lee');
  expect(key).toMatch(/^([0-9A-HJKMNP-TV-Z]{5}-){4}[0-9A-HJKMNP-TV-Z]{5}$/);
  const raw = key.replace(/-/g, '');
  const stored = await page.evaluate(() => ({ key: localStorage.getItem('cinch-key'), save: localStorage.getItem('cinch') }));
  expect(stored.key).toBe(raw);
  expect(stored.save).not.toContain(raw);
  const backup = await page.evaluate(async () => (await import('/js/store.js')).exportSave());
  expect(backup).not.toContain(raw);
  expect(b.sql.prepare('SELECT COUNT(*) AS n FROM accounts WHERE key_hash = ?').get(raw).n).toBe(0);

  await page.goto('/#today');
  await playAll(page);
  await expect(page.locator('.board-line')).toContainText('#1 of 1 on today’s leaderboard');
  await page.click('#result-board');
  await expect(page.locator('.rider-row.you')).toContainText('Ana Lee');
  await page.click('#lb-week');
  await expect(page.locator('.rider-row.you .dd')).toHaveText('1 day');
  await page.locator('.rider-row.you').click();
  await expect(page.locator('.board-peek')).toContainText('Roundups');
  await page.waitForTimeout(400);
  await page.locator('.rider-row.you').click();
  await expect(page.locator('.board-peek')).toBeHidden();
  // The home screen shows where you stand.
  await page.goto('/#home');
  await expect(page.locator('#home-board')).toContainText('#1');
});

test('a second device signs in with the key and gets the same record', async ({ page, browser }) => {
  test.setTimeout(90000);
  const b = backend();
  await serve(page, b);
  const key = await makeAccount(page, 'Ben', false);
  await page.goto('/#practice');
  for (let i = 0; i < 3; i++) {
    await page.locator('.thumb').first().focus();
    await page.keyboard.press('PageUp');
    await page.click('#drop');
    await page.waitForTimeout(60);
    await page.keyboard.press('Enter');
    await expect(page.locator('.panel.done')).toBeVisible();
    await next(page);
  }
  await page.goto('/#account');
  await page.click('#acct-sync-go');
  await expect(page.locator('#acct-sync')).toContainText('just now');

  const ctx = await browser.newContext();
  const other = await ctx.newPage();
  await serve(other, b);
  await other.goto('/#account');
  await other.fill('#acct-key', key.toLowerCase().replace(/-/g, ' '));
  await other.click('#acct-signin');
  await expect(other.locator('h1')).toHaveText('Ben');
  await other.goto('/#calibration');
  await expect(other.locator('.num-grid .num-tile').first()).toContainText('3');
  await ctx.close();

  // A wrong key never signs anyone in.
  const ctx2 = await browser.newContext();
  const third = await ctx2.newPage();
  await serve(third, b);
  await third.goto('/#account');
  await third.fill('#acct-key', '00000-00000-00000-00000-00000');
  await third.click('#acct-signin');
  await expect(third.locator('.form-msg').last()).toContainText('does not match an account');
  await ctx2.close();
});

test('names are checked as you type, and a taken name is refused', async ({ page }) => {
  const b = backend();
  await serve(page, b);
  await page.goto('/#account');
  await page.fill('#acct-name', 'sh1t head');
  await expect(page.locator('#acct-name-hint')).toHaveText(/without that word/);
  await page.fill('#acct-name', 'me@mail.com');
  await expect(page.locator('#acct-name-hint')).toHaveClass(/bad/);
  await b.call('/v1/account', { method: 'POST', body: { name: 'Dana', listed: true } });
  await page.fill('#acct-name', 'dana');
  await page.click('#acct-create');
  await expect(page.locator('.form-msg').first()).toHaveText('That name is taken. Pick another.');
  expect(await page.evaluate(() => localStorage.getItem('cinch-key'))).toBeNull();
});

test('hide from the board, download your data, and delete everything', async ({ page }) => {
  test.setTimeout(90000);
  const b = backend();
  await serve(page, b);
  const key = await makeAccount(page, 'Cass');
  await page.goto('/#today');
  await playAll(page);
  await expect(page.locator('.board-line')).toContainText('#1');
  await page.goto('/#account');
  await page.uncheck('#acct-listed-toggle');
  await expect(page.locator('#acct-listed-toggle')).toBeEnabled();
  // Hidden means no name: the score stays on the board.
  await page.goto('/#leaderboard');
  await expect(page.locator('.rider-row')).toHaveCount(1);
  await expect(page.locator('.rider-row .nm')).toContainText('Unnamed rider');
  await expect(page.locator('.rider-row')).not.toContainText('Cass');
  await expect(page.locator('.you-card')).toContainText('Your name is hidden');

  await page.goto('/#account');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#acct-export')]);
  const text = await (await dl.createReadStream()).toArray().then((c) => Buffer.concat(c).toString());
  const data = JSON.parse(text);
  expect(data.account.name).toBe('Cass');
  expect(data.roundups).toHaveLength(1);
  expect(text).not.toContain(key.replace(/-/g, ''));

  await page.click('#acct-delete');
  await page.fill('#acct-delete-name', 'wrong');
  await page.click('#acct-delete-go');
  await expect(page.locator('.danger .form-msg')).toContainText('exactly');
  await page.fill('#acct-delete-name', 'cass');
  await page.click('#acct-delete-go');
  await expect(page.locator('h1')).toHaveText('Account deleted');
  expect(await page.evaluate(() => localStorage.getItem('cinch-key'))).toBeNull();
  for (const t of ['accounts', 'saves']) expect(b.sql.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n).toBe(0);
  expect(b.sql.prepare('SELECT COUNT(*) AS n FROM scores WHERE account IS NOT NULL').get().n).toBe(0);
  // The record stays on this device.
  await page.goto('/#calibration');
  await expect(page.locator('.num-grid')).toBeVisible();
});

test('the privacy page and every new screen pass with no errors under the security policy', async ({ page }) => {
  const b = backend();
  await serve(page, b);
  for (const s of ['privacy', 'account', 'leaderboard', 'leaderboard/week', 'leaderboard/all', 'settings']) {
    await page.goto(`/#${s}`);
    await expect(page.locator('h1')).not.toBeEmpty();
  }
  await page.goto('/#privacy');
  await expect(page.locator('main')).toContainText('No email, no password');
  const csp = (await page.request.get('/')).headers()['content-security-policy'];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("script-src 'self'");
});

for (const scheme of ['light', 'dark']) {
  test(`account and leaderboard screens have no accessibility problems, ${scheme}`, async ({ page }) => {
    test.setTimeout(90000);
    await page.emulateMedia({ colorScheme: scheme });
    const b = backend();
    await serve(page, b);
    await b.call('/v1/account', { method: 'POST', body: { name: 'Elle', listed: true } });
    await page.goto('/#account');
    await page.fill('#acct-name', 'sh1t');
    expect(await audit(page), 'sign up').toEqual([]);
    await page.fill('#acct-name', 'Fern');
    await page.check('#acct-listed');
    await page.click('#acct-create');
    await expect(page.locator('#acct-key-show')).toBeVisible();
    expect(await audit(page), 'key').toEqual([]);
    await page.click('#acct-saved');
    await page.click('#acct-delete');
    expect(await audit(page), 'manage').toEqual([]);
    await page.goto('/#today');
    await playAll(page);
    expect(await audit(page), 'result with board line').toEqual([]);
    await page.goto('/#leaderboard');
    await page.locator('.rider-row').first().focus();
    await expect(page.locator('.board-peek')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await audit(page), 'leaderboard').toEqual([]);
    await page.goto('/#privacy');
    expect(await audit(page), 'privacy').toEqual([]);
  });
}
