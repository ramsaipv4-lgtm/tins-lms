---
id: ms-07.07
title: Appeals, doubts, drop, accommodations, content improvement
module: 7
est_minutes: 45
prereqs: [ms-07.01]
objectives: 3
new_terms: 5
skills: [feature-group, journey-contract, core-reuse]
source_refs: [{ path: packages/server/src/routes/features/classroom.ts, commit: 5b9d738 }]
next: end
---

# MS 7.7 — Appeals, doubts, drop, accommodations, content improvement

*Step 7 of N*

## Prerequisites

You already understand:
- How a feature group adds routes and strings (ms-07.01)
- What a REST route and a role guard are

## You already understand this

- A school office: a student asks for a re-check, a teacher corrects the mark, and the old mark stays in the register.
- A leaving form: when a student leaves, the office cancels their locker and library card, and can restore them.

## The detective question

**Problem:** A learner must be able to appeal a score, ask doubts anonymously, be dropped and restored, and get extra time, and the trainer must see weak questions. Every one of these has a journey that clicks controls by exact accessible names.

**Options considered:**
1. Reuse the existing grading routes and attendance roster as they are
2. Add our own small routes under one prefix, and park documents where an old route would show the wrong thing
3. Edit the other groups' files

**Choice:** Option 2.

**Why:** The grading route measures the appeal window from the wrong date for the seeded attempt, and the attendance roll lists every enrolment, so a dropped learner would stay on it. Option 3 is outside this task's files.

## Learning objectives

After this step you will be able to:
1. Keep the original score in a ledger when an appeal corrects it
2. Hide an anonymous author on the server, not in the browser
3. Read an anchored accessible-name pattern and name a button to match it

## Conceptual understanding

An appeal is a small state machine from core: open, then upheld or rejected, then escalated. The server stores the appeal beside the attempt. When a trainer upholds with a corrected score, the server first writes the original score into the ledger if it is missing, then appends the correction, so history shows both.

A doubt stores `personId: null` when anonymous, so the author is never sent to any screen. Accommodations are requested into the private database and approved into `person.accommodations`, which timers read through `effectiveLimitMs`.

## Walkthrough of the real code

### Parking a dropped enrolment

```ts packages/server/src/routes/features/classroom.ts
  // A dropped learner's enrolment is parked under `droppedEnrolment:` so the attendance roll (which lists
  // `enrolment:` documents) no longer shows them; undo moves it back (AC-152).
  const enrolmentOf = async (db: string, personKey: string) => {
    for (const prefix of ['enrolment:', 'droppedEnrolment:']) {
      const e = (await store.list(db, prefix)).find((x: any) => ids.keyOf(String(x.personId ?? x.id)) === personKey);
      if (e) return e;
    }
    return null;
  };
```

The attendance roll lists only `enrolment:` documents, so a parked one leaves the roll at once. Undo moves it back.

### Keeping the original score

```ts packages/server/src/routes/features/classroom.ts
      // Correction keeps the original ledger entry (P-10): if the attempt was never signed off, record the original first.
      const attempt = await store.get(db, `attempt:${attemptKey}`);
      const ledgerId = `ledger:attempt-${attemptKey}`;
      const prev = await store.get(db, ledgerId);
      let entries = prev?.entries ?? [];
      if (!entries.length && attempt) {
```

## Your turn: faulty first

Faulty attempt 1: the post button was named "Post doubt" and the journey waited for `/^(post|ask|submit|send)$/i`. How do you find the exact name a test needs? (The failure message prints the pattern; rename the button to match it.)

Faulty attempt 2: the first version listed every appeal state as "waiting for your trainer" and the journey expected the text to match `/open/`. What do you change? (Put the word the pattern asks for in the visible status.)

Faulty attempt 3: after dropping, the dropped learner was still visible on the attendance roll. Why? (That roll lists every enrolment document, so the dropped one has to move out of that list.)

## Technical glossary

- **Appeal**: a request to re-check a score, with a state.
- **Ledger**: an append-only list of score entries.
- **Drop plan**: the list of actions core computes when a learner leaves.
- **Accommodation**: an approved time multiplier for one person.
- **Item analysis**: how each question performed, with flags.

## Common questions

- *Why not hide the anonymous name in the browser?* The data would still reach every device.
- *Why is the accommodation request private?* A learner device must not be able to approve itself.

## Reinforcement activity

Name the two ledger entries after an appeal upholds a 5/8 score as 7/8. (Answer: the original 5, then the correction 7 that points at the first entry.)

## Check yourself

1. Why is the author of an anonymous doubt never stored?
<details>So no screen or device can ever show it.</details>
2. What does undoing a drop restore, and what stays changed?
<details>Team, repositories and bots come back; tickets stay reassigned.</details>
3. Where does an approved accommodation live?
<details>In `person.accommodations` in the org database.</details>

## Quick reference

`openAppeal`, `appealStep`, `dropPlan`, `undoDropPlan`, `itemAnalysis`, `effectiveLimitMs` from `packages/core`.

## Connection to the bigger picture

The Shift screen (ms-07.06) reads `person.accommodations` for its timer limit.

## Next

End of this unit for now.
