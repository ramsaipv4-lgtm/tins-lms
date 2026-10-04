# Instructor script — Pairing, devices, attendance
### Total runtime: **45 minutes**

> Say/Do teleprompter. `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions;
> `⚠️ LIKELY CROSS-Q` marks questions students usually ask.

## Hook (0:00 — 0:05)
[SAY] A hotel gives you a key card once. Today a phone gets a key card for the hub.
[DO] Show the QR payload fields on the board: hub id, address, fingerprint.

## Faulty first (0:05 — 0:20)
[SAY] No test failed for us on this task, so we look at a hazard instead. Two phones claim one code at once.
[BOARD] Draw both reading "unclaimed" before either writes.
[PAUSE] Ask the room what each phone gets.
⚠️ LIKELY CROSS-Q: Is core not pure? — Answer: yes, and pure still needs the caller to serialise load and save.

## Fix and explain (0:20 — 0:40)
[SAY] The serial chain makes each claim wait for the one before it.
[DO] Walk the claim excerpt, then the rotating or printed excerpt.

## Check yourself (0:40 — 0:45)
[SAY] Answer the three questions; the used, expired and unknown statuses are the key.
