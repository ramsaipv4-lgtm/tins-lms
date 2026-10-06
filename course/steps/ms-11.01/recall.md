# Recall — Server hardening and integration

## Exercise 1 — Find the lookup (3 min)

**What to do:** A seed stores an enrolment with id `enrolment:c1-l1` and `personId: 'l1'`. Write the lookup that finds it for the person key `l1`.

**The answer (check after):** list `enrolment:` documents and find the one whose `personId` (key form) equals `l1`.

## Exercise 2 — Build the regex (3 min)

**What to do:** Write the pattern that matches `day2/instructor_script.md` for index 2 without a regex literal.

**The answer (check after):** ``new RegExp(`(^|/)day0*${index}/instructor_script\\.md$`)``.

## Cards

**Q:** What does an MCP write tool return?

**A:** `{ status: 'pending', diff, pendingId }`; nothing else has changed.

---

**Q:** Which API prefix is public for sign-in?

**A:** `/api/signin`, as SPEC says; `/api/sign-in` is not public.

---

**Q:** What does a minor's integrity log keep?

**A:** Exam events only (D-33); practice events are dropped.

---

**Q:** Why can `/assets/*` be cached for a year?

**A:** Build file names carry a content hash.
