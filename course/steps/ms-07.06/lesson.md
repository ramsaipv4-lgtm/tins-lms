---
id: ms-07.06
title: Shift, sprint rituals and the practice forge
module: 7
est_minutes: 40
prereqs: [ms-02.01]
objectives: 3
new_terms: 6
skills: [shift-engine, server-clock, ui-contracts]
source_refs: [{ path: packages/web/src/features/shift/Shift.tsx, commit: 3bec664 }, { path: packages/server/src/routes/features/shift.ts, commit: 3bec664 }]
next: ms-07.07
---

# MS 7.6 — Shift, sprint rituals and the practice forge
*Step 31 of 42*

## Prerequisites

You already understand:
- Pure core functions that take time as an argument (the Shift engine, SPEC 4.10)
- Hono routes with a role guard

## You already understand this

- A help desk: tickets arrive, each has a deadline, and a late answer counts as a miss.
- A team stand-up: everyone says what blocks them.

## The detective question

**Problem:** A Shift is a timed team exercise. Tickets must arrive as time passes, but the browser clock can be wrong and tests move time. How does the screen know which tickets exist and how long are left?

**Options considered:**
1. Count time in the browser with a timer and send it to the server.
2. Store the start time on the server and compute elapsed time from the server clock on every read.
3. Push every state change to every client with a socket.

**Choice:** Option 2. The run stores only its start and the list of events; each read replays them with the core engine.

**Why:** One clock decides, so a phone with a wrong time cannot cheat, tests move one clock, and a replay always gives the same score.

## Learning objectives

1. Explain why elapsed Shift time comes from the server clock.
2. Build a screen whose test ids and button names follow a written UI contract.
3. Find the cause of a journey failure from the failing step name.

## Conceptual understanding

The server keeps a shiftRun document with a start time and an event list. A read rebuilds the state with startShift and applyShiftEvent, then calls slaReport for the elapsed time. The same group also holds stand-up, poker, retro, change requests, peer review and the practice forge, each as a small route and screen.

## Walkthrough of the real code

The ticket row fires an event. Look at when the typed answer is cleared:

```tsx packages/web/src/features/shift/Shift.tsx
  const fire = (kind: 'ack' | 'resolve') => run(async () => {
    const typed = inputRef.current?.value ?? answer;
    if (kind === 'resolve' && !typed.trim()) { setNote(t('shift.shift.empty')); return; }
    const r: any = await api('/api/shift/events', { method: 'POST', body: { kind, ticketId: tk.id, answer: kind === 'resolve' ? typed : undefined } });
    setNote(kind === 'resolve' && !r.accepted ? t('shift.shift.wrong') : null);
    if (kind === 'resolve' && r.accepted) setAnswer('');
    await reload();
  });
```

The server refuses a prod deploy without an approved change request:

```ts packages/server/src/routes/features/shift.ts
    let crId: string | null = null;
    if (b.environment === 'prod') {
      const cr = (await store.list(db, 'changeRequest:')).sort((a: any, z2: any) => a.createdAt - z2.createdAt)
        .find((r: any) => r.status === 'approved' && !r.usedBy);
      if (!cr) throw fieldError('changeRequest', 'approval-required', 403);
      await store.put(db, { ...cr, usedBy: `person:${me}`, updatedAt: now() });
      crId = cr.id;
```

## Your turn: faulty first

Real mistake from the build (journal M1): the first version cleared the answer after every event, including acknowledge. On the throttled phone profile the learner typed an answer while the acknowledge request was still running, the request finished and wiped the text, and the resolve was sent empty. Fix it so only a resolve clears the answer.

## Technical glossary

- **SLA:** the time allowed to resolve a ticket from its arrival.
- **Breached:** resolved late or not at all inside the SLA.
- **Replay:** rebuilding state from the start time and the events.
- **Four-eyes:** a prod deploy needs someone else's approval.
- **Practice forge:** Forgejo on the hub, used before real GitHub.
- **UI contract:** the test ids and accessible names a journey relies on.

## Common questions

**Q:** Why not a socket?
**A:** Polling each second is simple and enough for a classroom.

## Reinforcement activity

Add a test that starts a shift, moves the test clock six minutes and checks that two tickets are listed.

## Check yourself

1. Why does the screen not count time itself?
   <details>The server clock is the single source; tests move it with the test clock.</details>
2. What does the run document store?
   <details>The start time, the seed and the list of events.</details>
3. Why was the answer lost on the phone profile?
   <details>A slow acknowledge response cleared the field after the learner had typed.</details>
4. What status does a prod deploy get without an approved change request?
   <details>403 with approval-required.</details>

## Quick reference

- Start: POST /api/shift/start; events: POST /api/shift/events; end: POST /api/shift/finish.

## Connection to the bigger picture

The same pattern, server clock plus stored events, serves exams (SPEC 4.26) and appeals (SPEC 4.11).

## Next

Next: [MS 7.7 — Appeals, doubts, drop, accommodations, content improvement](../ms-07.07/lesson.md).
