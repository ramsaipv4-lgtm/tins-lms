# Recall — Rotating attendance code, pairing codes, certificate ids

## Exercise 1 — Predict the result (5 min)
**What to do:** Issue code `A` at time 0 with the default TTL, claim it at 1000 for `d1`, then claim it again at 2000 for `d2`.
**The answer (check after):** `ok` then `used`.

## Cards
**Q:** How many digits is an attendance code and how is it built?
**A:** Six, from HMAC-SHA-256 over the 8-byte big-endian period counter with HOTP dynamic truncation, left-padded with zeros.

**Q:** Which periods does verification accept?
**A:** The current and the previous one only.

**Q:** What are the four pairing results?
**A:** `ok`, `expired`, `used`, `unknown`.

**Q:** How long is a certificate id and in what alphabet?
**A:** 12 characters of Crockford base32.
