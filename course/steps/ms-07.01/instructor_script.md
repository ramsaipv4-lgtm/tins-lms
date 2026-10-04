# Instructor script — Web foundation
### Total runtime: **45 minutes**

> Say/Do teleprompter.

## Hook (0:00 — 0:05)
[SAY] Eight people will add screens to one app. How do they not collide?
[DO] Show the features folder.

## Faulty first (0:05 — 0:20)
[SAY] Our first home screen used the wrong test id. Watch the test time out.
[TYPE] node --test packages/web/test/foundation.test.mjs
⚠️ LIKELY CROSS-Q: Why not use the URL name? — Answer: the contract names the role (home-learner).

## Fix and explain (0:20 — 0:40)
[SAY] One table maps the space to the role name. Open registry.ts and show the glob.
[DO] Build with LMS_PSEUDO_LOCALE=1 and show ⟦…⟧.

## Check yourself (0:40 — 0:45)
[SAY] Answer the three questions.
