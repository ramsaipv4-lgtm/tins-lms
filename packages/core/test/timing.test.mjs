import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gradedTiming, effectiveLimitMs } from '../src/timing.ts';

// AC-47: gradedTiming tests
test('AC-47: Hub times win when present', () => {
  const result = gradedTiming({
    hubStart: 1000,
    hubEnd: 5000,
    monotonicMs: 3500,
    deviceStart: 1000,
    deviceEnd: 5000,
  });
  assert.deepEqual(result, { durationMs: 4000, flags: [] });
});

test('AC-47: Missing hub times use monotonic with offline-attempt', () => {
  const result = gradedTiming({
    hubStart: null,
    hubEnd: null,
    monotonicMs: 4000,
    deviceStart: 1000,
    deviceEnd: 5000,
  });
  assert.deepEqual(result, { durationMs: 4000, flags: ['offline-attempt'] });
});

test('AC-47: Missing only hubStart uses monotonic with offline-attempt', () => {
  const result = gradedTiming({
    hubStart: null,
    hubEnd: 5000,
    monotonicMs: 4000,
    deviceStart: 1000,
    deviceEnd: 5000,
  });
  assert.deepEqual(result, { durationMs: 4000, flags: ['offline-attempt'] });
});

test('AC-47: Missing only hubEnd uses monotonic with offline-attempt', () => {
  const result = gradedTiming({
    hubStart: 1000,
    hubEnd: null,
    monotonicMs: 4000,
    deviceStart: 1000,
    deviceEnd: 5000,
  });
  assert.deepEqual(result, { durationMs: 4000, flags: ['offline-attempt'] });
});

test('AC-47: Device clock moved 10 minutes adds clock-skew', () => {
  const result = gradedTiming({
    hubStart: 1000,
    hubEnd: 5000,
    monotonicMs: 4000,
    deviceStart: 1000,
    deviceEnd: 605000, // 10 minutes later than expected
  });
  assert.deepEqual(result, { durationMs: 4000, flags: ['clock-skew'] });
});

test('AC-47: Device clock moved slightly does not add clock-skew', () => {
  const result = gradedTiming({
    hubStart: 1000,
    hubEnd: 5000,
    monotonicMs: 4000,
    deviceStart: 1000,
    deviceEnd: 5030, // 30 seconds different
  });
  assert.deepEqual(result, { durationMs: 4000, flags: [] });
});

test('AC-47: Device clock skew at exactly 60 seconds does not flag', () => {
  const result = gradedTiming({
    hubStart: 1000,
    hubEnd: 5000,
    monotonicMs: 4000,
    deviceStart: 1000,
    deviceEnd: 65000, // exactly 60 seconds more
  });
  assert.deepEqual(result, { durationMs: 4000, flags: [] });
});

test('AC-47: Device clock skew just over 60 seconds flags', () => {
  const result = gradedTiming({
    hubStart: 1000,
    hubEnd: 5000,
    monotonicMs: 4000,
    deviceStart: 1000,
    deviceEnd: 65001, // just over 60 seconds
  });
  assert.deepEqual(result, { durationMs: 4000, flags: ['clock-skew'] });
});

test('AC-47: Offline attempt with clock skew has both flags', () => {
  const result = gradedTiming({
    hubStart: null,
    hubEnd: null,
    monotonicMs: 4000,
    deviceStart: 1000,
    deviceEnd: 605000, // 10 minutes later than expected
  });
  assert.deepEqual(result, { durationMs: 4000, flags: ['offline-attempt', 'clock-skew'] });
});

// AC-48: effectiveLimitMs tests
test('AC-48: 1.5× accommodation turns 60 min into 90 min', () => {
  const baseMs = 60 * 60 * 1000; // 60 minutes
  const result = effectiveLimitMs(baseMs, { timeMultiplier: 1.5 });
  assert.equal(result, 90 * 60 * 1000); // 90 minutes
});

test('AC-48: Values outside 1–3 are clamped', () => {
  const baseMs = 60 * 60 * 1000; // 60 minutes

  // Below 1 should clamp to 1
  const resultBelow = effectiveLimitMs(baseMs, { timeMultiplier: 0.5 });
  assert.equal(resultBelow, baseMs);

  // Above 3 should clamp to 3
  const resultAbove = effectiveLimitMs(baseMs, { timeMultiplier: 4 });
  assert.equal(resultAbove, baseMs * 3);
});

test('AC-48: Default multiplier is 1', () => {
  const baseMs = 60 * 60 * 1000;
  const result = effectiveLimitMs(baseMs, null);
  assert.equal(result, baseMs);
});

test('AC-48: No accommodation specified returns baseMs', () => {
  const baseMs = 60 * 60 * 1000;
  const result = effectiveLimitMs(baseMs, {});
  assert.equal(result, baseMs);
});

test('AC-48: Multiplier of 1 returns baseMs', () => {
  const baseMs = 60 * 60 * 1000;
  const result = effectiveLimitMs(baseMs, { timeMultiplier: 1 });
  assert.equal(result, baseMs);
});

test('AC-48: Multiplier of 3 returns 3× baseMs', () => {
  const baseMs = 60 * 60 * 1000;
  const result = effectiveLimitMs(baseMs, { timeMultiplier: 3 });
  assert.equal(result, baseMs * 3);
});

test('AC-48: Multiplier of 2 returns 2× baseMs', () => {
  const baseMs = 60 * 60 * 1000;
  const result = effectiveLimitMs(baseMs, { timeMultiplier: 2 });
  assert.equal(result, baseMs * 2);
});

test('AC-48: Exact boundaries 1 and 3 not clamped', () => {
  const baseMs = 100;
  assert.equal(effectiveLimitMs(baseMs, { timeMultiplier: 1 }), 100);
  assert.equal(effectiveLimitMs(baseMs, { timeMultiplier: 3 }), 300);
});

test('AC-48: Very small multiplier clamped to 1', () => {
  const baseMs = 100;
  assert.equal(effectiveLimitMs(baseMs, { timeMultiplier: 0.001 }), 100);
});

test('AC-48: Very large multiplier clamped to 3', () => {
  const baseMs = 100;
  assert.equal(effectiveLimitMs(baseMs, { timeMultiplier: 100 }), 300);
});

test('AC-48: Negative multiplier clamped to 1', () => {
  const baseMs = 100;
  assert.equal(effectiveLimitMs(baseMs, { timeMultiplier: -1 }), 100);
});
