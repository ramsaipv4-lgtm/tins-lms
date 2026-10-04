# Recall — Drop plan, retention, messages

## Exercise 1 — Drop plan for a learner (5 min)

**What to do:** Alice drops out. Class has T1 (Bob), T2 (Alice), T3 (Alice); teams {alpha: [Alice, Carol], beta: [Bob]}. Write `dropPlan(classState, 'Alice')` output.

**The answer (check after):**
```json
{
  "unassignTickets": ["T2", "T3"],
  "reassignReviews": [],
  "removeFromTeam": "alpha",
  "archiveRepos": true,
  "stopBots": true
}
```

## Exercise 2 — Retention timeline (5 min)

**What to do:** Chat created at 1000. Now = 1000 + 365 days + 1 ms. Due for deletion? What if now = 1000 + 365 days - 1 ms?

**The answer (check after):**
Yes (boundary is `>=`). No, not yet due.

## Exercise 3 — Phone normalization (5 min)

**What to do:** Three learners enter `+91 98765 43210`, `09876543210`, `9876543210`. What does `waLink` produce?

**The answer (check after):**
All produce `https://wa.me/919876543210?text=...`

## Cards

**Q:** What does `dropPlan` include?
**A:** Exact ticket IDs, review IDs, team ID, archiveRepos and stopBots flags. Not full team membership.

**Q:** Why pseudonymize grades but not delete?
**A:** Auditors need proof grades happened; privacy rules require names removed.

**Q:** Why doesn't `undoDropPlan` include tickets?
**A:** Reassigning a ticket is a trainer decision that should persist.

**Q:** What's the boundary check for retention?
**A:** `>=`. Retention is due *at* the deadline, not after.

**Q:** How does `waLink` handle a leading 0?
**A:** Strips separators first, then removes leading 0, then 91 prefix, then validates 10 digits.

**Q:** What happens if you call `waLink` with 7 digits?
**A:** It throws an error.
