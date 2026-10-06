# Syllabus: rebuild the Coach LMS from the specification

## What this course is

Coach LMS is a classroom system for trainers and learners: attendance by rotating code, a teleprompter that releases content in class, a catch-up gate, spaced-repetition cards, a Shift simulation, appeals, a board, offline phones, and the college reports around them. It was built in 11 batches by AI builders working from one contract, `SPEC.md`, and checked by a hidden acceptance suite. This course lets a working developer rebuild it from scratch by following the same order the builders used.

It teaches two things. First, what was built and why, told as Problem, Options considered, Choice and Why. Second, the mistakes: every step reuses the builders' real failures (failing output, how it was found, how it was fixed), and [Appendix A](appendix/A-post-ship-fixes.md) records what still broke after nine parallel web teams merged.

It is written for a developer who already ships TypeScript and wants to see a real, finished codebase from the inside. It is not a beginner course.

## Prerequisites

- TypeScript and Node 22.22 or newer (SPEC D-1: Node runs `.ts` files directly, so the code uses only the erasable-syntax subset).
- Comfort with `git`, `npm` workspaces and a terminal.
- A Chromium that Playwright can drive (SPEC D-8) for the journey tests from module 7 on.
- A machine with 16 GB of memory. The builders ran on 16 GB and 4 CPUs and had to run one gate at a time (see the [strategy](01-strategy.md)).
- The acceptance suite, the public repository `tins-lms-tests` (SPEC D-40), cloned next to your project or pointed to with `LMS_ACCEPTANCE_DIR`.

## Modules

Each module ends with all of its acceptance rows green. Times are the sum of the `est_minutes` of its steps; they cover reading, the code excerpts and the activity, not your own typing and debugging.

| # | Module | What you build | Steps | Acceptance rows | Minutes |
|---|---|---|---|---|---|
| 1 | Core scaffold | Workspace, shared byte helpers, feature switches, version compatibility | [ms-01.01](steps/ms-01.01/lesson.md) | AC-49, AC-50 | 50 |
| 2 | Core logic: learning | Seeded randomness, spaced-repetition cards, catch-up gate and mastery map, graded timing | [ms-02.01](steps/ms-02.01/lesson.md) to ms-02.04 | AC-1 to AC-10, AC-47, AC-48 | 175 |
| 3 | Core logic: crypto and records | Attendance and pairing codes, certificate ids, section keys, hash-chained ledger, signed packages, recovery words | [ms-03.01](steps/ms-03.01/lesson.md) to ms-03.05 | AC-11 to AC-21, AC-42 to AC-46, AC-58 | 160 |
| 4 | Core logic: classroom engines | Teleprompter pacing, Shift engine, appeals, AI policy, conflict merge, groups and poker, screenshot rules and analytics, drop plan | [ms-04.01](steps/ms-04.01/lesson.md) to ms-04.07 | AC-17, AC-18, AC-22 to AC-41, AC-55 to AC-57 | 315 |
| 5 | Package import and content gate | The checks that decide whether a course package may be published | [ms-05.01](steps/ms-05.01/lesson.md) | AC-51 to AC-54 | 45 |
| 6 | Server | Hono hub: sessions and roles, pairing, attendance, packages, sealed release, sync, grading, export, passkeys | [ms-06.01](steps/ms-06.01/lesson.md) to ms-06.08 (ms-06.07 was dropped) | AC-60 to AC-78, AC-81, AC-121 | 310 |
| 7 | Web app | Shell and feature registry, then admin, attendance, teleprompter, learner day, Shift, classroom, coach, offline files | [ms-07.01](steps/ms-07.01/lesson.md) to ms-07.09 | AC-80 to AC-98 and AC-150 to AC-170, except AC-94, AC-153 and AC-165 (modules 11 and 12) | 395 |
| 8 | Board | A trimmed Excalidraw fork with pages, Mermaid drop and a ruled PDF | [ms-08.01](steps/ms-08.01/lesson.md) | AC-97 | 45 |
| 9 | Performance | Budgets and a 200-learner load test command | [ms-09.01](steps/ms-09.01/lesson.md) | AC-100, AC-103 | 40 |
| 10 | Adapters | GitHub App and Forgejo adapters, encrypted backups, Google adapters, health digest | [ms-10.01](steps/ms-10.01/lesson.md) to ms-10.03 | AC-110 to AC-115, AC-117 | 125 |
| 11 | Hardening and integration | Server fixes found on the merged tree, MCP server, the web shell's hooks, nav-collision check, service worker | [ms-11.01](steps/ms-11.01/lesson.md) to ms-11.02 | AC-99, AC-101, AC-102, AC-116, AC-120, AC-122, AC-123, AC-165 | 85 |
| 12 | The last rows | AC-153 (accommodation time in the Shift timer) and AC-94 (screenshot import on the phone profile) | no lesson yet (see below) | AC-153, AC-94 | not counted |

