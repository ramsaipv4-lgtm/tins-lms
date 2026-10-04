// AC-38
import test from 'node:test';
import assert from 'node:assert/strict';
import { atRisk } from '../src/index.ts';

test('AC-38 ok status with no risk factors', () => {
  const result = atRisk({
    lockedMissedDays: 0,
    overdueCards: 0,
    daysSinceCommit: 0,
    lastShiftScorePct: 90,
  });

  assert.equal(result.level, 'ok');
  assert.deepEqual(result.reasons, []);
});

test('AC-38 watch status with one risk factor', () => {
  const result = atRisk({
    lockedMissedDays: 1,
    overdueCards: 0,
    daysSinceCommit: 0,
    lastShiftScorePct: 90,
  });

  assert.equal(result.level, 'watch');
  assert.ok(result.reasons.includes('locked missed days'));
});

test('AC-38 risk status with two risk factors', () => {
  const result = atRisk({
    lockedMissedDays: 1,
    overdueCards: 50,
    daysSinceCommit: 0,
    lastShiftScorePct: 90,
  });

  assert.equal(result.level, 'risk');
  assert.ok(result.reasons.includes('locked missed days'));
  assert.ok(result.reasons.includes('overdue cards'));
});

test('AC-38 all-null input is ok', () => {
  const result = atRisk({
    lockedMissedDays: 0,
    overdueCards: 0,
    daysSinceCommit: null,
    lastShiftScorePct: null,
  });

  assert.equal(result.level, 'ok');
  assert.deepEqual(result.reasons, []);
});

test('AC-38 null values do not add points', () => {
  const result = atRisk({
    lockedMissedDays: 0,
    overdueCards: 0,
    daysSinceCommit: null,
    lastShiftScorePct: 40,
  });

  assert.equal(result.level, 'watch');
  assert.deepEqual(result.reasons, ['last shift score']);
});
