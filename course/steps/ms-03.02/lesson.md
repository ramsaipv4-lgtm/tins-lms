---
id: ms-03.02
title: Section keys and teleprompter-paced release
module: 3
est_minutes: 20
prereqs: [ms-01.01]
objectives: 3
new_terms: 4
skills: [key-derivation, content-release]
source_refs: [{ path: packages/core/src/release.ts, commit: fadc0ff }]
next: ms-03.03
---

# MS 3.2 — Section keys and teleprompter-paced release
*Step 7 of 41*

## Prerequisites

- async/await and Uint8Array
- HKDF and AES-GCM from step ms-01.01

## You already understand this

- A teacher hands out a worksheet when the lesson reaches it, not before.
- A sealed envelope stays shut without the right key.

## The detective question

**Problem:** Class material for a day must reach phones early, but a section must stay unreadable until the trainer reaches it. Graded sections must never open just because the clock ran out.

**Options considered:**
1. Send each section when it is released, over the network.
2. Send everything in plain text and hide it in the UI.
3. Send every section sealed with its own key, and hand out a key only at release time.

**Choice:** Option 3: one HKDF key per section index, AES-GCM sealing, plus pure functions that decide release.

**Why:** Phones may be offline, so content must already be on the device. UI hiding is not secrecy. Pure functions with time passed in (D-22) are easy to test, and graded material never unlocks by time (D-38).

## Learning objectives

1. Derive a distinct 32-byte key per section from a day key.
2. Seal and open a section, and explain why tampering throws.
3. Compute a release plan and decide release with the three-way rule.

## Conceptual understanding

A day key is expanded with HKDF into one key per section (info `section:<index>`). Sealing uses a fresh IV, so two seals differ. A release plan lists when each section opens by time: the class start plus the planned seconds of earlier sections, or null for graded ones. A section is released if reached, if release-all was tapped, or (ungraded only) once now passes its time.

## Walkthrough of the real code

```ts packages/core/src/release.ts
export async function sectionKey(dayKey: Uint8Array, sectionIndex: number): Promise<Uint8Array> {
  return hkdfSha256(dayKey, new Uint8Array(0), utf8Encode(`section:${sectionIndex}`), 32);
}
```

The empty salt and the index in `info` make the key deterministic and different per section.

```ts packages/core/src/release.ts
export function releasePlan(
  classStart: number,
  sections: readonly { id: string; plannedSec: number; graded: boolean }[],
): { id: string; at: number | null }[] {
  let elapsedMs = 0;
  return sections.map((s) => {
    const at = s.graded ? null : classStart + elapsedMs;
    elapsedMs += s.plannedSec * 1000;
    return { id: s.id, at };
  });
}
```

Graded sections still add their duration to the running total; they only get a null time. Seconds are converted to milliseconds because all times are epoch milliseconds.

```ts packages/core/src/release.ts
  if (ctx.releaseAll || ctx.reachedIds.includes(section.id)) return true;
  if (section.graded) return false;
```

The graded check comes before the time check, so time can never open a graded section.

## Your turn: faulty first

No gate failures happened while building this step (see the journal), so the faulty case below is a hypothetical, not a recorded mistake.

A learner writes `at = classStart + elapsed` where `elapsed` sums `plannedSec` without multiplying by 1000.

**Predict:** What happens to a class that starts at 1,000,000 ms?
**Run it:** Section 2 opens 60 ms after start instead of 60 s.
**Diagnose:** Seconds were added to a millisecond clock.
**Fix:** Multiply by 1000, as in the walkthrough.

## Technical glossary

- **Day key:** the secret a day's section keys come from.
- **Section key:** 32-byte HKDF output for one section index.
- **Release plan:** per-section time-based release times.
- **Reached:** the trainer's teleprompter has arrived at the section.

## Common questions

**Why not one key for the whole day?** Opening one section would open all.

## Reinforcement activity

Write a test that a graded section with `now` far in the future is still locked.

## Check yourself

1. Is `sectionKey(k, 1)` the same on every call?
   <details>Yes, HKDF is deterministic.</details>
2. What happens if one byte of a sealed section is flipped?
   <details>`openSection` throws, because AES-GCM authenticates.</details>
3. What is `at` for a graded section?
   <details>null.</details>
4. Can time alone release a graded section?
   <details>No; only reaching it or release-all.</details>

## Quick reference

`sectionKey`, `sealSection`, `openSection`, `releasePlan`, `isReleased` in `packages/core/src/release.ts`.

## Connection to the bigger picture

The server (SPEC 5.5) hands out section keys as the teleprompter advances.

## Next

Next: [MS 3.3 — Append-only hash-chained ledger](../ms-03.03/lesson.md).
