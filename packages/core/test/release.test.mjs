// AC-14, AC-15, AC-16
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sectionKey, sealSection, openSection, releasePlan, isReleased, utf8Encode, utf8Decode } from '../src/index.ts';

const dayKey = new Uint8Array(32).fill(7);

test('AC-14 sectionKey is deterministic, per index, 32 bytes', async () => {
  const a = await sectionKey(dayKey, 0);
  assert.equal(a.length, 32);
  assert.deepEqual(a, await sectionKey(dayKey, 0));
  assert.notDeepEqual(a, await sectionKey(dayKey, 1));
});

test('AC-14 seal/open round trip, wrong key and tamper throw, fresh IV', async () => {
  const k = await sectionKey(dayKey, 2);
  const text = utf8Encode('board page');
  const s1 = await sealSection(k, text);
  assert.equal(utf8Decode(await openSection(k, s1)), 'board page');
  await assert.rejects(openSection(await sectionKey(dayKey, 3), s1));
  const bad = s1.slice(); bad[bad.length - 1] ^= 1;
  await assert.rejects(openSection(k, bad));
  assert.notDeepEqual(s1, await sealSection(k, text));
});

const secs = [
  { id: 'a', plannedSec: 60, graded: false },
  { id: 'b', plannedSec: 120, graded: true },
  { id: 'c', plannedSec: 30, graded: false },
];

test('AC-15 releasePlan cumulative, null for graded', () => {
  assert.deepEqual(releasePlan(1000, secs), [
    { id: 'a', at: 1000 }, { id: 'b', at: null }, { id: 'c', at: 1000 + 180000 },
  ]);
});

test('AC-16 release rules', () => {
  const plan = releasePlan(0, secs);
  const ctx = (o) => ({ now: 0, reachedIds: [], releaseAll: false, ...o });
  assert.equal(isReleased(secs[2], plan, ctx({ now: 179999 })), false);
  assert.equal(isReleased(secs[2], plan, ctx({ now: 180000 })), true);
  assert.equal(isReleased(secs[2], plan, ctx({ reachedIds: ['c'] })), true);
  assert.equal(isReleased(secs[2], plan, ctx({ releaseAll: true })), true);
  assert.equal(isReleased(secs[1], plan, ctx({ now: 9e12 })), false);
  assert.equal(isReleased(secs[1], plan, ctx({ reachedIds: ['b'] })), true);
  assert.equal(isReleased(secs[1], plan, ctx({ releaseAll: true })), true);
});
