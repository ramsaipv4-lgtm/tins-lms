# Recall — Offline phone profile, file exchange, export my data, robustness

## Exercise 1 — Trace a review (5 min)
**What to do:** Write what happens from rating a card with the hub off to the hub seeing it.
**The answer (check after):** `rateCard` writes the card to the local database; replication retries; when the hub answers the change is pushed.

## Cards
**Q:** Why does the phone store an offset to the hub clock?
**A:** Cards are due by the hub's time and the device clock may be wrong.

**Q:** What does a day package carry besides the sealed text?
**A:** The keys of its released sections, a manifest and the hub's signature.

**Q:** What does "Wi-Fi only downloads" hold back?
**A:** Downloads started by the app on a cellular connection, until the person allows one.
