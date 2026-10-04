# Recall — Append-only hash-chained ledger

## Exercise 1 — Detect tampering (10 min)

Build a three-entry ledger, edit `value` on entry 1 in a copy, and predict what `verifyLedger` returns before running it.

## Cards

**Q:** What does each ledger entry's hash cover?
**A:** The canonical JSON of the entry without its `hash`, which includes `prevHash`.

**Q:** What is the `prevHash` of entry 0?
**A:** 64 zeros.

**Q:** How do you fix a wrong value in an append-only ledger?
**A:** Append a new entry with `corrects` set to the old seq; the old entry stays.

**Q:** What does `currentValue` return?
**A:** The value of the latest entry for the subject.

**Q:** Why can a hash chain alone not stop a determined writer?
**A:** They can recompute every hash; the latest hash needs to be anchored somewhere they cannot edit.
