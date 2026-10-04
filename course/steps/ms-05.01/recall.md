# Recall — Package import and content gate

## Exercise 1 — Predict the waiver (5 min)
**What to do:** A package fails G3. A waiver for G3 has an expiry 30 days after `now`. Is the gate passing at `now`, and at `now` plus 8 days (with that later value passed as `now`)?
**The answer (check after):** Passing at both, because the cap is measured from the `now` you pass.

## Cards
**Q:** Which two layouts does the importer accept?
**A:** Companions inside `day{N}/` (v1.2) or in the track root with `_dayNN` names (v1.1).

**Q:** Which check can never be waived?
**A:** `G7-graded`.

**Q:** What does G4 compare?
**A:** The sum of the timed section lengths against the script's own Total runtime line, within 10%.

**Q:** How does G8 turn a recall file into cards?
**A:** Each exercise section becomes one card: front is the title and the "What to do" text, back is from the answer line to the next exercise.
