# Trainer prep — Screenshot rules, FAQ, at-risk, item analysis, clusters, re-flow

## What you need to know

This step covers six interconnected modules that analyze learner data from different angles: OCR parsing, text similarity, risk assessment, test psychometrics, error clustering, and schedule adjustment. All six run offline with no external APIs.

The key insight is that most of the cognitive work is done upfront in rule design and threshold selection. Once a trainer has defined parsing rules and confirmed the risk thresholds match their context, the modules run automatically.

## Demos to prepare

1. **Screenshot parsing:** Bring a screenshot of a nutrition app or receipt. Show how to write rules for "Calories" and "Total Cost". Demonstrate that `validateRules` catches a typo (bad regex) or a rule longer than 200 chars.

2. **FAQ grouping:** Use three actual exit-ticket responses from a previous cohort that were rephrasings of one question. Show how they group together with Jaccard ≥ 0.6 but different questions don't.

3. **At-risk dashboard:** Show a learner profile with one yellow signal (watch) vs two red signals (risk). Explain how adding a threshold for "days since commit" catches silent failures.

4. **Item analysis:** Use a test item that everyone got right (p > 0.95, flagged as trivial) and one that no one got right (p < 0.2, flagged as too hard). Show discrimination on a hard-but-discriminating item vs a hard-but-not-discriminating item.

5. **Clustering:** Show a test with three submissions that all fail the same two checks, plus a fourth that fails only one. Highlight how the bigger cluster suggests a systematic misunderstanding.

6. **Reflow:** Use a 5-day lesson plan where day 2 was planned but only 1 of 3 topics were covered. Show how reflow moves the uncovered topics to day 3 and lists what moved.

## Common questions from learners

**Q: Can I use `new RegExp(userInput)` as an anchor without validating first?**
A: No. Always call `validateRules` first. A bad regex will crash the parser.

**Q: If I change the stop words list, how does that affect old FAQ groups?**
A: Old groups are from a different run of `suggestFaq`. Changing stop words requires re-running on the same questions.

**Q: At what point is a learner considered "at risk"?**
A: When any two of the four signals are present. With one signal, they're just watched.

**Q: How many learners do I need for item analysis?**
A: At least 4 (so the bottom 27% is at least 1). With fewer, the top and bottom groups may be the same person.

**Q: If a learner makes a unique mistake, does it form a cluster?**
A: Yes. Every submission clusters with others that share its signature. A unique signature is a cluster of size 1, not shown if there's a minimum cluster size.

**Q: Can I reflow multiple times?**
A: Yes. Each call to `reflow` adjusts the plan based on coverage *so far*. You'd call it again after the next day if coverage is still behind.

## Tips for classroom use

1. **Parsing rules:** Let learners write rules for a screenshot you provide. Have them discuss why certain anchors are too vague (match multiple sections) vs too specific (fail on minor layout changes).

2. **FAQ threshold:** Ask: "If three learners ask the same thing three ways, is it worth grouping?" Then ask: "What if it's the same learner asking three times by accident?" (Set `minRepeats` higher for stricter grouping.)

3. **Risk assessment:** Show a cohort's risk distribution. Ask: "Who would you check in with first?" (The at-risk learners, obviously, but also ask why the at-risk level is better than checking everyone.)

4. **Item analysis:** Show a test with one trivial item (everyone got it) and one broken item (no one got it). Ask: "Why are both flagged? Aren't they different problems?" (Yes, and the trainer handles each differently: remove trivial items, fix broken items.)

5. **Clustering:** Show submissions and ask learners to manually group them, then compare to the algorithm. Discuss why order doesn't matter.

6. **Reflow:** Use a physical calendar. Mark planned topics. Cross off covered topics. Ask: "Where do the uncovered ones go now?" Lead to the reflow algorithm.

## Integration points

- **Server:** These modules are called by SPEC §5 analytics routes.
- **Web UI:** Dashboards for at-risk, item analysis, clustering, and reflow are in §7.
- **Trainer tools:** Screenshot rules are authored once and frozen. FAQ grouping runs on every exit-ticket batch.
