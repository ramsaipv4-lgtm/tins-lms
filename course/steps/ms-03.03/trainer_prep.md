# Trainer prep — Append-only hash-chained ledger

## Before you start (prerequisites)

Learners know SHA-256 and have seen `canonicalJson` (ms-01.01).

## 45-minute self-study path

1. Read the lesson (10 minutes).
2. Run `node --test packages/core/test/ledger.test.mjs` and read the three tests (10 minutes).
3. Edit each field of an entry in a scratch copy and watch `brokenAt` (15 minutes).
4. Read `.tins/kit/patterns/append-only-ledger` and `hash-chained-log` notes and compare (10 minutes).

## Worked example → faded example

Worked: append two entries, change `value` on entry 0, verify returns `brokenAt: 0`.
Faded: learner predicts `brokenAt` after changing `at` on entry 2 of 4.

## Top misconceptions

- Hashing proves who wrote an entry. It does not; it only shows the data changed.
- Deleting the last entry is detected. It is not, since the remaining chain is valid; anchor the latest hash.

## Likely student questions

**Q:** Why start `seq` at 0? **A:** The SPEC says 0, 1, 2 and the verifier checks seq equals index.

## Private mastery check

Explain why `verifyLedger` returns the first bad index and not all bad indexes.
