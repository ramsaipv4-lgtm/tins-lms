---
id: ms-07.05
title: Learner day - catch-up, cards, exit ticket, explain-it-back, first run, audio
module: 7
est_minutes: 45
prereqs: [ms-07.01]
objectives: 3
new_terms: 5
skills: [feature-group, core-reuse, test-contract]
source_refs: [{ path: packages/server/src/routes/features/learn.ts, commit: 4623c96 }, { path: packages/web/src/features/learn/index.tsx, commit: 4623c96 }]
next: end
---

# MS 7.5 - Learner day: catch-up, cards, exit ticket, explain-it-back, first run, audio

*Step 5 of N*

## Prerequisites

You already understand:
- How a feature group adds routes and strings (ms-07.01)
- What a REST route and a role guard are

## You already understand this

- A school gate: you may not enter the next class until you pass the entry test for the one you missed.
- A flash-card box: cards you know well come back rarely, cards you forget come back soon.

## The detective question

**Problem:** A learner who joined late must pass each missed day's diagnostic in order, review cards, hand in an exit ticket, explain a topic back and listen to the quick-learn. A brand new app must also offer four ways to start, but the shell shows only a sign-in screen to someone with no session.

**Options considered:**
1. Edit the shell so that "/" shows the first-run screen
2. Keep every decision in core and the server, and let the group mount its own first-run screen only when "/" is opened with no session
3. Show first-run as an ordinary route inside the learn space

**Choice:** Option 2.

**Why:** The shell is not this group's file, and option 3 cannot be reached because a person with no session is sent to sign-in before any space route renders. Option 2 stays inside the group and loads the screen only when it is needed.

## Learning objectives

After this step you will be able to:
1. Use `catchUpState` and the pass mark to decide which gate a learner sees
2. Match a free-text answer to an answer key without leaking the key to the browser
3. Read a journey's anchored accessible names and name your buttons to match

## Conceptual understanding

The server holds the answer key, so the browser only ever receives question text. A try is stored as an `attempt` document and the best score per day feeds `catchUpState`. Wrong answers become `errorNote` documents in the learner's personal database, which the error notebook groups by subtopic. Cards keep their FSRS state in the card document, and `reviewCard` from core computes the next due time.

## Walkthrough of the real code

### Free-text matching

```ts packages/server/src/routes/features/learn.ts
// A free-text answer is right when every word of the key appears in it (so an exact answer, or the key inside a
// longer sentence, passes; a shorter or different answer does not).
export function answerMatches(given: string, key: string): boolean {
  const g = new Set(norm(given));
  const k = norm(key);
  return g.size > 0 && k.length > 0 && k.every((w) => g.has(w));
}
```

### First run in front of the shell

```tsx packages/web/src/features/learn/index.tsx
async function maybeFirstRun(): Promise<void> {
  if (typeof document === 'undefined' || location.pathname !== '/') return;
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin', headers: { accept: 'application/json' } });
    if (res.status !== 401) return;
  } catch { return; } // offline: the installed app keeps showing the shell
```

## Your turn: faulty first

Faulty attempt 1: the catch-up retry timed out on the phone profile. The journey clicked "Start" while a "Try again" button and a "Start the diagnostic" button were both on screen, and the Start button was replaced mid-click. How do you fix it? (Show one button at a time and reuse the questions already on the device for a retry.)

Faulty attempt 2: the explanation field "was not an input". `getByLabel(/explanation|explain/i).first()` found the section whose `aria-labelledby` heading said "Explain it back". What do you change? (Remove the label from the wrapper so the first match is the textarea.)

## Technical glossary

- **Gate**: the diagnostic a learner must pass to unlock a missed day.
- **Attempt**: one stored try at a diagnostic, with its score.
- **Error note**: a wrong answer kept in the learner's own database.
- **FSRS**: the spaced-repetition scheduler behind the cards.
- **First run**: the screen of four ways to start on a fresh app.

## Common questions

- *Why does a retry not call the server?* The questions are already on the device and answers are checked on submit.
- *Why is "play" the whole button name?* The journey anchors the name, so extra words break it.

## Reinforcement activity

Write the three ways a person can reach the learner home from first run, and the route each one calls. (Answer: join with a code goes to `/join/<code>`; hub pairs with `/api/pairing/claim`; phone only calls `/api/join/phone-only`.)

## Check yourself

1. Why does the browser never receive the answer key?
<details>The server scores the answers, so the key stays on the server.</details>
2. What unlocks day 1 in the catch-up gate?
<details>Passing day 0 first, then scoring at least the pass mark on day 1.</details>
3. Why was `.first()` of a label search a trap?
<details>A container labelled by its heading matched before the textarea did.</details>

## Quick reference

`catchUpState`, `reviewCard`, `dueCards`, `tallyExitTickets`, `checkExplanation`, `parsePackage` from `packages/core`.

## Connection to the bigger picture

These screens are the learner's daily loop; the offline phone profile (ms-07.09) reuses them without the server.

## Next

End of this unit for now.
