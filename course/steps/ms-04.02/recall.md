# Recall — Shift engine

## Exercise 1 — Predict the status (5 min)
**What to do:** A ticket arrives at minute 5 with SLA 20. Resolve it at minute 26 and ask for the report at minute 30.
**The answer (check after):** `breached`, with minutesLeft null.

## Cards
**Q:** How is the deadline of a ticket computed?
**A:** Arrival minute plus SLA minutes, in milliseconds since shift start.

**Q:** What does a wrong answer do?
**A:** Nothing: the ticket stays open and earns nothing.

**Q:** When is modeFlag true?
**A:** When the scored mode differs from the pack's first rubric mode.
