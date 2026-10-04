# MS 2.4 — Trainer Prep: Graded Timing and Accommodations

---

## Before the lesson

- [ ] Review the code in `packages/core/src/timing.ts`. Run the unit tests locally.
- [ ] Read the "Walkthrough of the real code" section of the lesson to familiarize yourself with the logic flow.
- [ ] Prepare a live editor (VSCode, etc.) with the `timing.ts` file open for reference.
- [ ] Have the faulty code from "Your turn: faulty first" ready to display (paste it into a doc or editor).

---

## Key points to emphasize

### 1. Hub-signed times are the gold standard

- They're cryptographically signed by the server.
- Immune to device tampering or clock drift.
- Always use them when both start and end are available.

### 2. Monotonic time is the reliable fallback

- Runs at a steady rate, unaffected by NTP or manual clock changes.
- Always available because it's measured on the device.
- Worth flagging as 'offline-attempt' because it's not as strong as hub-signed, but still trustworthy.

### 3. Device wall time is for display only

- Users see wall time on their screen (2:15 PM, 2:45 PM).
- But clocks can drift, so we don't use wall time for measuring duration.
- We compare wall time to monotonic to detect skew, but we don't rely on it.

### 4. Clock skew is a signal, not an accusation

- A flag for the instructor to be aware, not proof of cheating.
- Honest reasons for large discrepancies: device suspension, NTP update, timezone correction.
- Instructors should investigate, not automatically penalize.

### 5. Accommodations are policy, not measurement

- `gradedTiming()` measures what happened (facts).
- `effectiveLimitMs()` applies policy (accommodations).
- Clamping prevents errors and abuse while respecting real needs.

---

## Common student questions to anticipate

**Q: "What if the hub is slow to sync? Don't we get stale times?"**
A: Hub times are signed at the moment the attempt completes. Even if sync is delayed, the times are still valid and represent what actually happened. Latency in syncing doesn't change the times.

**Q: "Can a learner dispute a grade because of clock skew?"**
A: They can appeal, but the flag helps the instructor make an informed decision. If the learner was honest, the appeal process will likely overturn the grade. The flag just adds context.

**Q: "Why not use GPS time or an external time service?"**
A: GPS time requires GPS signal, which may not be available indoors or in some regions. External services add complexity and dependency. The hub's time is good enough for this use case.

**Q: "What if a learner has a very slow internet connection and the attempt takes longer to sync?"**
A: The attempt clock (monotonic) is measured on the device, independent of network speed. Network latency affects when we learn the result, not how long the attempt took.

**Q: "How do we know the monotonic clock is accurate?"**
A: Monotonic clocks in modern operating systems are very accurate (within milliseconds). They're not affected by user changes or NTP. They may drift slightly over very long periods, but for a 1-hour exam, monotonic time is essentially perfect.

---

## Demonstration script (if you have time)

If the group is technical, show a live demo:

```js
// Simulate an attempt
const attempt = {
  hubStart: 1000,      // Server says start at 1000 ms
  hubEnd: 65000,       // Server says end at 65000 ms → 64 second duration
  monotonicMs: 64100,  // Device's internal clock says 64.1 seconds elapsed
  deviceStart: 1000,   // Device wall clock: 1000 ms
  deviceEnd: 61100,    // Device wall clock: 61100 ms → 60.1 second duration
};

const timing = gradedTiming(attempt);
// Result:
// { durationMs: 64000, flags: ['clock-skew'] }
// Why? Hub says 64s. Monotonic says 64.1s (close). Device says 60.1s.
// Clock diff: |61100 - 64100| = 3000 ms = 3 seconds → <60s threshold, no skew.
// Wait, let me recalculate...
// Device wall clock duration: 61100 - 1000 = 60100 ms
// Monotonic: 64100 ms
// Difference: |60100 - 64100| = 4000 ms = 4 seconds → <60s, OK.
// So flags should be [] (no skew).

// Let's try an exaggerated example:
const attempt2 = {
  hubStart: 1000,
  hubEnd: 65000,
  monotonicMs: 64000,
  deviceStart: 1000,
  deviceEnd: 125000,  // Device wall clock 124 seconds = 124 second duration
};

const timing2 = gradedTiming(attempt2);
// Hub duration: 65000 - 1000 = 64000 ms
// Device duration: 125000 - 1000 = 124000 ms
// Diff: |124000 - 64000| = 60000 ms = exactly 60 seconds
// Threshold check: skewMs > 60000? No, 60000 is not > 60000.
// Result: { durationMs: 64000, flags: [] }
// But if deviceEnd = 125001:
// Diff: |125001 - 64000| = 61001 ms
// skewMs > 60000? Yes.
// Result: { durationMs: 64000, flags: ['clock-skew'] }
```

This shows the boundary in action.

---

## Potential pitfalls and how to address them

| Pitfall | How to avoid | What to say |
|---------|-------------|-----------|
| Student confuses duration (measurement) with limit (policy) | Emphasize: `gradedTiming` = facts; `effectiveLimitMs` = policy | "These are separate functions because they solve different problems." |
| Student assumes wall time is always available | Explain monotonic time | "Monotonic time is always available because it's measured by the process itself, not the OS clock." |
| Student thinks flags = cheating detected | Clarify flags are signals, not accusations | "A flag means 'unusual'—might be honest, might not. Instructor investigates." |
| Student forgets to check both hubStart and hubEnd | Review the condition | "`if (hubStart && hubEnd)` — both required." |
| Student doesn't use `Math.abs()` for clock skew | Show the failure case | "If device clock is behind monotonic, you'd miss the skew without `Math.abs()`." |

---

## Connection to downstream tasks

This task enables:
- **b2-5 (Attempt scoring):** Uses `gradedTiming` to measure how long an attempt took.
- **b2-6 (Appeals):** Uses timing flags to decide if a grade is reviewable.
- **b3-3 (Item analysis):** Uses attempt duration to identify problematic or impossible items.

---

## For offline facilitation

If you're teaching asynchronously or the group is distributed:

1. **Pre-record a 15-minute walkthrough** of the code and the faulty-first bug hunt.
2. **Provide the code on GitHub** for learners to clone and run locally.
3. **Use an async Q&A board** where learners ask questions and you respond.
4. **Record a 10-minute demo** of the 60-second clock-skew boundary.

---

## Notes on the "faulty first" approach

The three bugs in `gradedTiming_bad` are intentionally realistic:

1. **Bug 1 (ignoring hub times)** is something a beginner might do ("simpler code").
2. **Bug 2 (positive-only skew check)** is a classic boundary mistake ("I only tested one direction").
3. **Bug 3 (incomplete hub check)** is a null-check oversight ("I forgot `hubEnd`").

These aren't nitpicks; they're security and correctness issues. The activity reinforces **why the code is written the way it is**, not just that it works.

---
