import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, seedFor, shuffle } from '../src/rng.ts';

// AC-1: createRng with same seed returns same sequence
test('AC-1: createRng with same seed returns identical sequence (first 1000 values)', () => {
  const seed = 'test-seed-123';
  const rng1 = createRng(seed);
  const rng2 = createRng(seed);

  const values1 = [];
  const values2 = [];

  for (let i = 0; i < 1000; i++) {
    values1.push(rng1());
    values2.push(rng2());
  }

  assert.deepEqual(values1, values2);
});

test('AC-1: createRng with different seeds gives different sequences', () => {
  const rng1 = createRng('seed-1');
  const rng2 = createRng('seed-2');

  const values1 = [];
  const values2 = [];

  for (let i = 0; i < 100; i++) {
    values1.push(rng1());
    values2.push(rng2());
  }

  // Should not be identical (with extremely high probability)
  assert.notDeepEqual(values1, values2);
});

test('AC-1: createRng returns values in [0, 1)', () => {
  const rng = createRng('boundary-test');

  for (let i = 0; i < 1000; i++) {
    const value = rng();
    assert(value >= 0, `Value ${value} is less than 0`);
    assert(value < 1, `Value ${value} is >= 1`);
  }
});

// AC-2: seedFor generates stable, different seeds
test('AC-2: seedFor differs for two classes and same item', () => {
  const itemId = 'item-1';
  const seed1 = seedFor('class-a', itemId);
  const seed2 = seedFor('class-b', itemId);

  assert.notEqual(seed1, seed2);
});

test('AC-2: seedFor is stable across calls', () => {
  const classSalt = 'class-x';
  const itemId = 'item-y';

  const seed1 = seedFor(classSalt, itemId);
  const seed2 = seedFor(classSalt, itemId);
  const seed3 = seedFor(classSalt, itemId);

  assert.equal(seed1, seed2);
  assert.equal(seed2, seed3);
});

test('AC-2: seedFor creates different seeds for different items in same class', () => {
  const classSalt = 'class-1';
  const seed1 = seedFor(classSalt, 'item-a');
  const seed2 = seedFor(classSalt, 'item-b');

  assert.notEqual(seed1, seed2);
});

// AC-2: shuffle tests
test('AC-2: shuffle returns a permutation of the input', () => {
  const rng = createRng('shuffle-seed');
  const original = [1, 2, 3, 4, 5];
  const shuffled = shuffle(original, rng);

  // Should have same elements
  assert.equal(shuffled.length, original.length);
  const sortedOriginal = Array.from(original).sort((a, b) => a - b);
  const sortedShuffled = shuffled.sort((a, b) => a - b);
  assert.deepEqual(sortedOriginal, sortedShuffled);
});

test('AC-2: shuffle never mutates the input', () => {
  const rng = createRng('no-mutate-seed');
  const original = [1, 2, 3, 4, 5];
  const originalCopy = Array.from(original);

  shuffle(original, rng);

  assert.deepEqual(original, originalCopy);
});

test('AC-2: shuffle with identical rng seeds produces identical results', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const seed = 'shuffle-deterministic';

  const rng1 = createRng(seed);
  const rng2 = createRng(seed);

  const shuffled1 = shuffle(items, rng1);
  const shuffled2 = shuffle(items, rng2);

  assert.deepEqual(shuffled1, shuffled2);
});

test('shuffle produces different results with different RNG seeds', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  const rng1 = createRng('seed-one');
  const rng2 = createRng('seed-two');

  const shuffled1 = shuffle(items, rng1);
  const shuffled2 = shuffle(items, rng2);

  // With high probability, these should be different
  assert.notDeepEqual(shuffled1, shuffled2);
});

test('shuffle returns new array, not same reference', () => {
  const rng = createRng('new-array-seed');
  const original = [1, 2, 3];
  const shuffled = shuffle(original, rng);

  assert.notEqual(original, shuffled);
});

test('createRng works with empty string seed', () => {
  const rng = createRng('');
  const values = [];

  for (let i = 0; i < 10; i++) {
    const value = rng();
    assert(value >= 0 && value < 1);
    values.push(value);
  }

  // Should have variation
  assert(new Set(values).size > 1);
});

test('createRng works with very long seed', () => {
  const longSeed = 'x'.repeat(10000);
  const rng = createRng(longSeed);
  const value = rng();

  assert(value >= 0 && value < 1);
});
