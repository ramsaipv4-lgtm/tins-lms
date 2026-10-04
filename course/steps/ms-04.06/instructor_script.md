# Instructor script — Screenshot rules, FAQ, at-risk, item analysis, clusters, re-flow

## Opening (2 min)

"Six modules today. All of them take raw data — OCR, exit tickets, learner signals, test responses, submission logs, lesson plans — and turn it into insights. The first three modules are utilities the trainer tools will call. The last three are analytics the server computes and shows on a dashboard."

## Screenshot rules (12 min)

Live-code a screenshot parser. Show the rule structure: anchor regex, field name, pick direction, optional unit. Then show how `validateRules` checks length, regex validity, and duplicates.

Ask: "Why reject anchors over 200 chars?" (Early catch of mistakes; regex performance.)

Write the parsing function: find the anchor line, pick same or next line, extract the number. Call out the number pattern: thousands separators, decimal, currency signs.

Run the tests. Show that the regex `/[₹Rs$]*\s*([0-9,]+\.?[0-9]*)/` finds numbers anywhere in a line, not just at the start.

## FAQ grouping (10 min)

"Three learners ask the same question three different ways. You don't want to answer each separately. But 'what is X' and 'what is Y' are not the same question."

Show the Jaccard similarity formula: intersection size over union size. Then show stop-word removal: a, the, is, how, what, do, to, of, in, why, an, i.

Test it: "How do I deploy a bicep file?" vs "how to deploy a bicep file?" vs "how do I deploy a bicep file in azure?" Show that all three have Jaccard ≥ 0.6 and group together if minRepeats is 3.

Run the tests.

## At-risk assessment (8 min)

"Four signals, one threshold each. Add them up. Show a color."

Walk through the signals: locked days, overdue cards (50+), stalled (5+ days), low score (< 50%). Each is optional; null never adds a point. Sum gives the level.

Ask: "Why not average the signals?" (Averaging would hide the worst problem. This way, a learner with one critical issue still gets flagged.)

## Item analysis (12 min)

"Which test items are broken?"

Show the method: rank learners by total score, take top 27%, take bottom 27%. Compute p (share correct) and discrimination (difference in p). Flag if p is extreme (< 0.2 or > 0.95) or discrimination is weak (< 0.2).

Ask: "Why 27%?" (Psychometric standard; balances sample size and extreme separation.)

Live-code the grouping logic. Show that `Math.max(1, Math.floor(...))` ensures at least one learner in each group.

## Submission clustering (8 min)

"Same mistakes, same cluster. Let's find them."

Sort failing checks, JSON-stringify to get a key, group by that key. Sort clusters by size (biggest first), then alphabetically by signature.

Ask: "What if two submissions have different order of failing checks?" (They still group together; order doesn't matter for a set.)

## Plan re-flow (8 min)

"You planned to cover A, B, C on day 1. You only covered A. C moves to day 2."

Show the algorithm: build a covered-topics set, filter the original plan, collect uncovered topics in order, prepend them to day `throughDay + 1`.

Key point: uncovered topics keep their original order; nothing else moves.

## Wrap-up (2 min)

"These six modules feed the server's dashboards and trainer tools. They run offline, audit-able, and fast. No external APIs. No machine learning that can't be explained. Just rules and statistics you can reason about."
