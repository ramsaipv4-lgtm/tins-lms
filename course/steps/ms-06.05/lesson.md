---
id: ms-06.05
title: Attempts, grade ledger, appeals and integrity log
module: 6
est_minutes: 40
prereqs: [ms-06.01]
objectives: 3
new_terms: 5
skills: [append-only-ledger, appeal-window, evidence-pack]
source_refs: [{ path: packages/server/src/routes/grading.ts, commit: 05dcdea }]
next: end
---

# MS 6.5 — Attempts, grade ledger, appeals and integrity log
*Step 5 of 7*

## Prerequisites

- The server foundation (ms-06.01): sessions, the central role table and `ctx`.
- The core ledger, appeal, timing and AI-policy functions (SPEC 4.9, 4.11, 4.12, 4.26).

## You already understand this

A paper exam has a script, a mark on the cover and a signed correction when the marker changes their mind. You never rub out the first mark. This step gives the server the same habit.

## The detective question

**Problem:** A learner submits graded work. A trainer marks it, later corrects the mark, and the learner appeals. How do we keep every mark, prove nothing was edited, and give the reviewer the facts?
**Options considered:** (1) overwrite a `score` field on the attempt; (2) keep a score field and a separate change log; (3) store each mark as a hash-chained ledger entry and let the attempt carry only a copy of the latest score.
**Choice:** Option 3. The first sign-off appends a ledger entry; every later sign-off appends a correction whose `corrects` points at the previous entry.
**Why:** The chain makes edits detectable (AC-20), a correction keeps the original (AC-21), and the appeal inbox can show the whole history without trusting a mutable field.

## Learning objectives

1. Store an attempt with its seed, mode, timing flags and AI-usage summary.
2. Sign off grades as ledger entries and corrections.
3. Open an appeal inside the 7-day window and serve its evidence pack to the trainer.

## Conceptual understanding

The route module only wires things together. The rules live in core: `seedFor` makes the per-class seed, `gradedTiming` produces the flags, `aiUsageSummary` writes the summary text, `appendEntry` builds the chain and `openAppeal` decides whether the window is open. The server adds who, when (always `ctx.clock.now()`) and where to store.

Role rules: a substitute may read the appeal inbox and the integrity log but never sign off a grade. That 403 comes from the central policy table, so it holds even before the handler runs (AC-62).

## Walkthrough of the real code

Sign-off. The first call has no entries; later calls link to the previous entry:

```ts packages/server/src/routes/grading.ts
    const ledgerId = `ledger:attempt-${attemptId}`;
    const prev = await ctx.store.get(db, ledgerId);
    const entries = prev?.entries ?? [];
    const next = await appendEntry(entries, {
      subject: `attempt:${attemptId}`, value: b.score, by, at: now, reason: b.reason,
      ...(entries.length ? { corrects: entries[entries.length - 1].seq } : {}),
    });
    await ctx.store.put(db, { type: 'ledger', id: ledgerId, schema: ctx.schema, subject: `attempt:${attemptId}`, entries: next, updatedAt: now, updatedBy: by });
```

Opening an appeal. The window starts when the grade was first published, falling back to the submit time:

```ts packages/server/src/routes/grading.ts
    const ledger = await ctx.store.get(db, `ledger:attempt-${attemptId}`);
    const publishedAt = ledger?.entries?.[0]?.at ?? attempt.submittedAt ?? attempt.updatedAt;
    const now = ctx.clock.now();
    const r = openAppeal({ id: attemptId, publishedAt, unreadConfirmations: unreadOf(attempt) }, now);
    if (!r.ok) throw ctx.http.fieldError('attemptId', r.reason, 409);
    await ctx.store.put(db, {
```

## Your turn: faulty first

A builder ran the new tests with `node --test packages/server/test/` and got `Cannot find module '.../packages/server/test'`. Find the cause before reading on. The fix: node 22 treats a directory as a script path, so pass a glob of files: `node --test packages/server/test/*.test.mjs`.

## Technical glossary

- **Ledger entry:** one hash-chained record with `seq`, `prevHash`, `hash`.
- **Correction:** an entry whose `corrects` names the earlier `seq`.
- **Evidence pack:** seed, mode, events, rubric rows and unread-confirmation count.
- **Appeal window:** 7 days from publication.
- **Integrity event:** `{ context, kind, at }` logged by the learner's device.

## Common questions

**Why store `score` on the attempt too?** For fast display; the ledger stays the truth.

**Why 409 for a closed window?** The request is valid but conflicts with the state of the grade.

## Reinforcement activity

Add a trainer route that rejects an appeal using `appealStep`. Which role guard does it need and where is the decision stored?

## Check yourself

1. Which module decides if an appeal is inside the window?
<details>core `openAppeal`, called from the route with the first ledger entry time.</details>
2. What does the second grade call append?
<details>A correction entry with `corrects` set to the previous seq; the original stays.</details>
3. Why does a substitute get 403 on grade sign-off?
<details>The central policy table lists that route for trainers only.</details>
4. When does an appeal open as upheld?
<details>When the attempt has an unread confirmed AI suggestion.</details>

## Quick reference

POST attempts, POST grade, POST and GET appeals, POST and GET integrity, all under `/api/classes/:id`.

## Connection to the bigger picture

The export (ms-06.06) writes these ledgers and events to the class archive.

## Next

End of chain for now.
