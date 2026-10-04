---
id: ms-04.07
title: Drop plan, retention, messages
module: 4
est_minutes: 45
prereqs: [ms-01.01]
objectives: 3
new_terms: 4
skills: [drop-plan, data-retention, url-generation]
source_refs: [{ path: packages/core/src/drop.ts, commit: 739e38c }, { path: packages/core/src/retention.ts, commit: 739e38c }, { path: packages/core/src/messages.ts, commit: 739e38c }]
next: end
---

# MS 4.7 — Drop plan, retention, messages

*Step 1 of N*

## Prerequisites

- Understanding of learner enrolment and teams
- Familiarity with immutable data structures
- Basic URL encoding and phone number formats

## You already understand this

- When a learner drops out, their work (tickets, reviews, team membership) needs to be reassigned or archived.
- Data governance rules require certain information to be deleted or anonymized after specific time periods.
- Messages sent via WhatsApp or other channels need properly formatted links and must handle international phone formats.

## The detective question

**Problem:** When a learner leaves a program, we need to safely handle their in-progress work and cleanly transition their responsibilities. Additionally, the system must enforce data retention policies. Finally, we need to enable messaging integrations.

**Options considered:**
1. Store full previous state in drop plan vs. store only references
2. Single configurable rule engine vs. type-specific hard-coded rules
3. Accept any phone format vs. require specific format with strict normalization

**Choice:** Drop plan stores only references. Retention uses type-specific rules. Messages normalize Indian phone numbers in standard formats.

**Why:** Drop plan design limits scope—store only IDs. Retention rules are auditable. Phone normalization is predictable.

## Learning objectives

1. Design a state-transition plan that separates discovery from action.
2. Apply time-based retention rules based on document type.
3. Normalize international phone numbers and generate shareable links.

## Conceptual understanding

**Drop plan:** Phase 1 discovers what to change. Phase 2 (undo) restores what can be restored (team, repos, bots), but not tickets—the trainer's reassignment decision is permanent.

**Retention:** Data has different lifespans by type. Transient (chat) deletes after time. Permanent (grades) pseudonymizes. Rules use `>=` boundary checks.

**Messages:** Phone numbers come in many notations. Normalize systematically: strip separators, remove prefixes in order, validate 10 digits, rebuild with country code.

## Walkthrough of the real code

### Drop plan: state-based transitions

```ts packages/core/src/drop.ts
export function dropPlan(
  classState: {
    tickets: { id: string; assignee: string | null }[];
    reviews: { id: string; reviewer: string }[];
    teams: Record<string, string[]>;
  },
  personId: string
): DropPlan {
  // Find all tickets assigned to this person
  const unassignTickets = classState.tickets
    .filter((ticket) => ticket.assignee === personId)
    .map((ticket) => ticket.id);

  // Find all reviews assigned to this person
  const reassignReviews = classState.reviews
    .filter((review) => review.reviewer === personId)
    .map((review) => review.id);

  // Find which team (if any) this person is in
  let removeFromTeam: string | null = null;
  for (const [teamId, members] of Object.entries(classState.teams)) {
    if (members.includes(personId)) {
      removeFromTeam = teamId;
      break;
    }
  }

  return {
    unassignTickets,
    reassignReviews,
    removeFromTeam,
    archiveRepos: true,
    stopBots: true,
  };
}
```

The function returns exact IDs and simple flags, leaving the action to the caller.

### Retention: type-specific timelines

```ts packages/core/src/retention.ts
const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

export function retentionDue(
  docs: readonly { id: string; type: string; createdAt: number; batchEndedAt: number | null; resultsAt: number | null }[],
  now: number
): { delete: string[]; pseudonymise: string[] } {
  const deleteIds: string[] = [];
  const pseudonymiseIds: string[] = [];

  for (const doc of docs) {
    const { id, type, createdAt, batchEndedAt, resultsAt } = doc;

    if (type === 'integrity') {
      // Delete 180 days after resultsAt
      if (resultsAt !== null && now >= resultsAt + 180 * DAY_MS) {
        deleteIds.push(id);
      }
    } else if (type === 'chat') {
      // Delete 1 year after createdAt
      if (now >= createdAt + YEAR_MS) {
        deleteIds.push(id);
      }
    } else if (type === 'container') {
      // Delete at batchEndedAt
      if (batchEndedAt !== null && now >= batchEndedAt) {
        deleteIds.push(id);
      }
    } else if (type === 'grade' || type === 'certificate') {
      // Pseudonymise 3 years after batchEndedAt, never delete
      if (batchEndedAt !== null && now >= batchEndedAt + 3 * YEAR_MS) {
        pseudonymiseIds.push(id);
      }
    }
  }

  return { delete: deleteIds, pseudonymise: pseudonymiseIds };
}
```

