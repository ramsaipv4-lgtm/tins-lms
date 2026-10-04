# Trainer prep — Seeded randomness

## Before you start (prerequisites)

You should understand:
- **Bit operations:** `^` (XOR), `<<` (left shift), `>>` (right shift)
- **Deterministic algorithms:** given the same input, always the same output
- **Hash functions:** converting arbitrary data to a fixed-size fingerprint
- **Array algorithms:** iteration, swapping, permutations
- **JavaScript closures:** functions that capture outer variables

If you're rusty on bit operations, review these 10 minutes before teaching:
- XOR: `0 ^ 0 = 0, 0 ^ 1 = 1, 1 ^ 1 = 0` (flips bits where operands differ)
- Left shift `<<`: `0101 << 2 = 10100` (multiply by power of 2)
- Right shift `>>`: `10100 >> 2 = 0101` (divide by power of 2, rounded down)
- Combine: `x ^= x << 13` means `x = x ^ (x << 13)`

---

## 45-minute self-study path

**15 min: Read the lesson**, focusing on:
- The "Conceptual understanding" section (why xorshift32 works)
- The "Walkthrough of the real code" (line-by-line explanation)

**10 min: Watch or sketch the xorshift32 algorithm** with a concrete example:
- Start with state = `0x12345678` (example)
- Apply `x ^= x << 13`: demonstrate the bits shifting and flipping
- Apply `x ^= x >> 17`: more flipping
- Apply `x ^= x << 5`: final scramble
- Show the result is very different from the starting value

**10 min: Study the three functions in isolation:**
- `createRng`: closes over state, returns a function
- `seedFor`: combines two strings deterministically
- `shuffle`: iterates from end to start, swaps with random index

**10 min: Run the reference implementation** locally:
- Create an RNG with a test seed
- Generate 20 numbers and verify they're in [0, 1)
- Shuffle [1..5] three times with the same seed and verify all three results are identical
- Shuffle [1..5] with two different seeds and verify the results differ

---

## Worked example → faded example

### Worked example: Implement createRng step-by-step

```ts
// Step 1: Define the hash function (we'll provide this)
function hashStringToNumber(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash = hash & hash; // 32-bit truncation
  }
  return Math.abs(hash);
}

// Step 2: Create the RNG function
export function createRng(seed: string): () => number {
  // Initialize state from the seed
  let state = hashStringToNumber(seed);
  
  // Handle the zero-state edge case
  if (state === 0) {
    state = 1;
  }
  
  // Return a function that updates state and returns a number
  return function(): number {
    // xorshift32 algorithm
    let x = state;
    x ^= x << 13;    // XOR with left-shifted version
    x ^= x >> 17;    // XOR with right-shifted version
    x ^= x << 5;     // XOR with left-shifted version again
    
    // Update state for the next call
    state = x;
    
    // Convert 32-bit integer to [0, 1)
    return ((x >>> 0) % 1000000000) / 1000000000;
  };
}
```

**Teaching notes:**
- Emphasize the closure: `state` is captured and persists across calls.
- Show the zero-check as a safety valve.
- Explain the XOR operations as "bit scrambling."
- Highlight the conversion to [0, 1): first unsigned (>>>), then modulo, then divide.

### Faded example: Implement seedFor with hints

```ts
export function seedFor(classSalt: string, itemId: string): string {
  // Combine the two inputs with a separator to avoid collisions
  const combined = `???: $??? ???`;
  
  // Hash the combined string into a deterministic hex string
  return hashStringToString(combined);
}

function hashStringToString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    // Accumulate the character codes
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  // Return as a padded hex string (8 characters)
  return Math.abs(hash).toString(16).padStart(8, '0');
}
```

**Hints for learners:**
- Fill in the `???` blanks: `${classSalt}:${itemId}`
- What format should the output be? (A hex string, 8 characters)
- Why the separator? (Prevents collisions between class-item pairs)

### Near-complete example: Implement shuffle

