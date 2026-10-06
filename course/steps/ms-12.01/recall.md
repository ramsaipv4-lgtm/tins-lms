# Recall — The last two rows

## Exercise 1 — Slow or ignored? (4 min)

**What to do:** A journey times out waiting for a result. Name one cheap way to tell whether the work was slow or never started.

**The answer (check after):** log at the start of the handler; if the log never appears the input was ignored.

## Exercise 2 — Order the writes (4 min)

**What to do:** A test counts documents, then the app writes one more. Give two fixes and say which is better.

**The answer (check after):** wait (fragile) or write earlier so the count already includes it (better).

## Cards

**Q:** Where does the accommodated Shift limit come from?

**A:** `limitFor` on the hub, which applies the person's time multiplier with `effectiveLimitMs`.

**Q:** Why queue a file chosen before the screen is ready?

**A:** A handler that returns early forgets the event; a queued file is processed when ready.

**Q:** What does `reserveMeta` write and when?

**A:** A `coachMeta:main` record with only a salt, when the PIN setup screen opens.

**Q:** Why send OCR data with Content-Encoding: gzip?

**A:** The browser inflates it natively, so the worker skips slow in-script unzipping.
