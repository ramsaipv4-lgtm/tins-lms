# Activity key — Rotating attendance code, pairing codes, certificate ids

**Trainer-only.**

## Reinforcement activity
Within one period the code is identical; in the next period it differs. With `periodSec` 120 the boundary moves to multiples of 120 seconds.

## Faulty first
1. The test generated the code with period 60 and verified with 120, so the counters differ. Both calls need the same period.
2. The edit applied to a line in another test where `p` is not defined.
3. `node --test` with a directory path treats it as a file; use a glob.

## Check yourself: expected answers
1. Two. 2. `unknown`. 3. A string keeps zeros. 4. HMAC of fixed inputs is deterministic.
