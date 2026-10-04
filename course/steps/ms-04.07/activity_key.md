# Activity key — Drop plan, retention, messages (trainer only)

## Reinforcement activity: answer

Drop Alex (team "backend", tickets T10, T11). Check retention (3-year-old grades, 1-year-old chat). Generate WhatsApp link to `+91-9876-543210` with text "Check your score".

Drop plan:
```json
{
  "unassignTickets": ["T10", "T11"],
  "reassignReviews": [],
  "removeFromTeam": "backend",
  "archiveRepos": true,
  "stopBots": true
}
```

Retention (at 3-year mark for grades, 1-year for chat):
```json
{
  "delete": ["chat-msg-id"],
  "pseudonymise": ["grade-id-1", "grade-id-2"]
}
```

WhatsApp link:
```txt
https://wa.me/919876543210?text=Check%20your%20score
```

## Marking guide

| Criterion | Full marks when | Common partial answer |
|---|---|---|
| Drop plan structure | Returns {unassignTickets, reassignReviews, removeFromTeam, archiveRepos, stopBots} with exact IDs | Returns objects instead of IDs; includes full team membership |
| Retention boundaries | Uses `>=`; properly calculates 365 days as ms | Uses `>`; misses first due item |
| Phone normalization | Handles +91, leading 0, spacing; produces 919876543210 | Handles only one format |
| URL encoding | `encodeURIComponent` used; text round-trips correctly | Malformed for special chars |
