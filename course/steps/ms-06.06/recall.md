# Recall — Export, import and signed class packages

## Exercise 1 — Predict the status (5 min)

**What to do:** A learner who is not enrolled in class c1 registers a device key and posts a file signed with it to `/api/classes/c1/files`. Then an enrolled learner posts a file with one byte changed. What are the two statuses?

**The answer (check after):** 403 (`untrusted`: the key is not among the enrolled learners' keys) and 400 (`bad-signature` or `corrupt`).

## Cards

**Q:** Why does the manifest not list itself?
**A:** A file cannot contain its own hash.

**Q:** Where does the hub keep its private signing key?
**A:** Only in the private database, never exported or replicated.

**Q:** What does `verifyManifest` return?
**A:** `{ missing, extra, changed }`, three lists of paths.

**Q:** Which status does import give for a manifest mismatch?
**A:** 400, before any document is written.
