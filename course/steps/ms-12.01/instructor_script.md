# Instructor script — The last two rows
### Total runtime: **45 minutes**

> Say/Do teleprompter. `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions;
> `⚠️ LIKELY CROSS-Q` marks questions students usually ask.

## Hook (0:00 — 0:05)

[SAY] Two tests stayed red after everything else was merged. One said "no timer", one said "timed out". Both guesses about the cause were wrong.

[DO] Show the two failure lines from the journal.

## Faulty first (0:05 — 0:20)

[SAY] The phone says the result never appeared in 68 seconds. Is the phone slow?

[DO] Show the `disabled` input and the early `return` in the old handler.

⚠️ LIKELY CROSS-Q: Does a disabled input accept files? — Answer: not from a person, but automation can set them, and the handler must not forget them.

## Fix and explain (0:20 — 0:40)

[SAY] Queue the file, start the worker early, reserve the PIN record.

[DO] Walk through the five excerpts in the lesson.

## Check yourself (0:40 — 0:45)

[SAY] Answer the four questions, then open the details.
