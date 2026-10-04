# CONTINUE: where the work stands

Update this file with every push. A new session (or a person) resumes from here.

**To resume:** open a session on this repo and say *"Continue: read CONTINUE.md."*

| Item | State |
|---|---|
| Phase | Planning (no code yet) |
| Current document | `docs/PLAN.md` v14 |
| Last completed step | Owner's answers to the review, feature picks and follow-ups recorded (DEC-36 to DEC-72) |
| Next step | Write `SPEC.md` (D-n / AC-n rows from PLAN v14) and the hidden acceptance suite (kept in a separate private repo), then the task list for 1a + 1b |
| Waiting on the owner | Nothing blocking; SPEC.md can start |
| Check command | None yet (the tins-kit gate starts with the first build task) |

## Files that matter

- `docs/PLAN.md`: the plan; §16 is the decision log, §15 the open questions, §19–§22 the latest
  decisions.
- `docs/FAILURE-QUESTIONS.md`: 46 failure scenarios with the owner's answers.
- `docs/FEATURE-IDEAS.md`: feature ideas with the owner's picks.
- `docs/ALT-DESIGN-REVIEW.md`: the second-opinion review.
- `docs/SIMULATED-RUN.md`: one end-to-end walkthrough.
- `experiments/`: small experiments that settled design questions.

## Rules while building (PLAN §22)

1. One small task at a time; it ends green and pushed, or reverted.
2. Push after every task; update this file in the same commit.
3. A task paused mid-way goes to a `wip/<task-id>` branch, with the next step written here.
