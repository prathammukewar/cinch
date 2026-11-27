import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root)));
const context = read('bank/context.json');
const bank = new Map(read('bank/questions.json').map((q) => [q.id, q]));

/** Every question object in the shipped files. */
function shipped() {
  const out = [];
  for (const f of readdirSync(new URL('data/', root))) {
    if (!/^(\d{4}-\d\d|practice-\d+)\.json$/.test(f)) continue;
    JSON.stringify(read(`data/${f}`), (k, v) => { if (v && typeof v === 'object' && typeof v.question === 'string') out.push(v); return v; });
  }
  return out;
}

test('every context line passes the bank checker', () => {
  execFileSync('python3', [new URL('tools/bank/context.py', root).pathname], { stdio: 'pipe' });
});

test('context lines ship with their questions, in plain view, and carry no number the question does not', () => {
  const qs = shipped();
  assert.ok(qs.length > 1000);
  let withContext = 0;
  for (const q of qs) {
    assert.equal(q.context, context[q.id], `${q.id} ships the line from bank/context.json`);
    if (!q.context) continue;
    withContext += 1;
    const said = `${q.question} ${bank.get(q.id).label || ''}`;
    for (const n of q.context.match(/\d+/g) || []) assert.ok(said.includes(n), `${q.id}: ${n} is not in the question or its subject's name`);
    assert.doesNotMatch(q.context, /[—–]/);
    assert.ok(q.context.length <= 230);
  }
  assert.ok(withContext > qs.length * 0.9, 'most questions have a line');
  for (const id of Object.keys(context)) assert.ok(bank.has(id), `${id} is in the bank`);
});
