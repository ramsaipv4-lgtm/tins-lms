# Integration log (orchestrator)

Feature groups are built in parallel and pass alone; merging two of them can still break journeys.
Each integration fix is recorded here with the evidence that found it.

## I-1: attend (b7-3) + tele (b7-4): duplicate "Today" and "Delivery reports"

**Problem:** b7-4 passed alone, but `kit merge` refused: "gate fails on the merged tree (each side
passed alone)". Failing: AC-83, AC-89, AC-150, AC-151 (desktop and phone), e.g.
`AC-151 [desktop] after step "learner signed in": expected self-learn player to be visible`.
**Cause:** both groups registered the learner route `/learn/today` (only one page can win) and both
added a trainer nav "Delivery reports"; the trainer's day-screen link order put "Teleprompter" before
the wrap-up "Today".
**Options considered:** rename one group's labels (breaks the journeys' accessible names); make one
group own both pages (rewrites working code); compose the pages.
**Choice:** compose: the learner "Today" page (tele) embeds the wrap-up panel (attend `LToday`,
`embedded`), the "Delivery reports" page (tele) embeds the draft list (attend `Reports`); attend's
duplicate routes stay reachable by URL but leave the nav; the trainer wrap-up "Today" sorts first.
**Why:** each group keeps its logic and tests; one nav entry per name; no journey changes.
**Proof:** `node --test` on teleprompter, wrapup and substitute journeys after the change: 8/8 pass.
**Lesson for the rebuild course:** a feature registry needs a rule for shared screens (one owner per
route and nav name, others contribute panels), or parallel teams collide exactly here.
