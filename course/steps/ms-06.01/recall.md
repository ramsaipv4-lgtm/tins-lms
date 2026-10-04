# Recall — Server foundation

## Exercise 1 — Predict the status (5 min)

**What to do:** A substitute calls `POST /api/classes/c1/join-codes`, which needs the trainer role. Then an admin calls it. What are the two statuses?

**The answer (check after):** 403 for the substitute (not listed), 200 for the admin (admin always passes).

## Cards

**Q:** What does the server print when it is ready?
**A:** `LISTENING <port>`

**Q:** Which routes work without a session?
**A:** Health, join, sign-in and pairing claim.

**Q:** What status do `/__test/*` routes return without `LMS_TEST_MODE=1`?
**A:** 404, because they are never registered.

**Q:** Where is the hub CA private key stored?
**A:** Only in `ca.json` in the data directory, never in a replicated database.
