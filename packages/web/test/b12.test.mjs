// b12-1: AC-153 (Shift screen shows the accommodated limit before the shift starts) and AC-94 (OCR warm-up, PIN record
// reserved before the first screen action). These are source-level checks: the screens themselves are exercised by the
// journeys, which the unit runner cannot start.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL(`../src/features/${p}`, import.meta.url), 'utf8');
const serverShift = readFileSync(new URL('../../server/src/routes/features/shift.ts', import.meta.url), 'utf8');

test('AC-153 the server tells a learner with no run yet the (accommodated) limit', () => {
  const noRun = serverShift.slice(serverShift.indexOf('if (!run || !pack) {'), serverShift.indexOf('const limitMs = await limitFor(pack, me);'));
  assert.match(noRun, /status: 'none'/);
  assert.match(noRun, /limitMs: await limitFor\(any, me\)/);
});

test('AC-153 the Shift screen shows shift-timer in the start state, from the server limit', () => {
  const s = src('shift/Shift.tsx');
  const start = s.slice(s.indexOf("data.status === 'none'"), s.indexOf("data.status === 'finished'"));
  assert.match(start, /data-testid="shift-timer"/);
  assert.match(start, /data\.limitMs/);
});

test('AC-94 the recognition worker starts when the screen opens and the data is not unzipped in script', () => {
  const o = src('coach/ocr.ts');
  assert.match(o, /export function prewarmOcr/);
  assert.match(o, /gzip: false/);
  assert.match(src('coach/Shot.tsx'), /prewarmOcr\(\)/);
});

test('AC-94 a file chosen before the screen is ready waits instead of being dropped', () => {
  const s = src('coach/Shot.tsx');
  assert.match(s, /setPicked\(f\)/);
  assert.match(s, /if \(picked && rules && ready\)/);
});

test('AC-94 the PIN record is reserved when the PIN screen opens, so no document appears later', () => {
  assert.match(src('coach/Gate.tsx'), /reserveMeta\(person\)/);
  const l = src('coach/lib.ts');
  assert.match(l, /export async function reserveMeta/);
  assert.match(l, /typeof meta\.wrapped === 'string'/);
});
