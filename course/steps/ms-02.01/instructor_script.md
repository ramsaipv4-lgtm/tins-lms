# Instructor script — Seeded randomness

**Total runtime: 40 minutes**

---

## 0:00 — 0:05: Opening (5 min)

**Say:** "Today we're solving a fairness problem. Imagine you run a class with a graded quiz. Learner A takes it on Monday, gets questions in order [1, 3, 5]. Learner B takes it on Wednesday, gets [5, 1, 3]. Same questions, different order. Is that fair? One of them might have studied the order, not the content.

In Coach LMS, we want every learner in the same class to see the same question order, every time. But we also want the system to be auditable. If a learner appeals their grade, we need to replay their exact questions and verify the score. That's where seeded randomness comes in."

**Do:** Show a slide: Two sequences of coin flips, one from a coin, one from a seeded random number generator. Both *look* random, but one you can replay.

---

## 0:05 — 0:15: The xorshift32 algorithm (10 min)

**Say:** "A seeded random number generator remembers its starting point. It's deterministic: same start, same sequence. Here's how it works in Coach LMS."

**Do:** Walk through the xorshift32 algorithm on a whiteboard or slide:

```pseudocode
state = seed
step 1: x = state
step 2: x = x XOR (x << 13)   // mix bits left
step 3: x = x XOR (x >> 17)   // mix bits right
step 4: x = x XOR (x << 5)    // mix bits left again
step 5: state = x             // remember for next call
step 6: return x / 1_000_000_000  // convert to [0, 1)
```

**Say:** "The three XOR operations scramble the bits. If the seed changes even slightly, the sequence is completely different. Let me show you."

**Do:** Run a demo (or show pre-computed values):

```pseudocode
Seed 'class-1' produces: 0.234, 0.567, 0.891, ...
Seed 'class-2' produces: 0.123, 0.456, 0.789, ...
Same seed, rerun:       0.234, 0.567, 0.891, ... (identical)
```

**Say:** "Same seed = same sequence. Different seed = different sequence. That's the guarantee."

---

## 0:15 — 0:25: seedFor and fairness (10 min)

**Say:** "But we don't give each learner a different seed. We give them the seed that matches their class and the question they're answering."

**Do:** Show the seedFor function:

```ts
seedFor(classSalt: string, itemId: string): string
```

**Say:** "When learner A in class 42 starts question 5, the system computes:

```ts
seed = seedFor('class-42', 'question-5')
```

When learner B, also in class 42, starts question 5:

```ts
seed = seedFor('class-42', 'question-5')  // same result
```

Same seed, so the RNG produces the same sequence. Learner A and B see the same variant order, same difficulty. Fair.

Now, the colon between class and item is important. Without it:
- `seedFor('class-1', '23')` hashes `'class-123'`
- `seedFor('class-12', '3')` also hashes `'class-123'`
- Collision! Learner in class 1, question 23 gets the same variant as learner in class 12, question 3. Not fair.

With the colon:
- `seedFor('class-1', '23')` hashes `'class-1:23'`
- `seedFor('class-12', '3')` hashes `'class-12:3'`
- Different hashes, different variants. Fair."

**Do:** Ask the class: "What if we hashed the class and item separately, then combined the hashes? Would that work?" (Yes, but the simple concatenation + colon is simpler and collision-free for reasonable input sizes.)

---

## 0:25 — 0:35: Fisher-Yates shuffle (10 min)

**Say:** "Now we have an RNG. How do we shuffle an array? The algorithm is called Fisher-Yates, and it's beautiful because every permutation has equal probability."

**Do:** Walk through the algorithm with a concrete example. Use a deck of cards or colored blocks:

```pseudocode
Start: [A, B, C, D]
Step 1: Pick a random index from 0–3. Say we pick 2 (C).
        Swap D and C: [A, B, D, C]
Step 2: Pick a random index from 0–2. Say we pick 0 (A).
        Swap B and A: [B, A, D, C]
Step 3: Pick a random index from 0–1. Say we pick 1 (A).
        Swap A and A (no change): [B, A, D, C]
Done: [B, A, D, C]
```

**Say:** "Why start at the end and work backward? Because once we swap element `i`, we never touch it again. This ensures it has an equal chance of ending up anywhere. If we picked from the entire list every time, some positions would be biased."

**Do:** Show code:

```ts
for (let i = n - 1; i > 0; i--) {
  const j = Math.floor(rng() * (i + 1));  // 0 to i, inclusive
  const temp = result[i];
  result[i] = result[j];
  result[j] = temp;
}
```

**Say:** "Notice: we're shuffling a *copy* of the input, not the original. We never mutate the caller's array. That's important for correctness."

---

## 0:35 — 0:40: Wrap-up and questions (5 min)

**Say:** "So we have three pieces:
1. `createRng(seed)`: returns a function that generates a deterministic sequence.
2. `seedFor(classSalt, itemId)`: computes a stable seed for a class and item.
3. `shuffle(items, rng)`: randomly permutes items without mutation.

These three functions power fairness and auditability in Coach LMS. When a learner appeals a grade, we replay the seed, shuffle the questions, recompute the score, and verify."

**Do:** Open the floor for questions:
- "What if two learners in the same class get different variants?" (They shouldn't; same seed → same shuffle.)
- "Why not use Math.random()?" (Not seeded; can't replay.)
- "Is xorshift32 secure?" (No, but it doesn't need to be. We're not hiding anything, just ensuring fairness.)
- "What if the seed is zero?" (The code initializes state to 1 instead. Zero is a fixed point in xorshift32.)

**Say:** "Your turn now. You'll implement `createRng`, `seedFor`, and `shuffle` from scratch, then test them against the spec."

---
