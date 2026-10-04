# Instructor script — Drop plan, retention, messages

### Total runtime: **40 minutes**

> Say/Do teleprompter. `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions;
> `⚠️ LIKELY CROSS-Q` marks questions students usually ask.

## Hook (0:00 — 0:05)

[SAY] A learner drops out mid-program with open tickets and team responsibilities. What happens to their work? And after three years, can we still see grades in reports? Today: safe departures, data governance, messaging integration.

[BOARD] Draw: learner drop → plan; time passes → retention; message → WhatsApp.

## Faulty first (0:05 — 0:20)

[SAY] Drop plan mistake: storing the full current team state.

[TYPE] Don't do this: store `{ team: teamId, members: [...full list] }`. If someone joins the team later, undo will overwrite that.

[SAY] Instead: store only `{ removeFromTeam: teamId }`. The team membership stays live. Undo reads it fresh when restoring.

⚠️ LIKELY CROSS-Q: But don't we need the old state for perfect undo? — Answer: No. Drop plan is a discovery document. Caller handles restoration.

## Fix and explain (0:20 — 0:40)

[SAY] Retention: each document type has a different rule. Use `>=` for boundary checks.

[TYPE] `if (now >= createdAt + YEAR_MS)` triggers exactly at the deadline, not after.

[SAY] Messages: normalize phone numbers step-by-step. Strip separators, remove prefixes, validate 10 digits, rebuild with 91.

[BOARD] `+91 9876-543210` → remove `-` → `+919876543210` → remove `+` → `919876543210` → remove `91` → `9876543210` → validate → rebuild `919876543210`.

## Check yourself (0:40 — 1:00)

[SAY] If a learner's in two teams, which does drop plan return? [Pause: the first found.] Why doesn't undo restore tickets? [Pause: trainer's decision is permanent.] What boundary check do we use? [Pause: `>=`.] Done. Next: packages and the content gate.
