import { test, expect, at, playAll, squeeze, next } from './helpers.js';
import { readFileSync, writeFileSync } from 'node:fs';

test('the Corral deals sets of seven, no category twice, then shows a result', async ({ page }) => {
  await page.goto('/#practice');
  let last = new Set();
  for (let i = 0; i < 7; i++) {
    await expect(page.locator('.ask .meta')).toContainText(`The Corral, set 1, ${i + 1} of 7`);
    const cat = (await page.locator('.ask .meta span').nth(1).textContent()).split(' \u00b7 ')[0];
    expect(last.has(cat)).toBe(false);
    last.add(cat);
    await squeeze(page, 0.3, 0.7);
    await page.click('#drop');
    await page.waitForTimeout(50);
    await page.keyboard.press('Enter');
    await expect(page.locator('.panel.done')).toBeVisible({ timeout: 6000 });
    await next(page);
  }
  await expect(page.locator('.tally .day')).toHaveText('The Corral, set 1');
  await expect(page.locator('.facts')).toContainText('of 7');
  await page.click('#again');
  await expect(page.locator('.ask .meta')).toContainText('The Corral, set 2, 1 of 7');
});

test('practice never uses a daily question, and Showdown links survive a round trip', async ({ page }) => {
  await page.goto('/#practice');
  const bad = await page.evaluate(async () => {
    const { practicePool } = await import('/js/bank.js');
    const pool = new Set((await practicePool()).map((x) => x.id));
    const s = await (await fetch('/bank/schedule.json')).json();
    return Object.values(s.days).flat().filter((id) => pool.has(id));
  });
  expect(bad).toEqual([]);
  const ok = await page.evaluate(async () => {
    const { encode, decode } = await import('/js/duel.js');
    const o = { v: 1, d: 'abc', n: 'Sam', q: ['a', 'b'], p: [10, 80], c: '01' };
    return JSON.stringify(decode(encode(o))) === JSON.stringify(o) && decode('garbage!!') === null && decode(encode({ v: 1, q: ['a'], p: [1, 2] })) === null;
  });
  expect(ok).toBe(true);
});

test('Quick Draw runs ten on the fuse and pitches when time is up', async ({ page }) => {
  await at(page, '2026-11-27T09:00:00');
  await page.goto('/#draw');
  await page.click('#start-quant');
  await expect(page.locator('.ask .meta')).toContainText('Quick Draw, 1 of 10');
  await page.clock.runFor(21000);
  await page.clock.runFor(3000);
  await expect(page.locator('.panel.done')).toBeVisible();
  await next(page);
  for (let i = 1; i < 10; i++) {
    await squeeze(page, 0.2, 0.8);
    await page.click('#drop');
    await page.clock.runFor(3000);
    await next(page);
  }
  await expect(page.locator('.facts')).toContainText('of 10');
  await expect(page.locator('.tally .of')).toContainText('1000');
});

test('backup and restore through the real buttons', async ({ page, browser }, info) => {
  await at(page, '2026-11-26T09:00:00');
  await page.goto('/#today');
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
  await expect(page.locator('h1')).toContainText('Brand Book');
  await page.evaluate(() => localStorage.setItem('cinch', '{{{'));
  await page.goto('/#today'); await page.reload();
  await expect(page.locator('.ask h1')).not.toBeEmpty();
  expect(await page.evaluate(() => Object.keys(localStorage).some((k) => k.startsWith('cinch-unreadable')))).toBe(true);
});

