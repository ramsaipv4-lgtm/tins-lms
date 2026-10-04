# Activity key — Append-only hash-chained ledger

**Trainer-only.**

## Exercise 1 — Detect tampering

Expected: `{ ok: false, brokenAt: 1 }`. Entry 1's stored hash no longer matches its recomputed hash. Entry 2 is not reported because the first failure stops the walk.

Common mistake: predicting `brokenAt: 2` because entry 2's `prevHash` still points at the old hash. Verification reaches entry 1 first.

## Check yourself: expected answers

1. 64 zeros.
2. It returns a new array; the input is not modified.
3. `{ ok: false, brokenAt: 2 }`.
4. Append a correction entry with `corrects` set to the old seq.

## Trainer notes

Misconception: "a correction should replace the old row". It never does; both stay and the latest wins in `currentValue`.
