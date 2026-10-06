---
id: ms-02.02
title: Cards and spaced repetition (ts-fsrs)
module: 2
est_minutes: 50
prereqs: [ms-02.01]
objectives: 3
new_terms: 5
skills: [spaced-repetition, fsrs-algorithm, card-scheduling]
source_refs: [{ path: packages/core/src/cards.ts, commit: 639065e }]
next: ms-02.03
---

# MS 2.2 — Cards and spaced repetition (ts-fsrs)
*Step 3 of 41*

## Prerequisites

You already understand:
- Seeded randomness (ms-02.01): why time and randomness are arguments, not global state
- Flashcard basics: front (question) and back (answer)
- Spaced repetition concept: review intervals grow after successful recalls

## You already understand this

- The FSRS algorithm: stability (interval when recall probability = 90%), difficulty (card hardness), and how ratings (again/hard/good/easy) adjust both
- That converting between formats (Date objects ↔ millisecond timestamps) must happen at module boundaries
- The difference between mutating input and returning new arrays

## The detective question

**Problem:** Coach LMS learners study thousands of flashcards across weeks. Showing all cards at once overwhelms; showing none makes them forget. We need to:
1. Track each card's due date and review count via the FSRS algorithm
2. Filter which cards are due today (due ≤ now)
3. Spread overdue cards across the next week so learners pace their reviews

**Options considered:**
1. Implement FSRS from scratch — too complex; the algorithm has 20 tuned parameters
2. Use ts-fsrs library (SPEC D-3) and wrap it for LMS's time representation
3. Hard-code a simple "show every 3 days" schedule — ignores difficulty and performance

**Choice:** Option 2 — ts-fsrs 5.4.2 library with a wrapper layer that:
- Converts our Card type (string id, millisecond timestamps) to/from ts-fsrs format (Date objects)
- Maps rating strings to ts-fsrs Grade enum values
- Implements spreadBacklog to distribute cards evenly across days

**Why:** This approach:
- **Uses proven algorithms:** FSRS 5 is battle-tested in Anki and other spaced repetition apps
- **Stays pure:** no clock reads or randomness in core; time is a parameter
- **Handles the hard case:** genuinely overdue cards get spread across days with overflow protection
- **Maintains type consistency:** LMS uses millisecond timestamps everywhere (SPEC §2)

## Learning objectives

After this step, you will understand:
1. How FSRS card state tracks stability, difficulty, and review count
2. How the four ratings (again/hard/good/easy) produce different intervals
3. How spreadBacklog schedules overdue cards fairly across days

## Conceptual understanding

### What is a card?

A card in Coach LMS is a flashcard with:
- `id`: unique string identifier
- `due`: milliseconds since epoch when the card is next due for review
- `reps`: number of times reviewed (starts at 0)
- **FSRS fields:** stability, difficulty, state, lapses — opaque internal state that drives scheduling

The FSRS library maintains stability and difficulty. Our job is to (1) wrap the library's Date-based API, and (2) implement the scheduling layer above it.

Example card structure:
```json
{
  "id": "card-xyz",
  "due": 1696412400000,
  "reps": 3,
  "stability": 45.2,
  "difficulty": 6.1,
  "state": 2,
  "scheduled_days": 21,
  "learning_steps": 0,
  "lapses": 1
}
```

### The four ratings and their effect

When a learner reviews a card, they give it a **rating**:
- `'again'`: "I forgot it" → due within 24 hours
- `'hard'`: "I struggled" → due in a few days
- `'good'`: "I knew it" → due in weeks
- `'easy'`: "Too easy" → due in months

Each rating updates the card's stability (longer interval) and difficulty (how much the interval should grow next time). The ordering is strict: `again` due < `hard` due < `good` due < `easy` due.

### Spreading backlog across days

Imagine a learner misses a week. They have 200 overdue cards. Showing all 200 today causes burnout; showing 0 lets them forget more. **spreadBacklog** distributes them:

```js
cardIds = [c1, c2, ..., c200]
result = spreadBacklog(cardIds, day=7, days=7, maxPerDay=30)
// result[7] = [c1, ..., c30]
// result[8] = [c31, ..., c60]
// ...
// result[13] = [c181, ..., c200]  // last day has overflow
```

Rules:
1. Assign each id exactly once
2. Respect maxPerDay within the time window
3. Keep input order (maintains priority)
4. Put overflow on the last day
5. Use sensible defaults: 7 days, 30 cards/day

