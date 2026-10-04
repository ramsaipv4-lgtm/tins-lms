# Tasks for v1 (orchestrated; see BUILDER.md)

Each task: `kit task new <id> --paths <paths>` creates its worktree; a builder sub-agent runs it;
the orchestrator merges with `kit merge <id>` and pushes. Every task also owns
`build/progress/<id>.json`, `docs/build-journal/<id>.md` and `course/steps/<step>/`.

| Task | Step | Model | Title | Rows | Code paths | Status |
|---|---|---|---|---|---|---|
| b1-1 | ms-01.01 | haiku | Core scaffold, shared byte helpers, feature switches, version compat | AC-49, AC-50 | packages/core | todo |
| b2-1 | ms-02.01 | haiku | Seeded randomness | AC-1, AC-2 | packages/core/src/rng.ts, packages/core/test/rng* | todo |
| b2-2 | ms-02.02 | haiku | Cards and spaced repetition (ts-fsrs) | AC-3, AC-4, AC-5 | packages/core/src/cards.ts, packages/core/test/cards* | todo |
| b2-3 | ms-02.03 | haiku | Catch-up gate and mastery map | AC-6 to AC-10 | packages/core/src/catchup.ts, packages/core/src/mastery.ts, packages/core/test/catchup*, packages/core/test/mastery* | todo |
| b2-4 | ms-02.04 | haiku | Graded timing and accommodations | AC-47, AC-48 | packages/core/src/timing.ts, packages/core/test/timing* | todo |
| b3-1 | ms-03.01 | sonnet | Rotating attendance code, pairing codes, certificate ids | AC-11, AC-12, AC-13, AC-58 | packages/core/src/attendance.ts, packages/core/src/pairing.ts, packages/core/src/certificate.ts, packages/core/test/attendance*, packages/core/test/pairing*, packages/core/test/certificate* | todo |
| b3-2 | ms-03.02 | sonnet | Section keys and teleprompter-paced release | AC-14, AC-15, AC-16 | packages/core/src/release.ts, packages/core/test/release* | todo |
| b3-3 | ms-03.03 | sonnet | Append-only hash-chained ledger | AC-19, AC-20, AC-21 | packages/core/src/ledger.ts, packages/core/test/ledger* | todo |
| b3-4 | ms-03.04 | sonnet | Manifests, tar archives, signed class packages | AC-42, AC-43, AC-44 | packages/core/src/export.ts, packages/core/test/export* | todo |
| b3-5 | ms-03.05 | sonnet | Recovery words and crypto-shredding | AC-45, AC-46 | packages/core/src/keys.ts, packages/core/test/keys* | todo |
| b4-1 | ms-04.01 | haiku | Teleprompter pacing and script parsing | AC-17, AC-18 | packages/core/src/pace.ts, packages/core/test/pace* | todo |
| b4-2 | ms-04.02 | sonnet | Shift engine | AC-22, AC-23, AC-24 | packages/core/src/shift.ts, packages/core/test/shift* | todo |
| b4-3 | ms-04.03 | haiku | Appeals and AI policy | AC-25, AC-26, AC-27 | packages/core/src/appeal.ts, packages/core/src/aipolicy.ts, packages/core/test/appeal*, packages/core/test/aipolicy* | todo |
| b4-4 | ms-04.04 | sonnet | Conflict merge | AC-28, AC-29 | packages/core/src/merge.ts, packages/core/test/merge* | todo |
| b4-5 | ms-04.05 | haiku | Study groups, estimation poker, stand-up, explain-it-back | AC-30 to AC-34 | packages/core/src/groups.ts, packages/core/src/poker.ts, packages/core/src/standup.ts, packages/core/src/explain.ts, packages/core/test/groups*, packages/core/test/poker*, packages/core/test/standup*, packages/core/test/explain* | todo |
| b4-6 | ms-04.06 | haiku | Screenshot rules, FAQ, at-risk, item analysis, clusters, re-flow | AC-35 to AC-41 | packages/core/src/screenshot.ts, packages/core/src/faq.ts, packages/core/src/atrisk.ts, packages/core/src/items.ts, packages/core/src/cluster.ts, packages/core/src/reflow.ts, packages/core/test/screenshot*, packages/core/test/faq*, packages/core/test/atrisk*, packages/core/test/items*, packages/core/test/cluster*, packages/core/test/reflow* | todo |
| b4-7 | ms-04.07 | haiku | Drop plan, retention, messages | AC-55, AC-56, AC-57 | packages/core/src/drop.ts, packages/core/src/retention.ts, packages/core/src/messages.ts, packages/core/test/drop*, packages/core/test/retention*, packages/core/test/messages* | todo |
| b5-1 | ms-05.01 | sonnet | Package import and content gate | AC-51 to AC-54 | packages/core/src/gate.ts, packages/core/test/gate* | todo |

Later batches (server B6, web B7, board B8, perf B9, adapters B10, hardening B11) are added
here when the core batches are merged, following SPEC §9.1.
