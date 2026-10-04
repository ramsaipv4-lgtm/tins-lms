# Activity key — Appeals and AI policy (trainer only)

## Reinforcement activity: answer

**Expected output:** A list of 4 appeal states and 5 cards with Q & A on appeal flow and AI policy.

## Marking guide

| Criterion | Full marks when | Common partial answer |
|---|---|---|
| States listed in order | All 4 states in the correct sequence: `open` → upheld/rejected → `escalated` → final-upheld/final-rejected | Student lists states but in wrong order (e.g., final before escalated) |
| Who acts at each step | Correctly identifies learner, trainer, system, and reviewer roles | Student says "admin" or "system" everywhere instead of naming roles |
| AI policy matrix | All 9 cells correct (off allows nothing, allowed allows all, explain-only allows only chat) | Student confuses explain-only with off, or puts a checkmark in the wrong column |
| Card on immutability | Explains that `history` is copied then appended to, with the new step added | Student says "the history is updated" instead of "a new array is returned" |
| Card on explain-only purpose | States that it allows clarification without giving answers | Student says "it limits AI to prevent cheating" (too vague) |

## Tips for grading

- **Appeal states:** If a student says `upheld` or `rejected` is two separate states instead of alternatives, mark it right (both lead to the same point).
- **AI policy:** A student might draw a 3×3 table correctly but phrase it as "off disables" vs. ✗—both are fine.
- **Immutability:** The key insight is that a new array is returned, not the old one modified. Accept "appended," "prepended," or "copied" if they're clear.
