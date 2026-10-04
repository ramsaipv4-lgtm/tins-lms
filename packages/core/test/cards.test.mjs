import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newCard, reviewCard, dueCards, spreadBacklog } from '../src/cards.ts';

test('AC-3: reviewCard ratings affect due date and reps', () => {
  const now = Date.now();
  const card = newCard('test-1', now);

  // Review with different ratings and get their due dates
  const cardAgain = reviewCard(card, 'again', now);
  const cardHard = reviewCard(card, 'hard', now);
  const cardGood = reviewCard(card, 'good', now);
  const cardEasy = reviewCard(card, 'easy', now);

  // Verify that due dates follow the pattern: again < hard < good < easy
  assert.ok(
    cardAgain.due < cardHard.due,
    `'again' due (${cardAgain.due}) should be less than 'hard' due (${cardHard.due})`
  );
  assert.ok(
    cardHard.due < cardGood.due,
    `'hard' due (${cardHard.due}) should be less than 'good' due (${cardGood.due})`
  );
  assert.ok(
    cardGood.due < cardEasy.due,
    `'good' due (${cardGood.due}) should be less than 'easy' due (${cardEasy.due})`
  );

  // Verify that 'again' puts the card due within 24 hours
  const twentyFourHours = 24 * 60 * 60 * 1000;
  assert.ok(
    cardAgain.due > now && cardAgain.due <= now + twentyFourHours,
    `'again' due (${cardAgain.due}) should be within 24h of now (${now})`
  );

  // Verify that reps increases by 1
  assert.equal(cardAgain.reps, card.reps + 1, "'again' should increase reps by 1");
  assert.equal(cardHard.reps, card.reps + 1, "'hard' should increase reps by 1");
  assert.equal(cardGood.reps, card.reps + 1, "'good' should increase reps by 1");
  assert.equal(cardEasy.reps, card.reps + 1, "'easy' should increase reps by 1");
});

test('AC-3: each rating increases reps independently', () => {
  const now = Date.now();
  const card1 = newCard('test-1', now);
  const card2 = newCard('test-2', now);

  const initialReps = card1.reps;

  const reviewed1 = reviewCard(card1, 'good', now);
  const reviewed2 = reviewCard(card2, 'easy', now);

  assert.equal(reviewed1.reps, initialReps + 1);
  assert.equal(reviewed2.reps, initialReps + 1);
});

test('AC-4: dueCards returns only cards with due <= now', () => {
  const now = Date.now();
  const card1 = newCard('card-1', now - 1000); // Due in the past
  const card2 = newCard('card-2', now + 86400000); // Due tomorrow
  const card3 = newCard('card-3', now - 500); // Due in the past

  const cards = [card1, card2, card3];
  const due = dueCards(cards, now);

  // Should only include card1 and card3
  assert.equal(due.length, 2);
  assert.equal(due[0].id, 'card-1');
  assert.equal(due[1].id, 'card-3');
});

test('AC-4: dueCards returns cards oldest first', () => {
  const now = Date.now();
  // Create cards with specific due times
  const cards = [
    { id: 'new-1', due: now - 5000, reps: 0, stability: 1, difficulty: 5, state: 0, scheduled_days: 0, learning_steps: 0, lapses: 0, last_review: undefined },
    { id: 'new-2', due: now - 2000, reps: 0, stability: 1, difficulty: 5, state: 0, scheduled_days: 0, learning_steps: 0, lapses: 0, last_review: undefined },
    { id: 'new-3', due: now - 10000, reps: 0, stability: 1, difficulty: 5, state: 0, scheduled_days: 0, learning_steps: 0, lapses: 0, last_review: undefined },
  ];

  const due = dueCards(cards, now);

  // Should be sorted by due date, oldest first
  assert.equal(due[0].id, 'new-3'); // -10000 (oldest)
  assert.equal(due[1].id, 'new-1'); // -5000
  assert.equal(due[2].id, 'new-2'); // -2000 (newest)
});

