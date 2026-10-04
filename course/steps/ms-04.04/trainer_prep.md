# Trainer prep — Conflict merge

## Before you start (prerequisites)
Learners can run node --test and read short TypeScript.

## 45-minute self-study path
Read the lesson, run packages/core/test/merge.test.mjs, do the reinforcement case.

## Worked example → faded example
Worked: ticket doing vs done. Faded: learners merge two arrays by id and predict the order.

## Top misconceptions
- Latest wins for everything (arrays are unioned; status takes the highest rank).
- A result is a plain document (it carries hubFields and mergeMeta for later merges).

## Questions students will ask (with answers)
Why not ignore ties? A tie must still pick one winner, or order would matter.

## Your mastery check (private)
Can the learner explain why a result must remember where each value came from?
