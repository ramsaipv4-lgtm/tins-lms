# MS 2.4 — Activity Key: Graded Timing and Accommodations

---

## Faulty First Activity: Spot the Bugs

### The broken code:

```ts
function gradedTiming_bad(t) {
  let flags = [];
  let duration = t.monotonicMs; // BUG 1
  
  const deviceDur = t.deviceEnd - t.deviceStart;
  if (deviceDur - t.monotonicMs > 60_000) {  // BUG 2
    flags.push('clock-skew');
  }
  
  if (!t.hubStart) flags.push('offline-attempt'); // BUG 3
  
  return { durationMs: duration, flags };
}
```

---

## Bug 1: Always using monotonic instead of hub-signed time

### What's wrong:

```ts
let duration = t.monotonicMs; // WRONG: ignores hubStart and hubEnd
```

The code uses monotonic time unconditionally, even when hub-signed times are available.

### Why it matters:

- **Security:** Hub-signed times are tamper-evident and cryptographically signed. Monotonic time is not. If we ignore hub times, we lose a critical defense against cheating.
- **Audit trail:** The hub's signature proves what the server measured. Monotonic time proves nothing; the device generated it.
- **Trust:** A learner could later claim (falsely) that monotonic time was wrong and appeal their grade. We'd have no cryptographic proof to refute them.

### The fix:

```ts
if (t.hubStart !== null && t.hubEnd !== null) {
  duration = t.hubEnd - t.hubStart;  // Hub times win
} else {
  duration = t.monotonicMs;           // Fallback only if hub times are missing
  flags.push('offline-attempt');      // Flag the fallback
}
```

### Lesson:

Always use the most reliable source available. Hub-signed times are the gold standard.

---

## Bug 2: Only catching positive clock skew

### What's wrong:

```ts
if (deviceDur - t.monotonicMs > 60_000) {  // Only catches positive drift
  flags.push('clock-skew');
}
```

This only triggers when the device wall time is **more** than 60 seconds ahead of monotonic. It misses cases where the device clock is **behind** monotonic.

### Why it matters:

A device clock can drift backward:
- NTP update that sets the clock to an earlier time
- Device suspended and clock falls behind
- Manual adjustment that sets the clock earlier

Example:
- Device wall-clock duration: 30 minutes
- Monotonic: 40 minutes
- Difference: 30 − 40 = −10 minutes = −600 seconds

The condition `−600000 > 60000` is false, so we don't flag it. But the 10-minute discrepancy is huge and worth investigating.

### The fix:

Use absolute value to catch both directions:

```ts
const deviceDur = t.deviceEnd - t.deviceStart;
const skewMs = Math.abs(deviceDur - t.monotonicMs);  // Absolute value
if (skewMs > 60_000) {
  flags.push('clock-skew');
}
```

Now both positive and negative skew ≥60 seconds trigger the flag.

### Lesson:

When comparing measurements, always use `Math.abs()` unless you have a reason to care about the direction.

---

## Bug 3: Incomplete hub-time check

### What's wrong:

```ts
if (!t.hubStart) flags.push('offline-attempt');  // Only checks hubStart
```

The code only checks if `hubStart` is missing. It flags as offline even if `hubStart` is present but `hubEnd` is null (or vice versa).

### Why it matters:

We can only compute a duration from hub times if **both** start and end are present. If we have only one:
- `hubStart` present, `hubEnd` null: Can't compute a duration.
- `hubStart` null, `hubEnd` present: Can't compute a duration.

If we incorrectly assume hub times are available when they're not, we might compute a wrong duration. For example:

```ts
// hubStart = 1000, hubEnd = null
// Incorrectly treated as "hub time available"
duration = t.hubEnd - t.hubStart  // = null - 1000 = NaN ❌
```

### The fix:

Check both:

```ts
if (t.hubStart !== null && t.hubEnd !== null) {
  duration = t.hubEnd - t.hubStart;
} else {
  duration = t.monotonicMs;
  flags.push('offline-attempt');  // Flag the fallback
}
```

Only use hub times if both are present.

### Lesson:

When checking for optional fields, validate all the ones you need, not just the first one.

---

## Bonus: Why clamping matters for accommodations

### The broken approach (no clamping):

```ts
export function effectiveLimitMs_bad(baseMs, accommodation) {
  if (accommodation?.timeMultiplier !== undefined) {
    return baseMs * accommodation.timeMultiplier;  // No bounds
  }
  return baseMs;
}
```

### Problem:

- A system error sets `timeMultiplier = 0.5`: Learner gets 50% time (unfair reduction).
- A typo: `timeMultiplier = 10`: Learner gets 10× time (unreasonable).
- A malicious person: `timeMultiplier = 100`: Learner gets unlimited time.

### The fix (clamping):

```ts
let multiplier = 1;
if (accommodation !== null && accommodation.timeMultiplier !== undefined) {
  multiplier = Math.max(1, Math.min(3, accommodation.timeMultiplier));
}
return baseMs * multiplier;
```

- `0.5` → clamped to 1 (full time; no penalty).
- `10` → clamped to 3 (generous but reasonable).
- `100` → clamped to 3.
- `1.5` → kept as-is (valid).

### Lesson:

When applying policy values from untrusted sources, always validate and bound them.

---

## Student Variations and Discussion

### Variation 1: "Why not just use hub times always?"

**Answer:** Hub times require the learner to sync with the hub. If they work offline, there are no hub times. We'd have to delay grading until sync, breaking the offline-first principle. Monotonic time lets us grade immediately, online or offline.

### Variation 2: "Couldn't a device clock drift >60 seconds and still be honest?"

**Answer:** Yes, but it's rare and worth investigating. It usually means:
- The device was suspended (VM, laptop sleep).
- An NTP update jumped the clock.
- A manual adjustment.

All are worth flagging for instructor awareness. A 60-second threshold is conservative; it doesn't assume dishonesty, just says "this is unusual."

### Variation 3: "Can a learner disable monotonic time?"

**Answer:** No. Monotonic time is measured at the application level and is internal to the attempt. It's not sent over the network (where it could be intercepted), and the learner can't change it. Only the hub-signed times come from outside and could theoretically be disputed.

---

## Expected Learner Mistakes

| Mistake | Why they make it | Correction |
|---------|-----------------|-----------|
| Always trusting device wall time | Seems simpler, quicker | Wall time can drift. Hub-signed is tamper-evident. |
| Checking `hubStart` OR `hubEnd` separately | Forget you need both | Both must exist to compute a duration. Use `&&`. |
| Only catching positive clock skew | Test with device ahead only | Devices can drift backward too. Use `Math.abs()`. |
| Not clamping the time multiplier | Assume input is always valid | Apply bounds: `Math.max(1, Math.min(3, value))`. |
| Confusing duration (what happened) with limit (policy) | Same word, different concepts | `gradedTiming` measures. `effectiveLimitMs` applies policy. |

---
