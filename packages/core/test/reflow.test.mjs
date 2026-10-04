// AC-41
import test from 'node:test';
import assert from 'node:assert/strict';
import { reflow } from '../src/index.ts';

test('AC-41 uncovered topics move to next day in order', () => {
  const plan = [
    { dayIndex: 0, topics: ['a', 'b', 'c'] },
    { dayIndex: 1, topics: ['d', 'e'] },
    { dayIndex: 2, topics: ['f'] },
  ];

  const covered = {
    0: ['a'],
    1: ['d'],
  };

  const result = reflow(plan, covered, 1);

  // Topics b and c (uncovered on day 0) and e (uncovered on day 1) should move to day 2
  assert.ok(result.moved.some((m) => m.topic === 'b' && m.from === 0 && m.to === 2));
  assert.ok(result.moved.some((m) => m.topic === 'c' && m.from === 0 && m.to === 2));
  assert.ok(result.moved.some((m) => m.topic === 'e' && m.from === 1 && m.to === 2));

  // Day 2 should have b, c, e before f
  const day2 = result.plan.find((d) => d.dayIndex === 2);
  assert.ok(day2);
  assert.deepEqual(day2.topics, ['b', 'c', 'e', 'f']);
});

test('AC-41 fully covered plan is unchanged', () => {
  const plan = [
    { dayIndex: 0, topics: ['a', 'b'] },
    { dayIndex: 1, topics: ['c'] },
  ];

  const covered = {
    0: ['a', 'b'],
    1: ['c'],
  };

  const result = reflow(plan, covered, 1);

  assert.deepEqual(result.plan, plan);
  assert.deepEqual(result.moved, []);
});

test('AC-41 topics are listed in moved with correct from/to', () => {
  const plan = [
    { dayIndex: 0, topics: ['x', 'y', 'z'] },
    { dayIndex: 1, topics: ['other'] },
  ];

  const covered = {
    0: ['y'],
  };

  const result = reflow(plan, covered, 0);

  // x and z should move from day 0 to day 1
  assert.ok(result.moved.some((m) => m.topic === 'x' && m.from === 0 && m.to === 1));
  assert.ok(result.moved.some((m) => m.topic === 'z' && m.from === 0 && m.to === 1));
  assert.equal(result.moved.length, 2);
});
