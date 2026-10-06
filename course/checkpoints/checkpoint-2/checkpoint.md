# Checkpoint 2: the classroom engines (after module 4)

**Covers:** ms-04.01 to ms-04.07. **Rows used:** AC-22 to AC-26, AC-28, AC-29, AC-32, AC-33, AC-41 (the module's other rows are covered by the gate in the Verify part). **Time:** about 60 minutes.

## Build

Write `packages/core/test/checkpoint2.test.mjs` pinning the scenarios below. Compute the expected values from SPEC §4.10 to §4.17 and §4.23 first. Implement from the SPEC only (D-40).

1. **Shift and SLA.** A pack of 60 minutes has `t1` (arrives at minute 0, SLA 10 min, answer `x`) and `t2` (arrives at minute 5, SLA 10 min, answer `y`); the rubric for mode `live` weighs `t1` 2 and `t2` 1. Start a shift with any seed at time 0.
   - (a) At 2 minutes, what does `slaReport` list?
   - (b) `t1` is resolved with `x` at minute 11, `t2` with `y` at minute 8. At minute 12, what are the two statuses?
   - (c) What are the `score` and `max` for mode `live`?
2. **Appeals.** An attempt was published at time 0 and has no unread confirmations. Is an appeal opened at 6 days + 1 ms accepted? At 8 days? If the attempt had one unread confirmation, in which state does an appeal opened on day 1 start? An appeal opened at day 1: in which state is it at day 8 minus 1 ms, and at day 8 exactly (use `appealTick`)?
3. **Merge.** Merge two `ticket` revisions with statuses `doing` (updated at 1) and `done` (updated at 2). What are the status and the `conflictBadge`? Merge a `class` revision from `hub:1` with `passMark` 6 and a later one from `person:l` with `passMark` 1. What is the merged `passMark`?
4. **Rituals.** Poker votes {3, 8}, {1, 2, 2, 3}, {8, 13, 13, 8}; stand-up answers `Waiting for review` and `unblocked yesterday`.
5. **Re-flow.** A plan with day 0 `a, b`, day 1 `c`, day 2 `d`; covered: day 0 `a`, day 1 `c`; `throughDay` 1. What is the new plan and what is in `moved`?

## Verify

1. `node --test packages/core/test/checkpoint2.test.mjs` passes.
2. Claim the module's rows in your progress file and run the gate once (one gate at a time, see the strategy).
3. Find one mistake in your own work, give its exact failing output and the command that proved the fix. If you had none, write down which test you wrote first and why it could have failed.

## Pass

14 of 20 points on [the rubric](rubric.md).
