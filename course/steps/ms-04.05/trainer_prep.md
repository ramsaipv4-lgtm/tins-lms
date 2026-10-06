# Trainer prep — Study groups, estimation poker, stand-up bot, explain-it-back

## Before you start (prerequisites)
Learners can run `node --test` on a TypeScript file under Node 22 and read short functions. You need the repo checked out at the merged tree so you can run `packages/core/test/groups.test.mjs`, `poker.test.mjs`, `standup.test.mjs` and `explain.test.mjs` (10 tests).

## 45-minute self-study path
1. Read SPEC §4.14 to §4.17 (10 min).
2. Read the four source files and run their tests (15 min).
3. Read `docs/build-journal/b4-5.md` and the audit row for b4-5 in `docs/build-journal/AUDIT.md` (10 min). Note the hidden-test reads: the step was written by the editor, and the journal says the builder rewrote its explain tests "using acceptance tests as template".
4. Reproduce scenarios A and B from the lesson in a terminal (10 min).

## Worked example → faded example
Worked: 7 people, size 3 gives 3, 2, 2 by the floor-plus-remainder rule. Faded: learners compute 10 people, size 4, then 11 people, size 3.

## Top misconceptions
- "Neighbouring cards" means numbers differing by 1 (it means adjacent in 1, 2, 3, 5, 8, 13).
- A negation always means the answer is not blocked (the merged code treats it that way, which is the scenario B limitation).
- Partial words are fine for matching (the SPEC says whole words).

## Questions students will ask (with answers)
Is the group swap pass optimal? No. It tries single swaps once and keeps those that raise the score; it is a heuristic, and AC-30 only asks for the property where possible. Why not use the RNG from ms-02.01? The builder's scope excluded rng.ts, so groups.ts has its own small generator (journal b4-5); a rebuild may reuse `createRng`.

## Your mastery check (private)
Can the learner explain why 3 and 8 need discussion but 8 and 13 do not, and why the stand-up check order matters?
