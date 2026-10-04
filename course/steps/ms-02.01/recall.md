# Recall — Seeded randomness

## Exercise 1 — Seed stability (5 min)

**What to do:**
Implement `seedFor(classSalt, itemId)` and test it. Run the same inputs three times in a row. What do you observe?

**The answer (check after):**

You should see:

```pseudocode
seedFor('class-1', 'item-5') // First call:  '0f4a8c2e'
seedFor('class-1', 'item-5') // Second call: '0f4a8c2e'
seedFor('class-1', 'item-5') // Third call:  '0f4a8c2e'
```

Every call returns the same string. This is **stability**: no randomness, just deterministic hashing. This is what we want: the same class and item always produce the same seed.

---

## Exercise 2 — Different seeds, different sequences (5 min)

**What to do:**
Create two RNGs with different seeds:
```ts
const rng1 = createRng('seed-A');
const rng2 = createRng('seed-B');
```

Generate 5 numbers from each. Do you get different sequences?

**The answer (check after):**

Yes. With high probability, you'll see:

```pseudocode
rng1: [0.234, 0.567, 0.891, 0.123, 0.456]
rng2: [0.123, 0.789, 0.345, 0.901, 0.678]
```

Different seeds produce different sequences. This is important for fairness: if all learners used the same seed, they'd all see the same question order, even across different classes.

---

## Exercise 3 — Shuffle non-mutation (5 min)

**What to do:**
Create an array `[1, 2, 3, 4, 5]`. Shuffle it using `createRng` and `shuffle`. Check the original array after. Has it changed?

**The answer (check after):**

The original array is **unchanged**. Shuffle returns a new array; it never mutates the input.

```ts
const items = [1, 2, 3, 4, 5];
const shuffled = shuffle(items, rng);
console.log(items);      // [1, 2, 3, 4, 5] unchanged
console.log(shuffled);   // e.g., [3, 1, 5, 2, 4] new array
console.log(items === shuffled);  // false (different objects)
```

This is a design rule: don't mutate the caller's data. Keep side effects minimal.

---

## Cards

**Q:** What is a seed?
**A:** A starting value for a random number generator. The same seed produces the same sequence of random numbers, every time.

**Q:** Why can we replay a seeded sequence?
**A:** Because the seed is the only input. Given seed `'X'`, we can run `createRng('X')` again anywhere (different machine, different time) and get the same numbers.

**Q:** Why does `seedFor` concatenate class and item instead of using them separately?
**A:** To avoid collisions. Without the separator, `'class-1' + '23'` and `'class-12' + '3'` both hash to `'class-123'`.

**Q:** What is xorshift32?
**A:** A simple, fast algorithm that produces a sequence of numbers from a starting state. It uses three bit-shift and XOR operations to scramble bits.

**Q:** What is Fisher-Yates shuffle?
**A:** An algorithm that rearranges items randomly without bias. It iterates from the end of the list backward, swapping each item with a random earlier item.

**Q:** Why can't we mutate the input array in shuffle?
**A:** The caller might reuse the array. If we mutate it, they see unexpected changes. Returning a new array is safer and clearer.

**Q:** If state is 0 in xorshift32, what happens?
**A:** All outputs are 0. Zero is a fixed point; XORing zero with zero always yields zero. We prevent this by setting `state = 1` if the seed hash is 0.

**Q:** Why do we convert the RNG output to [0, 1) instead of [0, 2^32)?
**A:** Because `Math.floor(rng() * (i + 1))` expects a number in [0, 1) to pick a random index from 0 to i. If rng() were in a different range, the math wouldn't work.

**Q:** Can two learners in the same class get different question orders?
**A:** No. If they're in the same class and taking the same question, they use the same seed, so the RNG produces the same sequence, and the shuffle is identical.

**Q:** Is xorshift32 cryptographically secure?
**A:** No. But we don't need it to be. Security is not the goal; fairness and auditability are. A secure RNG would be overkill and slower.
