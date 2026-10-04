# Recall — GitHub App and Forgejo adapters, push-check hook

## Exercise 1 — Predict the result (5 min)
**What to do:** Call `personaToken` with `now` equal to `batchEndsAt`.
**The answer (check after):** It reports `{ ok: false, reason }` and makes no HTTP call.

## Cards
**Q:** Why inject the base URL?
**A:** So tests run against a fake server and never reach a real service.

**Q:** When does Forgejo provisioning create a login?
**A:** When `GET /api/v1/users/:u` answers 404; the login has `must_change_password: true`.

**Q:** What does a blocked push message contain?
**A:** The class and file:line of the finding and a "rotate this key" instruction, never the key.

**Q:** What is logged when `secretScan` is turned off?
**A:** `{ switch: 'secretScan', on: false, by, at }`.
