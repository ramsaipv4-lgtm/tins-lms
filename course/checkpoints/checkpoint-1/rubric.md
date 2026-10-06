# Rubric: Checkpoint 1

| # | Criterion | Points | Full marks when | Partial |
|---|---|---|---|---|
| 1 | Catch-up scenarios | 6 | All three answers right, with the unlock-in-order rule stated | Two right, or right answers with no reason |
| 2 | Mastery | 3 | Only `git` is mastered, with both reasons for `dns` and `vm` | One reason missing |
| 3 | Cards and backlog | 4 | Due order and `reps` right; backlog split right | One of the two right |
| 4 | Timing | 3 | Flags and both limits right | Flags right, limits wrong |
| 5 | Evidence | 4 | Test file passes, rows green in the gate, journal entry has real failing output | Test passes but no journal |

14 of 20 is a pass. Below 14, redo the step named in the last column of the answer key.

## Answer key

These values were produced by running the merged code in this repository, and they agree with the SPEC rows named.

**1. Catch-up** (SPEC §4.3, AC-6 to AC-8; step ms-02.03)

| Case | `missed` | `nextGate` | `unlocked` | `selfStudyBlocked` |
|---|---|---|---|---|
| (a) `{d1:7, d0:5}` | `d0, d1, d2` | `d0` | `d3` | true |
| (b) `{d1:7, d0:6}` | `d0, d1, d2` | `d2` | `d0, d1, d3` | true |
| (c) `{d1:7, d0:6, d2:8}`, pass mark 7 | `d0, d1, d2` | `d0` | `d3` | true |

In (a) 5 is below the pass mark of 6, so `d0` stays locked, and `d1` stays locked even with 7 because an earlier missed day is locked (AC-7). In (b) `d0` and `d1` unlock in order; `d2` has no score. In (c) the class pass mark is 7, so 6 does not unlock `d0` and nothing after it does either. Today (`d3`) is always unlocked.

**2. Mastery** (SPEC §4.4, AC-10; ms-02.03): `git` is mastered (0.8 and 0.9, 25 hours apart). `dns` is not-yet (the two checks are 2 hours apart). `vm` is not-yet: its two most recent checks are 0.85 and 0.5.

**3. Cards** (SPEC §4.2, AC-3; ms-02.02): the due order is `again` earliest, then `hard`, then `good` (in the merged code, 1 minute, 6 minutes and 10 minutes after the review). `reps` becomes 1. Only the order and the within-24-hours rule for `again` are in the SPEC; do not mark exact minutes.

**4. Backlog** (SPEC §4.2, AC-5): day 10 gets `a, b, c`; day 11, the last day, gets `d, e, f, g, h`. Only three fit per day and the overflow goes on the last day.

**5. Timing** (SPEC §4.26, AC-47, AC-48; ms-02.04): `durationMs` 59,000 with flags `offline-attempt` and `clock-skew` (the device ran about 10 minutes longer than the monotonic clock, more than the 60 s limit). `effectiveLimitMs` with multiplier 5 gives 10,800,000 (clamped to 3), and with 0.5 gives 3,600,000 (clamped to 1).

**Evidence.** If the journal entry says "no mistakes", ask for the failing output. Across the build, the audit found that self-reports without output understated the failures (docs/build-journal/AUDIT.md).
