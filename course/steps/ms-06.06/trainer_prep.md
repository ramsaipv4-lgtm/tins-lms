# Trainer prep — Export, import and signed class packages

## Before you start (prerequisites)

Learners should have finished ms-06.01 (ctx, guards, test mode). Have a seeded test server running (`LMS_TEST_MODE=1`).

## 45-minute self-study path

1. Read the Detective question (5 min)
2. Study the three code excerpts (15 min)
3. Do Faulty first (10 min)
4. Reinforcement activity (8 min)
5. Check yourself (7 min)

## Worked example → faded example

Worked: export from the seeded server and list it with `tar -tf`. Faded: learners tamper with one file and predict the import error unaided.

## Top misconceptions

- "A signature hides the content": it does not; it only proves who made it and that it is unchanged
- "The manifest is secret": it is only a list of hashes
- "Deleting `d` from a JWK makes it safe to share": yes, that is the public key, which is exactly why the hub only accepts keys without it

## Questions students will ask (with answers)

**Can the hub import its own private key?** No: private keys are in the private database, which the export does not read.

**Why CSV and JSON both?** CSV for spreadsheets, JSON for lossless import.

## Your mastery check (private)

Explain, without notes, what happens to a file signed by a dropped learner's device key and why.
