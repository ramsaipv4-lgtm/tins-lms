# Builder brief (read with AGENTS.md)

You build **one task** of Coach LMS v1. `SPEC.md` is the contract; `TASKS.md` lists tasks.
`kit` means `node .tins/kit/bin/kit.mjs`.

## Rules

1. Work only inside your task's worktree and its declared paths.
2. **Do not read `acceptance/` except `acceptance/smoke/`** (SPEC D-40). The gate runs the
   acceptance rows you claim and prints which ones fail; that is your feedback.
3. Import other workspace packages by **relative path** (e.g. `../../core/src/index.ts`), never by
   `@lms/...` name (worktrees share one `node_modules`).
4. TypeScript in the erasable subset only (D-1): no `enum`, `namespace`, parameter properties or
   decorators; import with explicit `.ts` extensions. Node runs the files directly.
5. No new dependency unless SPEC §1.1 names it with that exact version.
6. Never write a real secret anywhere. Tests use invented values.

## Steps

1. `kit start --task <task-id> --paths <paths from TASKS.md> --model <your model>`
2. Read the SPEC sections for your rows. Write the code and your own unit tests in
   `packages/<pkg>/test/*.test.mjs` (node:test).
3. Claim your rows: write `build/progress/<task-id>.json` = `{ "green": ["AC-…", …] }`.
4. Run `kit gate` early and often. **Every failure you hit is course material**: keep the exact
   failing output.
5. Write `docs/build-journal/<task-id>.md` from `skill-template/templates/journal.md`: the decision
   (Problem / Options considered / Choice / Why), **every mistake** (what failed, the exact
   output, how you noticed, the fix, the command that proved it), what a learner will trip on, and
   the final gate result. Be honest; a journal with no mistakes is suspicious.
6. Write your course step in `course/steps/<step-id>/` (step id in TASKS.md) with all five files
   from `skill-template/templates/` (`lesson.md`, `instructor_script.md`, `recall.md`,
   `activity_key.md`, `trainer_prep.md`). Rules (`skill-template/SKILL.md`):
   - front matter `id` = the step id; `next: end` for now (the editor fixes the chain later);
     `est_minutes` honest (load budget: words/100 + code lines/8 ≤ est_minutes); ≤ 4 objectives,
     ≤ 8 new terms;
   - the Detective block uses exactly `**Problem:**`, `**Options considered:**`, `**Choice:**`,
     `**Why:**`;
   - "Your turn: faulty first" reuses **your real mistakes** from the journal;
   - "Check yourself": 3–5 numbered questions, each followed by `<details>answer</details>`;
   - code excerpts from the repo use a fence like ` ```ts packages/core/src/rng.ts ` and list
     `{ path: …, commit: <sha> }` in `source_refs` (commit your code first, then cite that sha);
   - recall.md: at least 3 `**Q:**`/`**A:**` cards.
   Check it with `node skill-template/checks/check.mjs course --repo . --steps-only`.
7. `kit gate` must pass. Then `kit close --why "implements <rows> as specified in SPEC"`.
   If close refuses, fix what it lists and close again. Do not push; the orchestrator merges.
8. Final message (≤ 25 lines): rows green, gate result, number of gate failures you hit before
   green, mistakes in one line each, anything in SPEC that was unclear.
