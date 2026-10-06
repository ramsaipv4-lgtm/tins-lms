---
id: ms-02.03
title: Catch-up gate and mastery map
module: 2
est_minutes: 45
prereqs: []
objectives: 3
new_terms: 4
skills: [catch-up-gate, mastery-tracking, study-group-formation]
source_refs: [{ path: packages/core/src/catchup.ts, commit: c0f99ad }, { path: packages/core/src/mastery.ts, commit: c0f99ad }]
next: ms-02.04
---

# MS 2.3 — Catch-up gate and mastery map
*Step 4 of 41*

## Prerequisites

You already understand:
- How locked content works (sections release when a condition is met)
- What a diagnostic assessment is and how scores measure understanding
- Basic time operations in JavaScript (milliseconds, 24-hour durations)
- How to work with arrays and sorting in TypeScript

## You already understand this

- Why a synchronous class (meeting every day) helps some learners stay on track and leaves others behind
- Why formative assessments (like diagnostics) help identify readiness for graded material
- Why peer learning works better when people have complementary skills

## The detective question

**Problem:** In a synchronous class, some learners miss days and need to catch up. When are they ready to proceed with graded material, and how do we form study groups based on skill proficiency? We need two mechanisms: (1) a **catch-up gate** that ensures missed days are unlocked in the right order, and (2) a **mastery map** that shows which skills a learner has truly mastered vs. still developing.

