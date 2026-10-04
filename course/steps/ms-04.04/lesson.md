---
id: ms-04.04
title: Conflict merge
module: 4
est_minutes: 30
prereqs: []
objectives: 3
new_terms: 6
skills: [conflict-merge, property-testing]
source_refs: [{ path: packages/core/src/merge.ts, commit: 9047a570ed0755336df32b22e3e4a8a6b1c57c40 }]
next: end
---

# MS 4.4 — Conflict merge
*Step 4 of N*

## Prerequisites
You can read a short TypeScript function and run `node --test` (ms-01.01).

## You already understand this
Two people edit the same shared shopping list on their phones with no signal. When both reconnect, the list must come out the same no matter whose phone syncs first.

## The detective question
**Problem:** A trainer's hub and a learner's phone each saved a different revision of the same document. Merging must give one answer, whatever the order or grouping, and a learner must not be able to change the pass mark.
**Options considered:** (1) Always keep the last revision received. (2) Pick the latest `updatedAt` for the whole document and nothing else. (3) A merge that picks a winner by `(updatedAt, updatedBy)`, unions arrays by `id`, and remembers where each protected value came from.
**Choice:** Option 3: the result carries `hubFields` and a small `mergeMeta` so that merging a result again behaves like merging the originals.
**Why:** Order-independence needs a total order on revisions. Associativity needs the result to remember who owned each element, status and class field; without that memory the second merge cannot tell a stale value from a fresh one.

## Learning objectives
1. State the three laws: order-independent, idempotent, associative.
2. Merge arrays by `id` and tickets by status rank.
3. Test the laws with a seeded generator instead of hand-picked examples.

## Conceptual understanding
A merge that satisfies the three laws is a join: merging a pile of revisions in any order or grouping lands on the same document. The winner is the largest `(updatedAt, updatedBy)`. A ticket status takes the highest of `todo < doing < review < done`, and the badge is true when more than one status was seen. Class-owned fields (`schedule`, `passMark`, `switches`) only come from revisions whose `updatedBy` starts with `hub:`.

## Walkthrough of the real code
The total order on revisions (content breaks exact ties so there is always one winner):

```ts packages/core/src/merge.ts
function cmpDoc(a: MergeDoc, b: MergeDoc): number {
  return cmpRank(rankOf(a), rankOf(b)) || cmpStr(canonicalJson(a), canonicalJson(b));
}
```

Ticket status and the badge, which remembers statuses from earlier merges:

```ts packages/core/src/merge.ts
      const idx = (s: string) => TICKET_ORDER.indexOf(s);
      const all = [...seen].sort((a, b) => idx(a) - idx(b) || cmpStr(a, b));
      doc.status = all[all.length - 1];
      conflictBadge = seen.size > 1;
      if (conflictBadge) mergeMeta.statuses = all;
```

A carried `hubFields` entry beats the revision's own field value:

```ts packages/core/src/merge.ts
        const carried = r.hubFields?.[f];
        if (carried && typeof carried === 'object' && 'value' in carried) consider(carried.value, carried.updatedAt);
        else if (typeof r.updatedBy === 'string' && r.updatedBy.startsWith('hub:') && r[f] !== undefined) consider(r[f], rankOf(r).updatedAt);
```

## Your turn: faulty first
I had no failing run on this task, so there is no real failure output to show. The faulty design below is one I found by reasoning while planning, before writing code, and it is recorded in the journal as a design near-miss rather than a gate failure.

**Scenario: array elements with the document's rank.** Revision a has rank 3 and no element X; b has rank 1 and X=1; c has rank 2 and X=2. Direct merge keeps X=2. Merge a and b first and the result has rank 3 and X=1 (from b); merging with c then keeps X=1, because the result outranks c. **Predict:** which value does each order give? **Diagnose:** the element lost its own rank when it was copied into the result. **Fix:** record the element's rank in `mergeMeta.elements` when it differs from the result's rank.

## Technical glossary
- **Idempotent:** merging a result with itself changes nothing.
- **Associative:** grouping does not matter.
- **Order-independent:** every permutation gives one result.
- **Provenance:** a note of where a value came from.
- **hubFields:** class-owned values with the time of their hub revision.
- **Property test:** a test over many generated inputs.

## Common questions
**Q: Why add `mergeMeta` to the document?** Without it the badge and element winners are lost on the second merge.
**Q: What if two revisions have the same rank and different content?** The larger canonical JSON wins, so the result is still deterministic.

## Reinforcement activity
Add a generator case with three class revisions where the hub revision has no `passMark`, and check what the merge does.

## Check yourself
1. What three laws must the merge satisfy?
<details>Order-independence, idempotence and associativity.</details>
2. Ticket revisions are `doing` and `done`. What are the status and the badge?
<details>`done` and true.</details>
3. A learner revision at the newest time sets `passMark` to 1. What is the merged value?
<details>The value from the latest `hub:` revision; the learner's is ignored.</details>
4. Why does the test use a seeded generator?
<details>It covers many cases and any failure can be replayed from its seed.</details>

## Quick reference
`mergeRevisions(docType, revisions)` returns `{ doc, conflictBadge }`.

## Connection to the bigger picture
Sync (D-6, D-24) calls this whenever a hub and a device disagree.

## Next
End of chain for now.
