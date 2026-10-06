---
id: ms-02.04
title: Graded Timing and Accommodations
module: 2
est_minutes: 40
prereqs: [ms-02.03]
objectives: 4
new_terms: 5
skills: [timing, accommodations, clock-skew, monotonic-time, offline-work]
source_refs: [{ path: packages/core/src/timing.ts, commit: bb6614112b654cb00aafed4aef9307b851f687d8 }]
next: ms-03.01
---

# MS 2.4 — Graded Timing and Accommodations
*Step 5 of 41*

## Prerequisites

- Ms-02.03 (Attempt scoring basics)
- Knowledge of cryptographic signing and time measurement
- Familiarity with device clocks and NTP synchronization

## You already understand this

- Time is fundamental to grading (SPEC §4.26, D-27)
- Device clocks drift or get adjusted by users
- Learners may have documented disabilities requiring extra time
- Offline-first means the hub may not always be available to sign times

## The detective question

When a learner sits down to take a graded assessment:
- Their device records the start and end **wall time** (what their clock says)
- They may work offline, so the hub doesn't see events in real time
- Hours later, the device syncs with the hub, which also has its own signed timestamps
- How do we measure the actual duration fairly, even if one clock drifted or the learner was offline?

And separately: a learner with a documented accommodation needs 1.5× the normal time. How do we apply this without allowing abuse?

**Problem:** Hub-signed times are reliable but may be missing (offline). Device wall times are always available but unreliable. We need both, with smart fallback and detection of problems.

**Options considered:**
1. Always use device wall time → fails when clocks drift or are manually adjusted.
2. Always use hub-signed time → fails when offline; learner waits until sync to see their result.
3. Hub when available, device wall time otherwise, and flag anomalies → gives us gradeability, safety, and offline-first UX.
4. Use monotonic time (elapsed seconds since the process started) → reliable but doesn't match real time for display.

**Choice:** Option 3 + use monotonic time as the fallback. Hub-signed times win when both start and end are present. If either is missing, fall back to monotonic and flag the result as an "offline attempt". Detect when device wall time drifts >60 seconds from monotonic and raise a "clock-skew" flag.

**Why:** SPEC §4.26 and D-27 say hub-signed times are the standard because they are tamper-evident and not affected by the learner's local clock. But monotonic time is more reliable than wall time because it runs at a steady rate unaffected by NTP updates or manual clock changes. The 60-second threshold is chosen to catch obvious drifts (e.g., a 10-minute timezone mistake) while ignoring tiny variation (<1 minute) from normal NTP operation. Flags let the grading system warn an instructor of unusual cases without blocking the learner.

For accommodations, a simple multiplier (1–3) is easy to apply and audit. Clamping prevents misuse while supporting real needs (1.5× or 2× for some disabilities, 3× in extreme cases).

## Learning objectives

By the end of this step, you will be able to:

1. **Distinguish** between wall-clock, hub-signed, and monotonic time in a graded system.
2. **Implement** fallback logic that chooses the most reliable duration measurement.
3. **Detect** and report clock skew (device clock drift >60 seconds from the monotonic clock).
4. **Apply** time accommodations safely (clamped 1–3×) to enforce accessible grading.

## Conceptual understanding

### Time sources in a graded attempt

An attempt has three potential time measurements:

| Source | Who provides | Reliability | Affected by learner? |
|--------|--------------|-------------|----------------------|
| **Hub-signed** | The hub, after sync | Very high (cryptographically signed) | No—learner can't change it |
| **Device wall time** | Learner's device clock | Low (user can adjust, NTP can jump it) | Yes—drifts with clock changes |
| **Monotonic time** | Process-local timer | High (steady, not affected by NTP) | No—measured in the attempt itself |

Hub-signed times are ideal but only available if the learner syncs with the hub (not always offline). Monotonic time is always available and reliable but doesn't correspond to real time (e.g., "5000 ms elapsed" doesn't tell you it was 2:30 PM). Device wall time bridges the gap for display but is unreliable for measurement.

### Clock skew detection

The device measures its wall-clock duration: `end − start`. Compare this to the monotonic duration. If they differ by >60 seconds, something unusual happened:
- The device clock was manually adjusted
- An NTP update jumped the clock forward or backward by a large amount
- The device was suspended (unusual for phones, possible for laptops)

A 60-second threshold allows for routine NTP drift (<1 second) and timezone mistakes while catching obvious problems.

### Accommodations and multipliers

A learner with a documented need might receive a time limit multiplier: 1.5× normal time, or 2×, or in rare cases 3×. This is applied to the **base time limit** (set by the assessment) and applies to **all** measurements.

For example:
- Base limit: 60 minutes (3,600,000 ms)
- Accommodation: 1.5× multiplier
- Effective limit: 90 minutes (5,400,000 ms)

