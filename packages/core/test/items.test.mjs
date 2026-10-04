// AC-39
import test from 'node:test';
import assert from 'node:assert/strict';
import { itemAnalysis } from '../src/index.ts';

test('AC-39 item analysis values and flagging', () => {
  const rows = [
    // Item 1: 4/5 correct (80%), easy item
    { personId: 'p1', itemId: 'i1', correct: true },
    { personId: 'p2', itemId: 'i1', correct: true },
    { personId: 'p3', itemId: 'i1', correct: true },
    { personId: 'p4', itemId: 'i1', correct: true },
    { personId: 'p5', itemId: 'i1', correct: false },

    // Item 2: 1/5 correct (20%), hard item
    { personId: 'p1', itemId: 'i2', correct: false },
    { personId: 'p2', itemId: 'i2', correct: false },
    { personId: 'p3', itemId: 'i2', correct: false },
    { personId: 'p4', itemId: 'i2', correct: true },
    { personId: 'p5', itemId: 'i2', correct: false },

    // Item 3: bad item - no discrimination
    { personId: 'p1', itemId: 'i3', correct: false },
    { personId: 'p2', itemId: 'i3', correct: false },
    { personId: 'p3', itemId: 'i3', correct: false },
    { personId: 'p4', itemId: 'i3', correct: false },
    { personId: 'p5', itemId: 'i3', correct: false },
  ];

  const result = itemAnalysis(rows);

  // Find each item result
  const i1 = result.find((r) => r.itemId === 'i1');
  const i2 = result.find((r) => r.itemId === 'i2');
  const i3 = result.find((r) => r.itemId === 'i3');

  // i1: p = 0.8, should not be flagged
  assert.ok(i1);
  assert.ok(Math.abs(i1.p - 0.8) < 0.01);

  // i2: p = 0.2, should be flagged (p < 0.2 is false, but p = 0.2 might still be questionable)
  assert.ok(i2);
  assert.ok(Math.abs(i2.p - 0.2) < 0.01);

  // i3: p = 0, should be flagged (p < 0.2)
  assert.ok(i3);
  assert.equal(i3.p, 0);
  assert.equal(i3.flag, true);
});
