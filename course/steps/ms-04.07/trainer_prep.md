# Trainer prep — Drop plan, retention, messages

## Before you start (prerequisites)

- Learners know `.filter()`, `.map()`, `Object.entries()`
- Immutable patterns (return new objects, don't mutate)
- Time arithmetic in milliseconds
- URL encoding basics

## 45-minute self-study path

1. Read lesson up to "Walkthrough" (15 min)
2. Code along instructor script—type implementations (15 min)
3. Work recall exercises (10 min)
4. Review Common questions (5 min)

## Worked example → faded example

**Worked:** Find team membership:
```js
for (const [teamId, members] of Object.entries(teams)) {
  if (members.includes(personId)) return teamId;
}
```

**Faded:** Complete the pattern:
```js
for (const [teamId, members] of Object.entries(classState.teams)) {
  if (___) removeFromTeam = teamId;
}
```
Answer: `members.includes(personId)`

## Top misconceptions

1. **"Undo should restore everything perfectly."** No. Plan records inventory, not state. Undo restores team and bots (system-level), but not tickets (trainer's decision is permanent).

2. **"Use `>` for boundary checks."** No. Retention happens *at* the deadline. Test: if deadline is 3 years, and 3 years have passed, it's due now. Use `>=`.

3. **"Just take the last 10 digits of a phone number."** Wrong. Input like `91098765432100` should throw, not truncate. Always validate exact count.

4. **"Pseudonymization deletes names."** Close. It removes names, emails, phone numbers, etc.—makes the record unusable for targeting. The record (grade value, cert number) survives.

## Questions students will ask (with answers)

**Q: If a learner is in two teams, which does `dropPlan` return?**
A: The first found. The loop exits after the first match. In practice, learners should not be in two teams.

**Q: What if `resultsAt` is null?**
A: The integrity log entry is never selected for deletion (the `if` checks `resultsAt !== null` first).

**Q: Can I use `Date` objects instead of milliseconds?**
A: No. Core is time-agnostic (SPEC §2). Caller converts `Date` to ms before calling.

**Q: What if `copyAll` is called with an empty array?**
A: Returns empty string.

**Q: Does the WhatsApp link work on mobile?**
A: Yes. `wa.me` is a deep link that opens WhatsApp on any platform.

## Your mastery check (private)

1. Write `dropPlan` without looking. Does it iterate teams correctly? Does it return only IDs, not full objects?

2. Write `retentionDue` for one type (grade). Did you use `>=`? Did you check for null?

3. Trace `waLink` with `+91-9876-543210`. Step by step: remove separators → remove 91 → `9876543210` → validate → `919876543210` → link. Correct?

4. Why doesn't `undoDropPlan` return ticket IDs? (Hint: who decides ticket reassignment?)