The multiplier is clamped to [1, 3] to prevent abuse:
- 0.5× entered → clamped to 1× (no time deduction)
- 5× entered → clamped to 3× (realistic upper bound)

## Walkthrough of the real code

### `gradedTiming` function

This function resolves all three time sources and returns the authoritative duration plus any flags.

**Step 1: Choose the duration.**

```ts packages/core/src/timing.ts
export function gradedTiming(t: {
  hubStart: number | null;
  hubEnd: number | null;
  monotonicMs: number;
  deviceStart: number;
  deviceEnd: number;
}): { durationMs: number; flags: ('offline-attempt' | 'clock-skew')[] } {
  const flags: ('offline-attempt' | 'clock-skew')[] = [];

  let durationMs: number;

  // Hub times win when both exist
  if (t.hubStart !== null && t.hubEnd !== null) {
    durationMs = t.hubEnd - t.hubStart;
  } else {
    // Otherwise use monotonic duration with offline-attempt flag
    durationMs = t.monotonicMs;
    flags.push('offline-attempt');
  }

  // Check for clock skew: device wall-clock duration vs monotonic duration
  const deviceWallClockDurationMs = t.deviceEnd - t.deviceStart;
  const skewMs = Math.abs(deviceWallClockDurationMs - t.monotonicMs);
  if (skewMs > 60_000) {
    flags.push('clock-skew');
  }

  return { durationMs, flags };
}
```

If the hub has both start and end timestamps, compute the hub-signed duration. This is the most trustworthy. Otherwise, use the monotonic duration (which is always available) and note that the attempt was offline. Then, compare the device's wall-clock duration against the monotonic duration. A difference >60 seconds is worth flagging. Use absolute value to catch both positive drift (device clock ahead) and negative (device clock behind).

### `effectiveLimitMs` function

Apply a time-limit multiplier for accommodations.

```ts packages/core/src/timing.ts
export function effectiveLimitMs(
  baseMs: number,
  accommodation: { timeMultiplier?: number } | null
): number {
  let multiplier = 1;

  if (accommodation !== null && accommodation.timeMultiplier !== undefined) {
    // Clamp to 1-3
    multiplier = Math.max(1, Math.min(3, accommodation.timeMultiplier));
  }

  return baseMs * multiplier;
}
```

If no accommodation is provided (`null`) or no multiplier is set, use 1 (no change). Otherwise, clamp the multiplier to [1, 3] and multiply the base limit.

### Integration

In a real grading flow:

1. Call `gradedTiming()` with the attempt's hub times, monotonic duration, and device wall times
2. Get back the authoritative duration and any flags ('offline-attempt', 'clock-skew')
3. Call `effectiveLimitMs()` with the base time limit and the learner's accommodation
4. Compare the duration against the effective limit to decide if time was exceeded
5. Check flags to decide if the grade needs instructor review

## Your turn: faulty first

Here's a flawed implementation of `gradedTiming`. Spot the bugs:

```ts
function gradedTiming_bad(t) {
  let flags = [];
  let duration = t.monotonicMs; // WRONG: always use monotonic, ignoring hub times
  
  // Check clock skew
  const deviceDur = t.deviceEnd - t.deviceStart;
  if (deviceDur - t.monotonicMs > 60_000) {  // WRONG: only catches positive drift
    flags.push('clock-skew');
  }
  
  if (!t.hubStart) flags.push('offline-attempt'); // WRONG: only checks hubStart, not hubEnd
  
  return { durationMs: duration, flags };
}
```

**Issues:**
1. **Always uses monotonic** even when hub times are present. Hub times are more reliable; they should always win.
2. **Only detects positive drift** (`deviceDur - monotonicMs > 60_000`). Device clocks can drift backwards too; use `Math.abs()`.
3. **Incomplete offline check.** If `hubStart` exists but `hubEnd` is null, we can't compute a duration. Need to check both: `if (hubStart !== null && hubEnd !== null)`.

## Technical glossary

- **Wall-clock time:** The time shown by a clock on a wall or device screen (subject to manual adjustment and NTP).
- **Monotonic time:** Elapsed seconds since some fixed point in the past (usually process start), guaranteed to move forward steadily.
- **Hub-signed time:** A timestamp produced and cryptographically signed by the server, immune to device tampering.
- **Clock skew:** A discrepancy between two clocks, often due to drift, manual adjustment, or suspension.
- **Accommodation:** An adjustment to standard conditions (e.g., extra time) for a learner with documented needs.

## Common questions

**Q:** Why 60 seconds for the threshold?

**A:** It's a practical compromise. Normal NTP drift is <1 second. A timezone mistake (e.g., entering ±5 hours instead of local time) would differ by thousands of seconds, easy to catch. A 60-second threshold catches obvious problems (manual clock changes, system updates that jump the clock) without false alarms from routine variation.

