# Trainer prep — Catch-up gate and mastery map

## Before you start (prerequisites)

Learners should be familiar with:
- **Arrays and sorting:** can read `array.sort((a, b) => ...)` and understand basic loop logic
- **Time in milliseconds:** know that JavaScript time is in milliseconds since epoch, and can do unit conversions (hours to ms)
- **Set operations:** understand what a Set is and how `.has()` and `.add()` work
- **TypeScript types:** can read `Record<string, number>` and understand generics

If any learner is new to Sets in JavaScript, spend 5 minutes on the difference between arrays and Sets (faster lookup with `.has()`) before diving into the gate logic.

---

## 40-minute self-study path

### 1. Read the lesson (15 minutes)

- **Conceptual understanding** section: focus on the three concepts (catch-up gate, mastery map, graded due date)
- **Walkthrough of the real code** section: read the gate unlocking logic and the mastery scoring logic
- **Technical glossary** section: note terms like "sequential unlock", "24-hour spacing", "pass mark"

### 2. Run the tests (10 minutes)

```bash
npm test -- packages/core/test/catchup.test.mjs
npm test -- packages/core/test/mastery.test.mjs
```

Watch all 15 tests pass. Look at the test file to understand:
- How `catchUpState` is called and what it returns
- How `masteryMap` is called and what it returns
- The boundary cases (exactly 24 hours, exactly 0.8 score)

### 3. Trace one code path (10 minutes)

**Catch-up gate scenario:** A learner joined on day 3 (missed 0, 1, 2). They score 6 on day 0, 0 on day 1, 0 on day 2. Trace:
- Which days are missed? (0, 1, 2)
- Which days are unlocked? (0, 3)
- What is nextGate? (1)
- Is selfStudyBlocked? (yes)

**Mastery scenario:** Skill "testing" has checks with scores [0.8, 0.75, 0.85] at times [t, t+1h, t+25h].
- What are the two most recent? (0.75, 0.85)
- Both ≥ 0.8? (no, 0.75 < 0.8)
- Result? ('not-yet')

### 4. Set up your examples (5 minutes)

- Open the instructor script (say/do outline)
- Prepare to show the catchUpState function and a test case live
- Prepare the mastery map examples (one check, two checks too close, two checks far apart)
- Prepare the gradedDueDate formula and an example calculation

---

## Worked example → faded example

### Worked Example 1: Sequential unlock in action

**Full version (trainer explains every step):**

```ts
// Scenario: Learner joined on day 3, missed days 0, 1, 2
const dayIds = ['day-0', 'day-1', 'day-2', 'day-3'];
const todayIndex = 3;
const attended = ['day-3'];

// Learner's diagnostic scores:
// day-0: 7 (passes with mark 6)
// day-1: 5 (fails)
// day-2: 8 (passes, but day-1 is locked so day-2 can't unlock)

const result = catchUpState({
  dayIds,
  todayIndex,
  attended,
  bestScores: { 'day-0': 7, 'day-1': 5, 'day-2': 8 },
});

console.log('Missed days:', result.missed); // ['day-0', 'day-1', 'day-2']
console.log('Next gate:', result.nextGate); // 'day-1'
console.log('Unlocked:', result.unlocked); // ['day-0', 'day-3']
console.log('Self-study blocked?', result.selfStudyBlocked); // true

// Explanation:
// - Day 0 unlocks because score 7 ≥ 6 and there are no earlier days
// - Day 1 stays locked because score 5 < 6
// - Day 2 would stay locked anyway because day 1 isn't unlocked
// - Self-study is blocked because day 1 and 2 are still locked
```

**Learner questions at each step:**
- "Why does day 2 stay locked even though the score is 8?"
- "What if the learner retakes day 1's diagnostic and scores 7? What changes?"
- "When does self-study become unblocked?"

**Faded version (learner fills in blanks):**

```ts
const dayIds = ['day-0', 'day-1', 'day-2', 'day-3'];
const todayIndex = 3;
const attended = ['day-3'];
const bestScores = { 'day-0': 7, 'day-1': 5, 'day-2': 8 };

const result = catchUpState({
  dayIds,
  todayIndex,
  attended,
  bestScores,
  // TODO: pass a custom pass mark of 7 instead of 6
  ________,
});

console.log('Next gate:', result.nextGate); // Expected: 'day-1' (still fails with mark 7)
console.log('Unlocked:', result.unlocked); // Expected: ??? (what changes if mark = 7?)
```

**Learner success:** Can fill in the blank, run the code, and explain why the results changed.

---

### Worked Example 2: Mastery with borderline checks

**Full version (trainer explains the conditions):**

```ts
const now = 1000;

// Scenario: Skill "recursion" with three checks
const checks = [
  { skill: 'recursion', score: 0.85, at: now },
  { skill: 'recursion', score: 0.79, at: now + 25 * 60 * 60 * 1000 }, // 25 hours later
  { skill: 'recursion', score: 0.81, at: now + 50 * 60 * 60 * 1000 }, // 50 hours later
];

const map = masteryMap(checks);

console.log('Recursion status:', map['recursion']); // 'not-yet'

// Why 'not-yet'?
// - Two most recent checks: 0.79 (at 25h) and 0.81 (at 50h)
// - Both ≥ 0.8? 0.79 < 0.8 (no, fails)
// - Result: 'not-yet'

// What if the middle check were 0.80?
const checks2 = [
  { skill: 'recursion', score: 0.85, at: now },
  { skill: 'recursion', score: 0.80, at: now + 25 * 60 * 60 * 1000 }, // exactly 0.80
  { skill: 'recursion', score: 0.81, at: now + 50 * 60 * 60 * 1000 },
];

const map2 = masteryMap(checks2);
console.log('Recursion status (with 0.80):', map2['recursion']); // 'mastered'
// Because 0.80 ≥ 0.8 (yes) and 0.81 ≥ 0.8 (yes)
```

