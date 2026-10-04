// AC-19, AC-20, AC-21
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendEntry, verifyLedger, currentValue } from '../src/ledger.ts';

async function build() {
  let l = [];
  l = await appendEntry(l, { subject: 'a', value: 1, by: 't', at: 1 });
  l = await appendEntry(l, { subject: 'b', value: { x: 2 }, by: 't', at: 2, reason: 'init' });
  l = await appendEntry(l, { subject: 'a', value: 3, by: 't', at: 3 });
  return l;
}

test('AC-19 append returns new array with chain', async () => {
  const empty = [];
  const l1 = await appendEntry(empty, { subject: 'a', value: 1, by: 't', at: 1 });
  assert.equal(empty.length, 0);
  assert.notEqual(l1, empty);
  const l = await build();
  assert.deepEqual(l.map((e) => e.seq), [0, 1, 2]);
  assert.equal(l[1].prevHash, l[0].hash);
  assert.equal(l[2].prevHash, l[1].hash);
  assert.deepEqual(await verifyLedger(l), { ok: true, brokenAt: null });
  assert.deepEqual(await verifyLedger([]), { ok: true, brokenAt: null });
});

test('AC-20 editing an earlier entry is detected at its seq', async () => {
  const l = await build();
  for (const [field, val] of [['value', 99], ['by', 'x'], ['at', 7], ['subject', 'z']]) {
    const t = l.map((e) => ({ ...e }));
    t[1][field] = val;
    assert.deepEqual(await verifyLedger(t), { ok: false, brokenAt: 1 });
  }
});

test('AC-21 correction supersedes, original unchanged', async () => {
  let l = await build();
  const before = JSON.stringify(l[0]);
  l = await appendEntry(l, { subject: 'a', value: 5, by: 't', at: 4, reason: 'typo', corrects: 2 });
  assert.equal(currentValue(l, 'a'), 5);
  assert.equal(l[3].corrects, 2);
  assert.equal(JSON.stringify(l[0]), before);
  assert.equal(l.length, 4);
  assert.equal(currentValue(l, 'none'), undefined);
  assert.equal((await verifyLedger(l)).ok, true);
});
