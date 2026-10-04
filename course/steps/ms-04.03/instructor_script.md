# Instructor script — Appeals and AI policy

### Total runtime: **50 minutes**

> Say/Do teleprompter. `[SAY]` lines are read aloud; `[DO]`, `[TYPE]`, `[BOARD]`, `[PAUSE]` are actions;
> `⚠️ LIKELY CROSS-Q` marks questions students usually ask.

## Hook (0:00 — 0:03)

[SAY] A learner gets a grade they disagree with. They have a week to appeal. We'll walk through that process—it's a state machine with automatic escalation—and then look at how we control what AI tools are available during graded work.

## The appeal process (0:03 — 0:20)

[BOARD] Draw the state machine:
- `open` (learner opens)
- ↓ trainer acts within 7 days
- `upheld` or `rejected`
- ↓ learner unhappy OR 7 days pass
- `escalated`
- ↓ second reviewer decides
- `final-upheld` or `final-rejected`

[SAY] An appeal lives for 7 days. The trainer has that time to uphold or reject it. If the trainer doesn't act, or the learner is unhappy, the appeal escalates to a second reviewer. Once a final decision is made, nothing changes it.

⚠️ LIKELY CROSS-Q: What if the learner and trainer both agree on day 1? — Answer: The appeal closes. No escalation.

[SAY] One special case: if an attempt has unread AI suggestions, the appeal opens as `upheld` automatically. We're saying the AI feedback itself counts as the trainer's input.

## Faulty first (0:20 — 0:35)

[TYPE] Show the code that escalates an appeal after 7 days. Point out the `appealTick` function.

```ts
export function appealTick(appeal: Appeal, now: number): Appeal {
  if (appeal.state !== 'open') return appeal;
  if (now - appeal.openedAt >= APPEAL_WINDOW_MS) {
    return appealStep(appeal, { kind: 'escalate', by: 'system', at: now });
  }
  return appeal;
}
```

[SAY] Notice: `appealTick` doesn't modify the appeal. It returns a new appeal. The caller's code decides whether to save it. This is the pattern: `appealStep` also returns a new appeal.

[DO] Show a test: open an appeal, call `appealTick` 6 days later (no change), call it 7 days later (escalated).

⚠️ LIKELY CROSS-Q: Who runs `appealTick`? — Answer: The server, as a background task. It runs periodically so appeals don't get stuck.

## AI policy (0:35 — 0:48)

[SAY] During graded work, the instructor sets an AI policy: off, allowed, or explain-only. This controls what the learner can do.

[TYPE] Show the function.

```ts
export function aiAllowed(policy: 'off' | 'allowed' | 'explain-only', toolKind: 'chat' | 'repo-write' | 'run-command'): boolean {
  switch (policy) {
    case 'off': return false;
    case 'allowed': return true;
    case 'explain-only': return toolKind === 'chat';
  }
}
```

[SAY] `explain-only` is the interesting one. It allows chat (ask questions) but not repo-write (edit code) or run-command (execute). The intent: get explanation, not a finished answer.

[DO] Call the function a few times with different combinations. Show that `'allowed'` opens everything, `'off'` closes everything, `'explain-only'` splits the difference.

[SAY] The summary function counts how many times the learner used AI tools and reports the policy.

```ts
export function aiUsageSummary(policy: string, events: readonly { at: number; toolKind: string }[]): string {
  if (policy === 'off') return 'AI off';
  const count = events.length;
  if (policy === 'allowed') return `AI allowed; used ${count} times`;
  if (policy === 'explain-only') return `AI explain-only; used ${count} times`;
  return 'AI off';
}
```

[SAY] This summary goes in the grade report the learner sees: "AI explain-only; used 2 times" tells them exactly what was allowed and what they did.

⚠️ LIKELY CROSS-Q: Can the learner turn off AI to look smarter? — Answer: No, the policy is set for the entire item. The report shows their actual usage.

## Check yourself (0:48 — 0:50)

[SAY] Let's do a quick check.

[PAUSE] 3 seconds

[SAY] Appeals stay open for how long? Seven days. An appeal opened on Monday can still be appealed on Monday of the next week, but not Tuesday. Think about a grade you'd challenge: how long would you want to appeal it?

