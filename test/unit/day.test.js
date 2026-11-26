import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dayNumber, keyOf, addDays, streaks, untilMidnight, dayKey } from '../../js/day.js';

test('day numbers and keys go both ways across years, leap days and month ends', () => {
  for (let n = -400; n < 2000; n += 1) assert.equal(dayNumber(keyOf(n)), n);
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addDays('2027-02-28', 1), '2027-03-01');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('a day is the local calendar day in every time zone, right up to midnight', () => {
  const code = `
    import('${new URL('../../js/day.js', import.meta.url).href}').then(({ dayKey, dayNumber, untilMidnight }) => {
      const at = (y, m, d, h, mi, s) => new Date(y, m - 1, d, h, mi, s);
      const out = [];
      out.push(dayKey(at(2026, 11, 25, 23, 59, 59)), dayKey(at(2026, 11, 26, 0, 0, 0)));
      out.push(dayNumber(dayKey(at(2027, 3, 14, 0, 30, 0))), dayNumber(dayKey(at(2027, 3, 14, 23, 30, 0))), dayNumber(dayKey(at(2027, 3, 15, 0, 30, 0))));
      out.push(dayNumber(dayKey(at(2026, 11, 1, 0, 30, 0))), dayNumber(dayKey(at(2026, 11, 1, 23, 30, 0))));
      out.push(untilMidnight(at(2026, 11, 25, 23, 59, 0)));
      console.log(JSON.stringify(out));
    });`;
  for (const tz of ['UTC', 'America/New_York', 'America/Los_Angeles', 'Asia/Kolkata', 'Pacific/Kiritimati', 'Pacific/Pago_Pago', 'Australia/Lord_Howe', 'Asia/Kathmandu', 'America/St_Johns', 'Africa/Cairo']) {
    const r = JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ: tz } }).toString());
    assert.deepEqual(r, ['2026-11-25', '2026-11-26', 110, 110, 111, -23, -23, 60000], tz);
  }
});

test('the same instant is a different day in different zones, and that is fine', () => {
  const code = `import('${new URL('../../js/day.js', import.meta.url).href}').then(({ dayKey }) => console.log(dayKey(new Date('2026-11-26T04:30:00Z'))));`;
  const run = (tz) => execFileSync(process.execPath, ['--input-type=module', '-e', code], { env: { ...process.env, TZ: tz } }).toString().trim();
  assert.equal(run('America/New_York'), '2026-11-25');
  assert.equal(run('Europe/London'), '2026-11-26');
});

test('streaks', () => {
  assert.deepEqual(streaks([], 10), { current: 0, best: 0 });
  assert.deepEqual(streaks([8, 9, 10], 10), { current: 3, best: 3 });
  assert.deepEqual(streaks([8, 9], 10), { current: 2, best: 2 }); // today not played yet
  assert.deepEqual(streaks([7, 8], 10), { current: 0, best: 2 });
  assert.deepEqual(streaks([1, 2, 3, 4, 9, 10], 10), { current: 2, best: 4 });
  assert.deepEqual(streaks([10, 9, 8, 8], 10), { current: 3, best: 3 });
});

test('until midnight is never more than a day and a bit', () => {
  const ms = untilMidnight();
  assert.ok(ms > 0 && ms <= 25 * 3600000);
  assert.match(dayKey(), /^\d{4}-\d\d-\d\d$/);
});
