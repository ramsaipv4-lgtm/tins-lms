# Recall — Sync rules and the merge pass

## Exercise 1 — Predict the refusal (5 min)
**What to do:** A client sends `x-lms-schema` three below the hub. Say status class and the word in the body.
**The answer (check after):** A 4xx (426) with `update-app`.

## Cards
**Q:** Which header announces a client's schema?
**A:** `x-lms-schema`.

**Q:** How does the hub remove a conflict?
**A:** It writes a core-merged revision on the winner and deletes the other revisions.

**Q:** What replaces plaintext in a coachEntry?
**A:** `enc: { iv, ct }`.