Each type has a different rule. Boundary check uses `>=` so retention happens the instant the deadline is reached.

### Messages: phone normalization and concatenation

```ts packages/core/src/messages.ts
export function waLink(phone: string, text: string): string {
  // Normalize Indian phone numbers: 91XXXXXXXXXX (10 digits)
  // Accept: +91XXXXXXXXXX, 0XXXXXXXXXX, 91XXXXXXXXXX, XXXXXXXXXX
  let normalized = phone.replace(/[\s\-+]/g, '');

  // Handle leading 0
  if (normalized.startsWith('0')) {
    normalized = normalized.slice(1);
  }

  // Handle 91 prefix
  if (normalized.startsWith('91')) {
    normalized = normalized.slice(2);
  }

  // Validate length
  if (normalized.length !== 10) {
    throw new Error(`Invalid phone number: expected 10 digits, got ${normalized.length}`);
  }

  // Ensure all characters are digits
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error('Invalid phone number: must contain only digits');
  }

  // Use 91 prefix for India
  const fullNumber = '91' + normalized;

  return `https://wa.me/${fullNumber}?text=${encodeURIComponent(text)}`;
}

export function copyAll(messages: readonly { name: string; text: string }[]): string {
  return messages.map((msg) => `${msg.name}:\n${msg.text}`).join('\n\n');
}
```

Phone normalization proceeds in order: remove separators, strip prefixes, validate. `encodeURIComponent` handles all special characters.

## Your turn: faulty first

1. **Mistaken tool use:** Tried `Read` tool on a directory path instead of `Bash ls`. Why? You thought Read could list directories. Problem: Read is for files. Lesson: choose the right tool—Read for files, Bash for directory operations.

2. **Scope mismatch:** Committed files (build/progress, docs/build-journal, course/steps) outside the session's declared scope. Why? The initial task instruction and TASKS.md didn't agree on scope paths. Problem: The session was created with TASKS.md scope (narrower), so close refused those files. Fixed with `--why` flag. Lesson: validate scope against TASKS.md before committing; use `--why` when the task includes metadata files.

3. **Boundary check order:** Using `>` instead of `>=` in retention logic. Why? You think "one ms before is not due yet." Problem: SPEC says "at" the deadline. Lesson: read date boundaries carefully; `now >= deadline`, not `now > deadline`.

## Technical glossary

- **Drop plan:** An immutable plan listing tickets, reviews, and team to transition.
- **Retention rule:** A policy specifying how long a document is kept (deleted, pseudonymized, or kept).
- **Phone normalization:** Converting phone numbers in various formats to a canonical form.
- **Boundary check:** Testing `now >= deadline`, not `now > deadline`.

## Common questions

**Q: Why doesn't undo restore tickets?**
A: The trainer's reassignment decision is permanent. Undo restores system-level infrastructure (team, repos, bots), not work decisions.

**Q: Why pseudonymize grades but not delete?**
A: Compliance: auditors verify grades exist, but privacy rules require names removed.

**Q: What happens if a phone number is invalid?**
A: `waLink` throws an error. The caller must catch it and ask the learner to re-enter.

## Reinforcement activity

Write a function that takes a CouchDB doc and calls `dropPlan`. Handle the case where a learner is in multiple teams and the case where they're in none.

## Check yourself

1. **What are the three document types that get deleted, and how long after which timestamp?**
   <details>
   Integrity logs: 180 days after resultsAt; chat: 1 year after createdAt; containers: at batchEndedAt.
   </details>

2. **Why does undoDropPlan not restore tickets?**
   <details>
   Because reassigning a ticket is a trainer decision that should stay permanent.
   </details>

3. **What's the difference between `now > deadline` and `now >= deadline`?**
   <details>
   `>=` triggers exactly at the deadline; `>` triggers one millisecond after. SPEC uses "at", so `>=`.
   </details>

## Quick reference

| Function | Input | Output |
|---|---|---|
| `dropPlan` | classState, personId | Plan with ticket/review/team IDs and flags |
| `undoDropPlan` | Plan | Team, repos, bots to restore |
| `retentionDue` | docs[], now | Delete and pseudonymise ID lists |
| `waLink` | phone, text | WhatsApp URL |
| `copyAll` | messages[] | Concatenated string |

## Connection to the bigger picture

Drop handles learner lifecycle. Retention enforces governance. Messages enable outreach. Together they ensure data integrity when people leave and compliance when time passes.

## Next

The next batch builds the package import and content gate.
