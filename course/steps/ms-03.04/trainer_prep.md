# Trainer prep — Manifests, tar archives, signed class packages

## Before you start (prerequisites)
Learners know SHA-256, public-key signatures and Uint8Array. Have `tar` installed.

## 45-minute self-study path
Read the lesson, run `node --test packages/core/test/export.test.mjs`, then do the reinforcement activity.

## Worked example → faded example
Worked: pack two files and list them with `tar -tf`. Faded: learners write the manifest check, then the signature check, with the key list left blank.

## Top misconceptions
- A round trip through our own code proves the format is right (it does not; use `tar -tf`).
- A valid signature means the sender is trusted (it only means the key matches; trust is a separate list).
- Sorting with `localeCompare` is fine for manifests.

## Questions students will ask (with answers)
- Why not zip? No dependency is allowed and ustar is simple.
- Why is the manifest not in the manifest? A file cannot hold its own hash.

## Your mastery check (private)
Learner explains why `untrusted` and `bad-signature` are different outcomes and which is checked first.
