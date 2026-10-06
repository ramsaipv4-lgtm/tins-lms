# Trainer prep - Web shell integration: hooks, nav collisions and the service worker

## Before you start (prerequisites)
Learners know the feature registry (ms-07.01) and have seen a service worker.

## 45-minute self-study path
Read the lesson, run `node scripts/navcheck.mjs` and `node --test packages/web/test/shell.test.mjs`, then break a label's order and run navcheck again.

## Worked example -> faded example
Worked: the coordinator home. Faded: add a switch-gated entry for a new screen.

## Top misconceptions
- "Reordering the precache makes the page controlled sooner." Install finishes first.
- "A passing journey means no collision." The journey may open a different screen that happens to satisfy it.

## Questions students will ask (with answers)
- Why a script and not a rule? The collision is by meaning, so only the patterns and labels together show it.

## Your mastery check (private)
Explain why the board is warmed on request and not at install.
