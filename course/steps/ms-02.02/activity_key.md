---
id: ms-02.02-key
title: Activity Key — Cards and spaced repetition
role: trainer
---

# Activity Key: MS 2.2 — Cards and spaced repetition

**Intended for trainers only.**

## Reinforcement activity: scheduleReview

**Prompt:**
Write a function `scheduleReview(card, ratings, now)` that simulates four consecutive reviews:

```txt
Input: 
  card = newCard('test', Date.now())
  ratings = ['hard', 'good', 'easy', 'easy']
  now = Date.now()

Output: final card state after all four reviews

Constraint: do not import reviewCard; use the FSRS library directly
```

### Expected answer

```ts
import { fsrs, createEmptyCard } from 'ts-fsrs';

function ratingToGrade(rating) {
  const map = { 'again': 1, 'hard': 2, 'good': 3, 'easy': 4 };
  return map[rating];
}

export function scheduleReview(card, ratings, now) {
  const f = fsrs();
  let fsrsCard = {
    ...card,
    due: new Date(card.due),
  };

  for (const rating of ratings) {
    const grade = ratingToGrade(rating);
    const recordLogItem = f.next(fsrsCard, new Date(now), grade);
    fsrsCard = recordLogItem.card;
  }

  return {
    ...fsrsCard,
    due: fsrsCard.due.getTime(),
  };
}
```

### Scoring rubric

| Criterion | 0 | 1 | 2 |
|-----------|---|---|---|
| **Loops through ratings** | Does not loop; processes only one rating. | Loops but with incorrect index or control. | Correctly iterates through all four ratings. |
| **Calls fsrs().next()** | Does not call next() or calls with wrong arguments. | Calls next() but omits Date conversion or rating mapping. | Correctly calls f.next() with (card, date, grade). |
| **Updates fsrsCard on each iteration** | Does not update state between iterations. | Updates state but loses intermediate changes. | Assigns result.card back to fsrsCard after each iteration. |
| **Converts due back to milliseconds** | Returns Date object due field. | Attempts conversion but with wrong method (e.g., valueOf()). | Uses .getTime() to convert Date to milliseconds. |
| **Returns correct structure** | Returns primitive or missing fields. | Returns partial Card structure. | Returns Card with id, due, reps, and FSRS fields. |

**Full marks:** 10/10 — passes all criteria.

**Partial credit guidance:**
- If only 2 ratings are processed: 5/10.
- If FSRS library is not used (e.g., hard-coded intervals): 2/10.
- If due is converted but the rest of the structure is wrong: 4/10.

## Misconceptions and likely errors

### Error 1: Not updating state between iterations

**Student code:**
```ts
const f = fsrs();
const recordLogItem = f.next(fsrsCard, now, grade);  // First rating
f.next(fsrsCard, now, grade);  // Second rating uses original card
```

**Problem:** Each `next()` returns a new card state. If you don't assign it back, the second iteration still uses the original card. The reps don't increase, and the due date doesn't change.

**Correction:** Always assign `fsrsCard = recordLogItem.card` before the next iteration.

### Error 2: Forgetting the Date conversion

**Student code:**
```ts
const recordLogItem = f.next(fsrsCard, now, grade);  // now is a number, not Date
```

**Problem:** ts-fsrs expects a Date object. If you pass a number, the method errors or returns undefined.

**Correction:** Convert with `new Date(now)` at the call site.

### Error 3: Wrong return type

**Student code:**
```ts
return recordLogItem.card;  // Returns ts-fsrs card with Date due
```

**Problem:** The spec requires a Card with millisecond due. If you return the raw ts-fsrs card, the due field is a Date object, breaking downstream code that expects a number.

**Correction:** Convert due back with `.getTime()` before returning.

### Error 4: Not using the library

**Student code:**
```ts
function scheduleReview(card, ratings, now) {
  let result = { ...card };
  for (const rating of ratings) {
    if (rating === 'easy') result.due += 2592000000;  // Hard-coded 30 days
    else if (rating === 'good') result.due += 604800000;  // Hard-coded 7 days
    result.reps++;
  }
  return result;
}
```

**Problem:** The spec says "use the FSRS library directly." Hard-coded intervals ignore difficulty, stability, and the algorithm's tuning.

**Correction:** Use `fsrs().next()` to compute intervals based on the algorithm.

## Check yourself (trainer notes)

**Q: If a learner gives four 'easy' ratings in a row, what happens to the card's stability?**

**A (trainer context):** Stability increases exponentially with each successful (easy) rating. The FSRS library models this with a power law: longer-than-expected intervals reward consistent success. After four 'easy' ratings, the next interval would be months or longer. (Exact value depends on the card's difficulty and the algorithm's parameters, which are internal to ts-fsrs.)

**Q: Why is the loop necessary instead of just calling next() four times in sequence?**

**A (trainer context):** Each call to `next()` reads the card's current state (stability, difficulty, reps) and returns a new state. If you don't loop and assign the new state back, you're re-using the same old state four times, so it's like applying only one rating. The loop ensures each rating updates the state for the next iteration.

**Q: If a student mistakenly uses the same fsrs() instance for all iterations vs. creating a new one each iteration, does it matter?**

**A (trainer context):** No, it doesn't matter much for this task. The `fsrs()` function is a factory that returns a stateless scheduler. Reusing the same instance is fine because the state is in the card, not in the fsrs object. Some students create a new one per iteration (inefficient but correct); others reuse (more efficient). Both work.

## Connection to the main step

The `scheduleReview` exercise mirrors `reviewCard` in the implementation, but asks students to loop and apply multiple ratings. This tests their understanding of:
1. State updates (the card changes after each rating).
2. Type conversions (Date ↔ milliseconds).
3. Library usage (the FSRS algorithm is a black box; you don't tune it).

It also previews a pattern learners will use in later modules: querying recent reviews to decide if a learner is ready for the next checkpoint.

