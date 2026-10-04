# Activity key — Teleprompter pacing and script parsing (trainer only)

## Reinforcement activity: Calculate behind time (8 min)

### Expected answers

**Question 1: Actual time and delta for section A?**

Expected: 720 seconds, delta = 120 seconds

Marking rubric:
- Full marks: Both values correct (720, 120)
- Partial: Correct actual time but wrong delta, or correct reasoning but math error
- Zero: No answer or both values wrong

**Question 2: Actual time and delta for section B?**

Expected: 900 seconds, delta = 0 seconds

Marking rubric:
- Full marks: Both values correct (900, 0)
- Partial: One value correct, minor arithmetic error
- Zero: Both values wrong

**Question 3: Actual time, delta, and current status for section C?**

Expected: 80 seconds actual, -220 delta, is current

Marking rubric:
- Full marks: All three aspects correct
- Partial: Actual time correct but delta wrong, or correct status but wrong times
- Zero: Multiple errors or no attempt

**Question 4: Total behind time?**

Expected: 120 seconds

Marking rubric:
- Full marks: Correct value, shows understanding that only positive deltas count
- Partial: Calculated some value but forgot to filter for positive deltas only
- Zero: Wrong value or no understanding of which deltas count

### Common misconceptions to watch for

1. **Summing all deltas:** Learner adds 120 + 0 + (-220) = -100. Correct: only positive deltas, so 120.

2. **Confusing actual time with elapsed time:** Learner calculates 720 - 0 as the "time elapsed since start" instead of "time spent in section A". The distinction matters.

3. **Not identifying the current section:** Learner correctly calculates section C's numbers but doesn't realize it's the current section (most recent entry).

4. **Arithmetic errors in subtraction:** Common to mess up 1620 - 720 or 900 - 900.

## Exercise 2: Parse a script excerpt (7 min)

### Expected answers

Four sections parsed:
1. `{ id: 'hook', title: 'Hook', plannedSec: 300, graded: false }`
2. `{ id: 'worked-example', title: 'Worked Example', plannedSec: 900, graded: false }`
3. `{ id: 'graded-practice', title: 'Graded Practice', plannedSec: 1200, graded: true }`
4. `{ id: 'wrap-up', title: 'Wrap-up', plannedSec: 300, graded: false }`

### Marking guide

| Criterion | Full marks when | Common partial answer |
|---|---|---|
| Correct number of sections | 4 sections (Discussion ignored) | 5 sections (included Discussion without times) |
| Correct ids (slugs) | All ids are lowercase, dashes for non-alphanumerics | ids include uppercase or double dashes (e.g., 'graded--practice') |
| Correct plannedSec | All time ranges converted correctly: 0:05 = 300, 0:15 = 900, 0:20 = 1200, etc. | Confused h:mm as m:ss (e.g., 0:05 = 5 instead of 300) |
| Correct graded flags | Only Graded Practice is `true`, others `false` | Marked all as `false`, or marked wrong sections as `true` |
| Correct title cleanup | Titles are original without `[graded]` marker | Left `[graded]` in title, or accidentally included "Discussion" |

### Common mistakes

1. **Including "Discussion":** The section has no time range, so it should be ignored. If learner included it, they didn't filter correctly.

2. **Wrong time conversion:** `0:20` is 20 minutes = 1200 seconds, not 20 seconds or 20*60 = 1200. Some learners confuse `h:mm` (hours:minutes) with `m:ss` (minutes:seconds).

3. **Slug errors:**
   - `'graded-practice'` correct; `'graded--practice'` (double dash) incorrect
   - `'Worked-Example'` (capital letters) incorrect; should be lowercase
   - `'worked_example'` (underscore instead of dash) incorrect

4. **Missing [graded] detection:** Learner parsed the section but set `graded: false` instead of `true`.

5. **Time range interpretation:** `(0:05 — 0:20)` means from 5 minutes to 20 minutes = 15 minutes = 900 seconds. Some learners calculate 0 to 5 = 5 min = 300 sec, then 0 to 20 = 20 min = 1200 sec (wrong both ways).

## Additional notes for trainers

- Emphasize the `h:mm` format. It's easy to misread as minutes:seconds.
- Show why filtering for positive deltas matters: a class that runs late in section 1 but catches up in section 2 is still "behind" by the amount from section 1.
- Discuss the slug generation as a design choice: it makes ids stable and URL-safe, even if the title changes slightly.
