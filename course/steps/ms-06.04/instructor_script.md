# Instructor script — Sync rules and the merge pass
### Total runtime: **45 minutes**

> `[SAY]` lines are read aloud; `[DO]`, `[TYPE]` are actions.

## Hook (0:00 — 0:05)
[SAY] Two phones edit the same card offline. Which edit wins?
[DO] Ask for guesses on the board.

## Faulty first (0:05 — 0:20)
[SAY] Our first guard broke every write. Here is the output.
[TYPE] `node --test packages/server/test/sync.test.mjs`
⚠️ LIKELY CROSS-Q: Why not read the body in the route? — Answer: express-pouchdb is not a Hono route; it reads the raw stream itself.

## Fix and explain (0:20 — 0:40)
[SAY] Buffer the body, play it back, and answer in the shape PouchDB understands.
[DO] Walk through the three guards and the merge pass.

## Check yourself (0:40 — 0:45)
[SAY] Answer the three questions in pairs.
