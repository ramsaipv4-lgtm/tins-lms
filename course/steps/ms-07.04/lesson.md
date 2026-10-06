---
id: ms-07.04
title: Teleprompter, substitute, trainer pack, rehearsal
module: 7
est_minutes: 40
prereqs: [ms-07.01]
objectives: 3
new_terms: 6
skills: [polling, sealed-sections, pacing]
source_refs: [{ path: packages/web/src/features/tele/Today.tsx, commit: 940e3ba61a07d3cda1f43a9691593b623e066dbb }, { path: packages/web/src/features/tele/Prompter.tsx, commit: 940e3ba61a07d3cda1f43a9691593b623e066dbb }]
next: ms-07.05
---

# MS 7.4 — Teleprompter, substitute, trainer pack, rehearsal
*Step 29 of 42*

## Prerequisites

- React state and effects
- The sealed-section release rule (SPEC 4.7)

## You already understand this

- A teacher who hands out a worksheet page only when the class reaches it: the sealed text is on every desk, the key arrives later.
- A stopwatch lap: each press records when a section began, and the lap list tells you ahead or behind.

## The detective question

**Problem:** A learner's day page must show a section the moment the trainer taps "next", with no reload, while the text stays sealed until its key is released.

**Options considered:**
1. Websocket push from the hub.
2. Poll the day every 2 seconds and decrypt in the browser when a key appears.
3. Reload the page on a timer.

**Choice:** Option 2.

**Why:** No new dependency (D-14), it works through the existing hub, and the sealed text only opens with the key, so a poll leaks nothing early.

## Learning objectives

1. Poll a server view and render only what is released.
2. Decrypt a sealed section in the browser with core's `openSection`.
3. Compute ahead/behind with core's `pace` from local "entered section" events.

## Conceptual understanding

The server (content.ts) already seals sections and releases keys. The tele group adds read models: a day view that includes the key only for released sections, a substitution document per day, and a package-based trainer pack. The trainer's "next" posts the section to the existing teleprompter route and records a local event; `pace` turns events into planned versus actual. Rehearsal runs the same view without posting anything.

## Walkthrough of the real code

The learner page polls and opens each newly keyed section once.

```ts packages/web/src/features/tele/Today.tsx
  usePoll(async () => {
    if (!cls) return;
    try {
      const r = await api<{ sections: Sec[] }>(`/api/tele/classes/${cls.id}/days/${d}`);
      setSecs(r.sections); setErr(false);
      for (const s of r.sections) {
        const k = `${d}.${s.id}`;
        if (!s.key || done.current.has(k)) continue;
        done.current.add(k);
        try {
          const text = new TextDecoder().decode(await openSection(unb64(s.key), unb64(s.sealed)));
          setTexts((o) => ({ ...o, [k]: text }));
        } catch { done.current.delete(k); }
      }
    } catch { setErr(true); }
  }, 2000, [cls?.id, d]);
```

The trainer's pace line is derived, never stored.

```ts packages/web/src/features/tele/Prompter.tsx
export function paceText(behindSec: number): string {
  if (Math.round(behindSec) === 0) return t('tele.pace.even');
  return behindSec > 0 ? t('tele.pace.behind', { t: fmtDur(behindSec) }) : t('tele.pace.ahead', { t: fmtDur(behindSec) });
}
```

## Your turn: faulty first

Two real mistakes from the build journal.

1. The rehearsal started its clock when the day finished loading, so a page-clock fast-forward before the section list arrived gave "Ahead of plan by 15:00". Fix: pass the Start click time as `startedAt`.
2. `selectOption({ label: /self.?learn/i })` threw "expected string, got object". Fix: pass the exact option text.

## Technical glossary

- **Sealed section:** AES-GCM text that opens only with its section key.
- **Released:** reached by the trainer, released to all, or (ungraded) due by time.
- **Polling:** asking again every few seconds.
- **Pace:** planned versus actual section time.
- **Handover pack:** what a substitute needs to teach a day.
- **Self-learn:** the day played as text with no trainer; questions are queued.

## Common questions

**Q: Why decrypt in the browser?** A: The hub never serves plaintext of unreleased sections (D-38).

**Q: Why is the trainer's pace local?** A: It is a coaching aid, not a record.

## Reinforcement activity

Make the poll interval 10 seconds and measure how long a release takes to appear.

## Check yourself

1. When does the day view include a key?
<details>Only when the section is released.</details>
2. What does `behindSec` mean when negative?
<details>The trainer is ahead of plan.</details>
3. What does rehearsal not do that the live teleprompter does?
<details>It never posts a release to learners.</details>

## Quick reference

- `GET /api/tele/classes/:id/days/:index`
- `pace(sections, events, now)`

## Connection to the bigger picture

Wrap-up and delivery reports read the substitution documents written here.

## Next

Next: [MS 7.5 — Learner day — catch-up, cards, exit ticket, explain-it-back, first run, audio](../ms-07.05/lesson.md).
