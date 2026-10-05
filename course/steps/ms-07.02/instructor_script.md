# Instructor script — Admin class setup, syllabus, college outputs, Google opt-in
### Total runtime: **45 minutes**

> Say/Do teleprompter.

## Hook (0:00 — 0:05)
[SAY] A college tells you its syllabus on the phone. What do you hand back?
[DO] Open the Syllabus screen.

## Faulty first (0:05 — 0:20)
[SAY] Our nav said Class setup, the journey wanted Classes. Watch it fail.
[TYPE] node --test acceptance/journeys/admin-setup.journey.mjs
⚠️ LIKELY CROSS-Q: Why exact names? — Answer: journeys match accessible names exactly.

## Fix and explain (0:20 — 0:40)
[SAY] Rename the label, then open draftSyllabus and walk the rule.
[DO] Paste four lines and draft.

## Check yourself (0:40 — 0:45)
[SAY] Answer the three questions.
