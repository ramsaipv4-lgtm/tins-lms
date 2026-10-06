# Instructor script — Performance budgets and the 200-learner load test CLI
### Total runtime: **40 minutes**

> Say/Do teleprompter. `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions;
> `⚠️ LIKELY CROSS-Q` marks questions students usually ask.

## Hook (0:00 — 0:05)
[SAY] Two hundred people press Submit in the same second. What do you want the hub to promise?
[BOARD] Write: 95% under 1 s, 200 answers within 10 s, zero lost writes.

## Faulty first (0:05 — 0:15)
[SAY] Here is a mistake from the real build: a long command run in a short-timeout shell.
[DO] Show the "moved to the background" message from the lesson.
⚠️ LIKELY CROSS-Q: Why does the gate take minutes? — Answer: it runs every claimed row's acceptance tests, on a shared machine.

## Fix and explain (0:15 — 0:35)
[SAY] Open `packages/cli/src/loadtest.ts`. First the guard, then the four phases.
[DO] Run the CLI against a local test hub and read the last stdout line.
[SAY] Failed requests are counted as Infinity so they can only hurt the percentage.
⚠️ LIKELY CROSS-Q: Why read documents back? — Answer: an acknowledgement is a promise; the stored document is the fact.

## Check yourself (0:35 — 0:40)
[SAY] Work through the three questions in the lesson.
