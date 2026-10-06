# Recall — Appeals, doubts, drop, accommodations, content improvement

## Exercise 1 — Name the storage (5 min)
**What to do:** For an accommodation request, an approved accommodation and an anonymous doubt say where each is stored.
**The answer (check after):** Request: private database. Approved: `person.accommodations` in the org database. Doubt: class database with `personId: null`.

## Cards
**Q:** What does an upheld appeal write to the ledger?
**A:** The original score first (if missing), then the correction pointing at it.

**Q:** What does undoing a drop not restore?
**A:** Tickets; they stay reassigned.

**Q:** How is the anonymous author hidden?
**A:** The server never stores it (`personId: null`).
