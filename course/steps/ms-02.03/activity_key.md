# Activity key — Catch-up gate and mastery map

**Trainer-only. Answers to lesson activities and check-yourself questions.**

---

## Exercise 1 — Trace the catch-up gate

### Scenario

- Days: `['day-0', 'day-1', 'day-2', 'day-3']`
- Today: day 3
- Attended: `['day-3']` (joined on day 3, missed 0–2)
- Scores: `{ 'day-0': 6, 'day-1': 0, 'day-2': 4 }`
- Pass mark: 6 (default)

### Expected trace

**Step 1: Find missed days**
- Days before today (0, 1, 2) that weren't attended
- Missed: `['day-0', 'day-1', 'day-2']`

**Step 2: Try to unlock each missed day in order**
- Day 0: score 6 ≥ 6 ✓, no earlier days ✓ → UNLOCKED
- Day 1: score 0 < 6 ✗ → LOCKED
- Day 2: score 4 < 6 ✗ (and day 1 not unlocked anyway) → LOCKED

**Step 3: Determine nextGate**
- First locked missed day is day 1
- `nextGate = 'day-1'`

**Step 4: Build unlocked list**
- Attended days: day 3
- Today: day 3
- Unlocked missed: day 0
- Unlocked: `['day-0', 'day-3']`

**Step 5: Determine selfStudyBlocked**
- Missed days: 3 (days 0, 1, 2)
- Unlocked missed: 1 (day 0)
- `selfStudyBlocked = true` (3 > 1, so there are locked missed days)

### Code validation

```ts
const result = catchUpState({
  dayIds: ['day-0', 'day-1', 'day-2', 'day-3'],
  todayIndex: 3,
  attended: ['day-3'],
  bestScores: { 'day-0': 6, 'day-1': 0, 'day-2': 4 },
});

assert.deepEqual(result.missed, ['day-0', 'day-1', 'day-2']);
assert.equal(result.nextGate, 'day-1');
assert.deepEqual(result.unlocked, ['day-0', 'day-3']);
assert.equal(result.selfStudyBlocked, true);
```

### Learner success indicators

- Correctly identified all missed days
- Explained why day 0 unlocked but day 1 didn't
- Recognized that self-study stays blocked until day 1 passes
- Understood that day 2's failure doesn't matter yet because day 1 is still locked

---

## Exercise 2 — Mastery decision with multiple checks

### Scenario

Checks for skill "testing":
- Check 1: score 0.9, at time 1000 ms
- Check 2: score 0.75, at time 1000 + 1 hour = 3600000 ms
- Check 3: score 0.85, at time 1000 + 25 hours = 90000000 ms

### Expected trace

**Step 1: Group and sort by skill**
- All three checks belong to "testing"
- Sorted by time: Check 1 (1000), Check 2 (3600000), Check 3 (90000000) ✓

**Step 2: Examine the two most recent checks**
- Most recent: Check 3 (score 0.85, at 90000000)
- Second-most recent: Check 2 (score 0.75, at 3600000)

**Step 3: Check both conditions**
- Both ≥ 0.8? 0.85 ✓, 0.75 ✗ → FAILS
- Because the second condition fails, the skill is **not-yet**

### Code validation

```ts
const map = masteryMap([
  { skill: 'testing', score: 0.9, at: 1000 },
  { skill: 'testing', score: 0.75, at: 3600000 },
  { skill: 'testing', score: 0.85, at: 90000000 },
]);

assert.equal(map['testing'], 'not-yet');
// Reason: Check 2 (0.75) is < 0.8
```

### Learner success indicators

- Sorted checks correctly by time
- Identified the two most recent checks correctly
- Understood that BOTH scores must be ≥ 0.8
- Recognized that a later lower score can prevent mastery

### Extension: What if Check 2 had been 0.80?

If the second-most recent check were 0.80 (not 0.75), then:
- Both ≥ 0.8? 0.85 ✓, 0.80 ✓ → PASSES
- Time apart? 90000000 - 3600000 = 86400000 ms = 24 hours ✓ → PASSES
- Result: **mastered**

---

## Check yourself — Answers

### Question 1

**A learner missed days 0, 1, 2 and scored: day-0: 5, day-1: 8, day-2: 7. What is `nextGate`?**

**Answer:** `nextGate = 'day-0'`

**Why:** Day 0's score (5) is below the pass mark (6), so it stays locked. Since day 0 is locked, day 1 cannot unlock (it requires day 0 to be unlocked first). So day 0 is the first locked missed day and is the next gate.