test('AC-4: dueCards does not mutate input', () => {
  const now = Date.now();
  const cards = [
    { id: 'card-1', due: now - 1000, reps: 0, stability: 1, difficulty: 5, state: 0, scheduled_days: 0, learning_steps: 0, lapses: 0, last_review: undefined },
    { id: 'card-2', due: now + 1000, reps: 0, stability: 1, difficulty: 5, state: 0, scheduled_days: 0, learning_steps: 0, lapses: 0, last_review: undefined },
  ];

  const originalOrder = cards.map((c) => c.id);
  dueCards(cards, now);

  // Original array should not be mutated
  assert.deepEqual(
    cards.map((c) => c.id),
    originalOrder
  );
});

test('AC-5: spreadBacklog assigns every id exactly once', () => {
  const cardIds = ['c1', 'c2', 'c3', 'c4', 'c5'];
  const result = spreadBacklog(cardIds, 0, 7, 30);

  // Collect all assigned ids
  const assignedIds = [];
  for (const dayIds of Object.values(result)) {
    assignedIds.push(...dayIds);
  }

  // Should have all ids assigned exactly once
  assert.equal(assignedIds.length, cardIds.length);
  assert.deepEqual(new Set(assignedIds).size, cardIds.length); // All unique
  cardIds.forEach((id) => {
    assert.ok(assignedIds.includes(id), `${id} should be assigned`);
  });
});

test('AC-5: spreadBacklog respects maxPerDay limit', () => {
  const cardIds = Array.from({ length: 100 }, (_, i) => `c${i + 1}`);
  const result = spreadBacklog(cardIds, 0, 7, 10);

  // Each day should have at most 10 cards (except possibly the last day with overflow)
  let totalAssigned = 0;
  for (let day = 0; day < 6; day++) { // First 6 days
    const dayCards = result[day] || [];
    assert.ok(dayCards.length <= 10, `Day ${day} should have <= 10 cards, got ${dayCards.length}`);
    totalAssigned += dayCards.length;
  }

  // Last day can have the overflow
  const lastDay = result[6] || [];
  totalAssigned += lastDay.length;

  assert.equal(totalAssigned, cardIds.length);
});

test('AC-5: spreadBacklog puts overflow on last day', () => {
  const cardIds = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10', 'c11'];
  const result = spreadBacklog(cardIds, 0, 3, 3); // 3 days, 3 max per day

  // Should have 9 cards in first 3 days (3 each), 2 on last day
  assert.equal((result[0] || []).length, 3);
  assert.equal((result[1] || []).length, 3);
  assert.equal((result[2] || []).length, 5); // 3 + 2 overflow
});

test('AC-5: spreadBacklog keeps input order', () => {
  const cardIds = ['z', 'a', 'm', 'b', 'x'];
  const result = spreadBacklog(cardIds, 0, 5, 1);

  // Collect all assigned ids in order
  const assignedIds = [];
  for (let day = 0; day < 5; day++) {
    assignedIds.push(...(result[day] || []));
  }

  // Should maintain input order
  assert.deepEqual(assignedIds, cardIds);
});

test('AC-5: spreadBacklog with default parameters', () => {
  const cardIds = Array.from({ length: 50 }, (_, i) => `c${i + 1}`);
  const result = spreadBacklog(cardIds, 10);

  // Should use defaults: days=7, maxPerDay=30
  let totalCards = 0;
  for (let day = 10; day < 17; day++) {
    totalCards += (result[day] || []).length;
  }

  assert.equal(totalCards, 50);
  assert.ok((result[10] || []).length <= 30);
  assert.ok((result[11] || []).length <= 30);
});

test('newCard creates card with correct structure', () => {
  const now = Date.now();
  const card = newCard('test-id', now);

  assert.equal(card.id, 'test-id');
  assert.equal(typeof card.due, 'number');
  assert.equal(typeof card.reps, 'number');
  assert.equal(card.reps, 0); // New card should have 0 reps
  assert.ok(card.due >= now); // Due should be at or after now
});