test('the dashboard fills in as questions are answered', async ({ page }) => {
  await page.goto('/#calibration');
  await expect(page.locator('.page')).toContainText('Nothing here yet');
  await page.evaluate(() => {
    const rows = Array.from({ length: 120 }, (_, i) => ({ id: `q${i}`, cat: ['Space', 'Food', 'Money'][i % 3], hit: i % 5 !== 0, l: 0.4, u: 0.6, x: i % 5 ? 0.45 + (i % 10) / 100 : 0.7, width: 0.2, points: i % 5 ? 80 : -120, lo: 1, hi: 2, at: i }));
    localStorage.setItem('cinch', JSON.stringify({ v: 1, practice: { rows, seen: {} } }));
  });
  await page.reload();
  await expect(page.locator('figure svg')).toHaveCount(2);
  await expect(page.locator('.page')).toContainText('80%');
  await expect(page.locator('.cats li')).toHaveCount(3);
  await expect(page.locator('.book-hero .state-pill')).toHaveText(/Too tight|On the mark|Too loose/);
  await expect(page.locator('.num-grid .num-tile')).toHaveCount(8);
  await page.locator('.topic').first().click();
  await expect(page.locator('.topic-peek')).toBeVisible();
  await expect(page.locator('.topic-peek')).toContainText('Roped');
  await page.locator('.tierbar .tseg').first().focus();
  await expect(page.locator('.tip')).toBeVisible();
  await page.goto('/#home');
  await expect(page.locator('#home-stats')).toContainText('80%roped');
});

test('settings: theme and sound stick', async ({ page }) => {
  await page.goto('/#settings');
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#sound');
  await page.reload();
  await expect(page.locator('#sound')).toHaveAttribute('aria-pressed', 'false');
});

test('erase asks twice', async ({ page }) => {
  await at(page, '2026-11-26T09:00:00');
  await page.goto('/#today');
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
  await page.goto('/#today');
  await expect(page.locator('#main')).toContainText('did not load');
  block = false;
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.ask h1')).not.toBeEmpty();
});

test('hints: fencing in shortens the rail and costs points, scouting adds landmarks', async ({ page }) => {
  await at(page, '2026-11-27T09:00:00');
  await page.goto('/#practice');
  let found = false;
  for (let i = 0; i < 7 && !found; i++) {
    if (await page.locator('#hint-scout').isVisible()) { found = true; break; }
    await squeeze(page, 0.3, 0.7);
    await page.click('#drop');
    await page.clock.runFor(3000);
    await next(page);
  }
  test.skip(!found, 'no landmark in this set');
  const before = await page.evaluate(() => [document.getElementById('low-value').value, document.getElementById('high-value').value]);
  await page.click('#hint-fence');
  await page.clock.runFor(800);
  await expect(page.locator('#hint-fence')).toHaveText(/Fence in more/);
  const after = await page.evaluate(() => [document.getElementById('low-value').value, document.getElementById('high-value').value]);
  expect(after).not.toEqual(before);
  await expect(page.locator('.worth')).toContainText('85% with hints');
  await page.click('#hint-scout');
  await expect(page.locator('#hint-scout')).toHaveText('Scouted');
  await expect(page.locator('.worth')).toContainText('72% with hints');
  await page.click('#drop');
  await page.clock.runFor(3000);
  await expect(page.locator('.panel.done')).toBeVisible();
  const row = await page.evaluate(() => JSON.parse(localStorage.getItem('cinch')).practice.rows.at(-1));
  expect(row.hints).toEqual({ scout: true, fence: 1 });
});

test('the daily fuse pitches the loop when it burns out', async ({ page }) => {
  await at(page, '2026-11-27T09:00:00');
  await page.goto('/#today');
  await expect(page.locator('.fuse')).toBeVisible();
  await page.clock.runFor(25500);
  await expect(page.locator('.fuse')).toHaveClass(/short/);
  await page.clock.runFor(5000);
  await page.clock.runFor(3000);
  await expect(page.locator('.panel.done')).toBeVisible();
  await expect(page.locator('.pts')).toHaveText('0');
});

test('questions show their difficulty', async ({ page }) => {
  await page.goto('/#today');
  await expect(page.locator('.ask .meta')).toContainText(/Tenderfoot|Wrangler|Trail boss/);
});

