import test from 'node:test';
import assert from 'node:assert/strict';
import { nameProblem, nameKey, tidyName } from '../../js/names.js';

test('ordinary names pass, in any alphabet', () => {
  for (const n of ['Ana', 'Ben Lee', "O'Neil", 'mary_k', 'Zoë', 'Søren', 'Ли Мин', '李小龍ab', 'raccoon rider', 'Grape Ape', 'Hancock', 'Scunthorpe fan', 'class act', 'Torpedo', 'Gay Paree', 'Jewel']) {
    assert.equal(nameProblem(n), null, n);
  }
});

test('names are tidied and compared loosely', () => {
  assert.equal(tidyName('  Ana   Lee '), 'Ana Lee');
  assert.equal(nameKey('Ann Lee'), nameKey('ann_lee'));
  assert.equal(nameKey('Pr4th4m'), nameKey('Pratham'));
});

test('length, characters and letters are checked', () => {
  assert.match(nameProblem('Al'), /at least 3/);
  assert.match(nameProblem('A'.repeat(21)), /at most 20/);
  assert.match(nameProblem('-dash'), /starting with a letter/);
  assert.match(nameProblem('ab<script>'), /letters, numbers/);
  assert.match(nameProblem('123'), /two letters/);
  assert.match(nameProblem('a​bc'), /letters, numbers/);
});

test('contact details and links are kept out of public names', () => {
  assert.match(nameProblem('call 5551234567'), /long numbers/);
  assert.match(nameProblem('me@mail'), /letters, numbers/);
  assert.match(nameProblem('ana.com'), /web addresses/);
  assert.match(nameProblem('www ana'), /web addresses/);
});

test('reserved names and impersonation of the game are refused', () => {
  for (const n of ['Cinch', 'cinch official', 'Admin', 'MODERATOR', 'C1nch']) assert.match(nameProblem(n), /reserved/, n);
});

test('slurs and obscenities are refused, including dressed up spellings', () => {
  for (const n of ['fuckface', 'f.u.c.k', 'Sh1t head', 'big dick', 'ass man', 'n1gga']) assert.match(nameProblem(n), /without that word/, n);
});
