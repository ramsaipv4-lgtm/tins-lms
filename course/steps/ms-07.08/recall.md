# Recall — Coach space

## Exercise 1 — Trace an unlock (5 min)
**What to do:** Write the steps from typing a PIN to having the data key.
**The answer (check after):** Fetch `coachMeta:main`, stretch the PIN with the salt, unwrap the data key, keep it in memory.

## Cards
**Q:** Where does the Coach data key live after unlocking?
**A:** Only in memory; a reload asks for the PIN again.

**Q:** What does the hub store for a coach entry?
**A:** Only `enc` (iv and ciphertext), never plaintext fields.

**Q:** Why is OCR imported lazily?
**A:** To keep it out of the shell bundle budget.
