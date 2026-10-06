# Checkpoint 1: the learning core (after module 2)

**Covers:** ms-01.01 to ms-02.04. **Rows:** AC-1 to AC-10, AC-47, AC-48 (and AC-49, AC-50 from module 1). **Time:** about 45 minutes, with your own code open.

## Build

In your own rebuild, write one test file, `packages/core/test/checkpoint1.test.mjs`, that pins the five scenarios below as `node:test` assertions against your functions. Write the expected values **before** you run anything. Use the SPEC (§4.1 to §4.4 and §4.26), not the acceptance sources.

1. **Catch-up.** A class has days `d0, d1, d2, d3`; today is `d3`; the learner attended only `d3`.
   - (a) Best scores `{ d1: 7, d0: 5 }` with the default pass mark. What are `missed`, `nextGate`, `unlocked` and `selfStudyBlocked`?
   - (b) Scores `{ d1: 7, d0: 6 }`. What is `nextGate` now, and which days are unlocked?
   - (c) Scores `{ d1: 7, d0: 6, d2: 8 }` with `passMark: 7`. What is `nextGate`?
2. **Mastery.** Checks for three skills: `git` 0.8 at hour 0 and 0.9 at hour 25; `dns` 0.9 at hour 0 and 0.9 at hour 2; `vm` 0.9 at hour 0, 0.85 at hour 30, then 0.5 at hour 60. Which skills are mastered?
3. **Cards.** For one new card reviewed at the same instant with `again`, `hard` and `good`: put the three due times in order, and say what `reps` becomes.
4. **Backlog.** `spreadBacklog` of eight ids `a` to `h`, starting at day 10, over 2 days with at most 3 per day. Which ids land on which day?
5. **Timing.** `gradedTiming` with no hub times, a monotonic duration of 59,000 ms and a device clock that ran 659,000 ms. Which flags? Then `effectiveLimitMs(3_600_000, { timeMultiplier: 5 })` and with `0.5`.

## Verify

1. Run your test file: `node --test packages/core/test/checkpoint1.test.mjs`. It must pass.
2. Run the acceptance rows for the module through the gate (claim them in `build/progress/<task>.json`) or run the visible subset with `npm run smoke`. Read the failure output, not the test source (SPEC D-40).
3. Write four lines in your journal: one mistake from modules 1 and 2, the exact failing output, how you noticed, and the command that proved the fix.

## Pass

You pass when your five scenarios are right on the first run, all ten rows are green in the gate, and your journal entry names a real failure with its output. Mark yourself with [the rubric](rubric.md); 14 of 20 points is a pass.