**Learner questions:**
- "Why does 0.79 prevent mastery? It's so close to 0.80."
- "What if the checks were at 0.8 and 0.8, exactly 24 hours apart. Mastered?"
- "Could a learner regain mastery after losing it?"

**Faded version:**

```ts
const now = 1000;

// Fill in the checks array so that "testing" is mastered:
const checks = [
  { skill: 'testing', score: ____, at: now },
  { skill: 'testing', score: ____, at: now + 24 * 60 * 60 * 1000 },
];

const map = masteryMap(checks);
assert.equal(map['testing'], 'mastered');
```

**Learner success:** Can fill in scores that satisfy both conditions (both ≥ 0.8, 24h apart).

---

## Top misconceptions

### Misconception 1: "The sequential unlock rule is too strict; why not let learners skip ahead?"

**What learners think:** If a learner can ace day 2's diagnostic, they should be allowed to proceed, even if day 0 and 1 are locked.

**Reality:** The gate enforces order because foundational concepts might be in day 0. Allowing skipping could leave gaps in understanding.

**How to address it:** Use a concrete example: "Day 0 is about variables, day 1 is about functions, day 2 is about closures. Closures build on functions, which build on variables. Skipping days breaks the chain."

### Misconception 2: "Mastery should be based on a single high score."

**What learners think:** Scoring 0.95 on a test should immediately mark a skill as mastered.

**Reality:** One check can be luck, teaching to the test, or memorization without understanding. Two checks 24+ hours apart demonstrate sustained competence.

**How to address it:** Use the "study and forget" example: "You cramped the night before a test and scored 0.95. Two weeks later, you take another quiz and score 0.6. Did you truly master the skill? The system says no—that's why it waits for two recent checks."

### Misconception 3: "The 24-hour minimum is arbitrary; 12 hours should be enough."

**What learners think:** A learner could take two checks within a few hours and prove mastery quickly.

**Reality:** 24 hours aligns with a daily class rhythm and requires a learner to leave and come back, suggesting the knowledge stuck overnight (more robust than same-day practice).

**How to address it:** Explain the pedagogy: "Two checks on the same day might both be copying the same study notes or using the same mental trick. Checks 24 hours apart suggest the learner retained the concept."

### Misconception 4: "If selfStudyBlocked is true, the learner can't learn anything."

**What learners think:** Blocking self-study is punitive and prevents learning.

**Reality:** Self-study is elective material. The gate is about graded material. While a learner is behind, we prioritize catch-up over optional self-study to keep them focused.

**How to address it:** Clarify: "Self-study is 'learn at your own pace' material. The gate gates the graded pathway. We're saying 'first, catch up to the class, then explore at your own pace.'"

---

## Questions trainers often ask

### "What if a learner retakes day 1's diagnostic? Does it replace the old score?"

**Answer:** The function uses `bestScores`, which is a snapshot of the learner's best score per day. If they retake and score higher, the system updates that field before calling `catchUpState`. The function doesn't do the update; it just reads the best scores.

### "Can a learner's self-study become unblocked mid-class, or does it stay blocked until the end of the day?"

**Answer:** The function returns a single snapshot state. In a real app, `selfStudyBlocked` would be recalculated every time the learner's diagnostic scores change or time passes. Trainers could see it update in real-time as learners pass gates.

### "How do I set a custom pass mark of 7 instead of 6?"

**Answer:** Pass `passMark: 7` in the input. The function defaults to 6 if not provided. Trainers can set different pass marks per class in the UI.

### "Is the 24-hour gap enforced strictly, or is it '24 hours, rounded'?"

**Answer:** It's strict: `latest.at - secondLatest.at >= twentyFourHoursInMs`. So exactly 24 hours (0 ms extra) is mastered. 23 hours 59 minutes 59 seconds is not-yet.

### "What happens if I call masteryMap with an empty array?"

**Answer:** It returns an empty object `{}`. No checks → no skills in the result (neither mastered nor not-yet).

### "Can a skill go from 'mastered' back to 'not-yet'?"

**Answer:** Yes, if the learner's two most recent checks don't both meet the threshold. For example, after achieving mastery with [0.9, 0.9], a later check of 0.5 becomes one of the two most recent, breaking the mastery condition.

---

## Your mastery check (private)

Before teaching, verify you can answer these without looking at the code:

1. **Catch-up gate:** A learner missed days 0, 1, 2. Scores: day-0: 8, day-1: 4, day-2: 9. What is nextGate?
   - Answer: 'day-1' (day-0 unlocks, but day-1 fails with mark 6, blocking day-2)

2. **Mastery:** Two checks of 0.8 and 0.85, exactly 24 hours apart. Mastered?
   - Answer: Yes (both ≥ 0.8, time gap is exactly 24 hours, which satisfies ≥)

3. **Self-study block:** When is selfStudyBlocked false?
   - Answer: When all missed days are either unlocked or there are no missed days at all

4. **Graded due date:** A gate passes at time 5000. Default extension. Due date?
   - Answer: 5000 + 604800000 = 604805000 ms

5. **Boundary case:** What's the minimum score for the second most recent check to enable mastery?
   - Answer: 0.8 exactly (the condition is `>= 0.8`)

If you struggled with any of these, re-read the lesson and run the tests again before teaching.
