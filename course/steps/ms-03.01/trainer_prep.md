# Trainer prep — Rotating attendance code, pairing codes, certificate ids

## Before you start (prerequisites)
Learners should know async/await, HMAC at a high level, and object spread.

## 45-minute self-study path
1. Read the lesson (15 min).
2. Run `node --test packages/core/test/attendance.test.mjs packages/core/test/pairing.test.mjs packages/core/test/certificate.test.mjs` (10 min).
3. Change the period to 120 and watch the code change boundary (15 min).

## Worked example → faded example
Worked: `claimPairing` on a fresh code. Faded: write the `expired` branch yourself.

## Top misconceptions
- "The previous code is a security hole." It is a one-period grace window by design.
- "Immutable means slow." The state is a small record.

## Questions students will ask (with answers)
**Why 12 characters?** 60 bits is enough to make guessing impractical while staying easy to type.

## Your mastery check (private)
Explain why `"toString"` must be `unknown` in `claimPairing`.
