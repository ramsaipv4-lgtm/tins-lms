# Recall — Manifests, tar archives, signed class packages

## Exercise 1 — Verify a manifest (5 min)
**What to do:** Given a manifest for files `a`, `b`, `c` and a folder holding `a` (edited), `c`, `d`, write down the result of `verifyManifest`.
**The answer (check after):** `{ missing: ['b'], extra: ['d'], changed: ['a'] }`.

## Cards
**Q:** What does the ustar checksum cover?
**A:** The sum of all 512 header bytes, with the 8-byte checksum field counted as spaces.

**Q:** How does a ustar archive end?
**A:** Two 512-byte blocks of zeros.

**Q:** What are the three failure reasons of `openPackage`?
**A:** `bad-signature`, `untrusted` and `corrupt`.

**Q:** Why test our tar writer against the system `tar -tf`?
**A:** Our reader and writer could share the same mistake; an independent reader catches it.
