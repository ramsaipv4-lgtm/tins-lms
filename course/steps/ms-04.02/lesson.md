---
id: ms-04.02
title: Shift engine
module: 4
est_minutes: 30
prereqs: [ms-01.01]
objectives: 3
new_terms: 5
skills: [pure-state-machines, seeded-choice, sla-status]
source_refs: [{ path: packages/core/src/shift.ts, commit: 8047257f1ef2de25ad02bfb3dd2f08cf2c0b1daa }]
next: end
---

# MS 4.2 — Shift engine
*Step 1 of N*

## Prerequisites

- Records and arrays in TypeScript
- Why core never reads the clock (SPEC section 2)

## You already understand this

- A help desk: tickets arrive, each has a deadline, and you are marked on how many you close in time.
- A card deck shuffled with a fixed seed gives the same deal every time.

## The detective question

**Problem:** A learner works through a simulated shift of tickets. Two learners with different seeds may see different variants, the same seed must replay identically, and a ticket not solved within its SLA counts as breached.
**Options considered:**
1. Store a clock inside the state and tick it.
2. Pass elapsed time as an argument and compute status from recorded event times.
3. List only arrived tickets in the state.
**Choice:** Option 2, with the state listing every ticket from the start (variant fixed by the seed) and `slaReport` filtering by arrival.
**Why:** Status is then a pure function of recorded times and the elapsed argument. Option 3 contradicted the acceptance check; the SPEC was corrected.

## Learning objectives

1. Derive a ticket status from recorded times and an elapsed argument.
2. Choose variants deterministically from a seed.
3. Score a rubric by mode without exceeding its maximum.

## Conceptual understanding

`startShift` draws one random number per pack ticket, in pack order, and picks a variant. `applyShiftEvent` records when a ticket was acknowledged or resolved. A wrong answer leaves the ticket open. `scoreShift` gives a rubric row its full weight only if the ticket was resolved correctly within its SLA.

## Walkthrough of the real code

Status comes from the deadline, counted from arrival.

```ts packages/core/src/shift.ts
function statusOf(spec: ShiftTicketSpec, p: Progress, elapsedMs: number): ShiftStatus {
  const deadline = (spec.arrivesAtMin + spec.slaMin) * MIN;
  if (p.resolvedAtMs !== null) return p.resolvedAtMs <= deadline ? 'resolved' : 'breached';
  if (elapsedMs > deadline) return 'breached';
  return p.ackedAtMs !== null ? 'acked' : 'waiting';
}
```

The report lists only tickets that have arrived and gives minutes left for open ones.

```ts packages/core/src/shift.ts
export function slaReport(
  state: ShiftState,
  elapsedMs: number,
): { ticketId: string; status: ShiftStatus; minutesLeft: number | null }[] {
  return arrivalOrder(state.pack)
    .filter((t) => t.arrivesAtMin * MIN <= elapsedMs)
    .map((t) => {
      const status = statusOf(t, state.progress[t.id], elapsedMs);
      const open = status === 'waiting' || status === 'acked';
      const deadline = (t.arrivesAtMin + t.slaMin) * MIN;
      return { ticketId: t.id, status, minutesLeft: open ? (deadline - elapsedMs) / MIN : null };
    });
}
```

## Your turn: faulty first

Real mistakes from the build journal.

1. The state listed only arrived tickets. The gate said `not ok 33 - AC-22 ...` with `expected: 1`, `actual: 0`. Three attempts changed the hash and none helped, because the SPEC text contradicted the acceptance check. Fix: list every ticket from the start.
2. `cat > /tmp/x.mjs` with no input hung until the timeout (exit 144). Fix: never read stdin by accident; use a scratch folder inside the worktree.
3. A debug edit that listed all tickets failed my own unit test first: `gate: builder unit tests fail`. Fix: revert and update the test to match the intended behaviour.

## Technical glossary

- **SLA:** the time allowed to resolve a ticket, counted from arrival.
- **Breached:** resolved late, or still open past the deadline.
- **Variant:** one of several versions of a ticket chosen by the seed.
- **Rubric mode:** live, recorded or emulated; the first listed is the default.
- **Monotonic ms:** milliseconds since the shift started, never wall-clock time.

## Common questions

**Q: Why does a wrong answer not resolve the ticket?** A: It scores like an unresolved ticket, so the learner can try again.

## Reinforcement activity

Start a shift with two seeds and print each ticket's variant. Then ask for the report at 4 minutes and at 11 minutes.

## Check yourself

1. When is a ticket breached?
<details>Resolved after its deadline, or still open once elapsed time passes arrival plus SLA.</details>
2. Why does the same seed give the same variants?
<details>The generator is seeded and consumed once per ticket in pack order.</details>
3. What sets modeFlag?
<details>The scored mode differs from the pack's first rubric mode.</details>

## Quick reference

- `startShift(pack, seed, startedAt)`, `applyShiftEvent(state, event)`
- `slaReport(state, elapsedMs)`, `scoreShift(state, mode)`

## Connection to the bigger picture

The shift runs the graded simulations of SPEC 4.10; times are hub-signed (D-27).

## Next

End of the chain for now.
