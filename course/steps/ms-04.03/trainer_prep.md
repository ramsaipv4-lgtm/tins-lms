# Trainer prep — Appeals and AI policy

## Before you start (prerequisites)

- You are comfortable with immutable state objects (step ms-03.01 covers pairing state).
- You understand state machines (a series of states with transitions between them).
- You know why enforcing policies in code is better than hoping people follow rules.

## 50-minute self-study path

1. Read the SPEC sections 4.11 and 4.12 (appeals and AI policy).
2. Skim the appeal.ts and aipolicy.ts source files (they're short).
3. Run the unit tests locally: `node --test packages/core/test/appeal.test.mjs` and `node --test packages/core/test/aipolicy.test.mjs`.
4. Trace through a test by hand: open an appeal, call `appealStep` to uphold it, then call it again with a final decision. Check the history.
5. Write a small test yourself: open an appeal, call `appealTick` 6 days later (should not escalate), then 7 days later (should escalate).

## Worked example → faded example

**Worked:** Trace the code path for opening an appeal within the window, with no unread confirmations.
```ts
openAppeal({ id: 'a1', publishedAt: 1000, unreadConfirmations: 0 }, 2000)
→ now - publishedAt = 1000, which is < 7 days in ms
→ unreadConfirmations is 0, so skip that branch
→ return { ok: true, appeal: { state: 'open', openedAt: 2000, history: [] } }
```

**Faded:** Trace the code path for opening an appeal after the window closes.
```ts
openAppeal({ id: 'a1', publishedAt: 1000, unreadConfirmations: 0 }, 1000 + 7*24*60*60*1000 + 1)
→ now - publishedAt = 7 days + 1 ms, which is > APPEAL_WINDOW_MS
→ return { ok: false, reason: 'window-closed' }
```

## Top misconceptions

1. **Escalation happens automatically on read.** No: you must call `appealTick` to check and escalate. The appeal doesn't change until then.
2. **Final decisions can be overturned.** No: once `final-upheld` or `final-rejected`, the appeal is locked. Further `appealStep` calls return it unchanged.
3. **`explain-only` means "no AI".** No: it means "chat only." The learner can still ask questions; they just can't run code or edit repos with AI help.
4. **AI usage is logged automatically.** No: the function takes `events` as an argument. The caller's server code must track and pass them.

## Questions students will ask (with answers)

**Q: Why not just store the appeal and update it?**
A: Core has no database. Pure functions are easier to test and to reason about. The server code decides when to save a new appeal.

**Q: What if two people escalate the same appeal at the same time?**
A: That's a merge conflict (SPEC 4.13). The merge function will pick one or both escalations depending on the timestamps.

**Q: Can the trainer escalate their own decision?**
A: Yes, technically. `appealStep` doesn't check permissions. The server code should validate that the user has the right role for each action.

**Q: Why is the window exactly 7 days, not 5?**
A: That's a policy decision in the SPEC. Your job is to implement it. If it changes, the SPEC updates first, then you change the constant.

**Q: What if the clock goes backward?**
A: The appeal window uses subtraction: `now - publishedAt`. If `now` goes backward, the window gets longer. Node's clock should never go backward (NTP keeps it synced), but if it does, the appeal is still usable—no data loss.

**Q: Does `aiUsageSummary` tell me if the policy was actually followed?**
A: No: it just reports the policy name and the count of uses. The app must separately check that every use was allowed with `aiAllowed`.

## Your mastery check (private)

Answer these without looking at the code:

1. **Appeal flow:** How many milliseconds is the appeal window? (Answer: 604,800,000)
2. **Final state:** If an appeal is in `final-upheld`, what does `appealStep` do? (Answer: returns it unchanged)
3. **Escalation:** How does `appealTick` know an appeal should escalate? (Answer: checks if now - openedAt >= APPEAL_WINDOW_MS)
4. **AI policy:** Which policies allow `repo-write`? (Answer: only `allowed`)
5. **History:** When you call `appealStep`, what happens to the old appeal's history? (Answer: it's copied into the new appeal, then the new step is appended)

If you can answer all five, you're ready to teach.