## Walkthrough of the real code

### newCard: create a blank card

```ts packages/core/src/cards.ts
// Create a new card
export function newCard(id: string, now: number): Card {
  const f = fsrs();
  const fsrsCard = createEmptyCard(new Date(now));
  return fsrsToCard(fsrsCard, id);
}
```

Each new card starts with due=now (show immediately), reps=0, and FSRS defaults (stability and difficulty for a brand-new item).

### reviewCard: apply a rating

```ts packages/core/src/cards.ts
export function reviewCard(card: Card, rating: Rating, now: number): Card {
  const f = fsrs();

  // Convert our Card back to FSRS format
  const fsrsCard: FSRSCard = {
    ...card,
    due: new Date(card.due), // Convert milliseconds back to Date
  };

  const grade = ratingToGrade(rating);
  const recordLogItem = f.next(fsrsCard, new Date(now), grade);

  return fsrsToCard(recordLogItem.card, card.id);
}
```

The rating is converted to a Grade (1–4). ts-fsrs.next() updates the card and returns the new state. Reps increases by 1 automatically.

### dueCards: filter without mutation

```ts packages/core/src/cards.ts
// Get cards that are due (due <= now), sorted oldest first
export function dueCards(cards: readonly Card[], now: number): Card[] {
  return cards
    .filter((card) => card.due <= now)
    .sort((a, b) => a.due - b.due)
    .map((card) => ({ ...card })); // Return copies to avoid mutation
}
```

The `.map((card) => ({ ...card }))` creates shallow copies so mutation of the returned array doesn't affect the input.

### spreadBacklog: distribute cards

```ts packages/core/src/cards.ts
// Spread cards across days: assigns each card to a specific day
// Returns a mapping of day index to array of card IDs
export function spreadBacklog(
  cardIds: readonly string[],
  startDay: number,
  days: number = 7,
  maxPerDay: number = 30
): Record<number, string[]> {
  const result: Record<number, string[]> = {};

  // Initialize all days with empty arrays
  for (let i = 0; i < days; i++) {
    result[startDay + i] = [];
  }

  let cardIndex = 0;

  // Assign cards to days
  for (let dayOffset = 0; dayOffset < days && cardIndex < cardIds.length; dayOffset++) {
    const dayIndex = startDay + dayOffset;
    const cardsForThisDay: string[] = [];

    // Add cards to this day up to maxPerDay
    while (cardsForThisDay.length < maxPerDay && cardIndex < cardIds.length) {
      cardsForThisDay.push(cardIds[cardIndex]);
      cardIndex++;
    }

    result[dayIndex] = cardsForThisDay;
  }

  // If there are remaining cards, put them all on the last day
  if (cardIndex < cardIds.length) {
    const lastDay = startDay + days - 1;
    const remainingCards = cardIds.slice(cardIndex);
    result[lastDay] = result[lastDay].concat(remainingCards);
  }

  return result;
}
```

Loop through days, filling each up to maxPerDay. Any overflow goes to the last day.

## Your turn: faulty first

### Bug 1: Wrong rating order

A learner sees a card and rates it 'hard'. The system assigns due = now + 3600000 (1 hour). That's wrong; 'hard' should be longer than 'again' (24h) but the code has them backwards.

```ts
// WRONG: inverted mapping
function ratingToGrade(rating: Rating): number {
  switch (rating) {
    case 'again': return 4;   // Should be 1
    case 'hard': return 3;    // Should be 2
    case 'good': return 2;    // Should be 3
    case 'easy': return 1;    // Should be 4
  }
}
```

**How to fix:** Check the ts-fsrs Grade enum: 1=Again (shortest interval), 2=Hard, 3=Good, 4=Easy (longest). The mapping must match that order.

### Bug 2: Mutating the input array in dueCards

```ts
// WRONG: sort mutates the input
export function dueCards(cards: readonly Card[], now: number): Card[] {
  return cards.filter((card) => card.due <= now).sort((a, b) => a.due - b.due);
}
```

If `cards` is a const array or used elsewhere, `.sort()` on the filtered array still mutates the originals (same object references). The test catches this:

```js
const original = [card1, card2];
dueCards(original, now);
console.log(original[0].id);  // Might be card2 now!
```

**How to fix:** Return copies with `.map((c) => ({ ...c }))`.

### Bug 3: Overflow logic error

