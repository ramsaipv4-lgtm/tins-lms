---
id: ms-07.02
title: Admin class setup, syllabus, college outputs, Google opt-in
module: 7
est_minutes: 45
prereqs: [ms-07.01]
objectives: 3
new_terms: 5
skills: [admin-screens, rule-based-draft, feature-switches]
source_refs: [{ path: packages/server/src/routes/features/admin.ts, commit: 58abe2b }]
next: ms-07.03
---

# MS 7.2 — Admin class setup, syllabus, college outputs, Google opt-in
*Step 27 of 42*

## Prerequisites

You already understand:
- The feature registry from ms-07.01
- What a REST route and a feature switch are

## You already understand this

- A school office form: the clerk fills program, batch and class, then attaches the syllabus pack.
- A light switch with a lock: Google features exist but stay dark until the owner flips them.

## The detective question

**Problem:** A college tells the admin its syllabus by voice. The admin needs a written draft the college can confirm, and every later change must be dated, without an AI being required.

**Options considered:**
1. Ask an AI to draft it
2. A rule-based draft: one topic per line, three topics per day, saved with a change log
3. Let the admin type the final syllabus by hand

**Choice:** Option 2.

**Why:** The app must work with AI off (P-3), a rule is testable, and the change log is computed by comparing topic sets.

## Learning objectives

After this step you will be able to:
1. Build an admin screen that sets up a class and shows the gate report
2. Explain how the syllabus draft and change log work
3. Explain why Google controls stay hidden until a switch is on

## Conceptual understanding

The class setup screen posts to one server route that creates the program, cohort and class, uploads the package, shows one row per gate check with a pass, fail or waived state, then publishes. Reports and certificates are produced in the browser. Switches are resolved on the server with core `isOn`.

## Walkthrough of the real code

### The syllabus draft

```ts packages/server/src/routes/features/admin.ts
export function draftSyllabus(notes: string): { days: { day: number; topics: string[] }[]; topics: string[] } {
  const topics = notes.split(/\r?\n|;/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
    .filter((l) => l.length > 0);
  const days: { day: number; topics: string[] }[] = [];
  for (let i = 0; i < topics.length; i += 3) days.push({ day: days.length + 1, topics: topics.slice(i, i + 3) });
  return { days, topics };
}
```

Bullets and numbers are stripped, then topics are grouped three to a day.

## Your turn: faulty first

Faulty attempt 1: the nav entry was "Class setup" but the journey looks for exactly "Classes". What is the fix?

Faulty attempt 2: on a slow phone a late server answer replaced the notes the admin had typed. How do you stop a stale answer from overwriting edits?

## Technical glossary

- **Gate report**: one row per content check with its state.
- **Change log**: dated list of syllabus changes.
- **Switch**: an on/off setting resolved class over program over org over default.
- **Opt-in**: a feature that is off until someone turns it on.
- **Certificate id**: 12 Crockford characters from core `certificateId`.

## Common questions

- *Why are PDFs made in the browser?* No new dependency and the server stays small.

## Reinforcement activity

Give the draft three notes lines "a", "b", "c", "d". How many days result? (Answer: 2.)

## Check yourself

1. Why is the syllabus draft rule-based?
<details>The app must work with AI off, and a rule is testable.</details>
2. What state can a gate check row have?
<details>Pass, fail or waived.</details>
3. Where is switch precedence decided?
<details>In core `isOn`, class over program over org over default.</details>

## Quick reference

`draftSyllabus`, `isOn`, `certificateId`, `createGoogleAdapter`.

## Connection to the bigger picture

Admin output feeds the college and the trainers' schedule screens.

## Next

Next: [MS 7.3 — Attendance, wrap-up, messages, trainer notes, digest](../ms-07.03/lesson.md).
