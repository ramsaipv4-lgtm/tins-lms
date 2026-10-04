# Instructor script — Packages, gate on upload, sealed sections

### Total runtime: **45 minutes**

> Say/Do teleprompter.

## Hook (0:00 — 0:05)
[SAY] A test says expected true, actual false. Nothing else. What do you do?
[DO] Show the gate line from the journal.

## Faulty first (0:05 — 0:20)
[SAY] I guessed three causes in a row. Count the gate runs.
[DO] Walk the journal table, mistake 1.
⚠️ LIKELY CROSS-Q: Why not read the test? — Answer: the rules forbid it; observe your own server instead.

## Fix and explain (0:20 — 0:40)
[SAY] Log requests, compare sizes: 39936 minus 3584 is one file.
[DO] Show normalizePaths and the store.put wrapper.
⚠️ LIKELY CROSS-Q: Why wrap store.put? — Answer: every writer is then covered, including the seed.

## Check yourself (0:40 — 0:45)
[SAY] Answer the four questions in pairs.
