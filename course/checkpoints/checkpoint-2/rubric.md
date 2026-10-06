# Rubric: Checkpoint 2

| # | Criterion | Points | Full marks when | Partial |
|---|---|---|---|---|
| 1 | Shift and SLA | 5 | (a), (b), (c) right with the "SLA counted from arrival" rule | Two of three |
| 2 | Appeals | 4 | All four answers right | Window right, states wrong |
| 3 | Merge | 4 | Status, badge and the hub-owned `passMark` right with the reason | Answers without reasons |
| 4 | Rituals and re-flow | 4 | Poker by card position; stand-up by whole words; re-flow plan and `moved` right | One part wrong |
| 5 | Evidence | 3 | Passing test file and one real failure with output | No failure evidence |

14 of 20 is a pass.

## Answer key

Values come from running the merged code and agree with the SPEC rows named.

**1. Shift** (SPEC §4.10, AC-22 to AC-24; ms-04.02)
- (a) At 2 minutes only `t1` has arrived: one entry, `t1`, status `waiting`, 8 minutes left. `t2` arrives at minute 5.
- (b) `t1` is `breached` (resolved at minute 11, 10-minute SLA from minute 0) and `t2` is `resolved` (minute 8, SLA ends at minute 15).
- (c) `score` 1 and `max` 3: `t1` earns 0 because it is breached, `t2` earns its weight of 1, and the maximum is the weights, 2 + 1.

**2. Appeals** (SPEC §4.11, AC-25, AC-26; ms-04.03). At 6 days + 1 ms the appeal is accepted and starts `open`. At 8 days it is refused with `window-closed`. With one unread confirmation it starts `upheld` with reason `unread-confirmation`. An appeal opened on day 1 is still `open` one millisecond before day 8 and `escalated` at day 8 (7 days after it opened).

**3. Merge** (SPEC §4.13, AC-28, AC-29; ms-04.04). Status `done` and `conflictBadge` true (the result also records the statuses it saw in `mergeMeta`). The `passMark` stays 6: the learner's later revision is ignored, and the document records the hub value in `hubFields`.

**4. Rituals** (SPEC §4.15, §4.16; ms-04.05 and its disclosure note). `{3, 8}`: discuss, low the voter of 3, high the voter of 8. `{1, 2, 2, 3}`: discuss, because 1 and 3 are not neighbouring cards. `{8, 13, 13, 8}`: consensus 13, a tie goes to the higher card. `Waiting for review` is blocked; `unblocked yesterday` is not (whole words only).

**5. Re-flow** (SPEC §4.23, AC-41; ms-04.06). Day 0 `a`, day 1 `c`, day 2 `b, d`; `moved` lists `b` from day 0 to day 2. The uncovered topic goes to the start of the day after `throughDay`, and later days keep their topics.

**Evidence.** A good answer names a gate or test failure from the build, for example the group size 3, 3, 1 failure in ms-04.05 or the SPEC contradiction found in ms-04.02, and the command that proved the fix.
