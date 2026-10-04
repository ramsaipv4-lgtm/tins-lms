import { test } from 'node:test';
import assert from 'node:assert/strict';
import { masteryMap } from '../src/mastery.ts';

test('AC-10: two checks of 0.8 and 0.9, 25 h apart → mastered', () => {
  const now = 1000;
  const result = masteryMap([
    { skill: 'skill1', score: 0.8, at: now },
    { skill: 'skill1', score: 0.9, at: now + 25 * 60 * 60 * 1000 },
  ]);

  assert.equal(result['skill1'], 'mastered');
});

test('AC-10: same scores 2 h apart → not-yet', () => {
  const now = 1000;
  const result = masteryMap([
    { skill: 'skill1', score: 0.8, at: now },
    { skill: 'skill1', score: 0.9, at: now + 2 * 60 * 60 * 1000 },
  ]);

  assert.equal(result['skill1'], 'not-yet');
});

test('AC-10: a later 0.5 after mastery → not-yet', () => {
  const now = 1000;
  const result = masteryMap([
    { skill: 'skill1', score: 0.8, at: now },
    { skill: 'skill1', score: 0.9, at: now + 25 * 60 * 60 * 1000 },
    { skill: 'skill1', score: 0.5, at: now + 50 * 60 * 60 * 1000 },
  ]);

  assert.equal(result['skill1'], 'not-yet');
});

test('AC-10: a skill with one check → not-yet', () => {
  const now = 1000;
  const result = masteryMap([
    { skill: 'skill1', score: 0.9, at: now },
  ]);

  assert.equal(result['skill1'], 'not-yet');
});

test('masteryMap: multiple skills', () => {
  const now = 1000;
  const result = masteryMap([
    // skill1: mastered
    { skill: 'skill1', score: 0.8, at: now },
    { skill: 'skill1', score: 0.9, at: now + 25 * 60 * 60 * 1000 },
    // skill2: not-yet (only one check)
    { skill: 'skill2', score: 0.95, at: now },
    // skill3: not-yet (two checks but too close)
    { skill: 'skill3', score: 0.8, at: now },
    { skill: 'skill3', score: 0.9, at: now + 2 * 60 * 60 * 1000 },
  ]);

  assert.equal(result['skill1'], 'mastered');
  assert.equal(result['skill2'], 'not-yet');
  assert.equal(result['skill3'], 'not-yet');
});

test('masteryMap: skill with no checks is absent', () => {
  const now = 1000;
  const result = masteryMap([
    { skill: 'skill1', score: 0.8, at: now },
  ]);

  assert.ok(!('skill2' in result));
});

test('masteryMap: boundary case exactly 24 h apart', () => {
  const now = 1000;
  const result = masteryMap([
    { skill: 'skill1', score: 0.8, at: now },
    { skill: 'skill1', score: 0.9, at: now + 24 * 60 * 60 * 1000 },
  ]);

  assert.equal(result['skill1'], 'mastered');
});

test('masteryMap: boundary case just under 24 h apart', () => {
  const now = 1000;
  const result = masteryMap([
    { skill: 'skill1', score: 0.8, at: now },
    { skill: 'skill1', score: 0.9, at: now + 24 * 60 * 60 * 1000 - 1 },
  ]);

  assert.equal(result['skill1'], 'not-yet');
});

test('masteryMap: boundary case exactly 0.8 score', () => {
  const now = 1000;
  const result = masteryMap([
    { skill: 'skill1', score: 0.8, at: now },
    { skill: 'skill1', score: 0.8, at: now + 25 * 60 * 60 * 1000 },
  ]);

  assert.equal(result['skill1'], 'mastered');
});

test('masteryMap: boundary case just under 0.8 score', () => {
  const now = 1000;
  const result = masteryMap([
    { skill: 'skill1', score: 0.79, at: now },
    { skill: 'skill1', score: 0.9, at: now + 25 * 60 * 60 * 1000 },
  ]);

  assert.equal(result['skill1'], 'not-yet');
});
