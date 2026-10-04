# Trainer prep — Sync rules and the merge pass

## Before you start (prerequisites)
Learners know MS 6.1 and what a revision is.

## 45-minute self-study path
Read the lesson, run `packages/server/test/sync.test.mjs`, do the reinforcement activity.

## Worked example → faded example
Worked: schema refusal. Faded: learner writes the document guard for another rule.

## Top misconceptions
- "CouchDB picks a winner so nothing is lost": the loser stays as a conflict until merged.
- "Encrypting is the server's job": the device encrypts; the server only refuses plaintext.

## Questions students will ask (with answers)
**Why not 403 for old clients?** 403 means a permission problem; the fix here is an app update.

## Your mastery check (private)
Learner can explain the three guards in order and the merge write.
