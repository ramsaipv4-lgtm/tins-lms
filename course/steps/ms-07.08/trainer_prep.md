# Trainer prep — Coach space

## Before you start (prerequisites)
Learners know AES-GCM and PBKDF2 from the core keys step.

## 45-minute self-study path
Read the lesson, run `node --test packages/web/test/coach.test.mjs`, do the faulty-first task.

## Worked example → faded example
Worked: `unlockWithPin`. Faded: write `lockCoach` yourself.

## Top misconceptions
- The PIN is the encryption key (it only unwraps the key).
- Hiding a nav link protects data (the encryption does).

## Questions students will ask (with answers)
**Is a 4-digit PIN strong?** It is a local lock; the stretching slows guessing, and five wrong tries stop the screen.

## Your mastery check (private)
Explain why changing the PIN does not re-encrypt entries.
