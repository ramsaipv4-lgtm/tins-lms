# Recall — Teleprompter pacing and script parsing

## Exercise 1 — Calculate behind time (8 min)

**What to do:** 

The script has three sections:
- Section A: planned 10 minutes (600 seconds)
- Section B: planned 15 minutes (900 seconds)
- Section C: planned 5 minutes (300 seconds)

Entry events:
- Entered A at t = 0
- Entered B at t = 720 (12 minutes)
- Entered C at t = 1620 (27 minutes)

At now = 1700 seconds, what is:
1. The actual time and delta for section A?
2. The actual time and delta for section B?
3. The actual time, delta, and whether section C is current?
4. The total behind time?

**The answer (check after):**

1. Section A: entered at 0, B entered at 720 → actual = 720 sec → delta = 720 - 600 = **120 seconds over**
2. Section B: entered at 720, C entered at 1620 → actual = 1620 - 720 = 900 sec → delta = 900 - 900 = **0 seconds (on time)**
3. Section C: entered at 1620, now = 1700 → actual = 80 sec → delta = 80 - 300 = -220 sec (under) → **current section**
4. Behind time = sum of positive deltas = **120 seconds**

## Exercise 2 — Parse a script excerpt (7 min)

**What to do:**

Given this markdown:

```markdown
# Trainer notes
### Total runtime: **45 minutes**

## Hook (0:00 — 0:05)
Introducing the concept.

## Worked Example (0:05 — 0:20)
Walk through a problem.

## Graded Practice [graded] (0:20 — 0:40)
Students attempt a problem.

## Discussion
(no timing)

## Wrap-up (0:40 — 0:45)
Summary and next steps.
```

Extract all sections using parseScriptSections. List each section with id, title, plannedSec, and graded flag.

**The answer (check after):**

```json
[
  { "id": "hook", "title": "Hook", "plannedSec": 300, "graded": false },
  { "id": "worked-example", "title": "Worked Example", "plannedSec": 900, "graded": false },
  { "id": "graded-practice", "title": "Graded Practice", "plannedSec": 1200, "graded": true },
  { "id": "wrap-up", "title": "Wrap-up", "plannedSec": 300, "graded": false }
]
```

(Discussion has no time range, so it's ignored. Total runtime extracted as 45 * 60 = 2700 seconds.)

## Cards

**Q:** What does `delta` mean in the context of pacing?

**A:** Delta is the difference between actual and planned time for a section: `delta = actual - planned`. Positive delta means the section took longer than planned (overrun); negative means it finished early.

---

**Q:** How is the current section determined?

**A:** The current section is the one with the most recent entry time. It's the section the trainer is actively in right now.

---

**Q:** Why does behindSec only count positive deltas?

**A:** Because being ahead of schedule is good; we don't penalize that. behindSec tracks cumulative overrun—how much extra time has been used up. It stays at that value even if later sections catch up.

---

**Q:** What time format is used in script headings?

**A:** Hours:minutes format, like `(1:23 — 1:45)`. This is 1 hour 23 minutes to 1 hour 45 minutes, which is 22 minutes of duration (1320 seconds).

---

**Q:** What does the `[graded]` marker do?

**A:** It marks a section as graded, which means it won't be automatically unlocked by time alone. The trainer must reach it for learners to unlock it.

---

**Q:** If a section is never entered, what values does it have?

**A:** Both `actualSec` and `deltaSec` are `null`. A null section doesn't contribute to behindSec.

---

**Q:** How are section ids (slugs) created from titles?

**A:** Titles are lowercased, and runs of non-alphanumeric characters are replaced with single dashes. Trailing and leading dashes are trimmed. Example: "Introduction to Loops" → "introduction-to-loops".

---

**Q:** What if sections are entered out of order?

**A:** The system doesn't enforce order. If section 2 is entered before section 1, the system calculates actual times based on the actual entry sequence. This allows trainers to skip ahead or revisit sections.

---

**Q:** Can behindSec be negative?

**A:** No. behindSec only accumulates from positive deltas. If the trainer is ahead of schedule, behindSec doesn't decrease below the highest point it reached.

---

**Q:** What happens if the script doesn't have a "Total runtime" line?

**A:** `scriptTotalSec()` returns `null`. The system can still parse sections and calculate pacing from the individual section timings.
