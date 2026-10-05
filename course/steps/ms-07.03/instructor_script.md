# Instructor script — Attendance, wrap-up, messages, trainer notes, digest
### Total runtime: **45 minutes**

> `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions.

## Hook (0:00 — 0:05)
[SAY] It is 6 pm. Eight learners left without a word. What does the trainer need in one minute?
[DO] Show the absentee page with the WhatsApp links.

## Faulty first (0:05 — 0:20)
[SAY] My first button said "Send comment" and the journey could not find it.
[TYPE] Show the failing line: `waiting for getByRole('button', { name: /^(send|post|comment)$/i })`.
⚠️ LIKELY CROSS-Q: Why not loosen the test? — Answer: the contract is the test; we match the contract.

## Fix and explain (0:20 — 0:40)
[SAY] Rename to "Send". Now show why notes sit in the private database.
[BOARD] Draw class database (replicates) and private database (does not).

## Check yourself (0:40 — 0:45)
[SAY] Answer the three questions in the lesson.