```ts
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  // Start with a copy, not the original
  const result = Array.from(items);
  const n = result.length;
  
  // Fisher-Yates: iterate from the end backward
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

**What's already there:**
- The function signature and the copy with `Array.from`
- The loop bounds

**What learners fill in:**
- The range for `j`
- The swap logic

---

## Top misconceptions

1. **"Seeded randomness means the seed is hidden."**
   - Reality: The seed is deterministic and often public. It's not a secret; it's a recipe for reproducibility.
   - Teaching approach: "The seed is like a recipe card. Anyone can follow it and get the same cake. That's the point."

2. **"xorshift32 is weak because I can predict the next number."**
   - Reality: xorshift32 is predictable *if you know the state*. But the learner doesn't; they only see the output. And even with some outputs, predicting the state is hard.
   - Teaching approach: "If I give you `0.234`, can you tell me the state? Probably not. The XOR operations scramble the bits thoroughly."

3. **"Shuffle must change the order."**
   - Reality: Any permutation is possible, including the original order. It's just unlikely.
   - Teaching approach: "Shuffle is like shuffling a deck of cards. Sometimes you shuffle and nothing changes. It's rare, but possible."

4. **"I should use a different seed for each call to seedFor."**
   - Reality: `seedFor` should be deterministic. Same class + item → same seed, always. The learner might misunderstand and add randomness.
   - Teaching approach: "`seedFor` is not random. It's like a lookup table. Same input, same output."

5. **"I can just concatenate class and item without a separator."**
   - Reality: This causes collisions. Show the example: `'class-1' + '23'` vs `'class-12' + '3'`.
   - Teaching approach: "Without a separator, we have a collision. With the colon, they're different. Always use a separator in concatenation-based keys."

---

## Questions students will ask (with answers)

**Q: Why can't we use Math.random() and just reload the page with the same random seed?**
A: Because JavaScript's Math.random() doesn't support seeding. The only way to get the same sequence is to implement your own RNG.

**Q: Is xorshift32 used in real production systems?**
A: Yes. It's used in CPUs, browsers (some implementations), and game engines. It's not cryptographically secure, but it's fast and good for simulations, games, and fairness.

**Q: What if the seed is really long (10,000 characters)?**
A: The hash function still works. It iterates character by character, so length doesn't matter much (still O(n)). The final hash is still a 32-bit integer.

**Q: What if the seed contains non-ASCII characters (emoji, Chinese)?**
A: `charCodeAt` returns the Unicode code point. It still works. The hash is deterministic on those code points.

**Q: Can I use a different PRNG algorithm (Mersenne Twister, PCG)?**
A: Yes. Mersenne Twister is more sophisticated (longer cycle, better distribution). But xorshift32 is fine for this use case. PCG is excellent for modern systems. Pick any PRNG; the interface stays the same.

**Q: Why is the state never zero?**
A: Because zero is a fixed point in xorshift32. The algorithm relies on non-zero bits to mix. If state is zero, all XOR operations produce zero, and the sequence is [0, 0, 0, ...].

**Q: Can I shuffle a shuffle (shuffle twice)?**
A: Yes. The result is still a permutation. Shuffling twice with different seeds is like shuffling once with a third seed (approximately).

**Q: How do I know my RNG is good?**
A: Run statistical tests (chi-squared, entropy tests). Or use an established PRNG like xorshift32 that's known to pass these tests. For this course, we trust xorshift32.

---

## Your mastery check (private)

Before teaching, verify you can:

1. **Explain xorshift32 in two sentences:** "A simple PRNG using three bit-shift-XOR operations to scramble 32 bits. Same seed → same sequence, different seed → different sequence."

2. **Trace through xorshift32 by hand:** Start with state `0x00000001`, apply the three XORs, show the new state is very different.

3. **Explain why seedFor needs a separator:** "Without it, `'class-1' + '23'` and `'class-12' + '3'` hash to the same value. With the colon, they're different."

4. **Implement Fisher-Yates from memory:** Without the lesson, write the loop, the random pick, and the swap. Test it mentally or on paper.

5. **Answer edge cases:**
   - What if the array is empty? (Loop never runs; return empty array.)
   - What if the array has one element? (Loop condition `i > 0` is false; return the copy.)
   - What if the seed is empty string? (Hash produces a specific number; the RNG works fine.)
   - What if rng() returns 0.0? (Fisher-Yates picks index 0; the swap is with itself.)
   - What if rng() returns 0.9999? (Picks index close to i; the swap happens normally.)

**If you can answer all five, you're ready to teach.**
