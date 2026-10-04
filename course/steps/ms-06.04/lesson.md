---
id: ms-06.04
title: Sync rules and the merge pass
module: 6
est_minutes: 45
prereqs: [ms-06.01]
objectives: 3
new_terms: 6
skills: [replication-guards, conflict-merge-pass, encrypted-document-rules]
source_refs: [{ path: packages/server/src/routes/sync.ts, commit: a8ffc27 }]
next: end
---

# MS 6.4 — Sync rules and the merge pass

*Step 4 of N*

## Prerequisites

You already understand:
- What a database document and a revision are
- What an HTTP header and a status code are
- What a role check does (MS 6.1)

## You already understand this

- A post office sorting room: letters (documents) pass through a counter that checks the sender before they reach the shelves
- Two people editing the same paper copy: someone has to merge the edits

## The detective question

**Problem:** The sync endpoint `/db/*` is served by a library that replicates anything for anyone. We need to stop other learners reading a personal database, refuse clients that are too old, keep Coach entries encrypted and merge conflicting edits.

**Options considered:**
1. Patch the library
2. A proxy in front of `/db`
3. Guard functions that run before the library, plus changes feeds for merging

**Choice:** Option 3.

**Why:** The library stays untouched (D-9), the guards are small and testable, and a changes feed notices a conflict the moment it lands.

## Learning objectives

After this step you will be able to:
1. Say which header makes the hub refuse an old client and with which words
2. Explain how the merge pass leaves a database with no conflicts
3. Explain why a coach entry holds `enc: { iv, ct }` and never `kind` or `values`

## Conceptual understanding

Every `/db` request passes three guards in order. The schema guard compares `x-lms-schema` with the hub's schema using core `canSync`: three versions behind gets `update-app`. The access guard needs a session, lets only the owner into `person-<id>` and only trainers, coordinators and admins write to `org`. The document guard looks at writes: a `coachEntry` may only live in a personal database, is refused with `403` for a minor, and with `400` if it carries plaintext fields.

When two phones edit one ticket offline, both revisions survive on the hub as a conflict. A live changes feed sees it, core `mergeRevisions` builds one document, and the hub writes it as a new revision while deleting the losing ones. Phones pull the merged revision and see no conflict.

## Walkthrough of the real code

### Refusing an old client

```ts packages/server/src/routes/sync.ts
    const r = canSync(n, ctx.schema);
    if (r.ok) return next();
    // 426: the client or the hub must be updated; the body names the action (update-app / update-hub).
    return send(res, 426, r.action, `${r.action}: client schema ${n}, hub schema ${ctx.schema}`, { action: r.action });
```

### The merge pass

```ts packages/server/src/routes/sync.ts
    const type = String(winner.type ?? id.split(':')[0]);
    const { doc } = mergeRevisions(type, revs.map(strip));
    const merged = { ...doc, _id: id, id, _rev: winner._rev };
    await db.bulkDocs([merged, ...conflicts.map((rev) => ({ _id: id, _rev: rev, _deleted: true }))]);
```

### Playing the body back

```ts packages/server/src/routes/sync.ts
function replay(req: any, body: Buffer): void {
  const origOn = req.on.bind(req);
  let scheduled = false;
  Object.defineProperty(req, 'readable', { value: true, configurable: true }); // raw-body refuses an ended stream
```

## Your turn: faulty first

**Mistake 1:** The guard read the request body and every write answered `500 stream is not readable`. Why does the next handler see an empty stream?

**Mistake 2:** The first refusal body was `{ error: { schema: ... } }` and PouchDB crashed with `(fatalError.name || "").toLowerCase is not a function`. What shape does PouchDB expect?

**Mistake 3:** The owner's brand-new personal database answered `404`. What should happen on first request?

## Technical glossary

- **Replication:** copying documents between two databases in both directions
- **Revision:** one version of a document, named by `_rev`
- **Conflict:** two live revisions of one document
- **Merge pass:** the hub's job that merges and removes conflicts
- **Schema header:** `x-lms-schema`, the client's document version
- **Ciphertext envelope:** `enc: { iv, ct }`

## Common questions

**Why 426?** Any 4xx works; 426 means "upgrade required".

**Can a trainer read a learner's coach data?** No: only the owner, and admin read-only; it is ciphertext anyway.

## Reinforcement activity

Replicate a ticket to two local PouchDB copies, edit each offline, push both, and watch the hub document until `_conflicts` disappears. Predict the winning status first.

## Check yourself

1. **Which action does a client three versions behind get?**

<details>
`update-app`, and its local data is untouched.
</details>

2. **Why is the merged revision written on the winner's revision?**

<details>
A new revision on the winning branch, plus deletions of the others, leaves exactly one live revision.
</details>

3. **What does a minor's personal database answer to any coachEntry?**

<details>
`403`.
</details>

## Quick reference

```ts
ctx.dbGuards.push(schemaGuard, accessGuard, documentGuard);
```

## Connection to the bigger picture

AC-122 (b6-7) reuses the minor rule; the web app (B7) sends `x-lms-schema` on every sync.

## Next

[Next step — fill in when sequences are known]