**Q:** What if the hub time is only partially available (start but not end)?

**A:** We treat this as offline. A duration needs both start and end; if either is missing, fall back to monotonic.

**Q:** Can a learner request a 2.5× multiplier for their accommodation?

**A:** The system will accept it and clamp it to 3×. It's stored as 2.5, but when applied, it becomes 3. This prevents ambiguity: the learner gets the accommodation they're entitled to, no more.

**Q:** Does offline-attempt mean the grade is invalid?

**A:** No—the learner just wasn't connected to the hub at the time. The grade is valid but flagged so instructors know to double-check in case of disputes. Offline-first is a design principle; offline grading is normal.

## Reinforcement activity

Write a function that determines if a graded attempt should be flagged for instructor review:

```ts
function shouldFlagForReview(attempt, learner) {
  const timing = gradedTiming({
    hubStart: attempt.hubStartMs,
    hubEnd: attempt.hubEndMs,
    monotonicMs: attempt.elapsedMs,
    deviceStart: attempt.deviceStartMs,
    deviceEnd: attempt.deviceEndMs,
  });

  const limit = effectiveLimitMs(attempt.baseTimeLimitMs, learner.accommodation);

  // Return true if any of these are true:
  // - Duration exceeds the limit AND offline-attempt flag is set
  // - Clock skew is detected
  // - Grade is below passing and the learner has a pending appeal

  return (
    (timing.durationMs > limit && timing.flags.includes('offline-attempt')) ||
    timing.flags.includes('clock-skew') ||
    (attempt.score < 6 && attempt.appeal?.status === 'open')
  );
}
```

## Check yourself

1. **You have hub start=1000, hub end=5000, monotonic=4000. What is the duration, and are there any flags?**
   <details>
     Duration: 4000 (hub times win). Flags: none (hub times were present, and device clock difference is not >60s).
   </details>

2. **Hub times are both null. Monotonic is 4000. Device went from 1000 to 605000 (10 min difference). What do you report?**
   <details>
     Duration: 4000 (monotonic). Flags: ['offline-attempt', 'clock-skew']. The huge device clock difference (604000 ms) is way over the 60s threshold.
   </details>

3. **A learner has a 1.5× accommodation and a base time limit of 60 minutes. What is the effective limit in milliseconds?**
   <details>
     60 minutes = 3,600,000 ms. Effective limit = 3,600,000 × 1.5 = 5,400,000 ms = 90 minutes.
   </details>

4. **A system error passes a time multiplier of 0 to effectiveLimitMs. What happens?**
   <details>
     Math.max(1, Math.min(3, 0)) = Math.max(1, 0) = 1. The multiplier is clamped to 1, so the learner gets the full base time (no reduction, no extension).
   </details>

5. **Why don't we use device wall-clock time directly to compute duration?**
   <details>
     Because the device clock can be manually adjusted, reset by NTP, or suspended. Monotonic time is guaranteed to move forward at a steady rate and is not affected by these events. Hub-signed time is even better because it's cryptographically signed and not controlled by the device.
   </details>

## Quick reference

**`gradedTiming(t)`**
- Returns the authoritative duration and any flags ('offline-attempt', 'clock-skew').
- Hub times win if both are present.
- Monotonic is the fallback (with 'offline-attempt' flag).
- Detects clock skew: |device wall time − monotonic| > 60s.

**`effectiveLimitMs(baseMs, accommodation)`**
- Applies the time multiplier from an accommodation.
- Multiplier defaults to 1 and is clamped to [1, 3].
- Returns baseMs × (clamped multiplier).

## Connection to the bigger picture

Grading is a trust boundary: learners want fair assessment, instructors want confidence in grades, and the system needs to prove both. Time is part of that proof.

- **Offline-first design** (D-20) means grading happens without always being connected. Monotonic time makes this possible.
- **Hub-signed times** (D-27) make grading tamper-evident. No learner can later claim they only spent 10 minutes on a 60-minute exam.
- **Accommodations** (SPEC §4.26) uphold disability rights. Clamping the multiplier prevents abuse while ensuring real needs are met.
- **Flags** (clock-skew, offline-attempt) turn ambiguous cases into signals. An instructor can review flagged grades manually; most are fine, but some might need a conversation with the learner.

Together, these mechanisms balance automation with human judgment—the system grades most attempts cleanly, flags edge cases, and trusts instructors to investigate anomalies.

## Next

Before you continue, do [Checkpoint 1](../../checkpoints/checkpoint-1/checkpoint.md).

Next: [MS 3.1 — Rotating attendance code, pairing codes, certificate ids](../ms-03.01/lesson.md).
