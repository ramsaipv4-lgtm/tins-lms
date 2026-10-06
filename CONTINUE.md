# CONTINUE: where the work stands

Update this file with every push. A new session (or a person) resumes from here.

**To resume:** open a session on this repo and say *"Continue: read CONTINUE.md."*

| Item | State (2026-10-06) |
|---|---|
| Phase | **v1 complete**: all 134 automated acceptance rows green on main; rebuild course assembled (course/, 42 steps, full skill-template check passes) |
| Merged | core (b1–b5), server (b6-*), adapters (b10-*), web shell b7-1 and groups admin b7-2, attend b7-3, tele b7-4, learn b7-5, shift b7-6, classroom b7-7, coach b7-8, files b7-9, board b8-1, perf/load b9-1, hardening b11-1 (server) and b11-2 (web), last rows b12-1, integration fixes I-1 … I-12, course c-1 (docs/build-journal/integration.md) |
| Open | manual rows for the owner: AC-118 (Android alarm intent, needs a phone), AC-119 (DuckDNS certificate renewal, needs the account); AC-145 (a fresh agent rebuilds from the course) not yet run; known issue: core stand-up negation check is a substring match (v1.1) |
| Next | owner tries v1 live; tins-kit knowledge transfer (kit capture/harvest commands, then promote findings RF-21 … RF-31 into kit checks and templates); v2 SPEC after live use |
| Check command | `node .tins/kit/bin/kit.mjs gate` (needs the tests repo next to this one, or `LMS_ACCEPTANCE_DIR`; full output in `.tins/state-gate-last.tap`) |

## How a task runs (orchestrator)

1. `kit task new <id> --paths …`; link `node_modules` and `acceptance` into the worktree; `node scripts/setup.mjs` also links nested `packages/*/node_modules` (I-8).
2. A builder sub-agent follows BUILDER.md. It does not run full gates: the machine (16 GB / 4 CPU) cannot take parallel gates. The orchestrator runs every gate one at a time (a lock), closes sessions and merges.
3. The orchestrator extracts failing commands and hidden-test reads from the builder's transcript into `<id>.evidence.md`; the journal must cite every item (one by one, "E3, E4").
4. Before merging an old branch, sync it with main inside a session. A branch with commits made outside a session, or a claim that the gate later refutes, is rebuilt from main in one new session (see tins-kit RF-29).
5. `scripts/navcheck.mjs` runs in the gate: a new nav-name collision fails it until a person reviews the journey (I-5 … I-7 were all nav-order fixes).

## Files that matter

- `SPEC.md` (contract; appendices A–E), `TASKS.md`, `BUILDER.md`, `docs/build-journal/AUDIT.md` (self-report vs transcript, model comparison), `docs/build-journal/integration.md` (I-1 … I-11).
- `docs/PLAN.md` (§19–§22 latest decisions), `docs/FEATURE-IDEAS.md`, `docs/FAILURE-QUESTIONS.md`.
- Acceptance suite: https://github.com/ramsaipv4-lgtm/tins-lms-tests
