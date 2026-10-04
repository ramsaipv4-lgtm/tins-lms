# Skill: course package generator (tins-lms edition)

**Version:** 2.0 (Claude, iteration 17). Based on the owner's skill template v1.2 and the
evaluation in `docs/COURSE-FORMAT-EVALUATION.md`. One skill, two variants, one gate.

## 1. Pick the variant

| Variant | Use when the source is… | Unit | Example |
|---|---|---|---|
| `day` | a syllabus (subjects, days, a college timetable) | a **day** with a fixed artifact set | package5 (Azure track) |
| `case-study` | a codebase or a finished build (real decisions, real bugs) | a **micro-step** in build order | the Coach LMS rebuild course |

Both variants share: a `manifest.json` that is the source of truth, a generated README, recall
cards, answer keys, a trainer prep pack, a teleprompter (Say/Do) script, faulty-first practice,
and the same gate (`checks/check.mjs`). Details: `variants/day.md`, `variants/case-study.md`.

## 2. Principles (both variants)

1. **The manifest is the source of truth.** Files, order, ids, timings and prerequisites live in
   `manifest.json`; `README.md` is generated from it and never edited by hand.
2. **Assume the trainer must learn it first** (PLAN §19.8 row 4). Every unit has `trainer_prep.md`:
   prerequisites, a 45-minute self-study path, worked → faded examples, top misconceptions, likely
   student questions with answers, and a private mastery check.
3. **Retrieval and spacing are built in.** Every unit has `recall.md`: closed-book tasks plus 8–10
   question/answer cards (imported as spaced-repetition cards).
4. **Every activity has an answer key** (`activity_key.md`, trainer-only).
5. **Faulty first.** Learners meet the broken version, predict, run, diagnose, then fix.
6. **Load budget.** Words/100 + code lines/8 + activity minutes ≤ the unit's `est_minutes`; at most
   4 objectives and 8 new terms per unit.
7. **Fixed labels for the "why".** Every decision is told as **Problem / Options considered /
   Choice / Why**.
8. **Facts are checked.** Code excerpts cite `path@commit` and must match the repo; other claims
   cite a source and get a second-model fact check (PLAN §19.8 row 7.9).
9. **Mastery, not calendar.** Each unit lists the skills it checks; the LMS gates the next unit on
   them (catch-up gate, mastery map).

## 3. Process

1. **Read the source.** Syllabus (variant `day`) or repository + build journal (variant
   `case-study`). Output a flat topic or decision list.
2. **Draft the manifest** (units in order, est_minutes, prereqs, checkpoint positions). Confirm
   it with the owner before generating content.
3. **Generate each unit** from `templates/`, one unit per sub-agent, each self-contained.
4. **Run the gate:** `node skill-template/checks/check.mjs <package-dir> [--repo <git-dir>]`. Fix
   every failure; there is no skip.
5. **Fact check:** a second model reviews every claim without a `source_ref`; disagreements go to
   the owner.
6. **Hand off:** regenerate README, write `STATE_HANDOFF.md`, zip.

## 4. The gate (one list, 14 checks)

| # | Check | Variant |
|---|---|---|
| 1 | Required files per unit exist | both |
| 2 | Manifest ↔ files: every entry exists, every content file is listed, README equals the generated one | both |
| 3 | Diagnostic: 8 numbered questions + an 8-item answer key (day) / 3–5 "Check yourself" questions with answers (case-study) | both |
| 4 | Script timings add up to the unit's time (±10%) | both |
| 5 | No broken relative links | both |
| 6 | Every fenced code block has a language tag | both |
| 7 | Graded items (Shift packs, exam banks, checkpoints) parse and have keys or rubrics | both |
| 8 | Recall cards parse (front and back) | both |
| 9 | Required sections present, with the fixed Detective labels | both |
| 10 | Chain: `next` follows manifest order; "Step X of N" is right; walking from step 1 visits every unit | case-study |
| 11 | Load budget (principle 6) | both |
| 12 | Every activity has a key; every checkpoint has `checkpoint.md` + `rubric.md` | both |
| 13 | Code fidelity: excerpts with `source_ref` match `git show <commit>:<path>` | case-study |
| 14 | Currency: every dated fact carries an "as of" date | both |

Checks 1–14 are implemented in `checks/check.mjs` (zero dependencies). The LMS content gate
(SPEC §4.29, G1–G8) is the subset the app enforces on import.

## 5. Builder-authored course content (case-study variant)

Only the builder knows which mistakes it made, how it noticed them and how it proved the fix. So
**every build task writes its own course material as part of the task**, not afterwards:

1. `docs/build-journal/<task-id>.md` from `templates/journal.md`, with:
   - the decision (Problem / Options considered / Choice / Why);
   - every mistake: what failed, the exact failing output, how it was found, the fix, and the
     command that proved it;
   - what a learner will trip on.
2. A **lesson draft** `course/steps/<step-id>/lesson.md` (+ `recall.md`, `activity_key.md`) from
   the templates. Its "Your turn: faulty first" section reuses the builder's **real** mistakes.
3. The task is not done until `check.mjs` passes on that step (checks 2, 6, 9, 11–13).

After v1, an editor pass makes the voice consistent and adds the syllabus, strategy, checkpoints,
appendices and marketing. Then a fresh agent rebuilds the app from the course (SPEC AC-145).