test('a Showdown: send a link, a friend plays it, both see who won', async ({ page, browser }) => {
  await at(page, '2026-11-27T09:00:00');
  await page.goto('/#duel');
  await page.click('#way-send');
  await page.fill('#duel-name', 'Sam');
  await page.click('#duel-start');
  for (let i = 0; i < 7; i++) {
    await squeeze(page, 0.25, 0.75);
    await page.click('#drop');
    await page.clock.runFor(3000);
    await next(page);
  }
  const url = await page.locator('.link-box').inputValue();
  expect(url).toMatch(/#duel\/[A-Za-z0-9_-]+$/);
  const ctx = await browser.newContext();
  const friend = await ctx.newPage();
  await friend.clock.install({ time: new Date('2026-11-27T10:00:00') });
  await friend.goto(url.replace('https://playcinch.pages.dev/', 'http://127.0.0.1:8692/'));
  await expect(friend.locator('.big-line')).toContainText('Sam scored');
  await friend.click('#duel-go');
  for (let i = 0; i < 7; i++) {
    await squeeze(friend, 0.1, 0.9);
    await friend.click('#drop');
    await friend.clock.runFor(3000);
    await next(friend);
  }
  await expect(friend.locator('.vs')).toBeVisible();
  await expect(friend.locator('.verdict-line')).toHaveText(/wins by|dead heat/);
  await expect(friend.locator('.duel-rows li')).toHaveCount(7);
  await expect(friend.locator('#duel-reply')).toBeVisible();
  await ctx.close();
});

test('Same saddle: two riders pass one phone, rope in secret, and one horseshoe lands for both', async ({ page }) => {
  await at(page, '2026-11-27T09:00:00');
  await page.goto('/#duel');
  await page.click('#way-same');
  await page.fill('#rider-1', 'Ana');
  await page.fill('#rider-2', 'Ben');
  await page.click('#side-start');
  for (let i = 0; i < 7; i++) {
    const [first, second] = i % 2 === 0 ? ['Ana', 'Ben'] : ['Ben', 'Ana'];
    await expect(page.locator('.ask .meta span').first()).toContainText(`${first}\u2019s turn`);
    await expect(page.locator('#drop')).toHaveText('Lock it in');
    await squeeze(page, 0.2, 0.6);
    await page.clock.runFor(200);
    const firstLoop = await page.evaluate(() => [document.getElementById('low-value').value, document.getElementById('high-value').value]);
    await page.click('#drop');
    await expect(page.locator('.handoff h2')).toHaveText(`Pass the phone to ${second}`);
    await page.click('#handoff-go');
    await expect(page.locator('.handoff')).toHaveCount(0);
    await expect(page.locator('.ask .meta span').first()).toContainText(`${second}\u2019s turn`);
    await page.clock.runFor(200);
    // The first loop is hidden: the second rider starts from the full rail.
    const fresh = await page.evaluate(() => [document.getElementById('low-value').value, document.getElementById('high-value').value]);
    expect(fresh).not.toEqual(firstLoop);
    await expect(page.locator('#drop')).toHaveText('Pitch the shoe');
    await squeeze(page, 0.4, 0.9);
    await page.click('#drop');
    await page.clock.runFor(3000);
    await expect(page.locator('.panel.done')).toBeVisible();
    await expect(page.locator('.pair-res li')).toHaveCount(2);
    await expect(page.locator('.pair-res li').first()).toContainText('Ana');
    await next(page);
  }
  await expect(page.locator('.vs')).toBeVisible();
  await expect(page.locator('.vs .who').first()).toHaveText('Ana');
  await expect(page.locator('.vs .who').nth(1)).toHaveText('Ben');
  await expect(page.locator('.verdict-line')).toHaveText(/wins by|dead heat/);
  await expect(page.locator('.duel-rows li')).toHaveCount(7);
  await expect(page.locator('#side-again')).toBeVisible();
});

/** A stand-in for the room server, shared by every page that routes to it. */
function fakeRooms() {
  const rooms = new Map();
  let made = 0;
  return async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/standings/, '');
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    const reply = (status, json) => route.fulfill({ status, json });
    if (path === '/v1/room' && req.method() === 'POST') {
      const code = `ROO${'ABCDEFGH'[made++]}`;
      const token = `host-token-${code}-0123456789`;
      rooms.set(code, { q: body.q, names: [body.name, null], tokens: [token, null], picks: [] });
      return reply(200, { code, seat: 0, token, q: body.q, names: [body.name, null] });
    }
    const m = path.match(/^\/v1\/room\/([A-Z]{4})(\/join|\/pick)?$/);
    const room = m && rooms.get(m[1]);
    if (!room) return reply(404, { error: 'no such room' });
    if (m[2] === '/join') {
      if (room.names[1]) return reply(409, { error: 'full' });
      room.names[1] = body.name;
      room.tokens[1] = `guest-token-${m[1]}-0123456789`;
      return reply(200, { code: m[1], seat: 1, token: room.tokens[1], q: room.q, names: room.names });
    }
    const seat = room.tokens.indexOf(m[2] === '/pick' ? body.token : url.searchParams.get('token'));
    if (seat < 0) return reply(403, { error: 'not your seat' });
    if (m[2] === '/pick') {
      if (!room.picks.some((p) => p.seat === seat && p.i === body.i)) room.picks.push({ seat, i: body.i, lo: body.lo, hi: body.hi, fence: body.fence, scout: body.scout ? 1 : 0 });
      return reply(200, { ok: true });
    }
    const mine = new Set(room.picks.filter((p) => p.seat === seat).map((p) => p.i));
    return reply(200, { code: m[1], seat, q: room.q, names: room.names, picks: room.picks.filter((p) => p.seat === seat || mine.has(p.i)), roped: room.picks.filter((p) => p.seat !== seat).map((p) => p.i) });
  };
}

