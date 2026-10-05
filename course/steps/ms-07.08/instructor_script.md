# Instructor script — Coach space

### Total runtime: **45 minutes**

> `[SAY]` lines are read aloud; `[DO]` and `[TYPE]` are actions.

## Hook (0:00 — 0:05)
[SAY] Your plans are private. How would you stop even the server from reading them?
[DO] Ask for answers, write them on the board.

## Faulty first (0:05 — 0:20)
[SAY] Our first build failed when we tapped Set PIN.
[TYPE] Show the console error: Class extends value #<Object> is not a constructor or null.
⚠️ LIKELY CROSS-Q: Why not fix the helper? — Answer: it belongs to the shell, outside this task.

## Fix and explain (0:20 — 0:40)
[SAY] We call the hub with fetch and seal entries on the device.
[DO] Walk through `unlockWithPin` and `buildRound`.

## Check yourself (0:40 — 0:45)
[SAY] Answer the three questions in the lesson.
