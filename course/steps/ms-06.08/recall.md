# Recall — Sign-out, passkeys and the sign-in gate

## Exercise 1 — Predict the status (5 min)

**What to do:** Sign in with a valid signature twice using the same challenge. What are the two statuses?

**The answer (check after):** 200 the first time, 400 (`challenge: unknown`) the second time, because the challenge was used up.

## Cards

**Q:** What does the server store for a passkey?
**A:** Only the public key (as a JWK), the credential id and a counter, in the private database.

**Q:** How long is a challenge valid?
**A:** Five minutes, and only once.

**Q:** Why convert the signature from DER?
**A:** Web Crypto verifies raw 64-byte r||s, authenticators send DER.

**Q:** What does Google sign-in answer when not configured?
**A:** 501 with `error.code` `not-configured`.
