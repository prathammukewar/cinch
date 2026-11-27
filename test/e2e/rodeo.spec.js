import { test, expect, squeeze, audit } from './helpers.js';
import { backend } from '../backend.js';

/** Points a page at the real server code, running in the test: requests through the worker, the room's socket straight into the room. */
async function serve(page, b) {
  await page.addInitScript(() => localStorage.setItem('cinch-api', `${location.origin}/standings`));
  await page.route('**/standings/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const res = await b.fetch(new Request(`https://api.test${url.pathname.replace('/standings', '')}${url.search}`, { method: req.method(), headers: { ...req.headers(), origin: url.origin }, body: req.postData() ?? undefined }));
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  await page.routeWebSocket(/\/standings\/v1\/rodeo\/[A-Z]{4}$/, (ws) => {
    const sock = b.rodeo.connect(ws.url().slice(-4), (m) => ws.send(m));
    sock.onclose = (code, reason) => ws.close({ code, reason });
    ws.onMessage((m) => { sock.say(String(m)); });
    ws.onClose(() => { if (sock.readyState !== 3) sock.drop(); });
  });
}

const meta = (p) => p.locator('.ask .meta span').first();

test('Rodeo: three riders on three devices play a room live, one reloads mid-game, and the host runs it again', async ({ page, browser }) => {
  test.setTimeout(240000);
  const b = backend();
  await serve(page, b);
  await page.goto('/#rodeo');
  await page.fill('#rodeo-name', 'Ana');
  await page.click('#room-start');
  await expect(page.locator('#room-code-show')).toHaveText(/^[A-Z]{4}$/);
  const code = (await page.locator('#room-code-show').textContent()).trim();
  expect(page.url()).toContain(`#rodeo/${code}`);
  await expect(page.locator('#rodeo-go')).toBeDisabled();

  const guests = [];
  for (const name of ['Ben', 'Cy']) {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await serve(p, b);
    await p.goto(`/#rodeo/${code}`);
    await p.fill('#rodeo-name', name);
    await p.click('#room-join-go');
    await expect(p.locator('#posse li.you')).toContainText(name);
    guests.push(p);
  }
  const [ben, cy] = guests;
  const all = [page, ben, cy];
  for (const p of all) await expect(p.locator('#posse li')).toHaveCount(3);
  await expect(ben.locator('.wait-line')).toContainText('Waiting for Ana to start');
  await expect(page.locator('#posse .kick')).toHaveCount(2);
  await expect(ben.locator('#posse .kick')).toHaveCount(0);
  expect(await audit(page)).toEqual([]);

  await page.click('#rodeo-go');
  for (const p of all) await expect(meta(p)).toContainText('Rodeo, 1 of 7');
  const question = await page.locator('.ask h1').textContent();
  for (const p of guests) await expect(p.locator('.ask h1')).toHaveText(question);
  await expect(page.locator('#drop')).toHaveText('Lock it in');

  // Someone opening the link after the start is turned away.
  const late = await (await browser.newContext()).newPage();
  await serve(late, b);
  await late.goto(`/#rodeo/${code}`);
  await late.fill('#rodeo-name', 'Dee');
  await late.click('#room-join-go');
  await expect(late.locator('.room-msg')).toHaveText('That rodeo has already started.');

  for (let i = 0; i < 7; i++) {
    await squeeze(page, 0.2, 0.7);
    await page.click('#drop');
    await expect(page.locator('.wait-line')).toContainText('Waiting for Ben and Cy');
    await expect(cy.locator('.posse-strip li.in')).toHaveCount(1);
    if (i === 2) {
      // Cy reloads before throwing and lands back on the same question.
      await cy.reload();
      await expect(meta(cy)).toContainText('Rodeo, 3 of 7');
      await expect(cy.locator('.ask h1')).toHaveText(await page.locator('.ask h1').textContent());
    }
    await squeeze(ben, 0.3, 0.8);
    await ben.click('#drop');
    await squeeze(cy, 0.1, 0.9);
    await cy.click('#drop');
    for (const p of all) {
      await expect(p.locator('.panel.done')).toBeVisible({ timeout: 10000 });
      await expect(p.locator('.rodeo-res li')).toHaveCount(3);
    }
    // Every device works out the same points for every rider.
    const pts = await Promise.all(all.map((p) => p.locator('.rodeo-res .num').allTextContents().then((x) => x.sort().join())));
    expect(new Set(pts).size).toBe(1);
    for (const p of all) await p.click('#next');
    if (i < 6) for (const p of all) await expect(meta(p)).toContainText(`Rodeo, ${i + 2} of 7`, { timeout: 8000 });
  }
  for (const p of all) {
    await expect(p.locator('#rodeo-verdict')).toHaveText(/You win\.|You came \d(st|nd|rd) of 3\.|A tie for first\./);
    await expect(p.locator('#standings li')).toHaveCount(3);
    await expect(p.locator('.rodeo-rows li')).toHaveCount(7);
  }
  await expect(ben.locator('.rodeo-end .wait-line')).toHaveText('Ana can start another round');
  expect(await audit(page)).toEqual([]);
  // Rodeo loops count in the Brand Book, once each, even for the rider who reloaded.
  const rows = await cy.evaluate(() => JSON.parse(localStorage.getItem('cinch')).practice.rows.filter((r) => r.mode === 'rodeo').length);
  expect(rows).toBe(7);

  await page.click('#rodeo-again');
  for (const p of all) await expect(p.locator('#posse li')).toHaveCount(3);
  await expect(page.locator('#rodeo-go')).toBeEnabled();
});

test('Rodeo: the host can take a rider out, and a rider who leaves frees their seat', async ({ page, browser }) => {
  const b = backend();
  await serve(page, b);
  await page.goto('/#rodeo');
  await page.fill('#rodeo-name', 'Ana');
  await page.click('#room-start');
  const code = (await page.locator('#room-code-show').textContent()).trim();
  const join = async (name) => {
    const p = await (await browser.newContext()).newPage();
    await serve(p, b);
    await p.goto(`/#rodeo/${code}`);
    await p.fill('#rodeo-name', name);
    await p.click('#room-join-go');
    await expect(p.locator('#posse li.you')).toBeVisible();
    return p;
  };
  const ben = await join('Ben');
  const cy = await join('Cy');
  await expect(page.locator('#posse li')).toHaveCount(3);
  await page.click('#posse button[aria-label="Remove Cy"]');
  await expect(cy.locator('#rodeo-closed')).toHaveText('The host took you out of the room.');
  await expect(page.locator('#posse li')).toHaveCount(2);
  await ben.click('#rodeo-leave');
  await expect(ben).toHaveURL(/#rodeo$/);
  await expect(page.locator('#posse li')).toHaveCount(1);
  await expect(page.locator('#rodeo-go')).toBeDisabled();
  // A bad name is caught before joining.
  const dee = await (await browser.newContext()).newPage();
  await serve(dee, b);
  await dee.goto(`/#rodeo/${code}`);
  await dee.fill('#rodeo-name', 'www.spam.com');
  await dee.click('#room-join-go');
  await expect(dee.locator('.room-msg')).toHaveText('Leave out web addresses.');
});

test('Rodeo: old Side by side links and codes land in the Rodeo', async ({ page }) => {
  await page.goto('/#duel');
  await expect(page.locator('#way-side')).toHaveAttribute('href', '#rodeo');
  await page.goto('/#duel/side');
  await expect(page.locator('h1')).toHaveText('Rodeo');
  await page.goto('/#duel/abcd');
  await expect(page).toHaveURL(/#rodeo\/ABCD$/);
});
