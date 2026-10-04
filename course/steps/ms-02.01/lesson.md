---
id: ms-02.01
title: Seeded randomness
module: 2
est_minutes: 40
prereqs: [ms-01.01]
objectives: 3
new_terms: 5
skills: [seeded-rng, deterministic-shuffling]
source_refs: [{ path: packages/core/src/rng.ts, commit: ac0b476 }]
next: end
---

# MS 2.1 — Seeded randomness

*Step 2 of N*

## Prerequisites

You already understand:
- How randomness is different from hashing (one produces different output each time, the other doesn't)
- What a seed is and why it makes randomness reproducible
- How arrays work and what a permutation is
- Bit operations (`^`, `<<`, `>>`) and 32-bit integers

## You already understand this

- Why grading must be fair: two learners answering the same question should get comparable difficulty
- How reusing code reduces bugs: don't write shuffle twice
- Why tests matter: "the RNG works" means "it produces the same sequence from the same seed"

## The detective question

**Problem:** Coach LMS needs reproducible randomness for auditable grading. Every time a learner starts a graded exercise, the system must offer the same variant (same question choices, same order) based on their class and the item id. This requires a seeded random number generator that:
- Produces identical sequences from the same seed
- Never reaches the network, file system or clock
- Works in the browser and on the server
- Supports shuffling without mutating the original array

**Options considered:**
1. Use JavaScript's `Math.random()` (not reproducible; no seed support)
2. Use a cryptographic library like tweetnacl (adds a dependency; overkill for this use case)
3. Implement a lightweight PRNG algorithm (xorshift32) seeded from a stable string hash

**Choice:** Option 3 — implement xorshift32 PRNG with `createRng`, pair it with `seedFor` to derive stable per-class seeds, and use Fisher-Yates shuffle.

**Why:**
- **Determinism:** The same seed always produces the same sequence. This satisfies auditability.
- **No dependencies:** xorshift32 is simple enough to implement in <20 lines. Keeps core lightweight.
- **Synchronous:** No async overhead. RNG values are generated on demand, no waiting.
- **Proven algorithm:** xorshift32 has been used in production since the 1990s. It's not cryptographically secure, but that's fine; we're not using it for security, just fairness.
- **Stable seeding:** `seedFor` combines class salt and item id, then hashes deterministically. Same class + item always produces the same seed.

## Learning objectives

After this step, you will:
1. Understand how a simple PRNG algorithm (xorshift32) maintains state and produces a sequence
2. Implement `seedFor` to derive stable, class-specific seeds for graded items
3. Use the RNG to shuffle arrays without mutation or bias

## Conceptual understanding

### Seeded PRNGs: why they matter

A **pseudo-random number generator** (PRNG) uses a mathematical formula to produce a sequence of numbers that *look* random but are fully deterministic. Given the same **seed** (starting value), the sequence is always identical.

Coach LMS uses seeded PRNGs to ensure fairness in grading:

```pseudocode
When learner A starts a graded item in class 1:
  seedFor('class-1', 'item-123') → seed → rng → sequence

When learner B, also in class 1, starts the same item:
  seedFor('class-1', 'item-123') → seed → rng → sequence (identical)
```

Both learners see the same question variants, in the same order, because their PRNGs start with the same seed.

This is **auditable**: an observer can replay the exact sequence, question-by-question, because the seed is deterministic and reproducible.

### The xorshift32 algorithm

xorshift32 is a simple, fast PRNG. It maintains a 32-bit **state** and updates it on each call:

```pseudocode
x = x XOR (x << 13)   // bit-shift left by 13, XOR with original
x = x XOR (x >> 17)   // bit-shift right by 17, XOR with current value
x = x XOR (x << 5)    // bit-shift left by 5, XOR with current value
state = x
return x / 2^32       // convert to [0, 1)
```

The three bit-shift XOR operations mix the bits thoroughly, ensuring that small changes in the seed produce completely different sequences. The state must never be zero (a constraint the code enforces).

### Stable seeding with `seedFor`

To ensure the same learner gets the same variant every time, the seed must be stable across calls. `seedFor` combines two inputs:

```ts
seedFor(classSalt: string, itemId: string): string
```

Example: `seedFor('class-42', 'question-5')` hashes the combination `'class-42:question-5'` into a deterministic string seed. The colon separator prevents collisions (e.g., `class-4` + `2:question` could look like `class-42` + `:question` without the separator).

### Fisher-Yates shuffle

The Fisher-Yates algorithm shuffles an array without bias:

```pseudocode
for i from n-1 down to 1:
  j = random(0, i)        // pick a random index from 0 to i (inclusive)
  swap array[i] and array[j]
```

Why it matters:
- **No mutation:** We swap in a *copy*, never modify the input
- **Uniform:** Every permutation has equal probability
- **Efficient:** O(n) time, one pass through the array

## Walkthrough of the real code

### createRng: Initialize state from seed

```ts packages/core/src/rng.ts
export function createRng(seed: string): () => number {
  // Initialize the state from the seed using HMAC-SHA-256
  // We use a synchronous PRNG algorithm (xorshift32) with state derived from the seed

  // Convert seed string to a number for xorshift initialization
  let state: number = hashStringToNumber(seed);

  // Ensure state is not zero (xorshift32 requires non-zero state)
  if (state === 0) {
    state = 1;
  }

  return function(): number {
    // xorshift32 algorithm: simple, deterministic, and fast
    let x = state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    state = x;

    // Convert to [0, 1)
    // Use unsigned right shift to ensure positive value
    return ((x >>> 0) % 1000000000) / 1000000000;
  };
}
```

**Key details:**
- `hashStringToNumber(seed)` converts the seed string to a 32-bit integer using a simple character-code accumulation.
- If the hash is zero, we set state to 1 (xorshift32's constraint).
- The returned function closes over `state`, maintaining it across calls.
- `(x >>> 0)` ensures an unsigned 32-bit value (JavaScript's default `|` operator can be tricky).
- Dividing by 1 billion (not 2^32) avoids floating-point edge cases and ensures values in [0, 1).

### seedFor: Deterministic combination

```ts packages/core/src/rng.ts
/**
 * Generates a stable seed for a graded item within a class.
 * Same class + item always produces the same seed.
 * Different classes or items produce different seeds.
 */
export function seedFor(classSalt: string, itemId: string): string {
  // Combine class salt and item id to create a unique seed
  // Use a simple concatenation with separator to avoid collisions
  const combined = `${classSalt}:${itemId}`;
  return hashStringToString(combined);
}
```

**Why the colon?** It's a separator. Without it:
- `seedFor('class-1', '23')` and `seedFor('class-12', '3')` would both hash the same string `'class-123'`.
- With the colon, they hash different strings: `'class-1:23'` and `'class-12:3'`.

### shuffle: Fisher-Yates in action

```ts packages/core/src/rng.ts
/**
 * Fisher-Yates shuffle using the provided RNG.
 * Returns a new shuffled array without mutating the input.
 */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = Array.from(items);
  const n = result.length;

  // Fisher-Yates shuffle from the end
  for (let i = n - 1; i > 0; i--) {
    // Pick a random index from 0 to i (inclusive)
    const j = Math.floor(rng() * (i + 1));

    // Swap result[i] and result[j]
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
}
```

**Key details:**
- `Array.from(items)` creates a copy, so the input is never mutated.
- The loop goes from `n-1` down to 1 (the last swap is at i=1, j in [0,1]).
- `Math.floor(rng() * (i + 1))` picks a random index from 0 to i, inclusive.
- We swap in place, which is O(n) and unbiased.

## Your turn: faulty first

Real mistakes from the build (from build journal M1–M2):

### Mistake 1: Missing language tags on code blocks (M1, E3–E5)

**Buggy example:**
In the Conceptual understanding section, showing code without language tag fails the gate:

    ```
    x = x XOR (x << 13)
    x = x XOR (x >> 17)
    ```

**What went wrong:**
- Code blocks without language tags (missing `ts`, `pseudocode`, etc.) fail the skill-template gate check 6.
- Gate output: `FAIL check 6: steps/ms-02.01/lesson.md: code block without a language tag`.

**How you spot it:**
Run `kit gate` after creating course step files. The gate scanner checks every code block has a language identifier.

**Fix:**
Add language tag: ` ```pseudocode ` or ` ```ts ` before code blocks.

**Proof:**
After adding tags to all ~10 code blocks, final gate PASS.

### Mistake 2: Walkthrough excerpts don't match source file (M2, E4–E8)

**Buggy example:**
In Walkthrough section, showing excerpt with incomplete comments:

    ```ts
    export function createRng(seed: string): () => number {
      let state = hashStringToNumber(seed);  // Omitted comments!
      ...
    }
    ```

**What went wrong:**
- Excerpts tagged with file path are checked against the actual commit.
- Omitting comments or changing formatting causes mismatch.
- Gate output: `FAIL check 13: ms-02.01: excerpt from packages/core/src/rng.ts does not match ac0b476`.

**How you spot it:**
Gate checker validates line-for-line against the commit. Comments matter.

**Fix:**
Include all comments and match formatting exactly from the source file (e.g., empty lines between sections).

**Proof:**
After including full comments from `git show ac0b476:packages/core/src/rng.ts`, final gate PASS.

## Technical glossary

- **Seed:** A starting value for a PRNG. Same seed → same sequence. Different seed → different sequence (with high probability).
- **Deterministic:** Producing the same output given the same input, every time. No randomness, no exceptions.
- **xorshift32:** A simple PRNG algorithm using bit shifts and XOR. Fast, but not cryptographically secure.
- **Permutation:** A rearrangement of items. A shuffle produces a random permutation of the input.
- **State:** The internal value a PRNG maintains and updates on each call. For xorshift32, it's a 32-bit integer.
- **Mutation:** Changing an object in place. `shuffle` must NOT mutate the input array.

## Common questions

**Q: Why not use a cryptographic PRNG like HMAC?**
A: Cryptographic PRNGs are slower and overkill. We're not securing anything; we're just ensuring fairness. xorshift32 is 100x faster and sufficient.

**Q: Can two different seeds produce the same sequence?**
A: In theory, yes (the state space is finite). In practice, with a 32-bit state space and billions of possible seeds, collisions are negligible. If you need a larger state space, use xorshift64 or a Mersenne Twister.

**Q: Why initialize state to 1 if the hash is 0?**
A: xorshift32 has a single fixed point: state 0 stays 0 forever. All XOR operations on zero yield zero. We guarantee non-zero by fiat.

**Q: Does the RNG need to be cryptographically secure for grading?**
A: No. Grading is audited (we can replay the seed and verify the variant), not secret. We care about reproducibility and fairness, not security. A secret seed is not part of the design.

## Reinforcement activity

Write a function that uses `createRng` and `shuffle` to randomly assign learners to teams:

```ts
export function assignTeams(
  learnerIds: string[],
  classSalt: string,
  teamSize: number
): string[][] {
  // Use seedFor('team-assignment', classSalt) to create a stable seed
  // Shuffle the learners
  // Split into teams of teamSize (last team may be smaller)
  // Return the teams
}
```

Test it:
1. Same class salt → same team assignments
2. Different class salt → different assignments
3. Learner A is always in the same team (determinism)

## Check yourself

1. **In xorshift32, what happens if the state is 0?**
   <details>
   The algorithm produces 0 forever; all outputs are 0. This is why we initialize `state = 1` if the hash produces 0.
   </details>

2. **Why does `seedFor` need a separator between class and item?**
   <details>
   Without it, `'class-1' + '23'` and `'class-12' + '3'` hash to the same string, causing collisions. The separator ensures unique hashes.
   </details>

3. **If you shuffle the same array twice with different RNG seeds, do you get different results?**
   <details>
   Yes. Different seeds produce different RNG sequences, leading to different swaps in Fisher-Yates, and thus different permutations.
   </details>

4. **In Fisher-Yates, why do we pick `j` from 0 to `i` (not 0 to `n`)?**
   <details>
   We start from the end and work backward. After element at position `i` is swapped, we never touch it again. This ensures every element is equally likely to end up in any position.
   </details>

5. **If a learner's seed is stable, how do they get fair variant selection?**
   <details>
   The seed combines class salt (same for all learners in a class) and item id (same item). So all learners in class 1 see question 5's variants in the same order. They don't see the *same* variant (each learner's question number is different), but they face the same difficulty/fairness.
   </details>

## Quick reference

```ts
// Create an RNG for a specific class and item
const seed = seedFor('class-42', 'question-5');
const rng = createRng(seed);

// Generate random numbers
const r1 = rng();  // 0.123...
const r2 = rng();  // 0.456...

// Shuffle an array
const items = ['a', 'b', 'c', 'd'];
const shuffled = shuffle(items, rng);  // items unchanged (returns new array)
```

## Connection to the bigger picture

Seeded randomness is foundational to many parts of Coach LMS:

- **Graded items:** Question variants, multiple-choice orderings, and problem parameters are all determined by the seed.
- **Study groups:** Learners are assigned to teams based on mastery and a seeded shuffle (see §4.14).
- **Shift simulation:** The shift engine (§4.10) chooses ticket variants using seeded randomness, ensuring replayability.
- **Fairness audits:** Any grading decision can be audited by replaying the seed and verifying the variant generated.

Without seeded randomness, these systems would be non-deterministic, making audits impossible.

## Next

Next steps build on this foundation:
- **MS 2.2:** Spaced repetition (cards, due dates)
- **MS 2.3:** Catch-up gate (using mastery and seeded assignment)
- **MS 2.4:** Graded timing and accommodations

Your seeded RNG is used in all three.
