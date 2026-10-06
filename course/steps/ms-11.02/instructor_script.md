# Instructor script - Web shell integration: hooks, nav collisions and the service worker
### Total runtime: **45 minutes**

> `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions.

## Hook (0:00 - 0:05)
[SAY] Two screens are both called "Roster". Which one opens when a journey says roster?
[DO] Run `node scripts/navcheck.mjs` and show a pinned collision.

## Faulty first (0:05 - 0:20)
[SAY] Every pseudo-locale test hung, the plain ones passed.
[TYPE] Show `page.goto: Timeout 30000ms exceeded` and `wc -c packages/web/dist/index.html`.
⚠️ LIKELY CROSS-Q: Why not raise the timeout? - Answer: the page never loaded; waiting longer cannot help.

## Fix and explain (0:20 - 0:40)
[SAY] Keep index.html under the compression threshold and tell the server owner.
[BOARD] Draw install (core, parallel), activate, then the staff page asking the worker to warm the board.

## Check yourself (0:40 - 0:45)
[SAY] Answer the three questions in the lesson.
