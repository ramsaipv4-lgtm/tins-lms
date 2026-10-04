# Recall — Screenshot rules, FAQ, at-risk, item analysis, clusters, re-flow

## Cards

**Q:** How long can a screenshot rule anchor be?
**A:** At most 200 characters. Longer anchors are likely mistakes and are rejected by `validateRules`.

**Q:** What happens if a screenshot line matches the anchor but has no number on it (same-line) or the next line is missing?
**A:** The field value is `null` and the line is `null`. The field is still included in the result.

**Q:** If a question appears in the FAQ input multiple times, does it create multiple groups?
**A:** No. All instances of the same text group together. Each person in the group is counted once.

**Q:** What is the minimum number of questions needed to form an FAQ group with the default threshold?
**A:** Three (`minRepeats` defaults to 3). Two instances are below the threshold.

**Q:** How many of the four at-risk signals can be `null` without affecting the level?
**A:** All four. A learner with (locked: 0, overdue: 0, days: null, score: null) is "ok".

**Q:** Which learners are in the top group for item analysis on a 9-learner test?
**A:** 2 learners (27% of 9 = 2.43, rounded down). But at least 1 is always included, so even with 1 learner, the top group is that learner.

**Q:** Can two submissions cluster together if their failing checks are in different orders?
**A:** Yes. The cluster signature is the sorted set of failures. Order doesn't matter.

**Q:** If a topic is planned for day 3 but covered on day 5, and `throughDay` is 4, does it move?
**A:** Yes. It was planned by day 4 but not covered, so it moves to day 5.

**Q:** How is the reflow result sorted?
**A:** The returned plan is sorted by `dayIndex` in ascending order.

**Q:** What is stop-word removal used for in FAQ grouping?
**A:** To focus Jaccard similarity on content words, not function words. "How do I" appears in almost every question; removing it reveals what's actually similar.

**Q:** What does a question's "representative" in the FAQ result mean?
**A:** It's the text of the first similar question found in the group. It represents that cluster when displayed to the trainer.
