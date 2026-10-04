import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catchUpState, gradedDueDate } from '../src/catchup.ts';

test('AC-6: learner who attended every day', () => {
  const result = catchUpState({
    dayIds: ['day-0', 'day-1', 'day-2', 'day-3'],
    todayIndex: 2,
    attended: ['day-0', 'day-1', 'day-2'],
    bestScores: { 'day-0': 8, 'day-1': 7, 'day-2': 6 },
  });

  assert.deepEqual(result.missed, []);
  assert.equal(result.nextGate, null);
  assert.deepEqual(result.unlocked, ['day-0', 'day-1', 'day-2']);
  assert.equal(result.selfStudyBlocked, false);
});

test('AC-7: learner who joined on day 3 (missed days 0–2)', () => {
  // Test that passing day 1's diagnostic before day 0's does not unlock day 1
  const result1 = catchUpState({
    dayIds: ['day-0', 'day-1', 'day-2', 'day-3'],
    todayIndex: 3,
    attended: ['day-3'],
    bestScores: { 'day-1': 8, 'day-0': 0, 'day-2': 0 },
  });

  assert.deepEqual(result1.missed, ['day-0', 'day-1', 'day-2']);
  assert.equal(result1.nextGate, 'day-0');
  assert.ok(!result1.unlocked.includes('day-1'));

  // Test that after day 0 passes (day 1 not yet passed), nextGate = day 1
  const result2 = catchUpState({
    dayIds: ['day-0', 'day-1', 'day-2', 'day-3'],
    todayIndex: 3,
    attended: ['day-3'],
    bestScores: { 'day-0': 6, 'day-1': 0, 'day-2': 0 },
  });

  assert.equal(result2.nextGate, 'day-1');
  assert.ok(result2.unlocked.includes('day-0'));
});

test('AC-8: pass mark scoring', () => {
  // Score 5 of 8 does not unlock with default pass mark (6)
  const result1 = catchUpState({
    dayIds: ['day-0', 'day-1'],
    todayIndex: 1,
    attended: [],
    bestScores: { 'day-0': 5 },
  });

  assert.ok(result1.selfStudyBlocked);
  assert.equal(result1.nextGate, 'day-0');

  // Score 6 does unlock
  const result2 = catchUpState({
    dayIds: ['day-0', 'day-1'],
    todayIndex: 1,
    attended: [],
    bestScores: { 'day-0': 6 },
  });

  assert.ok(!result2.selfStudyBlocked);
  assert.equal(result2.nextGate, null);

  // Custom pass mark of 7
  const result3 = catchUpState({
    dayIds: ['day-0', 'day-1'],
    todayIndex: 1,
    attended: [],
    bestScores: { 'day-0': 6 },
    passMark: 7,
  });

  assert.ok(result3.selfStudyBlocked);
  assert.equal(result3.nextGate, 'day-0');

  // Today stays unlocked even while missed days are locked
  const result4 = catchUpState({
    dayIds: ['day-0', 'day-1', 'day-2'],
    todayIndex: 2,
    attended: [],
    bestScores: { 'day-0': 0, 'day-1': 0 },
  });

  assert.ok(result4.unlocked.includes('day-2'));
});

test('AC-9: gradedDueDate default 7 days', () => {
  const gatePassedAt = 1000;
  const dueDate = gradedDueDate(gatePassedAt);
  const expectedDue = 1000 + 7 * 24 * 60 * 60 * 1000;
  assert.equal(dueDate, expectedDue);
});

test('AC-9: gradedDueDate custom extension', () => {
  const gatePassedAt = 1000;
  const dueDate = gradedDueDate(gatePassedAt, 14);
  const expectedDue = 1000 + 14 * 24 * 60 * 60 * 1000;
  assert.equal(dueDate, expectedDue);
});
