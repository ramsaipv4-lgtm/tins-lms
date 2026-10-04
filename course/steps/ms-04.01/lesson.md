---
id: ms-04.01
title: Teleprompter pacing and script parsing
module: 4
est_minutes: 50
prereqs: []
objectives: 3
new_terms: 4
skills: [teleprompter-pacing, script-parsing]
source_refs: [{ path: packages/core/src/pace.ts, commit: 9b41a35 }]
next: end
---

# MS 4.1 — Teleprompter pacing and script parsing

*Step 1 of N*

## Prerequisites

You already understand:
- How JavaScript arrays and objects work
- Basic string manipulation and regex
- Time calculations (converting between hours, minutes, seconds)
- The concept of scheduled timing in a classroom

## You already understand this

- How instructors need to track whether they're running on time or off schedule
- Why time estimates are important for lesson planning
- How markdown is used for documentation

## The detective question

**Problem:** Coach LMS needs to track whether an instructor is running ahead of or behind schedule during a live class, and the system needs to parse instructor scripts to extract timing information for automatic section release and pacing feedback.

**Options considered:**
1. Hardcode timing information into the database and have instructors manually update progress
2. Parse script headings to extract timing, track when instructors enter each section, calculate actual vs planned time
3. Use separate timing files and require instructors to log time separately

**Choice:** Option 2 — parse markdown scripts to extract section timings and a `pace()` function that calculates pacing by tracking when sections are entered.

**Why:** This approach:
- **Integrates with the script:** timing lives where instructors already write (the markdown script)
- **Automatic section tracking:** no extra manual logging needed, just track when trainer reaches each section
- **Learner-facing feedback:** the app can show learners which section is current and how far through the day we are
- **No external dependencies:** uses only standard regex and time arithmetic

## Learning objectives

After this step, you will understand:
1. How teleprompter pacing calculates behind/ahead time by comparing actual to planned section duration
2. How to parse markdown script headings with time ranges and convert them to section data
3. How the system determines the current section and calculates cumulative "behind time"

## Conceptual understanding

### Teleprompter pacing basics

A Coach LMS instructor script has sections like:

```markdown
## Hook (0:00 — 0:05)
## Faulty first (0:05 — 0:20)
## Fix and explain (0:20 — 0:40)
## Check yourself (0:40 — 0:45)
```

Each section has a **planned duration** (e.g., Hook = 5 minutes = 300 seconds).

