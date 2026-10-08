# CONTINUE: where the work stands

Update this file with every push. A new session (or a person) resumes from here.

**To resume:** open a session on this repo and say *"Continue: read CONTINUE.md."*

| Item | State (2026-10-08) |
|---|---|
| Phase | **v1 complete** (134 automated rows green); **v2-G games: contract folded into SPEC §13, tests written, nothing built yet** |
| Merged since v1 | I-13 (web unit tests fall back to Playwright's default Chromium; `.lms-data/` ignored), c-2 (course citations point at commits on main, D-41, tins-kit RF-33), d-2 (product demo videos) |
| Demo videos | `node demos/run.mjs` (about 18 min) writes 15 videos to `demos/out/` (git-ignored) with `index.md`; the last run's copies are in `~/work/demo-videos/` on the owner's machine. Task **d-1 is still "open" but was superseded by d-2** (kit has no abandon command, tins-kit RF-34); leave it |
| Games (v2-G) | SPEC §13 (D-42 to D-65, AC-200 to AC-246; AC-202, 220 to 226 and 230 reserved for the 3D/raid contract). Acceptance tests for the first wave are on tests main (`acceptance/games/`). Build plan §13.10 and TASKS.md: g-0 (rowcheck + switch keys) → g-1 Snek ∥ g-2 engine/story/arcade → g-3 Syntax Drop + prologue → **owner playtest** → g-6 sniper, g-4 whack-a-bug, g-5 aftershock → g-12 shop and gear |
| **AC-49, expected mismatch** | SPEC AC-49 now lists the nine games switch keys, but tests main still has the v1 `core/switches.test.mjs` until g-0 merges the tests-repo branch `ac49-game-switches` (right before g-0's close gate, together with the core change). **Do not "fix" this in either repo.** |
| Open | manual rows AC-118, AC-119; AC-145 (fresh agent rebuilds from the course) not run; playtest rows AC-243 to AC-246 (owner) |
| v1.1 bugs | stand-up "blocked" is a substring match; from the d-1/d-2 recordings (`docs/build-journal/d-2.md`): blank first board page, appeal message wrong when the score is unchanged, phone first-run blank space, day 0/1 numbering, coordinator sees substitute buttons, staff 403 on `/api/classroom/my-status`, duplicate "Roster" nav, pair lab "pair" of five, imported day package only on File exchange, raw id in Lab results, **raw `[SAY]`/`[TYPE]` instructor cues on the learner's Today page**, **blank space above the phone first-run screen**, **the nav filling a phone's first screen** (content below the fold for about a second) |
| Next | games as above; **v2-UX: the frontend needs a major overhaul before it is usable as a product** (owner's review of the d-2 demo videos); not started, the owner decides the approach later; games continue as planned and the arcade shell will likely be restyled then; tins-kit knowledge transfer (RF-21 … RF-35) |
| Check command | `node .tins/kit/bin/kit.mjs gate` (needs the tests repo next to this one, or `LMS_ACCEPTANCE_DIR`; full output in `.tins/state-gate-last.tap`). Every gate runs all claimed rows (about 30 to 55 min) |

## How a task runs (orchestrator)

1. `kit task new <id> --paths …`; link `node_modules` and `acceptance` into the worktree; `node scripts/setup.mjs` also links nested `packages/*/node_modules` (I-8).
2. A builder sub-agent follows BUILDER.md. It does not run full gates: the machine (16 GB / 4 CPU) cannot take parallel gates. The orchestrator runs every gate one at a time (a lock), closes sessions and merges.
3. The orchestrator extracts failing commands and hidden-test reads from the builder's transcript into `<id>.evidence.md`; the journal must cite every item (one by one, "E3, E4").
4. Before merging an old branch, sync it with main inside a session. A branch with commits made outside a session, or a claim that the gate later refutes, is rebuilt from main in one new session (see tins-kit RF-29).
5. `scripts/navcheck.mjs` runs in the gate: a new nav-name collision fails it until a person reviews the journey (I-5 … I-7 were all nav-order fixes).

## Files that matter

- `SPEC.md` (contract; §13 games; appendices A–E), `TASKS.md`, `BUILDER.md`, `docs/build-journal/AUDIT.md` (self-report vs transcript, model comparison), `docs/build-journal/integration.md` (I-1 … I-11).
- `docs/PLAN.md` (§19–§22 latest decisions), `docs/FEATURE-IDEAS.md`, `docs/FAILURE-QUESTIONS.md`.
- Acceptance suite: https://github.com/ramsaipv4-lgtm/tins-lms-tests
