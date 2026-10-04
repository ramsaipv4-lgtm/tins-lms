# Say/Do script — Catch-up gate and mastery map

**Total runtime: 45 minutes**

---

## Introduction (0:00 — 0:05) [5 min]

**Say:**
"Today we're solving two problems that happen every time a class meets synchronously: (1) some learners miss days and need to catch up, and (2) we need to understand which skills each learner has truly mastered, so we can form study groups strategically. We'll implement the catch-up gate (which unlocks missed days in order) and the mastery map (which identifies skills where learners have demonstrated real proficiency)."

**Do:**
- Show the lesson's Detective question on screen
- Highlight the two SPEC requirements:
  - SPEC §4.3: catch-up gate with sequential unlock
  - SPEC §4.4: mastery map with two checks ≥ 0.8, ≥ 24 hours apart
- Show an example: "A learner missed days 0, 1, 2. They pass day 2's diagnostic first. What happens? (Answer: day 2 stays locked because day 0 isn't unlocked yet.)"

---

## Part 1: Catch-up gate (0:05 — 0:25) [20 min]

**Say:**
"The catch-up gate does three things: (1) identifies which days are missed, (2) unlocks them in order when diagnostic scores pass a threshold, and (3) tells us whether self-study is blocked. Let's start with the core logic."

**Do:**
- Open the `catchUpState` function in the Walkthrough section
- Explain the four steps:
  1. Find missed days (days before today that weren't attended)
  2. Try to unlock each missed day in order
  3. A day unlocks if its score ≥ pass mark AND all earlier missed days are already unlocked
  4. Return the state: which days are unlocked, what's the next gate, is self-study blocked

**Say:**
"Notice the sequential unlock rule (the inner loop at line XX). This ensures a learner who missed day 0, 1, 2 can't skip to day 2 even if they ace day 2's diagnostic. They have to unlock them in order: 0, then 1, then 2. Why? Because the foundational concepts might be in day 0."

**Do:**
- Live-code or show a test case:
  ```ts
  const result = catchUpState({
    dayIds: ['day-0', 'day-1', 'day-2', 'day-3'],
    todayIndex: 3,
    attended: ['day-3'],
    bestScores: { 'day-0': 6, 'day-1': 0, 'day-2': 0 },
    passMark: 6,
  });
  // result.nextGate = 'day-1' (day-0 is unlocked, but day-1 is not)
  // result.selfStudyBlocked = true (day-1 and day-2 are locked)
  ```
- Run the test: `node --test packages/core/test/catchup.test.mjs`
- Show all tests pass

**Ask the learner:**
"What would happen if we removed the sequential unlock check and allowed any day to unlock independently?"
(Expected: A learner could skip ahead, missing foundational content.)

---

## Part 2: Mastery map (0:25 — 0:40) [15 min]

**Say:**
"Now, for study groups to work, we need to know which skills each learner has truly mastered. Not 'kind of understands' or 'got lucky on a quiz', but really knows. We use a simple rule: a skill is mastered when a learner has two recent checks, both scoring ≥ 0.8, at least 24 hours apart."

**Do:**
- Open the `masteryMap` function
- Explain the logic:
  1. Group checks by skill
  2. For each skill, sort checks by time
  3. If fewer than 2 checks, it's 'not-yet'
  4. If 2+ checks, look at the two most recent ones
  5. Both must be ≥ 0.8 AND ≥ 24 hours apart for 'mastered'

**Say:**
"Why 24 hours? One check can be luck or review. But two checks a day apart? That suggests the learner has internalized the skill over time. It's evidence of real competence, not one-time guessing."

**Do:**
- Show a test case live:
  ```ts
  const map = masteryMap([
    { skill: 'recursion', score: 0.8, at: 1000 },
    { skill: 'recursion', score: 0.9, at: 1000 + 25 * 60 * 60 * 1000 }, // 25 hours later
  ]);
  // map = { recursion: 'mastered' }
  ```
- Run the test: `node --test packages/core/test/mastery.test.mjs`
- Show all tests pass

**Ask the learner:**
"A learner scores 0.95 on a recursion quiz, then doesn't take another check for 3 months. Do they have mastery? Why or why not?"
(Expected: No, because we need recent checks. Three months later, they might have forgotten. The function looks at the two most recent checks; if one of them is very recent and the other old, the old one doesn't count anymore—no wait, the function looks at the two most recent. If the most recent is 0.95 and the second-most-recent is from 3 months ago, it still needs to be 24h apart. But if there's only one check in 3 months, the function returns 'not-yet'. This is a good teaching moment.)

---

## Part 3: Graded due date (0:40 — 0:45) [5 min]

**Say:**
"Once a learner passes their catch-up gate, they can access graded material. But when is it due? The system gives them 7 days by default, or a custom extension if the trainer wants to be generous."

**Do:**
- Show the `gradedDueDate` function
- Explain: takes the gate-pass time and adds days (default 7, or a custom value)
- Formula: `gatePassedAt + days * 24 * 60 * 60 * 1000`
- Note: result is in milliseconds, which is what the system uses throughout

**Say:**
"This is straightforward, but important: it ensures every learner has a consistent amount of time after they unlock graded material."

---

## Closing (0:45)

**Say:**
"Today you learned how Coach LMS manages catch-up for learners who miss class, and how it tracks mastery to form study groups. Both are essential for a fair, personalized learning experience. Questions?"

**Do:**
- Invite learner discussion
- Mention the next steps: study group formation using mastery maps, appeals if a learner disagrees with a score, etc.
