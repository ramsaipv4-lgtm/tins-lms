# Recall — Catch-up gate and mastery map

## Exercise 1 — Trace the catch-up gate (8 min)

**What to do:**
A learner joined on day 3 (missed days 0, 1, 2). Their diagnostic scores are:
- day-0: 5
- day-1: 8
- day-2: 6

What are `nextGate`, `unlocked`, and `selfStudyBlocked`? (Pass mark: 6)

**The answer (check after):**

- Missed days: ['day-0', 'day-1', 'day-2']
- Day 0 tries to unlock: score 5 < 6 (fail) → LOCKED
- Day 1 tries to unlock: score 8 ≥ 6 (pass), but day 0 is locked → LOCKED
- Day 2 tries to unlock: score 6 ≥ 6 (pass), but day 0 and 1 are locked → LOCKED
- Unlocked: ['day-3'] (only today)
- nextGate: 'day-0' (first locked missed day)
- selfStudyBlocked: true (days 0, 1, 2 are all locked)

---

## Exercise 2 — Mastery decision (8 min)

**What to do:**
Skill "testing" has these checks:
1. Score 0.85 at time 1000
2. Score 0.82 at time 1000 + 12 hours
3. Score 0.88 at time 1000 + 26 hours

Is "testing" mastered? Why or why not?

**The answer (check after):**

- Sorted by time: Check 1 (0.85, 1000), Check 2 (0.82, 1000+12h), Check 3 (0.88, 1000+26h)
- Two most recent: Check 2 (0.82, 12h) and Check 3 (0.88, 26h)
- Both ≥ 0.8? Yes (0.82 ≥ 0.8, 0.88 ≥ 0.8)
- Time gap ≥ 24h? 26h - 12h = 14h < 24h (No)
- Result: **not-yet** (time gap too short)

---

## Exercise 3 — Graded due date (4 min)

**What to do:**
A learner passes a catch-up gate at timestamp 2000. Calculate the due date for graded work with:
1. Default extension (7 days)
2. Custom extension (10 days)

**The answer (check after):**

Formula: `due = gatePassedAt + extensionDays * 24 * 60 * 60 * 1000`

1. Default (7 days):
   - 7 * 24 * 60 * 60 * 1000 = 604,800,000 ms
   - 2000 + 604,800,000 = 604,802,000 ms

2. Custom (10 days):
   - 10 * 24 * 60 * 60 * 1000 = 864,000,000 ms
   - 2000 + 864,000,000 = 864,002,000 ms

---

## Cards

**Q:** What is a "missed day" in the catch-up gate?
**A:** A day before today that the learner did not attend. Days in the future or today itself are never missed.

**Q:** Explain the sequential unlock rule for the catch-up gate.
**A:** A missed day can only unlock if two conditions are met: (1) its diagnostic score ≥ pass mark, and (2) all earlier missed days are already unlocked. This prevents skipping ahead.

**Q:** What does `nextGate` represent?
**A:** The first missed day that is still locked (not yet unlocked). It tells the learner which gate to pass next. If all missed days are unlocked, `nextGate` is null.

**Q:** What is `selfStudyBlocked`? When is it true?
**A:** It's true when at least one missed day is still locked. Self-study materials (elective learning) are inaccessible while a learner is behind on the required catch-up path.

**Q:** What are the two conditions for a skill to be mastered?
**A:** (1) The two most recent checks must both score ≥ 0.8, and (2) they must be at least 24 hours apart.

**Q:** Why does the mastery map look at the two most recent checks, not the highest scores?
**A:** Because we want evidence of current competence, not historical high scores. A learner might have scored 0.95 six months ago but forgotten the material. The two most recent checks show current understanding.

**Q:** Can a skill lose its "mastered" status?
**A:** Yes. If a learner has a mastered skill but then takes a new check (even if the old checks were high), the two most recent checks are recalculated. If the new check is low, the skill can become 'not-yet'.

**Q:** What is the minimum time gap between two checks for mastery?
**A:** Exactly 24 hours. The condition is `latest.at - secondLatest.at >= twentyFourHoursInMs`, so 24 hours exactly (0 ms extra) satisfies the rule, but 23 hours 59 minutes 59 seconds does not.

**Q:** What is the default deadline extension for graded work after a gate passes?
**A:** 7 days (604,800,000 milliseconds). Trainers can override this with a custom `extensionDays` value.

**Q:** Name three scenarios where `selfStudyBlocked` remains true even though one missed day is unlocked.
**A:** (1) A learner missed 3 days, unlocked 1, but 2 are still locked. (2) A learner missed 5 days, unlocked 2, but 3 are still locked. (3) Any case where the number of unlocked missed days < total number of missed days.

**Q:** If two checks have scores of exactly 0.80 and 0.80, exactly 24 hours apart, is the skill mastered?
**A:** Yes. Both conditions are satisfied: (1) both are ≥ 0.8 (0.80 ≥ 0.8 is true), and (2) the time gap is ≥ 24 hours (0 extra, so exactly 24 hours is true).

**Q:** What does the catch-up gate return if a learner attended every day?
**A:** `{ missed: [], nextGate: null, unlocked: [all days up to today], selfStudyBlocked: false }`. No days are missed, all days are unlocked, and self-study is unblocked.

**Q:** How does `masteryMap` handle skills with no checks?
**A:** They are absent from the returned object. Only skills with at least one check appear in the result (as 'not-yet' or 'mastered').

**Q:** Why is 24 hours the chosen interval, not 12 or 48 hours?
**A:** 24 hours aligns with the typical class rhythm in synchronous cohorts (one day apart between class sessions) and represents overnight retention (suggesting real understanding rather than same-day guessing or cramming).
