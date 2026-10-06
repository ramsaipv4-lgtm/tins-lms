---
id: ms-07.03
title: Attendance, wrap-up, messages, trainer notes, digest
module: 7
est_minutes: 45
prereqs: [ms-07.01]
objectives: 3
new_terms: 5
skills: [feature-group, private-data, core-reuse]
source_refs: [{ path: packages/server/src/routes/features/attend.ts, commit: 345b595 }, { path: packages/web/src/features/attend/wa.ts, commit: 345b595 }]
next: ms-07.04
---

# MS 7.3 — Attendance, wrap-up, messages, trainer notes, digest
*Step 28 of 41*

## Prerequisites

You already understand:
- How a feature group adds routes and strings (ms-07.01)
- What a REST route and a role guard are

## You already understand this

- A paper register: the teacher reads out a code, students write it down, the teacher ticks the roll.
- A staff-room notebook: comments about students stay in the staff room, not on the class notice board.

## The detective question

**Problem:** After class the trainer needs one tap to publish material and close attendance, a list of absentees with ready WhatsApp messages, private notes, and a Friday list of who is at risk, grouped by the same lab mistakes.

**Options considered:**
1. Compute everything in the browser from the replicated class database
2. Small server routes that return exactly what each screen needs, reusing core functions
3. Edit the existing attendance route

**Choice:** Option 2.

**Why:** Notes and lab comments must stay private, and the class database replicates to every learner. Option 3 is outside this task's files; option 1 would leak phone numbers and notes.

## Learning objectives

After this step you will be able to:
1. Explain why trainer notes live in the private database
2. Build a `wa.me` link and a "Copy all" text with core, not by hand
3. Group submissions with `clusterSubmissions` and send one comment to a cluster

## Conceptual understanding

The roster state is computed on the server from enrolments and attendance documents: verified, present (printed code), active or dropped. The wrap-up route is idempotent: its documents have fixed ids, so a second tap changes nothing. The digest counts missed class days from the schedule, then calls `atRisk`.

## Walkthrough of the real code

### Reuse core for clusters

```ts packages/server/src/routes/features/attend.ts
    const clusters = clusterSubmissions(attempts.map((a: any) => ({ id: a.id, failing: a.failing }))).map((cl, i) => ({
      index: i, signature: cl.signature,
      members: cl.ids.map((id) => {
        const a = byId.get(id); const k = ids.keyOf(a.personId);
        return { attemptId: id, personId: `person:${k}`, name: nameOf[k] ?? k, itemId: a.itemId ?? '' };
      }),
    }));
```

### Safe WhatsApp link

```ts packages/web/src/features/attend/wa.ts
export function waLinkSafe(phone: string, text: string): string | null {
  try { return waLink(phone, text); } catch { return null; }
}
```

`waLink` throws for a bad number; the screen then shows "No valid phone number" instead of crashing.

## Your turn: faulty first

Faulty attempt 1: the comment button was named "Send comment" and the journey looked for exactly "send". How do you find the exact name a test needs? (Read the accessible-name pattern in Appendix D and anchor your own label to it.)

Faulty attempt 2: attendance returned 403 `not-enrolled` for seeded learners. What did the probe script show, and where do you fix it when the old route is outside your files? (Add your own route that matches enrolments by person key.)

## Technical glossary

- **Roster**: the class list with today's attendance state.
- **Wrap-up**: the one-tap end-of-day publish.
- **Private database**: storage that never replicates.
- **Cluster**: submissions sharing the same set of failing checks.
- **At-risk level**: ok, watch or risk from `atRisk`.

## Common questions

- *Why not store notes on the learner's person document?* It replicates to the learner.
- *Why does the digest use the schedule?* A day can exist in the schedule with no package content.

## Reinforcement activity

List three documents the wrap-up writes and their fixed ids. (Answer: `wrapup:day<N>`, `report:day<N>`, `card:day<N>-<i>` per learner.)

## Check yourself

1. Where are trainer notes stored and why?
<details>In the private database, so they never replicate to learners.</details>
2. Why is wrap-up safe to tap twice?
<details>Its documents have fixed ids and are only created when missing.</details>
3. What does `waLink` do with a 7-digit number?
<details>It throws, so the screen shows no link.</details>

## Quick reference

`clusterSubmissions`, `atRisk`, `waLink`, `copyAll` from `packages/core`.

## Connection to the bigger picture

These screens give the trainer the daily loop; the substitute handover (ms-07.04) reads the same notes and at-risk list.

## Next

Next: [MS 7.4 — Teleprompter, substitute, trainer pack, rehearsal](../ms-07.04/lesson.md).
