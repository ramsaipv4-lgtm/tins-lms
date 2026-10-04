# Instructor script — Teleprompter pacing and script parsing

**Total runtime: 50 minutes**

---

## Hook (0:00 — 0:05)

[SAY] "Today we're building the teleprompter system—the part that tells instructors whether they're running on time and helps learners see which section is current. By the end of this lesson, you'll understand how we parse timing from the script and calculate pacing from real entry events."

[DO]
- Show the lesson's Detective question on screen
- Highlight the two SPEC requirements:
  - AC-17: pace calculation with actual vs planned durations
  - AC-18: parseScriptSections to extract headings with time ranges

---

## Conceptual foundation: Pacing math (0:05 — 0:20)

[SAY] "Let's start with the core idea. Here's a script structure:"

[BOARD]
```markdown
## Hook (0:00 — 0:05)       → planned 5 min = 300 sec
## Faulty first (0:05 — 0:20) → planned 15 min = 900 sec
## Fix and explain (0:20 — 0:40) → planned 20 min = 1200 sec
```

[SAY] "As the trainer teaches, the system records when they **enter** each section. The actual time for a section is from entry until the next section starts (or now, if we're still in it)."

[SAY] "If Hook took 360 seconds but was planned for 300, we're 60 seconds behind. That's `delta` = actual − planned."

[SAY] "`behindSec` is the sum of all positive deltas—all the time we've overrun. If we catch up later, it stays at the cumulative overrun."

[PAUSE] "Let me show you a concrete example."

[BOARD]
```text
Sections: [600s, 600s]
Entry events: [0, 720]  (enter section 1 at 0, section 2 at 720)
At now = 900:

Section 1: actual = 720 - 0 = 720 sec → delta = 120 (over)
Section 2: actual = 900 - 720 = 180 sec → delta = -420 (under, still in progress)
behindSec = 120 (only count positive deltas)
```

[SAY] "Section 1 took 2 extra minutes. Section 2 is only 3 minutes in, still under time. Total behind: 2 minutes."

⚠️ LIKELY CROSS-Q: "What if the trainer goes backwards or skips a section?" — Answer: "The system doesn't enforce order. It calculates from actual entry times. If section 2 is entered before section 1, that's fine."

---

## Parsing the script (0:20 — 0:35)

[SAY] "The script lives in markdown. We need to extract sections with timing. Here's what we're looking for:"

[BOARD]
```markdown
## Hook (0:00 — 0:05)
## **Faulty first (0:05 — 0:20)**
## Fix and explain [graded] (0:20 — 0:40)
```

[SAY] "The system finds all headings with time ranges in `(h:mm — h:mm)` format, calculates the duration, and creates a slug for the id."

[TYPE] Show example parsing:
```text
## Introduction to Loops (0:00 — 0:10)
↓
{ id: 'introduction-to-loops', title: 'Introduction to Loops', plannedSec: 600, graded: false }
```

[SAY] "We also handle `[graded]` markers—these sections never unlock by time alone, even if we're past their scheduled time."

[SAY] "And we extract the total runtime from lines like `Total runtime: **45 minutes**`. That's helpful for validation."

[TYPE] Show the regex pattern (simplified):
```regex
/^#+\s+.*?\s*\((\d+):(\d{2})\s*[—–-]\s*(\d+):(\d{2})\)/
```

[SAY] "This matches headings with times. We accept em dash, en dash, and hyphen interchangeably."

⚠️ LIKELY CROSS-Q: "Why create slugs? Why not just use the full title?" — Answer: "Slugs are URL-safe and stable. A title might have special characters or change slightly; a slug is deterministic."

---

## The pace() function (0:35 — 0:45)

[SAY] "Let's walk through the `pace()` function. It takes sections, events, and now, and returns pacing info."

[BOARD]
```ts
pace(
  sections: readonly { id: string; plannedSec: number }[],
  events: readonly { sectionId: string; at: number }[],
  now: number
): {
  perSection: { id: string; actualSec: number | null; deltaSec: number | null }[]
  currentId: string | null
  behindSec: number
}
```

[SAY] "For each section, if it was entered, we calculate actual time and delta. The current section is the one with the latest entry. behindSec is the sum of positive deltas."

[DO]
- Show the test case from AC-17 on screen
- Walk through each step of the calculation
- Show what `null` means (section never entered)

[SAY] "This is the core of teleprompter pacing. Everything else is UI."

⚠️ LIKELY CROSS-Q: "How do we know which is the current section?" — Answer: "The current section is the one with the most recent entry time. If no sections have been entered, currentId is null."

---

## Bringing it together: Exercise (0:45 — 0:50)

[SAY] "Now you're the builder. Here's a script with timing:"

[BOARD]
```markdown
## Intro (0:00 — 0:05)
## Main (0:05 — 0:20)
## Wrap (0:20 — 0:25)
```

[SAY] "The trainer enters Intro at 0, Main at 310 (5:10), and Wrap at 1200 (20:00). At now = 1320 (22:00), calculate the pacing."

[DO]
- Have learners work through the calculation
- Intro: 310 - 0 = 310, planned 300, delta = 10
- Main: 1200 - 310 = 890, planned 900, delta = -10
- Wrap: 1320 - 1200 = 120, planned 300, delta = -180, current
- behindSec = 10 (only the positive delta from Intro)

[SAY] "The trainer overran Intro by 10 seconds, caught up in Main, and is still early in Wrap. Total behind: 10 seconds."

---

## Summary

Teleprompter pacing is simple math: track section entry times, compare to planned durations, and sum the overages. The script parser extracts timing from markdown headings and handles various formatting quirks. Together, these give real-time pacing feedback that respect the reality of live teaching.
