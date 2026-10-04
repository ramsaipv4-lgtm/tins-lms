# Activity key — Seeded randomness

**Trainer-only. Answers to lesson activities and check-yourself questions.**

---

## Exercise 1 — Implement createRng with xorshift32

### Expected implementation

```ts
export function createRng(seed: string): () => number {
  let state = hashStringToNumber(seed);
  if (state === 0) {
    state = 1;
  }
  return function(): number {
    let x = state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    state = x;
    return ((x >>> 0) % 1000000000) / 1000000000;
  };
}

function hashStringToNumber(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
```

### Test 1: Determinism

```ts
const rng1 = createRng('test-seed');
const rng2 = createRng('test-seed');

const values1 = [];
const values2 = [];

for (let i = 0; i < 100; i++) {
  values1.push(rng1());
  values2.push(rng2());
}

assert.deepEqual(values1, values2);
```

**Learner success indicators:**
- The two RNG instances produce identical sequences
- Values stay consistent across multiple calls
- The sequences are long and varied (not all the same number)

### Test 2: Range check

```ts
const rng = createRng('boundary-test');

for (let i = 0; i < 1000; i++) {
  const value = rng();
  assert(value >= 0, `Value ${value} is below 0`);
  assert(value < 1, `Value ${value} is >= 1`);
}
```

**Learner success indicators:**
- All generated values are non-negative
- All values are strictly less than 1
- No values are exactly 0 (very rare, but check the implementation)
- No values are exactly 1

### Common mistakes:
1. **Returning a negative number:** Using `x` directly instead of `(x >>> 0)` preserves the sign. JavaScript's 32-bit integers are signed.
   - Fix: Use `(x >>> 0)` to convert to unsigned, or use modulo as in the reference.
2. **Using `x / (2 ** 32)` without handling negatives:** Results in negative outputs.
   - Fix: Use `((x >>> 0) % 1000000000) / 1000000000` to ensure non-negative and avoid precision issues.
3. **Initializing state every time the RNG is called:** The state must persist across calls.
   - Fix: Initialize state once in `createRng`, then close over it in the returned function.
4. **Not handling the zero-state case:** If the hash is 0, xorshift32 produces 0 forever.
   - Fix: Check `if (state === 0) state = 1;` after hashing.

---

## Exercise 2 — Implement seedFor and verify stability

### Expected implementation

```ts
export function seedFor(classSalt: string, itemId: string): string {
  const combined = `${classSalt}:${itemId}`;
  return hashStringToString(combined);
}

function hashStringToString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
```

### Test 1: Stability

```ts
const seed1 = seedFor('class-42', 'item-5');
const seed2 = seedFor('class-42', 'item-5');
const seed3 = seedFor('class-42', 'item-5');

assert.equal(seed1, seed2);
assert.equal(seed2, seed3);
```

**Learner success indicators:**
- Same inputs produce identical output
- No variation across calls
- The output is a deterministic string (typically 8 hex characters)

### Test 2: Different classes produce different seeds

```ts
const seedA = seedFor('class-1', 'item-5');
const seedB = seedFor('class-2', 'item-5');

assert.notEqual(seedA, seedB);
```

**Learner success indicators:**
- Changing the class produces a different seed
- The difference is fundamental (different hash), not random variation

### Test 3: No collision with simple concatenation

```ts
// Test that adding a separator prevents collisions
const seed1 = seedFor('class-1', '23');
const seed2 = seedFor('class-12', '3');

assert.notEqual(seed1, seed2);
```

**Learner success indicators:**
- The separator prevents the collision mentioned in the lesson
- Implementation uses `classSalt:itemId` or similar, not just concatenation

### Common mistakes:
1. **Omitting the separator:** `'class-1' + '23'` collides with `'class-12' + '3'`.
   - Fix: Use a separator like `:` to split the two inputs clearly.
2. **Not returning a string:** Returning a number instead of a hex string.
   - Fix: Convert the hash to a hex string: `Math.abs(hash).toString(16)`.
3. **Returning a variable-length string:** Sometimes '1' (1 char), sometimes '1a2b3c4d' (8 chars).
   - Fix: Pad to a fixed length with `.padStart(8, '0')`.

---

## Exercise 3 — Implement Fisher-Yates shuffle

### Expected implementation

```ts
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = Array.from(items);
  const n = result.length;
  
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }
  
  return result;
}
```

### Test 1: Non-mutation

```ts
const items = [1, 2, 3, 4, 5];
const itemsCopy = [...items];
const shuffled = shuffle(items, rng);

assert.deepEqual(items, itemsCopy);  // original unchanged
assert.notEqual(items, shuffled);    // new array
```

**Learner success indicators:**
- The input array is not modified
- A new array is returned
- The returned array contains the same elements as the input

### Test 2: Permutation

```ts
const items = ['a', 'b', 'c', 'd'];
const shuffled = shuffle(items, rng);

// Check same length
assert.equal(shuffled.length, items.length);

// Check all elements present (no duplicates, no missing)
const itemsSorted = items.sort();
const shuffledSorted = shuffled.sort();
assert.deepEqual(itemsSorted, shuffledSorted);
```

**Learner success indicators:**
- The shuffled array has the same length as the input
- All input elements are present in the output
- No elements are duplicated
- No elements are missing

### Test 3: Determinism with same RNG

