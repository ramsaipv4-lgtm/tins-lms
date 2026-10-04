# Recall — Conflict merge

## Exercise 1 — Ticket merge (5 min)
**What to do:** Merge a `doing` ticket and a `done` ticket.
**The answer (check after):** status `done`, `conflictBadge` true.

## Cards
**Q:** Which three laws does mergeRevisions satisfy?
**A:** Order-independent, idempotent and associative.

**Q:** Which revision wins a profile document?
**A:** The largest `(updatedAt, updatedBy)`.

**Q:** Why does the result carry `hubFields`?
**A:** So a later merge still knows the class-owned value came from a hub revision and when.

**Q:** How are arrays of objects with `id` merged?
**A:** Unioned by `id`, sorted by `id`, keeping the latest revision's element.
