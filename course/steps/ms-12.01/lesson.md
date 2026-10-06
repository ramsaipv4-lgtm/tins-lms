---
id: ms-12.01
title: The last two rows
module: 12
est_minutes: 45
prereqs: [ms-11.01]
objectives: 4
new_terms: 6
skills: [state-ownership, race-conditions, performance-profiling, dropped-input]
source_refs: [{ path: packages/server/src/routes/features/shift.ts, commit: 53ae25f0b92304507461ab3b34805baed308d562 }, { path: packages/web/src/features/shift/Shift.tsx, commit: 53ae25f0b92304507461ab3b34805baed308d562 }, { path: packages/web/src/features/coach/lib.ts, commit: 53ae25f0b92304507461ab3b34805baed308d562 }, { path: packages/web/src/features/coach/Shot.tsx, commit: 53ae25f0b92304507461ab3b34805baed308d562 }, { path: packages/web/src/features/coach/Gate.tsx, commit: 53ae25f0b92304507461ab3b34805baed308d562 }]
next: end
---

# MS 12.1 — The last two rows
*Two failures that were not what they looked like*

## Prerequisites

- A React state hook and an effect
- That the Coach PIN record lives in the learner's personal database
- That the Shift pack has a duration and a learner can have a time multiplier

## You already understand this

- A timetable shows the length of a lesson before the lesson starts.
- If two people count the cupboard while a third is still putting things in, the counts differ.
- A button that is greyed out still gets pressed by someone with a script.

## The detective question

**Problem:** Two acceptance rows stayed red after everything else merged. AC-153: an approved extra-time learner opened Shift and saw no timer. AC-94: the screenshot journey timed out on the phone profile and failed every other time on the desktop with "no document may be saved before the learner confirms".

**Options considered:**
1. AC-153: start the shift for the learner so the timer exists. Or show the limit before the start, from the server.
2. AC-94 phone: make recognition cheaper (smaller data, smaller picture). Or start early and never lose the upload.
3. AC-94 desktop: wait longer before the journey counts documents. Or make the one early document appear before anyone counts.

**Choice:** Show the limit from the server in the not-started state; start the worker early and queue an early upload; write the PIN record's salt when the PIN screen opens.

**Why:** Starting a shift stores a run and starts SLA clocks, showing a number does nothing. A timing log showed the phone failure was a dropped file, not slow recognition. A request log showed the count running before the PIN write in failing runs, so the fix is to remove the race, not to wait out of it.

## Learning objectives

1. Put a number the screen needs in the state the screen is in, computed by the server that owns the rule.
2. Tell "slow" from "ignored" by logging when a handler starts.
3. Queue an input that arrives before the screen is ready instead of dropping it.
4. Remove a race by moving a write earlier, not by sleeping.

## Conceptual understanding

**Single owner:** the accommodated limit is computed by `limitFor` on the hub; the screen only prints it.

**Warm-up:** work started when a screen opens (the recognition worker) so it is done when the user acts.

**Dropped input:** an event handler that returns early because a precondition is false, with nothing remembering the event.

**Race:** two things whose order is not guaranteed; here the journey's document count and the PIN write.

**Reserved record:** a record created early with part of its content (the salt) and completed in place later.

**Beacon:** `navigator.sendBeacon`, a fire-and-forget request, used here as a log line from a throttled browser.

## Walkthrough of the real code

The server now answers with the limit before any run exists:

```ts packages/server/src/routes/features/shift.ts
    if (!run || !pack) {
      // No run yet: still tell the learner the (accommodated) limit so the Shift screen can show it before the start.
      const any = pack ?? (await loadPack(key));
      return { status: 'none', hasPack: !!any, team, ...(any ? { limitMs: await limitFor(any, me), durationMin: any.durationMin } : {}) };
    }
```

The start screen prints it:

```tsx packages/web/src/features/shift/Shift.tsx
        {data.limitMs !== undefined && <p data-testid="shift-timer">{t('shift.shift.limit', { min: Math.round(data.limitMs / 60000) })}</p>}
```

