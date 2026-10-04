# MS 2.4 — Instructor Script: Graded Timing and Accommodations

**Timing: 40 minutes total**
- Intro & detective question: 8 min
- Walkthrough code: 12 min
- Faulty first activity: 8 min
- Q&A and wrap: 12 min

---

## Opening (2 min)

"You've built the core of grading. Now we need to answer a practical question: **When a learner takes a timed test offline, how do we know how long they actually spent?** And if they have documented accessibility needs for extra time, how do we grant that fairly?

This step is about time and trust. Time is fundamental to grading—you can't say someone deserves a grade if you don't know they took the time allotted. But device clocks drift. Networks drop. We need a system that works offline, detects problems, and doesn't blame the learner for things outside their control."

## The detective question (6 min)

Display the scenario:

> A learner in rural India sits down to take a 60-minute exam on their phone. They work offline. Their device records they started at 2:15 PM and finished at 2:55 PM. But their device clock is 10 minutes fast because it lost power and reset. The hub, when they sync later, says they started at 2:05 PM and finished at 2:45 PM according to the server's signed timestamps.
>
> Question: Did they cheat by recording false times? Or is this just normal device drift?

Give the group 2 minutes to discuss. Then reveal the three time sources and how we reconcile them:

1. **Device wall time:** 40 minutes (device says 2:15 to 2:55).
2. **Hub-signed time:** 40 minutes (server says 2:05 to 2:45)—same duration, different clock.
3. **Monotonic time:** ~40 minutes (elapsed seconds since the attempt started).

"All three measurements agree on the duration. The device clock is just offset. That's normal. We **don't trust wall time for grading**—we use the hub's signed time if available, and fall back to monotonic if offline. The device clock tells us when it happened, not how long it took."

Then, a second scenario:

> Same learner. Same exam. This time their device says 2:15 to 3:15 (60 min), but the hub says 2:05 to 2:35 (30 min).

"Now we have a real conflict. Did the learner spend an extra 30 minutes? Or did their device clock jump? We call this 'clock skew.' We flag it and let the instructor investigate."

## Architecture (3 min)

Draw or display this table:

| Time Source | Reliability | Who provides | Used for? |
|-------------|-------------|--------------|-----------|
| Hub-signed | Very high | Server after sync | Grading (authoritative) |
| Monotonic | High | Device's process timer | Grading (offline fallback) |
| Wall clock | Low | Device screen clock | Display, diagnostics |

"The key insight: **Monotonic time is more reliable than wall time.** Wall time can jump (NTP update, manual change). Monotonic time marches forward at a steady rate. Neither is perfect, but together they catch problems."

## Walkthrough the code (12 min)

Open `packages/core/src/timing.ts` in an editor.

### Part 1: Duration logic (6 min)

```ts
if (t.hubStart !== null && t.hubEnd !== null) {
  durationMs = t.hubEnd - t.hubStart;
} else {
  durationMs = t.monotonicMs;
  flags.push('offline-attempt');
}
```

"Rule 1: If the hub has signed both times, use that. You can't have a more reliable answer than cryptography. If either the start or end is missing—because the learner was offline, or there was an error—fall back to monotonic and flag it. The grade is still valid, but the instructor will see the flag and know to be alert."

### Part 2: Clock skew detection (6 min)

```ts
const deviceWallClockDurationMs = t.deviceEnd - t.deviceStart;
const skewMs = Math.abs(deviceWallClockDurationMs - t.monotonicMs);
if (skewMs > 60_000) {
  flags.push('clock-skew');
}
```

"We compare device wall time to monotonic time. If they differ by more than 60 seconds, something unusual happened. Why 60 seconds? It's a boundary:
- Normal NTP drift: <1 second.
- A timezone mistake (±5 hours): thousands of seconds—easy to catch.
- 60 seconds: Catches obvious problems like a device suspended for a few minutes or a manual clock adjustment, but doesn't panic over routine variation.
- **Absolute value:** We use `Math.abs()` because the device clock can drift forward or backward."

Point to the code and ask: "What would happen if we only checked `deviceDur - monotonic > 60_000` (no absolute value)?"

*Expected answer: We'd miss cases where the device clock drifted backward (e.g., device was suspended).*

### Part 3: Accommodations (depends on how much time is left)

If time allows, show:

```ts
export function effectiveLimitMs(
  baseMs: number,
  accommodation: { timeMultiplier?: number } | null
): number {
  let multiplier = 1;
  if (accommodation !== null && accommodation.timeMultiplier !== undefined) {
    multiplier = Math.max(1, Math.min(3, accommodation.timeMultiplier));
  }
  return baseMs * multiplier;
}
```

"If a learner has documented needs—dyslexia, ADHD, a physical disability—they might get 1.5× or 2× the normal time. We apply that here by multiplying the base limit. The clamp to [1, 3] prevents abuse: a mistyped '10×' becomes '3×' (still generous), and a '0×' becomes '1×' (no time reduction).

This logic is separate from measuring the attempt's actual duration. This is **applying policy**, not measuring facts."

## Faulty first activity (8 min)

Explain: "I've written a broken version of `gradedTiming`. Your job is to spot the bugs and understand why they matter."

Display the bad code from the lesson:

```ts
function gradedTiming_bad(t) {
  let flags = [];
  let duration = t.monotonicMs; // WRONG
  
  const deviceDur = t.deviceEnd - t.deviceStart;
  if (deviceDur - t.monotonicMs > 60_000) {  // WRONG
    flags.push('clock-skew');
  }
  
  if (!t.hubStart) flags.push('offline-attempt'); // WRONG
  
  return { durationMs: duration, flags };
}
```

Ask in pairs:
1. "What's wrong with always using monotonic?" (Ignore hub times, less secure.)
2. "What if the device clock is **behind** the monotonic? Will we catch it?" (No—only catching positive drift.)
3. "If `hubStart` is null but `hubEnd` is present, does this code flag offline-attempt?" (No—it only checks hubStart.)

Bring the group back and correct each bug. Ask: "Why does this matter?

- **Bug 1:** A learner could claim (falsely) that monotonic time was wrong, and we'd have no hub-signed proof.
- **Bug 2:** If their device clock drifted backward, we'd miss it and might under-flag a suspicious attempt.
- **Bug 3:** We'd treat an incomplete hub timestamp as 'hub was present,' which is false."

## Wrap-up (5 min)

"Timing is boring until it matters. Most attempts will have clean hub times and no skew. But the outliers—the learner whose device was offline, or whose clock drifted—that's where this code earns its keep. It flags the edge cases so instructors can think, not so they panic.

And accommodations? This is where accessibility becomes code. A 1.5× multiplier isn't a suggestion; it's a protected right, and clamping it to [1, 3] is how we prevent misuse without being paternalistic."

## Key takeaways

- Hub-signed times win because they're tamper-evident.
- Monotonic time is the offline fallback because it's steady.
- Device wall time is for display, not grading.
- Clock skew (|wall − monotonic| > 60s) is worth flagging.
- Accommodations apply a multiplier, clamped to [1, 3].
- Flags (offline-attempt, clock-skew) turn edge cases into signals.

---

## Total runtime: **40 minutes**
