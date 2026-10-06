---
id: ms-04.03
title: Appeals and AI policy
module: 4
est_minutes: 50
prereqs: [ms-03.01]
objectives: 3
new_terms: 5
skills: [state-machines, immutable-state, policy-enforcement]
source_refs: [{ path: packages/core/src/appeal.ts, commit: 1f3fb653f01ebac843dc08e5ac4996d544077905 }, { path: packages/core/src/aipolicy.ts, commit: 1f3fb653f01ebac843dc08e5ac4996d544077905 }]
next: ms-04.04
---

# MS 4.3 — Appeals and AI policy
*Step 13 of 41*

## Prerequisites

- State machines (transitions, immutability)
- Milliseconds since Unix epoch for timing
- Policy enforcement patterns (whitelist/blacklist)

## You already understand this

- A learner can challenge a grade and the system tracks the dispute.
- AI tools have different risk levels: chat for clarification is safer than code changes.
- A policy says what is and is not allowed, and must be checked at the right time.

## The detective question

**Problem:** Learners need a fair process to appeal grades. Appeals go through a trainer first, then a second reviewer if the learner is unhappy. The system must escalate automatically if the trainer doesn't act. Meanwhile, during graded work, the AI tools available depend on a policy set by the instructor—some work might allow free use, other work only explanations.

**Options considered:**
1. Store appeals in a database and update them on reads; check for escalations at view time.
2. Model appeals as immutable state; escalate explicitly when `appealTick` is called.
3. Implement AI policy as role-based permissions, checked at runtime from a database.
4. Implement AI policy as static rules: a policy string determines what each tool kind is allowed.

**Choice:** Option 2 for appeals (immutable state, explicit escalation). Option 4 for AI policy (static rules, simple lookup).

**Why:** Immutable state (like pairing, release) is easy to test and reason about. Explicit escalation via `appealTick` gives tests control over time without side effects. Static policy rules are simpler than role-based checks and match the SPEC's straightforward definitions.

## Learning objectives

1. Model a multi-stage workflow as a state machine with immutable transitions.
2. Implement automatic actions (escalation) that are triggered by explicit calls with time.
3. Enforce policy rules by checking conditions and returning allow/deny answers.

## Conceptual understanding

An appeal is a state machine:
- `open` → (trainer acts within 7 days) → `upheld` or `rejected`
- → (learner unhappy or 7 days pass) → `escalated`
- → (second reviewer acts) → `final-upheld` or `final-rejected`

The 7-day window starts from when the attempt was published, not when the appeal opened. If an attempt has unread AI confirmations, it opens directly as `upheld`.

AI policy is a string: `'off'`, `'allowed'`, or `'explain-only'`. For each tool kind (`'chat'`, `'repo-write'`, `'run-command'`), the policy says yes or no. `'explain-only'` allows only `'chat'`. The summary counts tool uses and describes the policy.

## Walkthrough of the real code

Opening an appeal checks the window and handles unread confirmations.

```ts packages/core/src/appeal.ts
export function openAppeal(
  attempt: { id: string; publishedAt: number; unreadConfirmations: number },
  now: number,
): { ok: true; appeal: Appeal } | { ok: false; reason: 'window-closed' } {
  // Check if appeal window is still open (within 7 days of publishedAt)
  if (now - attempt.publishedAt > APPEAL_WINDOW_MS) {
    return { ok: false, reason: 'window-closed' };
  }

  // If attempt has unread confirmations, open as upheld with unread-confirmation reason
  if (attempt.unreadConfirmations > 0) {
    return {
      ok: true,
      appeal: {
        state: 'upheld',
        reason: 'unread-confirmation',
        openedAt: now,
        history: [],
      },
    };
  }

  // Otherwise, open as open
  return {
    ok: true,
    appeal: {
      state: 'open',
      openedAt: now,
      history: [],
    },
  };
}
```

Each step appends to `history` and moves to a new state.

