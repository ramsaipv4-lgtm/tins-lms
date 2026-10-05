# CONTINUE: where the work stands

Update this file with every push. A new session (or a person) resumes from here.

**To resume:** open a session on this repo and say *"Continue: read CONTINUE.md."*

| Item | State (2026-10-05) |
|---|---|
| Phase | Building v1 (SPEC.md, tasks in TASKS.md, builder rules in BUILDER.md) |
| Merged | Core 18/18 (core suite 125/125), server b6-1..b6-6, adapters b10-1..b10-3, web foundation b7-1 |
| In progress | b6-8 (sign-in/out, passkeys), b7-2 admin, b7-3 attendance, b7-4 teleprompter, b7-6 Shift (worktrees in `../tins-lms.worktrees/<task>`) |
| Next | b7-5 learn, b7-7 classroom, b7-8 coach, b7-9 files, b8-1 board, b9-1 performance, b11-1 hardening (AC-99, AC-116, AC-120, AC-122, AC-123); then the rebuild course (SPEC §11) |
| Known red | AC-122 (minor profile) until b11-1 |
| Check command | `node .tins/kit/bin/kit.mjs gate` (needs the tests repo next to this one, or `LMS_ACCEPTANCE_DIR`) |

## How a task runs (orchestrator)

1. `kit task new <id> --paths <TASKS.md paths + build/progress/<id>.json, docs/build-journal/<id>.md, docs/build-journal/<id>.evidence.md, course/steps/<step>>`; link `node_modules` and `acceptance` into the worktree.
2. A builder sub-agent follows BUILDER.md and closes its kit session.
3. The orchestrator extracts failing commands and hidden-test reads from the builder's transcript into `<id>.evidence.md`; the builder reconciles its journal; the gate must pass.
4. `kit merge <id>`, push. Sync a task branch only inside a session with `git merge --no-ff main`.

## Files that matter

- `SPEC.md` (contract; appendices A–E), `TASKS.md`, `BUILDER.md`, `docs/build-journal/AUDIT.md`.
- `docs/PLAN.md` (§19–§22 latest decisions), `docs/FEATURE-IDEAS.md`, `docs/FAILURE-QUESTIONS.md`.
- Acceptance suite: https://github.com/ramsaipv4-lgtm/tins-lms-tests
