---
id: ms-02.02-prep
title: Trainer Prep — Cards and spaced repetition
role: trainer
---

# Trainer Prep: MS 2.2 — Cards and spaced repetition

**Self-study guide for trainers. Estimated time: 45 minutes.**

## Prerequisites you must know

Before teaching this step, ensure you understand:

1. **Seeded randomness (ms-02.01):** Why time and randomness are parameters, not global state.
   - Check: Can you explain why `newCard()` takes `now` as a parameter instead of calling `Date.now()` inside?
   - Read: SPEC §3.1 on pure functions if unclear.

2. **The FSRS algorithm (conceptually):** Stability, difficulty, forgetting curves.
   - Check: Can you explain what "stability = 20 days" means? (Recall probability = 90% at that interval.)
   - Read: ts-fsrs library README (https://github.com/open-spaced-repetition/ts-fsrs) for the 5.4.2 version.

3. **TypeScript basics:** Generics, interfaces, type conversion.
   - Check: Can you read the Card interface and explain each field?
   - Read: TypeScript handbook on interfaces if unclear.

## The 45-minute self-study path

### Minutes 1–10: Read the lesson

Read the lesson's "Problem and choice" section and "Conceptual understanding." Focus on:
- The four ratings and their interval ordering (again < hard < good < easy).
- Why spreading matters (don't overwhelm learners with 200 cards on one day).
- The role of each function: newCard, reviewCard, dueCards, spreadBacklog.

**Check:** Can you draw a timeline showing when a card is due after receiving ratings 'again', 'hard', 'good', 'easy' from the same starting point?

### Minutes 11–20: Dive into the code

Read `packages/core/src/cards.ts` top to bottom. For each function:

1. **ratingToGrade():** Why do these numbers (1, 2, 3, 4) map to the strings? (Answer: ts-fsrs's Grade enum.)
2. **fsrsToCard():** Why convert Date to milliseconds? (Answer: LMS uses millisecond timestamps everywhere; Date is ts-fsrs's convention.)
3. **newCard():** Why is due=now? (Answer: New cards are shown immediately, not deferred.)
4. **reviewCard():** Trace one example: a card with reps=2, reviewed with 'good'. What changes? (Answer: reps becomes 3, due becomes several days later, stability increases.)
5. **dueCards():** Why return copies? (Answer: The input is readonly; mutation would be a side effect.)
6. **spreadBacklog():** Trace the overflow logic. What happens with 50 cards, 3 days, maxPerDay=15? (Answer: Days 0–1 get 15 each, day 2 gets 20.)

**Check:** Can you explain why `.map((c) => ({ ...c }))` creates a shallow copy? (Spread creates a new object with the same field references.)

### Minutes 21–30: Run the tests

Open a terminal and run:

```bash
cd /home/user/tins-lms.worktrees/b2-2
node --test packages/core/test/cards.test.mjs
```

You should see 11 tests pass. Read each test and match it to the function it tests:

- **AC-3 tests:** Verify rating order and reps increment.
  - `reviewCard ratings affect due date and reps`
  - `each rating increases reps independently`
  
- **AC-4 tests:** Verify dueCards filters and sorts, and doesn't mutate.
  - `dueCards returns only cards with due <= now`
  - `dueCards returns cards oldest first`
  - `dueCards does not mutate input`
  
- **AC-5 tests:** Verify spreadBacklog spreads fairly and respects limits.
  - `spreadBacklog assigns every id exactly once`
  - `spreadBacklog respects maxPerDay limit`
  - `spreadBacklog puts overflow on last day`
  - `spreadBacklog keeps input order`
  - `spreadBacklog with default parameters`

**Check:** Can you explain what each test is asserting? Pick one (e.g., `dueCards returns cards oldest first`) and describe the test in your own words.

### Minutes 31–40: Worked examples

Walk through these scenarios on paper:

**Scenario 1: A learner reviews a new card**

```txt
Given: card = newCard('q1', 1696412400000)
       rating = 'good'
       now = 1696412400000

Compute: result = reviewCard(card, 'good', now)

Expected:
- result.reps = 1 (increased from 0)
- result.due > now + 604800000 (more than 7 days, but exact value depends on FSRS)
- result.id = 'q1' (unchanged)
- result.stability and result.difficulty have changed (opaque FSRS state)
```

**Scenario 2: Spreading overdue cards**

```txt
Given: cardIds = ['a', 'b', 'c', 'd', 'e']
       startDay = 10
       days = 3
       maxPerDay = 2

Compute: result = spreadBacklog(cardIds, 10, 3, 2)

Expected:
result[10] = ['a', 'b']
result[11] = ['c', 'd']
result[12] = ['e']  // Overflow on last day
```

**Scenario 3: Filtering due cards**

```txt
Given: now = 1000
       cards = [
         { id: 'x', due: 500, reps: 1, ... },   // due in past
         { id: 'y', due: 1500, reps: 0, ... },  // due in future
         { id: 'z', due: 200, reps: 2, ... }    // due in past, oldest
       ]

Compute: due = dueCards(cards, 1000)

Expected:
due = [
  { id: 'z', due: 200, ... },  // oldest first
  { id: 'x', due: 500, ... }
]
// 'y' is not included (due > now)
```

**Check:** Can you construct a scenario where spreadBacklog's overflow logic matters (i.e., the last day has > maxPerDay cards)?

### Minutes 41–45: Anticipate learner questions

Read the "Common questions" section in the lesson. For each question, make sure you can explain the answer:

1. **"Why is a new card due at now instead of later?"** (New cards show immediately to establish a baseline.)
2. **"What if spreadBacklog gets an empty array?"** (Returns a Record with all empty days.)
3. **"Can a card be due far in the past?"** (Yes; spreadBacklog handles this by spreading forward.)
4. **"Does spreadBacklog shuffle cards?"** (No; it preserves input order, so priority cards appear first.)

**Mastery check:** Answer these without looking at the lesson:
1. Explain the four ratings and their interval ordering.
2. Why does newCard take `now` as a parameter?
3. What does it mean for a card to have stability=30?
4. If 200 overdue cards are spread across 7 days with maxPerDay=30, how are they distributed? (Days 0–5: 30 each; day 6: 20.)

If you're unsure about any of these, re-read the relevant section and run a test to confirm your understanding.

## Top misconceptions

### Misconception 1: "The FSRS algorithm is a black box; I don't need to understand it."

**Reality:** You don't need to understand the math, but you should know conceptually:
- Stability = the interval at 90% recall probability.
- Difficulty = how hard the card is (higher = shorter intervals).
- Ratings adjust both: 'easy' increases both, 'again' decreases stability and might increase difficulty.

**Why it matters:** Trainers who can't explain these to learners can't help when learners ask, "Why is this card due in 3 weeks instead of 2?"

### Misconception 2: "Reps is a measure of mastery."

**Reality:** Reps is just a count of reviews, not a quality measure. A card with reps=10 and rating='again' 10 times has high reps but is not mastered.

**Why it matters:** Learners might think "I've done 10 reps, I should pass the checkpoint," but the algorithm cares about *recent* performance, not count.

### Misconception 3: "dueCards modifies the input array."

**Reality:** dueCards filters and sorts, returning *copies*. The input is untouched.

**Why it matters:** If a trainer tells a learner "reviewing a card will change the list of due cards," they're technically right, but the implementation doesn't modify the array in-place. This is important for state management in larger systems.

### Misconception 4: "spreadBacklog schedules cards by due date."

**Reality:** spreadBacklog takes raw card *IDs*, not Card objects with due dates. It distributes them across days by assignment order, not by their existing due dates.

**Why it matters:** Learners might assume "spreadBacklog sorts overdue cards by how overdue they are." It doesn't—it just spreads them evenly. (That's by design: learners should review in the order given, assuming they're already prioritized by whoever created the list.)

## Likely student questions and answers

### Q: "If I have two cards, one due in 2 weeks and one due in 2 days, does spreadBacklog put them on different days?"

**A:** No. spreadBacklog doesn't look at due dates. It takes a list of card IDs and assigns them to days in order. You might have called it already to schedule the reviews; spreadBacklog just distributes *new* overdue cards.

### Q: "Why do we need four ratings? Why not just 'correct' and 'incorrect'?"

**A:** The FSRS algorithm models *degree* of difficulty. Saying "I forgot it" is different from "I barely remembered it." The ratings let the algorithm distinguish, so it can adjust intervals more finely.

### Q: "If a card has stability=100 days, can it ever be due sooner?"

**A:** Yes, if you rate it 'again'. The rating recalculates stability (downward) based on the failed recall. A failed review can reset a stable card to due within 24 hours.

### Q: "Does dueCards guarantee oldest-first, or is it just a side effect?"

**A:** It's a guarantee. The code explicitly sorts by `a.due - b.due`. This is important for user experience: learners should review the longest-overdue cards first.

### Q: "In spreadBacklog, does the overflow matter for correctness, or just user experience?"

**A:** Both. Without overflow, extra cards would be lost (not assigned to any day). With overflow, all cards are scheduled. User experience is also improved because learners know when the backlog ends.

## Connection to the bigger picture

This step is part of **Module 2: Scheduling and retention**. The progression is:

1. **ms-02.01 (Seeded randomness):** Time and randomness are parameters.
2. **ms-02.02 (Cards and FSRS, this step):** Track individual card states and spread overdue cards.
3. **ms-02.03 (Catch-up gate):** Use due dates to block learners from self-study until they clear catch-up material.
4. **ms-02.04 (Progress export):** Serialize card state so learners can resume on a different device.

Understanding spaced repetition here enables the gate logic in the next step: if a learner has 50 overdue cards, the gate shows them 10/day and doesn't let them move forward until the backlog is under a threshold.

## Your turn: teach one segment to a peer

Pick one of these and prepare to explain it to a colleague in 5 minutes:

- The four ratings and their interval ordering, with an example.
- Why spreadBacklog puts overflow on the last day.
- Why dueCards returns copies instead of the originals.

Explain it without reading the lesson or code. If you get stuck, that's a signal to re-read.