```ts
const seed = 'shuffle-test';
const items = [1, 2, 3, 4, 5];

const rng1 = createRng(seed);
const rng2 = createRng(seed);

const shuffled1 = shuffle(items, rng1);
const shuffled2 = shuffle(items, rng2);

assert.deepEqual(shuffled1, shuffled2);
```

**Learner success indicators:**
- Identical RNG seeds produce identical shuffles
- This proves the shuffle is deterministic and depends only on the RNG
- Learner understands the link between RNG seed and shuffle outcome

### Common mistakes:
1. **Mutating the input:** Directly shuffling the input array instead of a copy.
   - Fix: Start with `const result = Array.from(items);`.
2. **Returning the input instead of the copy:** `return items;` instead of `return result;`.
   - Fix: Always return the copy.
3. **Picking `j` from 0 to `n`, not 0 to `i`:** `Math.floor(rng() * n)` instead of `Math.floor(rng() * (i + 1))`.
   - Fix: Pick `j` from 0 to the current position `i`, not the whole array.
4. **Going from 0 to n-1 instead of n-1 to 1:** This produces biased results (the first element is never swapped in).
   - Fix: Loop from `i = n - 1` down to `i > 0`.

---

## Check yourself: Expected answers

### Q1: True or false — If I create two RNG instances with the same seed, they produce identical sequences forever.

**Answer: True**

**Explanation:** The seed determines the initial state. With the same seed and the same xorshift32 algorithm, the state evolves identically, so the outputs are identical.

**Learner success indicator:** Understands the deterministic nature of seeded RNGs.

### Q2: What is the colon in `seedFor('class-1', 'item-5')`'s concatenation?

**Answer: A separator to prevent collisions.**

**Explanation:** Without it, `seedFor('class-1', '23')` and `seedFor('class-12', '3')` would both hash `'class-123'`, creating identical seeds for different class-item pairs.

**Learner success indicator:** Recognizes the collision problem and understands why a separator helps.

### Q3: In Fisher-Yates shuffle, why do we iterate from `n-1` down to `1`, not from `0` to `n-1`?

**Answer: Once we've swapped an element at position `i`, we don't touch it again. This ensures every element has an equal probability of ending up in any position.**

**Explanation:** If we iterated forward and picked `j` from the whole array each time, the first element would never move (we'd pick `j >= 1` on the first iteration). By iterating backward, we ensure uniform probability.

**Learner success indicator:** Understands the Fisher-Yates algorithm's correctness.

### Q4: If the input array is `[1, 2, 3]` and we shuffle it, can we get `[1, 2, 3]` back?

**Answer: Yes, but only with low probability. Any permutation is possible.**

**Explanation:** Fisher-Yates gives every permutation equal probability, including the identity permutation. However, with 3 items, there are 6 permutations, so the identity has a 1/6 chance.

**Learner success indicator:** Recognizes that "shuffle" doesn't guarantee a *changed* order, just a random permutation.

### Q5: If two learners use different RNG seeds, can they get the same shuffle result?

**Answer: Possible but extremely unlikely.**

**Explanation:** Two different seeds produce different RNG sequences, which lead to different swaps in Fisher-Yates. The probability of ending up with the same permutation is 1/(n!), which is tiny for any reasonable array size.

**Learner success indicator:** Understands that RNG seed strongly determines shuffle outcome but leaves room for coincidence.

---

## Trainer notes

### Misconceptions to watch for:

1. **"Seeded randomness means the learner's seed is secret."** No. The seed is deterministic and often public (derived from class + item). We're not hiding anything, just ensuring reproducibility.

2. **"xorshift32 is as good as /dev/urandom."** No. xorshift32 is not cryptographically secure. But we're not doing cryptography here; we're ensuring fairness, which doesn't require security.

3. **"Shuffle might mutate the input."** No, not in the correct implementation. Always copy first. Mutation is a bug.

4. **"The zero-state rule is arbitrary."** It's not. Zero is a fixed point in xorshift32. The algorithm was designed assuming non-zero state. If you don't handle it, your RNG breaks.

5. **"seedFor should hash the inputs separately, then combine."** It could, but concatenation + separator is simpler and avoids ordering collisions.

### Pacing:

- Exercise 1 (createRng + xorshift32): 15 minutes. This is the hardest part. Learners may struggle with bit operations. Have a reference implementation ready.
- Exercise 2 (seedFor): 5 minutes. Once they understand hashing, this is straightforward.
- Exercise 3 (shuffle): 10 minutes. The algorithm is simple, but testing for non-mutation is important.

### Assessment:

- **Correctness:** All three exercises should pass the tests.
- **Reasoning:** Ask a learner to explain why separator matters, or why we copy before shuffle.
- **Edge cases:** Ask "What if the array is empty?" (n=0, the loop never runs, returns an empty array). "What if the seed is empty string?" (The hash still works; it just produces a specific number).

---

## Supplementary: Comparing shuffles

If you want to check that two shuffles with different RNG seeds produce different results, you can run:

```ts
const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const rng1 = createRng('seed-one');
const shuffled1 = shuffle(items, rng1);

const rng2 = createRng('seed-two');
const shuffled2 = shuffle(items, rng2);

console.log('Shuffled with seed-one:', shuffled1);
console.log('Shuffled with seed-two:', shuffled2);
console.log('Are they different?', !arraysEqual(shuffled1, shuffled2));
```

For a 10-element array, the probability of two random shuffles being identical is 1/(10!), or about 1 in 3.6 million. So in practice, different seeds always produce different shuffles.
