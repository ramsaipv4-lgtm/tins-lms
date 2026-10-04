# Recall — Recovery words and crypto-shredding

## Exercise 1 — Round trip (5 min)
**What to do:** Convert the bytes 0..31 to words and back.
**The answer (check after):** wordsToEntropy(recoveryWords(bytes)) equals bytes.

## Cards
**Q:** Why does the word list have exactly 256 words?
**A:** One byte has 256 values, so each byte maps to exactly one word.

**Q:** What does shred remove?
**A:** Only that person's wrapped key, so their sealed data can no longer be opened.

**Q:** What does wrapPersonKey use underneath?
**A:** aesGcmSeal from util.ts, with the wrapping key.
