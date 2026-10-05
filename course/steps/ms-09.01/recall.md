# Recall — Performance budgets and the 200-learner load test CLI

## Exercise 1 — Predict the summary (5 min)
**What to do:** A hub answers every sync write with 201 but stores none. Predict `lostWrites` and `pass` for 10 learners.
**The answer (check after):** `lostWrites` is 10 and `pass` is false; the packages/cli unit test "a hub that drops writes" checks it.

## Cards
**Q:** Why does the load test accept loopback targets only?
**A:** It signs in through `/__test/login`, which exists only on a local test-mode hub.

**Q:** How is a failed request counted in the percentage?
**A:** As `Infinity`, so it is in the sample and counts as slower than the limit.

**Q:** How does the CLI decide that no write was lost?
**A:** It lists attendance, attempt and exitTicket documents in the class database afterwards and compares each count with the learner count.

**Q:** What is the quiz window?
**A:** Time from the first answer sent to the last response received; it must be 10 s or less.
