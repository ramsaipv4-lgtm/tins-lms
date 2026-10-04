// Cards and spaced repetition using ts-fsrs (SPEC §4.2)
import { fsrs, createEmptyCard, type Card as FSRSCard } from 'ts-fsrs';

// Ratings for card reviews
export type Rating = 'again' | 'hard' | 'good' | 'easy';

// Card type: extends FSRS card with our custom fields
export interface Card extends FSRSCard {
  id: string;
  due: number;
  reps: number;
}

// Convert FSRS rating names to ts-fsrs Grade values
function ratingToGrade(rating: Rating): 1 | 2 | 3 | 4 {
  switch (rating) {
    case 'again':
      return 1; // Again = 1 in ts-fsrs
    case 'hard':
      return 2; // Hard = 2
    case 'good':
      return 3; // Good = 3
    case 'easy':
      return 4; // Easy = 4
  }
}

// Convert ts-fsrs card to our Card type
function fsrsToCard(fsrsCard: FSRSCard, id: string): Card {
  return {
    ...fsrsCard,
    id,
    due: fsrsCard.due.getTime(), // Convert Date to milliseconds
    reps: fsrsCard.reps,
  };
}

// Create a new card
export function newCard(id: string, now: number): Card {
  const f = fsrs();
  const fsrsCard = createEmptyCard(new Date(now));
  return fsrsToCard(fsrsCard, id);
}

// Review a card and return the updated card
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

// Get cards that are due (due <= now), sorted oldest first
export function dueCards(cards: readonly Card[], now: number): Card[] {
  return cards
    .filter((card) => card.due <= now)
    .sort((a, b) => a.due - b.due)
    .map((card) => ({ ...card })); // Return copies to avoid mutation
}

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
