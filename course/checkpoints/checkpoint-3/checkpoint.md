# Checkpoint 3: the hub (after module 6)

**Covers:** ms-06.01 to ms-06.08. **Rows:** AC-60 to AC-65, AC-78, AC-81 and, by reading, AC-67 to AC-71. **Time:** about 60 minutes.

## Build

Start your hub in the hub profile with a fresh data folder, then check what a stranger can and cannot do. Use `curl`; do not open the acceptance sources.

```bash
PORT=18081 LMS_PROFILE=hub LMS_DATA_DIR=$(mktemp -d) node packages/server/src/main.ts
```

1. **Start-up.** Read the first lines on stdout. What do you see once, and what should you never see again? Where does the hub keep its certificate authority, and what does the pairing QR carry (SPEC D-25, AC-61)?
2. **Public and guarded routes.** With no session cookie, call `GET /api/health`, `GET /api/me`, and `GET /__test/anything`. Predict the three status codes first (SPEC AC-60, AC-62, AC-78).
3. **A guard that is one character wrong.** SPEC says the public sign-in routes live under `/api/signin`. Your guard lists `/api/sign-in`. What does an anonymous call to `/api/signin/...` return, and which step of the course shows the workaround that was used and the fix that removed it?
4. **Sync rules.** A client whose schema is 3 versions behind the hub tries to replicate (AC-71). What must the hub answer, and what must happen to the client's local data? Why is "within 2 versions" the rule (SPEC D-23)?
5. **Sealed release.** Explain in four sentences how a learner who fetches a sealed section before release cannot read it, and what the hub does when the trainer taps next (AC-68). Say why graded sections are never released by time alone (D-38).

## Verify

1. Your answers to 1 and 2 are checked by running the server and the three `curl` calls, then writing the real status codes next to your predictions.
2. Run the server unit tests and the gate with your module-6 rows claimed. Run one gate at a time.
3. Add one line to your journal for the hardest failure in this module, with its exact output.

## Pass

14 of 20 points on [the rubric](rubric.md).