```ts
// WRONG: overwrites last day instead of concatenating
if (cardIndex < cardIds.length) {
  const lastDay = startDay + days - 1;
  result[lastDay] = cardIds.slice(cardIndex);  // Loses cards already on last day!
}
```

If the last day already has cards (because days exactly divides cardIds.length evenly on earlier days), this erases them.

**How to fix:** Use `concat()` to append overflow: `result[lastDay] = result[lastDay].concat(...)`.

## Technical glossary

- **FSRS:** Free Spaced Repetition Scheduler; algorithm that models forgetting curves
- **Stability:** The interval length (in days) at which recall probability = 90%
- **Difficulty:** A score 1–10; higher = harder, so interval doesn't grow as much
- **Grade/Rating:** A learner's response to a card (Again=1, Hard=2, Good=3, Easy=4 in ts-fsrs)
- **Due:** The time when a card is eligible for review again
- **Reps:** Repetition count; incremented each review
- **Backlog:** Cards that are due but not yet reviewed

## Common questions

**Q: Why is a new card due at *now* instead of later?**

A: New cards are shown immediately to give learners a baseline. Only after the first review do they enter the FSRS schedule.

**Q: What if spreadBacklog gets an empty cardIds array?**

A: It returns a Record with all days having empty arrays. No cards = nothing to schedule.

**Q: Can a card be due far in the past?**

A: Yes, if a learner hasn't reviewed in months. spreadBacklog handles this by spreading the backlog forward from *now*.

**Q: Does spreadBacklog shuffle cards?**

A: No. It keeps input order, so high-priority cards (listed first) appear earlier in the week.

## Reinforcement activity

Write a function `scheduleReview(card, ratings, now)` that simulates four consecutive reviews:

```txt
Input: card (new), ratings = ['hard', 'good', 'easy', 'easy'], now = Date.now()
Output: final card state after all four reviews
Constraint: do not import reviewCard; use the FSRS library directly
```

## Check yourself

1. **What does reps measure, and when does it increase?** 
   <details>
   **Answer:** Reps is the count of reviews. It increases by 1 each time reviewCard is called, regardless of the rating.
   </details>

2. **If a card is due on day 5 and spreadBacklog starts on day 3 with maxPerDay=20, where does it go?**
   <details>
   **Answer:** It goes into the backlog (startDay to startDay+days-1). If it's already been scheduled, spreadBacklog doesn't reschedule it; it only distributes new ids. (This is a clarification: spreadBacklog takes raw card ids, not Card objects with existing due times.)
   </details>

3. **Why must dueCards return copies of cards instead of the originals?**
   <details>
   **Answer:** The input is readonly, so the caller expects the original array not to be modified. Returning copies (via .map) ensures the caller can safely mutate the returned array without side effects.
   </details>

4. **If 'again' puts a card due within 24h, how does the FSRS library know the current time?**
   <details>
   **Answer:** We pass `now` to reviewCard, which converts it to a Date. The ts-fsrs library uses that Date to compute the due date for the next review. No global clock is read.
   </details>

5. **What happens in spreadBacklog if cardIds has 50 items, days=3, and maxPerDay=15?**
   <details>
   **Answer:** Days 0–1 get 15 cards each (30 total). Day 2 (the last day) gets the remaining 20 cards (3 + overflow). Result: { startDay: [c1..c15], startDay+1: [c16..c30], startDay+2: [c31..c50] }.
   </details>

## Quick reference

| Function | Arguments | Returns | Purpose |
|---|---|---|---|
| `newCard(id, now)` | string, number | Card | Create a blank card due at *now* |
| `reviewCard(card, rating, now)` | Card, Rating, number | Card | Apply a rating and update due date |
| `dueCards(cards, now)` | readonly Card[], number | Card[] | Filter to due ≤ now, sort oldest first |
| `spreadBacklog(ids, start, days?, max?)` | string[], number, number?, number? | Record<number, string[]> | Distribute ids across days |

## Connection to the bigger picture

Spaced repetition is how learners convert short-term exposure into long-term retention. Without the backlog spreading in spreadBacklog, a learner who misses class would face a cliff of 200 cards due today — discouraging and cognitively overloaded. With it, they see 20–30 cards per day, which is manageable.

The Card type also serves a later module: when learners export their progress, we need to serialize cards with their FSRS state so they can resume on a different device.

## Next

Next: [MS 2.3 — Catch-up gate and mastery map](../ms-02.03/lesson.md).
