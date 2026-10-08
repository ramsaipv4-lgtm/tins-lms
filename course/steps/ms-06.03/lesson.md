---
id: ms-06.03
title: Packages, gate on upload, sealed sections and teleprompter release
module: 6
est_minutes: 45
prereqs: [ms-06.01]
objectives: 3
new_terms: 5
skills: [content-gate, sealed-sections, debugging-by-observation]
source_refs: [{ path: packages/server/src/routes/content.ts, commit: a18ee86 }]
next: ms-06.04
---

# MS 6.3 — Packages, gate on upload, sealed sections and teleprompter release
*Step 21 of 42*

## Prerequisites
- The server foundation (ms-06.01): `ctx`, the store and role guards.
- Core release functions (`sectionKey`, `sealSection`, `releasePlan`, `isReleased`) and the content gate (`runGate`).

## You already understand this
A trainer uploads a course; a checker (the gate) rejects broken ones; learners get locked chapters that open as the trainer teaches. This step wires those ideas into HTTP routes.

## The detective question
**Problem:** The acceptance test for uploads failed with only `expected: true actual: false`, while my own tests were green.
**Options considered:** Guess at tar path formats; guess at the status word; add waivers; or observe the real requests reaching my server.
**Choice:** Log the requests my own server received and compare upload sizes.
**Why:** The log showed the uploaded tar was exactly one file smaller than the fixture, a file the root README still listed, so the gate was right and the test input was wrong. Guessing cost eight gate runs; observing cost one.

## Learning objectives
1. Explain why a failing package is stored as `draft` and cannot be published.
2. Explain why section plaintext is sealed when written, not when read.
3. Debug a failure you cannot see by observing your own program's inputs.

## Conceptual understanding
Upload: the body is a tar. We unpack it, normalise the paths the same way every time, run `runGate`, and store the files and the checks in the private database. Failing means `draft`; publish re-runs the gate (with optional waivers) and refuses with 409.

Release: each day has a random key kept in the private database. Section `i` is sealed with `sectionKey(dayKey, i)`. A learner's day response holds the sealed text always, and the key only when core's `isReleased` says so.

## Walkthrough of the real code
Path normalisation is one rule applied always:

```ts packages/server/src/routes/content.ts
function normalizePaths(entries: [string, string][]): Record<string, string> {
  const list = entries.map(([p, t]) => [p.replace(/^(\.\/)+/, ''), t] as [string, string]).filter(([p]) => p !== '' && !p.endsWith('/'));
  const first = list[0]?.[0].split('/')[0];
  const wrapped = list.length > 0 && list.every(([p]) => p.includes('/') && p.split('/')[0] === first);
  return Object.fromEntries(list.map(([p, t]) => [wrapped ? p.slice(first.length + 1) : p, t]));
}
```

Sealing at write time covers every writer, including the test seed:

```ts packages/server/src/routes/content.ts
  const rawPut = store.put.bind(store);
  store.put = async (dbName: string, doc: any) => {
    if (doc && doc.type === 'day' && typeof dbName === 'string' && dbName.startsWith('class-')) {
      doc = await sealDay(dbName.slice('class-'.length), doc);
    }
    return rawPut(dbName, doc);
  };
```

## Your turn: faulty first
My first attempt at the failing upload test was to change path handling, then the status word, then add waivers. Each guess left the gate failing with the same message. Look at the real mistake: which evidence would have told you the cause on the first run? Write down what you would log, then compare with the journal (mistake 2).

## Technical glossary
- **Gate**: the G1 to G8 content checks run on upload.
- **Draft**: status of a package whose gate failed.
- **Sealed section**: AES-GCM ciphertext of a section, IV first.
- **Day key**: random per-day secret kept only in the private database.
- **Reached**: the section ids the trainer's teleprompter has visited.

## Common questions
- Why not just hide plaintext in the response? Because the class database replicates to devices.
- Can a graded section open by time? No, only by reaching it or "release all".

## Reinforcement activity
Upload a tar of the fixture with one required file removed. Predict which check fails, then confirm, and try to publish it.

## Check yourself
1. What status does a package get when any gate check fails?
<details>Draft; publishing it returns 409 with the failing checks.</details>
2. Where is the day key stored, and why there?
<details>In the private database, which is never replicated.</details>
3. When does a graded section's key appear?
<details>Only when the trainer reaches it or taps release all, never by time.</details>
4. Why wrap `store.put` instead of sealing in the GET route?
<details>Plaintext would already be stored and replicated by then.</details>

## Quick reference
`POST /api/packages`, `POST /api/packages/:id/publish`, `GET /api/classes/:id/days/:index`, `POST /api/classes/:id/teleprompter`.

## Connection to the bigger picture
Sync (next steps) replicates class databases, so what is stored there must already be safe.

## Next

Next: [MS 6.4 — Sync rules and the merge pass](../ms-06.04/lesson.md).
