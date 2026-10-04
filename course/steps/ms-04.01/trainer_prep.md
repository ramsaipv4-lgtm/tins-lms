# Trainer prep — Teleprompter pacing and script parsing

## Before you start (prerequisites)

Learners should have:
- Built the seeded randomness module (b2-1) to understand how time is passed as a parameter
- Some familiarity with regular expressions (regex)
- Understood the concept of time deltas (actual vs planned) from the lesson material

If some learners are weak on regex, have the regex pattern pre-drawn on the board.

## 45-minute self-study path

1. **Read the SPEC § 4.8** (10 min): Understand the function signatures, return types, and the three acceptance checks (AC-17, AC-18, and the total runtime parsing).

2. **Trace through AC-17 by hand** (10 min): Using the example from the acceptance test (planned 600+600, entries at 0 and 720, now 900), manually calculate:
   - Actual time for each section
   - Delta for each section
   - Which section is current
   - Behind time
   - Which sections have null values
   
   Verify your answers match the expected result in the test.

3. **Design the pace() function** (8 min): Sketch the algorithm:
   - How to match events to sections
   - How to determine the next event (when a section ends)
   - How to identify the current section
   - How to accumulate behind time

4. **Design the parseScriptSections() function** (8 min): Plan the regex:
   - Match heading lines (##, ###, etc.)
   - Capture title (may have ** bold markers)
   - Capture start and end times in h:mm format
   - Extract [graded] marker
   - Calculate duration in seconds
   - Generate slug from title

5. **Implement and test** (9 min): Write the code, run tests, debug any issues.

## Worked example → faded example

### Worked example: parsing a single heading

Input markdown:
```markdown
## Introduction to Loops (0:00 — 0:15)
```

Step-by-step:
1. Split markdown into lines
2. Match the regex pattern: `^#+\s+(.+?)\s*\((\d+):(\d{2})\s*[—–-]\s*(\d+):(\d{2})\)`
3. Extract:
   - Title: "Introduction to Loops"
   - Start: "0:15" → 0*3600 + 15*60 = 900 seconds
   - End: "0:15" → wait, that's wrong. Let me re-read the input...
   
Actually, input is `(0:00 — 0:15)`:
   - Start: "0:00" → 0*3600 + 0*60 = 0 seconds
   - End: "0:15" → 0*3600 + 15*60 = 900 seconds
   - Duration: 900 - 0 = 900 seconds

4. Create slug: "introduction-to-loops" (lowercase, non-alphanumerics → dash)
5. No [graded] marker, so `graded: false`
6. Result: `{ id: 'introduction-to-loops', title: 'Introduction to Loops', plannedSec: 900, graded: false }`

### Faded example: Parse this heading

```markdown
## **Graded Exam [graded] (1:00 — 1:30)**
```

(Learner fills in):
- Title after removing ** and [graded]: ___________
- Start time: _____ seconds
- End time: _____ seconds
- Duration: _____ seconds
- Slug: ___________
- Graded flag: _____

(Answers: "Graded Exam", 3600, 5400, 1800, "graded-exam", true)

## Top misconceptions

1. **Time format is h:mm, not m:ss or mm:ss**
   - "(0:15)" is 15 minutes (900 seconds), not 15 seconds
   - "(1:30)" is 1 hour 30 minutes (5400 seconds)
   - Show the conversion formula: `h * 3600 + m * 60`

2. **Behind time accumulates only from positive deltas**
   - A section that runs short doesn't make "ahead time"
   - If section 1 is 2 min late but section 2 catches up, we're still 2 min behind overall
   - `behindSec = sum of all positive deltas`

3. **The current section is the most recent entry, not the "next" section**
   - If events are [0, 720, 1200], at now=1300, we're in section 3 (most recent entry)
   - Not in some "next" or "planned" section

4. **Null values mean "never entered", not "not yet graded" or "not yet evaluated"**
   - A section with null actualSec and deltaSec simply hasn't been entered yet
   - It contributes nothing to behind time

5. **Slug generation is deterministic but not reversible**
   - "Introduction to Loops" → "introduction-to-loops"
   - "introduction-to-loops" ← cannot reliably reverse to original title
   - This is by design (URL-safe, stable across title rewrites)

## Questions students will ask (with answers)

**Q: What if two sections have the same slug?**
A: That would be a problem; the system would have duplicate ids. The real app validates that section ids are unique. In our tests, we assume well-formed scripts.

**Q: What if the trainer enters a section twice?**
A: The second entry time overwrites the first in the events map. The system calculates based on the most recent entry. This is probably a bug in the real system (the trainer accidentally tapped twice), but the math still works.

**Q: Why use em dash instead of hyphen?**
A: The spec allows all three (em dash, en dash, hyphen) to be robust to different Markdown editors. Some editors auto-convert hyphens to em dashes.

**Q: What if plannedSec is 0 (a section with no planned time)?**
A: The system would calculate delta normally. If a section took 60 seconds but was planned for 0, delta = 60 (very late). This is unlikely in practice but the math handles it.

**Q: How do we know behindSec is correct?**
A: We validate with unit tests. AC-17 specifies the exact calculation: "behindSec = sum of deltas of finished sections plus the current section's overrun (if any)". Our tests check this.

## Your mastery check (private)

Before you teach this:

- [ ] Trace through AC-17 example by hand without looking at code
- [ ] Explain why "current section" is determined by latest entry, not next event
- [ ] Describe the slug algorithm in plain English
- [ ] Manually parse the fixture script from the skill-template (if available) and verify ids
- [ ] Explain why behindSec can be negative or zero but not go into a "negative behind" state
- [ ] Write the regex pattern for matching headings (test on paper first)

If you struggle with any of these, spend extra time in the Conceptual understanding section of the lesson before teaching.
