---
id: ms-03.03
title: Append-only hash-chained ledger
module: 3
est_minutes: 30
prereqs: [ms-01.01]
objectives: 3
new_terms: 6
skills: [hash-chain, append-only-ledger]
source_refs: [{ path: packages/core/src/ledger.ts, commit: 94555fc188f43f2fb8f05f642211c26c213ed142 }]
next: end
---

# MS 3.3 — Append-only hash-chained ledger
*Step 3 of N*

## Prerequisites

You already understand:
- SHA-256 and the `sha256` and `canonicalJson` helpers from ms-01.01
- Async functions and arrays in TypeScript

## You already understand this

- A paper cash book: you never rub out a line, you add a new line that cancels the old one.
- A git history: each commit names its parent, so changing an old commit changes every later id.

## The detective question

**Problem:** Grades and attendance marks must be correctable, yet nobody (not even a trainer) may quietly rewrite history. How do we keep a record where edits are visible?

**Options considered:**
1. A normal table with an `updatedAt` column.
2. An append-only list where a correction is a new entry (the `append-only-ledger` pattern), without hashes.
3. An append-only list where each entry also stores the hash of the one before it (the `hash-chained-log` pattern).

**Choice:** Option 3, as pure functions over an array: `appendEntry`, `verifyLedger`, `currentValue`.

**Why:** Option 1 forgets what was there. Option 2 shows history but cannot prove it was not edited. Option 3 makes any edit to an old entry break its own hash, so `verifyLedger` names the first bad entry. Pure functions (no file, no clock) fit SPEC D-22.

## Learning objectives

1. Build an entry hash from canonical JSON so it is stable.
2. Chain entries with `prevHash` and verify from the start.
3. Model a correction as a new entry that points at the old one.

## Conceptual understanding

Each entry has `seq` (0, 1, 2, ...), the caller's fields, `prevHash` and `hash`. The hash is SHA-256 of the canonical JSON of the entry without `hash`, so it covers `prevHash`. The first entry's `prevHash` is 64 zeros. `appendEntry` returns a new array and never touches its input. `verifyLedger` walks from the start and returns the first index where seq, link or hash is wrong. A correction is an ordinary entry with `corrects` set to the original's `seq`; `currentValue` returns the latest value for a subject. Caveat from the pattern: a writer can rebuild the whole chain, so the newest hash should be kept somewhere the writer cannot edit.

## Walkthrough of the real code

### Appending

```ts packages/core/src/ledger.ts
export async function appendEntry(
  ledger: readonly Entry[],
  entry: { subject: string; value: unknown; by: string; at: number; reason?: string; corrects?: number },
): Promise<Entry[]> {
  const last = ledger.length > 0 ? ledger[ledger.length - 1] : undefined;
  const body: EntryBody = {
    seq: last ? last.seq + 1 : 0,
    subject: entry.subject,
    value: entry.value,
    by: entry.by,
    at: entry.at,
    prevHash: last ? last.hash : GENESIS,
  };
  if (entry.reason !== undefined) body.reason = entry.reason;
  if (entry.corrects !== undefined) body.corrects = entry.corrects;
  const hash = await hashBody(body);
  return [...ledger, { ...body, hash }];
}
```

Optional fields are added only when present, so an absent `reason` never becomes a hashed `undefined`.

### Verifying

```ts packages/core/src/ledger.ts
export async function verifyLedger(ledger: readonly Entry[]): Promise<{ ok: boolean; brokenAt: number | null }> {
  let prev = GENESIS;
  for (let i = 0; i < ledger.length; i++) {
    const e = ledger[i];
    const { hash, ...body } = e;
    if (e.seq !== i || e.prevHash !== prev || (await hashBody(body as EntryBody)) !== hash) {
      return { ok: false, brokenAt: i };
    }
    prev = hash;
  }
  return { ok: true, brokenAt: null };
}
```

Edit entry 1 and its recomputed hash differs from the stored one, so `brokenAt` is 1 (AC-20).

## Your turn: faulty first

I hit no gate failures on this task, so these two faults are ones I avoided on purpose, not mistakes from the journal.

**Scenario 1: hash that skips the link.** Imagine `hashBody` hashed only `subject`, `value`, `by`, `at`.
**Predict:** can you delete entry 1 and still verify?
**Diagnose:** the hash omits `prevHash`, so entries are not tied together; only the seq check would catch it.
**Fix:** hash the whole entry minus `hash`.

**Scenario 2: key order.** Imagine hashing `JSON.stringify(body)` instead of `canonicalJson`.
**Predict:** what if the ledger is copied through a tool that reorders keys?
**Diagnose:** the same entry gets a different hash, so a good ledger fails to verify.
**Fix:** hash `canonicalJson(body)`.

## Technical glossary

- **Append-only:** entries are only ever added.
- **Hash chain:** each entry stores the previous entry's hash.
- **Genesis hash:** 64 zeros, the `prevHash` of entry 0.
- **Canonical JSON:** sorted keys, no spaces, so equal data gives equal bytes.
- **Correction:** a new entry whose `corrects` names an old `seq`.
- **brokenAt:** the first index where verification fails.

## Common questions

**Q: Does a correction delete the old value?** A: No. Both stay; `currentValue` shows the latest.

**Q: Can the chain stop a determined admin?** A: Not alone. They can rebuild every hash, so anchor the last hash elsewhere.

## Reinforcement activity

Append three entries, change `value` on entry 1 in a copy, and run `verifyLedger`. Then append a correction for entry 0 and print `currentValue`.

## Check yourself

1. What is `prevHash` of the first entry?
   <details>64 zeros (the genesis hash).</details>
2. Why is the input array left unchanged by `appendEntry`?
   <details>It returns a new array, so earlier versions of the ledger stay valid and callers cannot be surprised.</details>
3. You change `by` on entry 2 of 5. What does `verifyLedger` return?
   <details>`{ ok: false, brokenAt: 2 }`; entry 2's recomputed hash no longer matches.</details>
4. How is a mistaken value fixed?
   <details>Append a new entry with the right value and `corrects` set to the old seq; `currentValue` returns it.</details>

## Quick reference

```ts
let l = await appendEntry([], { subject: 'a', value: 1, by: 't', at: 1 });
l = await appendEntry(l, { subject: 'a', value: 2, by: 't', at: 2, corrects: 0 });
await verifyLedger(l); // { ok: true, brokenAt: null }
currentValue(l, 'a'); // 2
```

## Connection to the bigger picture

Grades, appeals and attendance (SPEC §4.9, §5.7) use this ledger. It reuses `sha256` and `canonicalJson` from ms-01.01.

## Next

Manifests, tar archives and signed class packages.
