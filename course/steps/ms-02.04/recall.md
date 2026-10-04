# MS 2.4 — Recall: Graded Timing and Accommodations

**Study these cards to reinforce key concepts.**

---

## Card 1: Why not use device wall time for grading?

**Q:** Why don't we just use the learner's device clock to measure how long they spent on the exam?

**A:** Device clocks are unreliable. They can be manually adjusted, updated by NTP (network time protocol) in ways that jump forward or backward by seconds or minutes, or suspended (on laptops). Wall time can drift from the true time by minutes or hours. Monotonic time, by contrast, is guaranteed to move forward at a steady rate, unaffected by manual changes or NTP. And hub-signed time is even better: it's cryptographically signed and proves what the server measured.

---

## Card 2: Hub-signed time hierarchy

**Q:** If we have both hub-signed times and monotonic time available, which one should we use for the official duration?

**A:** Hub-signed times always win. They are tamper-evident and not affected by the device's local clock. Use hub-signed duration when both `hubStart` and `hubEnd` are present. If either is missing (e.g., the learner was offline), fall back to monotonic with an 'offline-attempt' flag.

---

## Card 3: Detecting clock skew

**Q:** A device records a wall-clock duration of 40 minutes, but monotonic time says 30 minutes. Should we flag this?

**A:** The difference is 10 minutes = 600 seconds. Since 600,000 ms > 60,000 ms (60 seconds), yes, we flag it with 'clock-skew'. This signals something unusual—maybe the device clock jumped, the device suspended, or something else. It's not an error; it's a signal for the instructor to review.

---

## Card 4: Accommodations and clamping

**Q:** A learner's accommodation specifies `timeMultiplier: 0.2` due to a data entry error. What happens?

**A:** The multiplier is clamped: `Math.max(1, Math.min(3, 0.2))` = 1. The learner gets the full base time with no reduction. Clamping prevents accidental harm (setting 0.2× would unfairly reduce their time) while also capping abuse (someone entering 10× gets 3×).

---

## Card 5: Offline-first grading

**Q:** What does the 'offline-attempt' flag mean? Is the grade invalid?

**A:** No, the grade is valid. The flag means the learner was not connected to the hub when they took the exam, so we used monotonic time instead of hub-signed time. The grade is still fair—monotonic time is reliable—but the instructor sees the flag and can prioritize review if there's a dispute. Offline-first is normal in Coach LMS.

---

## Card 6: The three time sources

**Q:** List the three ways we can measure how long an attempt took, in order of reliability (most to least).

**A:**
1. **Hub-signed (start and end):** Most reliable. Cryptographically signed; not affected by device clock. Used when both are present.
2. **Monotonic time:** Reliable. Steady clock, not affected by manual changes or NTP. Used when hub times are missing. Flagged as 'offline-attempt'.
3. **Device wall time:** Least reliable. Can be manually adjusted, updated by NTP, suspended. Used only for display and diagnostics.

---

## Card 7: Why 60 seconds for clock skew?

**Q:** Why is the threshold for flagging clock skew set at 60 seconds, not 10 or 120?

**A:**
- **<10 seconds:** Too sensitive. Normal NTP drift is <1 second. You'd flag every attempt.
- **60 seconds:** Sweet spot. Catches obvious problems (manual clock adjustments, system sleep that jumps time) while ignoring routine variation.
- **>120 seconds:** Too lenient. Might miss a learner who manually reset their clock to pretend they spent less time.

---

## Card 8: Time multiplier bounds

**Q:** A learner has `timeMultiplier: 3.5` in their accommodation. What effective limit do they get?

**A:** Clamped to 3. `Math.min(3, 3.5)` = 3. So if the base limit is 60 minutes, the effective limit is 180 minutes (60 × 3). The system never applies more than 3× to prevent unreasonable accommodations.

---

## Card 9: Offline attempt + clock skew

**Q:** Can an attempt have both 'offline-attempt' and 'clock-skew' flags? What does that mean?

**A:** Yes. It means the learner was offline (no hub times), so we used monotonic, AND the device wall time differed from monotonic by >60 seconds. This is unusual and worth investigating, but not necessarily a problem. It could just mean the device was asleep for part of the attempt.

---

## Card 10: Separating timing and accommodation

**Q:** How are the `gradedTiming` function (which measures duration) and the `effectiveLimitMs` function (which applies accommodation) different?

**A:** `gradedTiming` measures what actually happened: how long the learner spent, whether it was offline, and whether the clock drifted. `effectiveLimitMs` applies policy: it takes a time limit and adjusts it based on the learner's documented needs. They are separate concerns.

---
