# Trainer prep — Server foundation

## Before you start (prerequisites)

Learners should know what an HTTP status code is and have seen a cookie in browser tools.

## 45-minute self-study path

1. Read SPEC section 5 and Appendix A routes for `/api/me` and join (10 min).
2. Run the server with `LMS_TEST_MODE=1` and call health, login and me with curl (15 min).
3. Read `guard.ts`, `http.ts` and `store.ts` (10 min).
4. Break `destroyAll` on purpose by removing the `pouch__` skip and watch `/db` hang (10 min).

## Worked example → faded example

Worked: trace a learner calling an admin route (no cookie 401, cookie 403). Faded: trace a substitute on a trainer route.

## Top misconceptions

- "403 and 401 are the same": 401 means identify yourself, 403 means you are known but not allowed.
- "A hidden test route is safe": it must not exist at all.

## Questions students will ask (with answers)

**Why not store sessions in the database?** In memory is enough for the foundation; a restart signs people out.

## Your mastery check (private)

Explain, without notes, why join codes are hashed and why `/__test/*` returns 404.