**Total: 41 steps, 1,745 minutes (about 29 hours) of reading and guided work**, before your own implementation time. Plan on several times that for a full rebuild; the builders' tasks were sized to fit one session each.

### Notes on the table

- Step ms-04.05 (study groups, poker, stand-up, explain-it-back) was written by the course editor after the fact. Its original builder read hidden acceptance tests, so that lesson tells you to implement from the SPEC only.
- Module 12 had no lesson when this course was assembled: task b12-1 was still in progress (CONTINUE.md, 2026-10-06). Checkpoint 6 uses the SPEC rows for AC-153 and AC-94 and the integration notes, not a lesson.
- The rows AC-118, AC-119, AC-130, AC-131 and AC-140 to AC-145 are manual checks in the SPEC and are not part of a module.

## Checkpoints and the final project

| Checkpoint | After | Focus |
|---|---|---|
| [Checkpoint 1](checkpoints/checkpoint-1/checkpoint.md) | Module 2 | Cards, catch-up gate, mastery, timing |
| [Checkpoint 2](checkpoints/checkpoint-2/checkpoint.md) | Module 4 | Pure engines: Shift, merge, rituals |
| [Checkpoint 3](checkpoints/checkpoint-3/checkpoint.md) | Module 6 | Server: roles, sealed release, sync |
| [Checkpoint 4](checkpoints/checkpoint-4/checkpoint.md) | Module 7 | Journeys on desktop and phone |
| [Checkpoint 5](checkpoints/checkpoint-5/checkpoint.md) | Module 9 | Budgets and the load test |
| [Checkpoint 6](checkpoints/checkpoint-6/checkpoint.md) | Module 12 | The last rows and a full gate run |

Each checkpoint has a short build-and-verify task and a rubric with an answer key. The [final project](final-project/brief.md) is a v2 feature written in the same style as the SPEC. Two appendices close the course: [A, post-ship fixes](appendix/A-post-ship-fixes.md) and [B, the decision log](appendix/B-decision-log.md).

## How to use the acceptance suite as your target

The SPEC is the contract and the acceptance suite is the examiner. Each SPEC row `AC-n` names the test file that checks it (the Check column). Use it like this:

1. Read the SPEC rows for the step (the lesson names them) and write your own unit tests first, in `packages/<pkg>/test/*.test.mjs`.
2. Run only the rows you have claimed. Your claimed rows live in `build/progress/<task>.json` as `{ "green": ["AC-30", ...] }`, and the project gate (`scripts/gate.mjs`) refuses to let that list shrink.
3. Read the failure output, not the test source. SPEC D-40 says builders work from the SPEC, the visible smoke subset (`acceptance/smoke/`) and the data fixtures (`acceptance/fixtures/`) only. Reading the hidden tests voids a build experiment's score, and it defeats this course's point, which is to learn to derive behaviour from a specification. Appendix D of the SPEC gives the journey UI contract (test ids and accessible names) so you do not need the journey sources.
4. Claim a row only after the gate, not one local run, has shown it green. Two of the branches in Appendix A had to be rebuilt because a row was claimed before the gate verified it.
5. `npm run smoke` runs the visible smoke subset; `node .tins/kit/bin/kit.mjs gate` runs the full gate (the full suite took 29.5 minutes in integration item I-12; the strategy explains how to run it on a small machine).

The course is verified only when a fresh agent, working from step 1 in an empty folder, reaches a passing acceptance suite (SPEC AC-145). That run had not been recorded when this page was written.