test('Side by side: two devices share a room and rope the same questions live', async ({ page, browser }) => {
  test.setTimeout(120000);
  const rooms = fakeRooms();
  const setup = async (p) => {
    await p.addInitScript(() => localStorage.setItem('cinch-api', `${location.origin}/standings`));
    await p.route('**/standings/v1/room**', rooms);
  };
  await setup(page);
  await page.goto('/#duel');
  await page.click('#way-side');
  await page.fill('#duel-name', 'Ana');
  await page.click('#room-start');
  const code = (await page.locator('#room-code-show').textContent()).trim();
  expect(code).toMatch(/^[A-Z]{4}$/);
  const ctx = await browser.newContext();
  const guest = await ctx.newPage();
  await setup(guest);
  await guest.goto(`/#duel/${code}`);
  await guest.fill('#duel-name', 'Ben');
  await guest.click('#room-join-go');
  await expect(page.locator('.ask .meta span').first()).toContainText('1 of 7 \u00b7 vs Ben', { timeout: 8000 });
  await expect(guest.locator('.ask .meta span').first()).toContainText('1 of 7 \u00b7 vs Ana');
  await expect(page.locator('.ask h1')).toHaveText(await guest.locator('.ask h1').textContent());
  for (let i = 0; i < 7; i++) {
    await squeeze(page, 0.2, 0.7);
    await page.click('#drop');
    await expect(page.locator('.wait-line')).toContainText('Waiting for Ben');
    await squeeze(guest, 0.3, 0.8);
    await guest.click('#drop');
    for (const p of [page, guest]) {
      await expect(p.locator('.panel.done')).toBeVisible({ timeout: 10000 });
      await expect(p.locator('.pair-res li')).toHaveCount(2);
    }
    expect(await page.locator('.pair-res').innerText()).toBe(await guest.locator('.pair-res').innerText());
    for (const p of [page, guest]) await next(p);
  }
  await expect(page.locator('.verdict-line')).toHaveText(/You win by|Ben wins by|dead heat/);
  await expect(guest.locator('.verdict-line')).toHaveText(/You win by|Ana wins by|dead heat/);
  await expect(guest.locator('.duel-rows li')).toHaveCount(7);
  await ctx.close();
});