**Common mistake:** Learners might think day 1 should be the next gate because its score is high. But the sequential rule prevents day 1 from unlocking until day 0 is unlocked.

---

### Question 2

**Can a skill be marked as "mastered" with only one check?**

**Answer:** No.

**Why:** The function explicitly checks `if (skillCheckList.length < 2) { result[skill] = 'not-yet'; }`. One check is always 'not-yet', no matter how high the score.

**Teaching point:** This prevents premature mastery attribution based on a single lucky or coached answer.

---

### Question 3

**Two checks of 0.8 and 0.8, exactly 24 hours apart. Mastered?**

**Answer:** Yes.

**Why:** 
- Both ≥ 0.8? 0.8 ✓, 0.8 ✓ → PASSES
- 24 hours apart? The condition is `latest.at - secondLatest.at >= twentyFourHoursInMs`. Since we have exactly 24 hours (0 offset), the inequality is satisfied.

**Boundary teaching:** This shows that 24 hours is inclusive (the `>=` operator). So the minimum time gap is exactly 24 hours, not "more than 24".

---

### Question 4

**A learner unlocks a gate at time 1000 ms. What is the due date with default extension?**

**Answer:** `1000 + 7 * 24 * 60 * 60 * 1000 = 1000 + 604800000 = 604801000` ms

**Formula:** `gatePassedAt + extensionDays * 24 * 60 * 60 * 1000`

**Explanation:**
- 7 days × 24 hours/day × 60 min/hour × 60 sec/min × 1000 ms/sec = 604800000 ms
- 1000 + 604800000 = 604801000 ms

**Teaching point:** The result is in milliseconds, which is the standard unit throughout Coach LMS. Learners sometimes forget the 1000 multiplier for seconds-to-milliseconds.

---

### Question 5

**What does `selfStudyBlocked: true` mean?**

**Answer:** At least one missed day is still locked. The learner should focus on catching up before doing elective self-study.

**Why:** If a learner has missed 3 days and unlocked 2, there's still 1 locked day. The system blocks self-study to avoid distracting them from the catch-up requirement.

**Teaching point:** Self-study materials (optional, interest-driven) are inaccessible when a learner is behind. Graded material due to catch-up takes priority.

---

## Common misconceptions

### Misconception 1: "If my score on day 1 is high enough, I can unlock day 1 even if day 0 is locked."

**Reality:** No. The sequential rule requires day 0 to be unlocked before day 1 can unlock, regardless of score. The order of days matters; you can't rearrange the sequence.

**How to address:** Use the "joined late" scenario from the lesson. A learner who joined on day 3 (missed 0, 1, 2) cannot skip to day 2 even if day 2's diagnostic is easy.

### Misconception 2: "One high score (0.95) on a quiz means I've mastered the skill."

**Reality:** No. Mastery requires two recent checks spaced 24+ hours apart, both ≥ 0.8. A single check is not enough; it could be luck, test-specific strategy, or surface-level understanding.

**How to address:** Show the faulty code in the lesson's "Your turn" section. One check always returns 'not-yet', preventing mastery attribution without sustained evidence.

### Misconception 3: "If my last check is 0.9 and the one before it is 0.75, I'm almost mastered (one check away)."

**Reality:** No. The function looks at the two most recent checks. If one is 0.75, the 'mastered' condition fails (both must be ≥ 0.8). The learner is 'not-yet' and needs another high-scoring check 24+ hours after the current one.

**How to address:** Trace through the mastery logic step-by-step with a concrete example, showing that both recent checks must pass the score threshold.

---

## Top learner challenges

1. **Off-by-one errors in sequencing:** Learners sometimes unlock day 0 but then incorrectly skip to day 2 when checking day 1. Emphasize the loop: check day 1 after day 0 is unlocked.

2. **Time unit confusion:** The mastery map uses milliseconds; learners often forget to multiply hours by 3600 * 1000. Provide a clear conversion table.

3. **Boundary conditions:** Exactly 24 hours (1 ms away)? That's mastered (>= 24h). Exactly 0.8 score? That's mastered (>= 0.8). Learners often implement `>` instead of `>=` and fail boundary tests.

4. **Forgetting the 'not-yet' default:** For skills with one check, students sometimes check if the score is high and mark it mastered. Remind them: always return 'not-yet' for fewer than two checks.