A PIN exists only when the record has the wrapped key; the salt is reserved earlier:

```ts packages/web/src/features/coach/lib.ts
// A PIN exists once the record carries the wrapped data key. Before that the record may hold only the salt (reserveMeta).
export async function hasPin(person: string): Promise<boolean> {
  const meta = await dbGet(person, META_ID);
  return !!meta && typeof meta.wrapped === 'string';
}

// The PIN record is created when the PIN screen opens, with just the salt, and the key is added to the same record when
// the PIN is chosen. Stretching a PIN takes a while on a phone, so writing the whole record at the end made the first
// document of the personal database appear at an unpredictable moment, in the middle of whatever the learner did next.
export async function reserveMeta(person: string): Promise<void> {
  if ((await dbGet(person, META_ID)) !== null) return;
  await dbPut(person, { _id: META_ID, type: 'coachMeta', id: META_ID, schema: 1, updatedAt: Date.now(), updatedBy: `person:${person}`, salt: base64Encode(crypto.getRandomValues(new Uint8Array(16))) });
}
```

The PIN screen reserves it before it shows the setup form:

```tsx packages/web/src/features/coach/Gate.tsx
      void hasPin(person).then(async (has) => { if (!has) await reserveMeta(person).catch(() => {}); if (live && !unlockedKey(person)) setMode(has ? 'unlock' : 'setup'); }).catch(() => { if (live) setMode('setup'); });
```

A file chosen early waits for the screen:

```tsx packages/web/src/features/coach/Shot.tsx
  useEffect(() => { if (picked && rules && ready) { const f = picked; setPicked(null); void onFile(f); } }, [picked, rules, ready]);
```

## Your turn: faulty first

1. The phone run failed with `expected shot-confirm ... to be visible` after 68 s. A beacon at the start of `readScreenshot` never fired. Is recognition slow? What do you look at next? (Hint: `disabled={!rules || !ready || ...}` and `if (!file || !rules || !ready) return;`.)
2. After "fixing" the PIN record copy, the desktop run still said `1 !== 0`, alternating pass and fail. The request log showed `GET _all_docs` before `PUT coachMeta:main` in failing runs. Why does stretching the PIN make this alternate, and what single move removes it?

## Technical glossary

- **Single owner**: one place computes a rule.
- **Warm-up**: start slow work when the screen opens.
- **Dropped input**: an event ignored with no memory of it.
- **Race**: order not guaranteed.
- **Reserved record**: a document created early and completed in place.
- **Beacon**: a fire-and-forget request used as a log.

## Common questions

1. **Why not start the shift to show the timer?** It stores a run and starts SLA clocks.
2. **Why is the OCR data sent with Content-Encoding: gzip?** The browser inflates it natively; a script in the worker is much slower on a phone.
3. **Is a salt-only record a saved document?** It is the PIN record, with no learner data; entries are still saved only on Confirm.

## Reinforcement activity

Add the extended limit to the end-of-shift score screen and say which function must supply it so the screen cannot disagree with the running timer.

## Check yourself

1. Why does the server, not the screen, compute the limit? <details>The multiplier lives in the person record and `limitFor` clamps it with the same function the running shift uses.</details>
2. A handler returns early when `!ready`. What breaks and how do you fix it? <details>An early event is lost; keep it in state and process it when the precondition becomes true.</details>
3. How did you tell "slow" from "ignored"? <details>A log at the start of the handler never fired in the failing runs.</details>
4. Why does moving the salt write earlier remove the flake? <details>The count and the write no longer overlap: the record already exists before anyone counts, and completing it edits the same document.</details>

## Quick reference

- Limit in the not-started state: `GET /api/shift/state` returns `limitMs`.
- OCR data: `/api/coach/ocr/lang/eng.traineddata` (gzip on the wire).
- PIN record: `coachMeta:main`, salt first, wrapped key later.

## Connection to the bigger picture

Rows AC-153 and AC-94 are the last two of the v1 build.

## Next

This is the last step for now (`next: end`).
