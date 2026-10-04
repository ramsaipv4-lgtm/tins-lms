---
id: ms-02.02-recall
title: Recall and Spaced Repetition — Cards and spaced repetition
role: learner
---

# Recall: MS 2.2 — Cards and spaced repetition

## Closed-book retrieval exercises

Complete these without looking at the lesson. Write pseudocode or explain in your own words.

### Exercise 1: Implement ratingToGrade

Write a function that maps rating strings to ts-fsrs Grade numbers.

```txt
Input: rating = 'hard'
Output: 2

Input: rating = 'easy'
Output: 4
```

<details>

**Solution:**

```ts
function ratingToGrade(rating: Rating): 1 | 2 | 3 | 4 {
  switch (rating) {
    case 'again': return 1;
    case 'hard': return 2;
    case 'good': return 3;
    case 'easy': return 4;
  }
}
```

The mapping is: Again=1 (shortest), Hard=2, Good=3, Easy=4 (longest). This order matches ts-fsrs's Grade enum.

</details>

### Exercise 2: Filter due cards

Write pseudocode for a function that takes an array of cards and returns only those due by `now`, sorted oldest first.

```txt
Input: cards = [
  { id: 'a', due: now - 5000 },
  { id: 'b', due: now + 1000 },
  { id: 'c', due: now - 10000 }
]
now = Date.now()

Output: [
  { id: 'c', due: now - 10000 },
  { id: 'a', due: now - 5000 }
]
```

<details>

**Solution:**

```ts
export function dueCards(cards: readonly Card[], now: number): Card[] {
  return cards
    .filter((card) => card.due <= now)
    .sort((a, b) => a.due - b.due)
    .map((card) => ({ ...card }));
}
```

The steps are:
1. Filter: keep only cards where `due <= now` (including exactly now).
2. Sort: ascending by due date (oldest first).
3. Map: return shallow copies to avoid mutating the input array.

</details>

### Exercise 3: Distribute cards across days

Write the logic to assign 25 card IDs across 3 days with a limit of 10 cards/day. Show the result as a mapping of day → card IDs.

```txt
Input: ['c1', 'c2', ..., 'c25'], startDay=5, days=3, maxPerDay=10

Output:
5: ['c1', 'c2', ..., 'c10']
6: ['c11', 'c12', ..., 'c20']
7: ['c21', 'c22', ..., 'c25']
```

<details>

**Solution:**

```ts
export function spreadBacklog(
  cardIds: readonly string[],
  startDay: number,
  days: number = 7,
  maxPerDay: number = 30
): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  
  for (let i = 0; i < days; i++) {
    result[startDay + i] = [];
  }
  
  let cardIndex = 0;
  
  for (let dayOffset = 0; dayOffset < days && cardIndex < cardIds.length; dayOffset++) {
    const dayIndex = startDay + dayOffset;
    const cardsForThisDay: string[] = [];
    
    while (cardsForThisDay.length < maxPerDay && cardIndex < cardIds.length) {
      cardsForThisDay.push(cardIds[cardIndex]);
      cardIndex++;
    }
    
    result[dayIndex] = cardsForThisDay;
  }
  
  if (cardIndex < cardIds.length) {
    const lastDay = startDay + days - 1;
    result[lastDay] = result[lastDay].concat(cardIds.slice(cardIndex));
  }
  
  return result;
}
```

The algorithm:
1. Initialize all day slots as empty arrays.
2. Iterate through days, filling each up to maxPerDay.
3. If cards remain, append them all to the last day with `.concat()`.

</details>

## Spaced repetition cards

Use these for daily recall. Try to answer without looking at the back. Mark your confidence: ✓ (knew it), ◐ (partial), ✗ (forgot).

**Q:** What does the 'again' rating do to a card's due date?

**A:** It schedules the card to be due within 24 hours. It represents a failed recall, so the card is revisited quickly to prevent further forgetting.

---

**Q:** Name the four rating options and their general effect on interval length.

**A:** 'again': shortest interval (within 24h); 'hard': short interval (days); 'good': medium interval (weeks); 'easy': longest interval (months). The ordering is strict: again < hard < good < easy.

---

**Q:** Why does dueCards use `.map((c) => ({ ...c }))` at the end?

**A:** To return shallow copies of the cards instead of the original objects. The input is readonly, so the caller doesn't expect mutation. Returning copies ensures the caller can safely mutate or reorder the result array without affecting the input.

---

**Q:** What is the purpose of spreadBacklog?

**A:** It distributes a large number of overdue card IDs across multiple days, respecting a daily card limit (maxPerDay). This prevents overwhelming a learner with all overdue cards on one day while ensuring all cards are eventually scheduled.

---

