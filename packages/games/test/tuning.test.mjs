// D-64: tuning.ts equals the SPEC.md §13.9 Tuning table (parsed here at test time).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TUNING } from '../src/tuning.ts';

function specTable() {
  const spec = readFileSync(new URL('../../../SPEC.md', import.meta.url), 'utf8');
  const from = spec.indexOf('### 13.9 Tuning');
  const to = spec.indexOf('### 13.10', from);
  assert.ok(from >= 0 && to > from, 'SPEC.md has a 13.9 Tuning section');
  const rows = [...spec.slice(from, to).matchAll(/^\| `([A-Za-z0-9.]+)` \| (-?[0-9.]+) \|/gm)];
  return Object.fromEntries(rows.map((m) => [m[1], Number(m[2])]));
}

test('D-64 tuning.ts exports exactly the SPEC §13.9 names and values', () => {
  const table = specTable();
  assert.ok(Object.keys(table).length >= 80, 'the table was parsed');
  assert.deepEqual(Object.keys(TUNING).sort(), Object.keys(table).sort());
  for (const [name, value] of Object.entries(table)) assert.equal(TUNING[name], value, name);
});

test('D-64 spot values used by the game rules', () => {
  assert.equal(TUNING['common.assistFactor'], 0.5);
  assert.equal(TUNING['syntaxDrop.minBeatMs'], 500);
  assert.equal(TUNING['whack.maxProgramLines'], 9);
  assert.equal(TUNING['story.prologueMaxMs'], 90000);
});
