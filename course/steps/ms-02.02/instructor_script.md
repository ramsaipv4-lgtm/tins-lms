---
id: ms-02.02-script
title: Instructor Script — Cards and spaced repetition (ts-fsrs)
role: trainer
---

# Instructor Script: MS 2.2 — Cards and spaced repetition (ts-fsrs)

**Total time:** 50 minutes

## Segment 1: Problem and choice (8 min)

**Say (3 min):**
"Today we solve the backlog problem. Imagine a learner misses a week of study. They have 200 overdue flashcards. What do we do?

- Show all 200 today? They burn out, answer 'again' on everything, and forget more than they learn.
- Show none? They stay behind and fall off.

We need a smarter approach: **spread the backlog across days, respecting a daily limit, so learners pace their reviews**. That's what today's step does.

The tool we use is the ts-fsrs library—the same engine that powers Anki. We wrap it for Coach LMS's millisecond-timestamp API."

**Do (5 min):** Live code walkthrough
- Open `packages/core/src/cards.ts` in the editor.
- Point to the four functions: `newCard`, `reviewCard`, `dueCards`, `spreadBacklog`.
- Explain the wrapper role: "ts-fsrs uses JavaScript Date objects. Our LMS uses milliseconds. The helper `fsrsToCard` and `ratingToGrade` bridge that gap."

## Segment 2: The four ratings (10 min)

**Say (3 min):**
"When a learner reviews a card, they pick one of four ratings:

- 'again': I forgot it. Due within 24 hours.
- 'hard': I struggled but got it. Due in a few days.
- 'good': I knew it. Due in weeks.
- 'easy': Too easy. Due in months.

Each rating updates two fields:
1. **Stability:** how long until they forget (the interval at 90% recall).
2. **Difficulty:** the card's hardness—harder cards have shorter intervals.

The FSRS algorithm tunes both based on history. Our job is **not** to tune; it's to wire the ratings to the right Grade enum values."

**Do (7 min):** Walk through the code
- Show `ratingToGrade()`:
  ```ts
  function ratingToGrade(rating: Rating): 1 | 2 | 3 | 4 {
    switch (rating) {
      case 'again':   return 1;
      case 'hard':    return 2;
      case 'good':    return 3;
      case 'easy':    return 4;
    }
  }
  ```
- Explain: "These numeric grades (1, 2, 3, 4) are ts-fsrs's enum. Again=1 is the shortest; Easy=4 is the longest."
- Show `reviewCard()`:
  ```ts
  const grade = ratingToGrade(rating);
  const recordLogItem = f.next(fsrsCard, new Date(now), grade);
  ```
- Highlight: "The `next()` method returns a new card state. Reps increments automatically."

## Segment 3: Filtering due cards (8 min)

**Say (2 min):**
"Once cards are scheduled, we need to ask: 'Which cards are due right now?' That's `dueCards()`. It filters the deck and sorts oldest due first."

**Do (6 min):** Code and test walkthrough
- Show the test in `cards.test.mjs`:
  ```js
  const now = Date.now();
  const card1 = newCard('card-1', now - 1000);  // due in past
  const card2 = newCard('card-2', now + 86400000);  // due tomorrow
  const card3 = newCard('card-3', now - 500);  // due in past
  
  const due = dueCards([card1, card2, card3], now);
  assert.equal(due.length, 2);  // Only card1 and card3
  assert.equal(due[0].id, 'card-3');  // Oldest first
  assert.equal(due[1].id, 'card-1');
  ```
- Explain: "The filter `card.due <= now` picks cards due in the past or right now. Then sort by `a.due - b.due` puts the oldest first (prioritize the longest-overdue)."
- Important: "Notice we return copies (`.map((c) => ({ ...c }))`). The input is readonly, so we don't mutate it."

## Segment 4: Spreading the backlog (20 min)

**Say (5 min):**
"Now the hardest part: **spreadBacklog**. The learner is 200 cards behind. We have 7 days and can show 30 cards/day. We must distribute those 200 cards fairly:

- Days 0–5: 30 cards each (180 total)
- Day 6 (last day): 20 cards (overflow)

The rules:
1. Every card appears exactly once.
2. Each day gets at most maxPerDay cards.
3. Extra cards go on the last day.
4. Keep input order (high-priority cards are shown first in the week)."

**Do (15 min):** Step through the algorithm
- Show the test:
  ```js
  const cardIds = ['c1', 'c2', ..., 'c200'];
  const result = spreadBacklog(cardIds, startDay=7, days=7, maxPerDay=30);
  // result[7] = [c1, ..., c30]
  // result[8] = [c31, ..., c60]
  // ...
  // result[13] = [c171, ..., c200]
  ```

- Live code walkthrough (read the code from the editor):
  ```ts
  for (let dayOffset = 0; dayOffset < days; dayOffset++) {
    const dayIndex = startDay + dayOffset;
    const cardsForThisDay = [];
    
    while (cardsForThisDay.length < maxPerDay && cardIndex < cardIds.length) {
      cardsForThisDay.push(cardIds[cardIndex]);
      cardIndex++;
    }
    
    result[dayIndex] = cardsForThisDay;
  }
  
  // Overflow: any remaining cards go on the last day
  if (cardIndex < cardIds.length) {
    const lastDay = startDay + days - 1;
    result[lastDay] = result[lastDay].concat(cardIds.slice(cardIndex));
  }
  ```
- Narrate: "We loop through each day. For each day, we pop up to maxPerDay cards and assign them. When we run out of days, any leftover cards go on the last day."

- Show the "faulty first" bug:
  ```ts
  // WRONG: overwrites instead of concatenating
  result[lastDay] = cardIds.slice(cardIndex);
  ```
  "This erases cards already on the last day. The fix is `concat()`."

- Run the test:
  ```bash
  node --test packages/core/test/cards.test.mjs
  ```
  "All tests pass."

## Segment 5: Summary and check (4 min)

**Say (2 min):**
"So we have:
1. **newCard():** Create a blank card due now.
2. **reviewCard():** Apply a rating and update state via FSRS.
3. **dueCards():** Filter to due cards and sort oldest first.
4. **spreadBacklog():** Distribute overdue cards across days with overflow protection.

This layer sits on top of ts-fsrs and gives Coach LMS the scheduling it needs. Learners never see the raw FSRS fields; they see the due date and pick a rating."

**Check (2 min):** Ask learners:
1. "If a card is due on day 7 and spreadBacklog starts on day 0 with maxPerDay=10 for 5 days, where does it end up?" (Answer: day 4, the last day, as overflow if there are 51+ cards, otherwise it gets assigned normally.)
2. "What does reps measure?" (Answer: the number of reviews.)
3. "Why does dueCards return copies instead of the originals?" (Answer: to avoid mutating the input array.)
