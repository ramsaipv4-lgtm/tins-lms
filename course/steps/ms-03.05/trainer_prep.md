# Trainer prep — Recovery words and crypto-shredding

## Before you start (prerequisites)
Learners have done ms-01.01 (AES-GCM helpers).

## 45-minute self-study path
Read the lesson, run packages/core/test/keys.test.mjs, do the reinforcement test.

## Worked example → faded example
Worked: bytes to words. Faded: learners write wordsToEntropy with the error cases.

## Top misconceptions
- Shredding deletes the ciphertext (it does not; it deletes the key).
- A word list can be any size (it must be 256 for one byte per word).

## Questions students will ask (with answers)
Why not hex? Words are easier to write down and check by eye.

## Your mastery check (private)
Can the learner explain why the list size must be 256 and why shred returns a new object?