**Options considered:**
1. Unlock all missed days at once if any diagnostic score passes
2. Require every missed day's diagnostic to pass (too strict; some learners can learn ahead)
3. Unlock missed days in order, sequentially (chosen: requires day N's score before day N+1 can unlock)

**Choice:** Implemented two functions:
- `catchUpState()` determines which days are missed, which are unlocked, what the next gate is, and whether self-study is blocked
- `masteryMap()` identifies skills where learners have demonstrated proficiency with two high-scoring checks spaced 24 hours apart
- `gradedDueDate()` calculates when graded work is due after a gate is passed

**Why:**
- **Sequential unlock prevents jumping ahead:** A learner who missed day 0, 1, 2 cannot unlock day 2 without unlocking day 0 first, ensuring foundational material is covered
- **24-hour spacing weeds out lucky guesses:** Two checks 25+ hours apart mean substantive practice, not guessing the same way twice
- **Time-locked scoring prevents mastery loss:** A single lower score doesn't erase mastery status if it comes after mastery is achieved
- **Default 7-day extension window is pedagogically sound:** Allows 1 week to complete graded work after a gate passes

## Learning objectives

After this step, you will understand:
1. How the catch-up gate enforces sequential unlock of missed days and blocks self-study until gaps are filled
2. How mastery is determined (two recent high-scoring checks spaced 24+ hours apart, or not-yet)
3. How study groups are formed based on mastery patterns to maximize peer learning

## Conceptual understanding

### Catch-up gate (catchup.ts)

When a learner misses a day of synchronous class, they must catch up before proceeding. The catch-up gate manages this:

- **Missed days:** Any day before today that the learner did not attend
- **Unlock requirement:** Each missed day requires a diagnostic score ≥ pass mark (default 6) AND all earlier missed days must be unlocked
- **Self-study block:** While any missed day is locked, `selfStudyBlocked` is true (self-study materials are inaccessible)
- **Attended days and today:** Always unlocked and accessible (live class stays open)

**Example:** A learner joined on day 3 (missed days 0, 1, 2). If they pass day 1's diagnostic first, day 1 stays locked because day 0 isn't unlocked yet. Once day 0 is unlocked (diagnostic ≥ 6), day 1 becomes the new `nextGate`.

### Mastery map (mastery.ts)

A **skill** is a topic or competency (e.g., "recursion", "testing"). We track skill mastery through checks (assessments). A skill is:

- **Mastered:** Two most recent checks both score ≥ 0.8 and are ≥ 24 hours apart
- **Not-yet:** Has one check, or two checks but they don't meet the criteria above, or a later low score after mastery
- **Absent:** No checks recorded for this skill

**Why 24 hours?** One check can be luck or review. Two checks a day apart suggest the learner has internalized the skill over time.

### Graded due date (gradedDueDate)

When a learner unlocks a graded section (by passing the catch-up gate), the system calculates a due date. Default: 7 days after the gate passes. Trainers can extend this.

Formula: `due = gatePassedAt + (extensionDays ?? 7) * 24 * 60 * 60 * 1000` (milliseconds)

## Walkthrough of the real code

### catchup.ts: Sequential unlock

```ts packages/core/src/catchup.ts
export function catchUpState(input: CatchUpInput): CatchUpState {
  const passMark = input.passMark ?? 6;
  const attendedSet = new Set(input.attended);

  // Find all missed days (days before today that were not attended)
  const missed: string[] = [];
  for (let i = 0; i < input.todayIndex; i++) {
    const dayId = input.dayIds[i];
    if (!attendedSet.has(dayId)) {
      missed.push(dayId);
    }
  }

  // Determine which missed days are unlocked
  // A missed day is unlocked when:
  // 1. Its best score >= pass mark
  // 2. All earlier missed days are unlocked
  const unlockedMissed = new Set<string>();
  for (const missedDayId of missed) {
    const score = input.bestScores[missedDayId] ?? 0;
    if (score >= passMark) {
      // Check if all earlier missed days are unlocked
      const missedIndex = missed.indexOf(missedDayId);
      let allEarlierUnlocked = true;
      for (let i = 0; i < missedIndex; i++) {
        if (!unlockedMissed.has(missed[i])) {
          allEarlierUnlocked = false;
          break;
        }
      }
      if (allEarlierUnlocked) {
        unlockedMissed.add(missedDayId);
      }
    }
  }
```

Key pattern: Loop through missed days in order, unlock each one only if its score passes AND all earlier ones are unlocked.

### mastery.ts: Two recent checks, 24h apart

```ts packages/core/src/mastery.ts
export function masteryMap(checks: readonly MasteryCheck[]): Record<string, 'mastered' | 'not-yet'> {
  // Group checks by skill
  const skillChecks: Record<string, MasteryCheck[]> = {};
  for (const check of checks) {
    if (!skillChecks[check.skill]) {
      skillChecks[check.skill] = [];
    }
    skillChecks[check.skill].push(check);
  }

  // Determine mastery for each skill
  const result: Record<string, 'mastered' | 'not-yet'> = {};
  for (const skill in skillChecks) {
    const skillCheckList = skillChecks[skill];
    // Sort by timestamp, most recent last
    skillCheckList.sort((a, b) => a.at - b.at);

    if (skillCheckList.length < 2) {
      // A skill with only one check is not-yet
      result[skill] = 'not-yet';
    } else {
      // Get the two most recent checks
      const latest = skillCheckList[skillCheckList.length - 1];
      const secondLatest = skillCheckList[skillCheckList.length - 2];

      // Check if both are >= 0.8 and at least 24h apart
      const minScoreOk = latest.score >= 0.8 && secondLatest.score >= 0.8;
      const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
      const timeOk = latest.at - secondLatest.at >= twentyFourHoursInMs;

      if (minScoreOk && timeOk) {
        result[skill] = 'mastered';
      } else {
        result[skill] = 'not-yet';
      }
    }
  }

  return result;
}
```

Key pattern: Sort checks by time, then look at the two most recent. Both must be ≥ 0.8 and ≥ 24 hours apart for mastery.

## Your turn: faulty first

**Scenario 1: The missing-day lock**

A trainer implements catch-up without the sequential unlock rule:

```ts
// Faulty code (wrong)
const unlockedMissed = new Set<string>();
for (const missedDayId of missed) {
  const score = input.bestScores[missedDayId] ?? 0;
  if (score >= passMark) {
    unlockedMissed.add(missedDayId); // No check for earlier days!
  }
}
```

**Predict:** What goes wrong?
**Run it:** A learner misses days 0, 1, 2. They pass day 2's diagnostic before day 0's. With the faulty code, day 2 unlocks immediately.
**Diagnose:** The learner can now skip to day 2's graded material without covering days 0 and 1, potentially missing foundational concepts.
**Fix:** Before unlocking a missed day, check that all earlier missed days in the missed array are already unlocked.

---

**Scenario 2: The mastery lock**

A learner thinks one high score means mastery:

```ts
// Faulty code (wrong)
if (skillCheckList.length >= 1 && skillCheckList[skillCheckList.length - 1].score >= 0.8) {
  result[skill] = 'mastered'; // Only needs one check!
}
```

**Predict:** What goes wrong?
**Run it:** A learner scores 0.95 on a recursion quiz. The faulty code marks recursion as mastered.
**Diagnose:** One high score could be luck, a test-specific strategy, or surface-level understanding. We need evidence of sustained competence over time.
**Fix:** Require two most recent checks, both ≥ 0.8, and ≥ 24 hours apart.

## Technical glossary

- **Catch-up gate:** The unlocking mechanism for missed days, enforcing sequential progress
- **Missed day:** A day before today that a learner did not attend
- **Pass mark:** The minimum diagnostic score (0–8) required to unlock a missed day; default 6
- **Self-study block:** When true, learners cannot access self-study material until all missed days are unlocked
- **Mastery:** Evidence that a learner has demonstrated skill proficiency through recent, spaced checks
- **Check:** A single assessment (quiz, exercise, etc.) that measures a skill; recorded with a score and timestamp
- **Skill:** A named topic or competency (e.g., "testing", "error-handling")
- **24-hour spacing:** The minimum time between two checks for them to count toward mastery, preventing same-day repetition

## Common questions

**Q: Why does the catch-up gate block self-study if only one missed day is locked?**
A: Because missed days block graded work, and learners might try to compensate by doing unrelated self-study. Blocking self-study ensures they focus on catching up. Once all missed days are unlocked, self-study is unblocked.

**Q: What if a learner has a mastered skill, then scores 0.5 on a later check?**
A: The function looks at the two most recent checks. If the latest two are a 0.95 (old, mastered) and a 0.5 (new, low), the function returns 'not-yet' because the second condition (both ≥ 0.8) fails. This is intentional: one weak performance after mastery suggests the skill is slipping.

**Q: Can a learner's due date be extended beyond 7 days?**
A: Yes. `gradedDueDate(gatePassedAt, extensionDays)` accepts an optional `extensionDays` parameter. A trainer can pass 10, 14, 30, etc., to give more time.

**Q: Why is the 24-hour minimum exactly 24 hours, not 12 or 36?**
A: This is a design choice in SPEC §4.4. 24 hours aligns with a typical class rhythm (one day apart in a synchronous cohort) and is long enough to prevent gaming (same day attempts) but short enough to not delay mastery recognition.

## Reinforcement activity

### Part 1: Trace the catch-up gate

You are given:
- Days: `['day-0', 'day-1', 'day-2', 'day-3']`
- Today: day 3
- Attended: `['day-3']` (joined on day 3)
- Scores: `{ 'day-0': 6, 'day-1': 0, 'day-2': 4 }`

**Trace step-by-step:** What is `nextGate`, `unlocked`, and `selfStudyBlocked`?

**Expected result:**
- Missed: `['day-0', 'day-1', 'day-2']`
- Day 0 unlocks (score 6 ≥ 6, no earlier days)
- Day 1 stays locked (score 0 < 6)
- nextGate = 'day-1'
- unlocked = `['day-0', 'day-3']` (day 0 is unlocked, today is always unlocked)
- selfStudyBlocked = true (day 1 and 2 are locked)

### Part 2: Mastery decision

You are given these checks for skill "testing":
- Check 1: score 0.9, at time 1000
- Check 2: score 0.75, at time 2000 (1 hour later)
- Check 3: score 0.85, at time 90000000 (25 hours later)

**Determine:** Is "testing" mastered?

**Expected:** Yes. The two most recent checks are 2 and 3. Score 0.85 ≥ 0.8 (yes), score 0.75 ≥ 0.8 (no). So not mastered because not both ≥ 0.8.

Wait, let me recalculate. We look at the two most recent checks: check 2 (score 0.75) and check 3 (score 0.85). For mastery, both must be ≥ 0.8. 0.75 < 0.8, so not mastered.

## Check yourself

1. **A learner missed days 0, 1, 2 and scored: day-0: 5, day-1: 8, day-2: 7. What is `nextGate`?**
   <details>day-0. Because day-0's score (5) is below the pass mark (6), it stays locked, so it remains the next gate even though day-1 and day-2 have high scores.</details>

2. **Can a skill be marked as "mastered" with only one check?**
   <details>No. The function requires at least two checks. A single check always returns 'not-yet'.</details>

3. **Two checks of 0.8 and 0.8, exactly 24 hours apart. Mastered?**
   <details>Yes. Both scores are ≥ 0.8 (yes), and they are exactly 24 hours apart, which satisfies the ≥ 24 hours condition.</details>

4. **A learner unlocks a gate at time 1000 ms. What is the due date with default extension?**
   <details>`1000 + 7 * 24 * 60 * 60 * 1000 = 1000 + 604800000 = 604801000` ms</details>

5. **What does `selfStudyBlocked: true` mean?**
   <details>At least one missed day is still locked. The learner should focus on catching up before doing elective self-study.</details>

## Quick reference

```ts
// Catch-up gate
const state = catchUpState({
  dayIds: ['day-0', 'day-1', 'day-2'],
  todayIndex: 2,
  attended: ['day-2'],
  bestScores: { 'day-0': 6, 'day-1': 7 },
  passMark: 6, // optional
});
// state.missed = ['day-0', 'day-1']
// state.nextGate = null (both unlocked)
// state.unlocked = ['day-0', 'day-1', 'day-2']
// state.selfStudyBlocked = false

// Mastery map
const map = masteryMap([
  { skill: 'recursion', score: 0.9, at: now },
  { skill: 'recursion', score: 0.85, at: now + 25 * 60 * 60 * 1000 },
]);
// map = { recursion: 'mastered' }

// Graded due date
const due = gradedDueDate(1000, 10); // 10 days instead of 7
```

## Connection to the bigger picture

The catch-up gate and mastery map together enable:
- **Structured catch-up:** Learners don't get stuck; they know exactly what gate to pass next
- **Study group formation (§4.14):** Groups are seeded based on mastery patterns; learners with diverse skill profiles learn from each other
- **Informed trainer feedback:** Trainers see which skills are mastered and which need reteaching
- **Fair deadlines:** Graded work due dates are extended consistently based on when a learner passed their gate

Without these, learners who miss class fall further behind, and trainers can't form effective peer-learning groups.

## Next

Next: [MS 2.4 — Graded Timing and Accommodations](../ms-02.04/lesson.md).
