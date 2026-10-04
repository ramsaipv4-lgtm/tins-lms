# Instructor script — Server foundation

**Total runtime: 45 minutes**

---

## Hook (0:00 — 0:05)

[SAY] "Six tasks will add routes to one server. Today we look at the ground they stand on."

[DO]
- Show the Detective question on screen

---

## Start and sessions (0:05 — 0:15)

[SAY] "main.ts prints ADMIN_INVITE once and LISTENING when ready. Every API route needs a session cookie except four."

[DO]
- Run the server with test mode and call `/api/health`, then `/api/me` without a cookie

---

## Role guard and validation (0:15 — 0:27)

[SAY] "401 means no session, 403 means wrong role. Admin always passes."

[DO]
- Open `guard.ts` and walk through `role`
- Send an invalid join body and read the 400 field map

---

## Faulty first: the hanging reset (0:27 — 0:38)

[SAY] "Predict what happens to /db after reset if we destroy every database folder."

[DO]
- Show Mistake 1 from the lesson; let learners guess before revealing

---

## Check yourself (0:38 — 0:45)

[SAY] "Three questions, closed book."

[DO]
- Read the questions; reveal answers one at a time
