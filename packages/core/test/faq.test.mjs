// AC-37
import test from 'node:test';
import assert from 'node:assert/strict';
import { tallyExitTickets, suggestFaq } from '../src/index.ts';

test('AC-37 tally counts and orders correctly', () => {
  const responses = [
    { choiceIds: ['a', 'b'] },
    { choiceIds: ['a', 'c'] },
    { choiceIds: ['b'] },
  ];

  const result = tallyExitTickets(responses);

  // Should have a: 2, b: 2, c: 1, ordered by count then id
  assert.deepEqual(result, [
    { choiceId: 'a', count: 2 },
    { choiceId: 'b', count: 2 },
    { choiceId: 'c', count: 1 },
  ]);
});

test('AC-37 similar questions form one FAQ group', () => {
  const questions = [
    { id: '1', text: 'how do I deploy a bicep file' },
    { id: '2', text: 'how do I deploy a bicep file?' },
    { id: '3', text: 'how do I deploy a bicep file in azure' },
    { id: '4', text: 'something else' },
    { id: '5', text: 'how do I deploy something' },
  ];

  const result = suggestFaq(questions, 3);

  // Questions 1, 2, 3 should form a group (3 similar questions with 3 min repeats)
  assert.equal(result.length, 1);
  assert.equal(result[0].ids.length, 3);
  assert.ok(result[0].ids.includes('1'));
  assert.ok(result[0].ids.includes('2'));
  assert.ok(result[0].ids.includes('3'));
});

test('AC-37 repeats below threshold do not group', () => {
  const questions = [
    { id: '1', text: 'how do I deploy' },
    { id: '2', text: 'how do I deploy' },
  ];

  const result = suggestFaq(questions, 3);

  // Only 2 similar questions, but threshold is 3
  assert.equal(result.length, 0);
});