```ts packages/core/src/appeal.ts
export function appealStep(appeal: Appeal, action: { kind: 'uphold' | 'reject' | 'escalate' | 'decide-final'; by: string; at: number; outcome?: 'uphold' | 'reject' }): Appeal {
  // Cannot change a final decision
  if (appeal.state === 'final-upheld' || appeal.state === 'final-rejected') {
    return appeal;
  }

  // Create the new step
  const step: AppealStep = {
    kind: action.kind,
    by: action.by,
    at: action.at,
  };

  if (action.outcome !== undefined) {
    step.outcome = action.outcome;
  }

  // Determine the new state based on the action kind
  let newState: Appeal['state'];
  switch (action.kind) {
    case 'uphold':
      newState = 'upheld';
      break;
    case 'reject':
      newState = 'rejected';
      break;
    case 'escalate':
      newState = 'escalated';
      break;
    case 'decide-final':
      if (action.outcome === 'uphold') {
        newState = 'final-upheld';
      } else if (action.outcome === 'reject') {
        newState = 'final-rejected';
      } else {
        // Should not happen based on SPEC
        return appeal;
      }
      break;
  }

  return {
    state: newState,
    reason: appeal.reason,
    openedAt: appeal.openedAt,
    history: [...appeal.history, step],
  };
}
```

AI policy is a simple rule check.

```ts packages/core/src/aipolicy.ts
export function aiAllowed(policy: 'off' | 'allowed' | 'explain-only', toolKind: 'chat' | 'repo-write' | 'run-command'): boolean {
  switch (policy) {
    case 'off':
      return false;
    case 'allowed':
      return true;
    case 'explain-only':
      return toolKind === 'chat';
    default:
      return false;
  }
}
```

## Your turn: faulty first

Three real mistakes during the build. Find the bug before reading the fix.

1. First implementation allowed `decide-final` to change a final appeal. The test showed `final-upheld` turning into `final-rejected`. Fix: check the state at the start and return unchanged if final.
2. The `aiUsageSummary` returned different wording: `'AI off'` but `'AI allowed (N times)'`. The test showed it expected `'AI allowed; used N times'`. Fix: unify the format with `'<policy>; used N times'`.
3. The appeal window used `>=` instead of `>`, rejecting appeals at exactly 7 days. Fix: use `>` so day 7 still works.

## Technical glossary

- **Appeal window:** 7 days = 7 × 24 × 60 × 60 × 1000 milliseconds.
- **Immutable state:** each call returns a new object; the old one is never changed.
- **Escalation:** automatic transition to `escalated` if a trainer doesn't act within 7 days.
- **Policy:** a rule set by the instructor that says what AI tools are allowed during a graded item.
- **Tool kind:** a category of AI action: `chat` (ask questions), `repo-write` (edit code), `run-command` (execute).

## Common questions

**Q: Why immutable appeals?** A: Pure functions are easy to test; the caller controls when a new appeal replaces the old one.

**Q: Why does `appealTick` not update in the database?** A: `appealTick` returns a new appeal; the caller's server code saves it. This keeps core free of database knowledge.

**Q: Why not reject all AI if just one tool is off?** A: Each tool has different risk. Chat is explanation; repo-write changes code. Let the policy pick per tool.

## Reinforcement activity

Write a function that takes an appeal and a list of action events, and applies them all in order using `appealStep`. Then call `appealTick` at a time 7 days later and check that it escalated.

## Check yourself

1. How long is the appeal window from the time an attempt is published?
<details>Exactly 7 days (7 × 24 × 60 × 60 × 1000 milliseconds). Appeals can open on day 7 but not after.</details>
2. What does it mean if an appeal has `reason: 'unread-confirmation'`?
<details>The attempt had unread AI suggestions, so the appeal opened as upheld automatically without waiting for a trainer.</details>
3. What happens if you call `appealStep` on an appeal in state `final-upheld`?
<details>It returns the appeal unchanged; the state cannot be changed once final.</details>
4. Which tool kinds does the `'explain-only'` policy allow?
<details>Only `'chat'`; not `'repo-write'` or `'run-command'`.</details>
5. What does `aiUsageSummary` return if the policy is `'allowed'` and there are 3 tool uses?
<details>`'AI allowed; used 3 times'`.</details>

## Quick reference

- `openAppeal(attempt, now)` → `{ ok: true; appeal } | { ok: false; reason: 'window-closed' }`
- `appealStep(appeal, action)` → `Appeal`
- `appealTick(appeal, now)` → `Appeal` (escalates if 7 days have passed)
- `aiAllowed(policy, toolKind)` → `boolean`
- `aiUsageSummary(policy, events)` → `string`

## Connection to the bigger picture

The server's appeal routes (SPEC 5.5, 5.6) call `openAppeal` and `appealStep` to handle learner requests. A background task runs `appealTick` periodically to escalate stale appeals. AI policy is read from the `attempt` document when graded work starts.

## Next

Next: [MS 4.4 — Conflict merge](../ms-04.04/lesson.md).