As the trainer teaches, the system tracks when they **enter** each section. The actual time for a section is from when they entered it until they enter the next section (or now, if they're still in it).

**Behind time** is how much extra time the trainer has used up to now. If the first section took 360 seconds but was planned for 300 seconds, the trainer is now 60 seconds behind. If they catch up in the second section, behind time decreases.

### Script structure

The markdown script uses headings with time ranges:

```markdown
## Section Title (h:mm — h:mm)
```

The time range uses the **em dash** `—` (also accepts `–` or `-`), with times in `hours:minutes` format.

The system also:
- Detects `[graded]` markers to flag graded sections (these never unlock by time alone)
- Creates **slugs** from titles (lowercase, non-alphanumerics → single dash)
- Reads total runtime from `Total runtime: **N hours**` or `Total runtime: **N minutes**` lines

### Example: two sections

With sections:
- Section 1: planned 600 seconds (10 minutes)
- Section 2: planned 600 seconds (10 minutes)

And events (when trainer entered each section):
- Entered section 1 at time 0
- Entered section 2 at time 720 (12 minutes)

At now = 900:
- **Section 1:** entered at 0, left at 720 → actual = 720 seconds → delta = 720 - 600 = **+120 seconds over**
- **Section 2:** entered at 720, still in progress at 900 → actual so far = 180 seconds → delta = 180 - 600 = -420 seconds (under so far)
- **Behind time:** 120 seconds (trainer used 2 extra minutes so far; still in section 2 but not over yet)

## Walkthrough of the real code

### pace() function

```ts packages/core/src/pace.ts
export function pace(
  sections: readonly { id: string; plannedSec: number }[],
  events: readonly { sectionId: string; at: number }[],
  now: number
): PaceResult
```

The function:
1. Builds a map of events (which section was entered, at what time)
2. For each section, finds when it was entered and when the next section started
3. Calculates actual time = next section's entry time − this section's entry time (or now, if current)
4. Calculates delta = actual − planned
5. Sums all positive deltas to get behindSec (the trainer's cumulative overrun)

Key insights:
- Sections never entered have `null` for actualSec and deltaSec
- The current section is the one with the latest entry time
- behindSec only counts positive deltas (overages), not underages

### parseScriptSections() function

```ts packages/core/src/pace.ts
export function parseScriptSections(markdown: string): ParsedSection[]
```

Uses a regex to match:
```markdown
## [**]Title[**] (h:mm [—–-] h:mm)[graded]
```

It:
1. Extracts all heading lines from the markdown
2. Parses the time range and converts to seconds: `endSeconds − startSeconds`
3. Checks for `[graded]` marker (removes it from title)
4. Creates an id slug from the title (lowercase, collapse non-alphanumerics)
5. Returns all matching sections in order

### scriptTotalSec() function

```ts packages/core/src/pace.ts
export function scriptTotalSec(markdown: string): number | null
```

Searches for lines like `Total runtime: **45 minutes**` and extracts the number, converting hours or minutes to seconds. Returns `null` if not found.

## Your turn: faulty first

Here are three common mistakes learners make when first implementing pacing:

**Mistake 1:** Calculating behind time from ALL sections (positive and negative)
```ts
// Wrong: includes negative deltas
behindSec = sections.map(s => s.delta).reduce((a,b) => a + b, 0)

// Right: only positive deltas count
behindSec = sections.map(s => s.delta).filter(d => d > 0).reduce((a,b) => a + b, 0)
```

**Mistake 2:** Not realizing the current section is always the one with the most recent entry
```ts
// Trying to pass in currentId as a parameter
pace(sections, events, now, currentId)

// Right: figure out which section was entered most recently
const latestEvent = events.reduce((latest, e) => e.at > latest.at ? e : latest)
```

**Mistake 3:** Assuming time ranges are in minutes only
```ts
// Assuming (1:15) is just minutes
const minutes = 1 * 15  // Wrong!

// Right: it's hours:minutes
const seconds = 1 * 3600 + 15 * 60  // = 4500 seconds
```

## Technical glossary

- **Teleprompter:** script-following display used by instructors; here, the system that tracks progress through the script
- **Pacing:** how fast or slow the class is progressing relative to the planned schedule
- **Delta:** the difference between actual and planned values (actual − planned)
- **Behind time:** cumulative positive delta (how much extra time has been used)
- **Slug:** URL-safe identifier created from text (lowercase, non-alphanumerics → dashes)
- **Graded section:** content that counts toward a grade; never unlocks by time alone

## Common questions

**Q: What if the trainer skips a section and never enters it?**
A: That section will have `actualSec: null` and `deltaSec: null`. It won't contribute to behind time.

**Q: Can behind time be negative?**
A: No. `behindSec` only sums positive deltas. If the trainer is ahead of schedule, `behindSec` doesn't go negative; it just stops accumulating.

**Q: What if sections are entered out of order?**
A: The system doesn't enforce order. If section 2 is entered before section 1, the system calculates based on the actual entry times.

**Q: Does the script have to use em dashes? What about regular hyphens?**
A: The parser accepts em dash `—`, en dash `–`, and regular hyphen `-` interchangeably.

## Reinforcement activity

You are a trainer. The script says:
- Hook (10 min)
- Faulty first (15 min)
- Fix and explain (20 min)
- Check yourself (5 min)

You enter Hook at 0:00, Faulty first at 12:30 (750 seconds), and Fix and explain at 30:00 (1800 seconds). At 35:00 (2100 seconds), you're still in Fix and explain.

1. How long did Hook actually take?
2. What is the delta for Hook?
3. How much behind are you at 35:00?

## Check yourself

1. **What is the time range format in a script heading?** Look at the spec and describe how to convert `(2:15 — 2:30)` to seconds.

<details>
Hours:minutes format. Start = 2*3600 + 15*60 = 8100 sec. End = 2*3600 + 30*60 = 9000 sec. Duration = 9000 - 8100 = 900 sec (15 min).
</details>

2. **Given sections with planned [600, 600] and events at [0, 750], what is the delta for section 1 at now = 1000?**

<details>
Section 1: entered at 0, section 2 entered at 750. Actual = 750 - 0 = 750. Delta = 750 - 600 = 150 seconds.
</details>

3. **Why doesn't the system enforce that sections are entered in order?**

<details>
Because the real trainer might skip ahead (jump to an example) or go back (revisit a question). The system calculates based on actual times, not prescribed order.
</details>

## Quick reference

```ts
// Parse sections from a script
const sections = parseScriptSections(markdown)
// → [{ id: 'hook', title: 'Hook', plannedSec: 600, graded: false }, …]

// Get total runtime
const totalSec = scriptTotalSec(markdown)  // → 2700 (45 minutes)

// Calculate pacing
const result = pace(sections, events, now)
// → { perSection: […], currentId: 'section2', behindSec: 120 }
```

## Connection to the bigger picture

Teleprompter pacing is part of Coach LMS's **real-time classroom system**. It powers:

- **Learner dashboards:** "We're 5 min ahead of schedule" (negative behindSec)
- **Section release:** graded sections unlock when the trainer reaches them (not by time)
- **Trainer HUD:** projector display showing current section, time remaining, behind/ahead indicator
- **Post-class analytics:** "This section took 15 min; we planned 10 min"

The system respects that classrooms are unpredictable. A trainer might spend extra time on a hard concept or skip a section if it's not needed. Pacing is information, not a constraint.

## Next

[Next step — fill in when sequences are known]
