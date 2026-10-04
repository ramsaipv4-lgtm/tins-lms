# Tasks for v1 (orchestrated; see BUILDER.md)

Each task: `kit task new <id> --paths <paths>` creates its worktree; a builder sub-agent runs it;
the orchestrator merges with `kit merge <id>` and pushes. Every task also owns
`build/progress/<id>.json`, `docs/build-journal/<id>.md` and `course/steps/<step>/`.

| Task | Step | Model | Title | Rows | Code paths | Status |
|---|---|---|---|---|---|---|
| b1-1 | ms-01.01 | haiku | Core scaffold, shared byte helpers, feature switches, version compat | AC-49, AC-50 | packages/core | merged |
| b2-1 | ms-02.01 | haiku | Seeded randomness | AC-1, AC-2 | packages/core/src/rng.ts, packages/core/test/rng.test.mjs | merged |
| b2-2 | ms-02.02 | haiku | Cards and spaced repetition (ts-fsrs) | AC-3, AC-4, AC-5 | packages/core/src/cards.ts, packages/core/test/cards.test.mjs | merged |
| b2-3 | ms-02.03 | haiku | Catch-up gate and mastery map | AC-6 to AC-10 | packages/core/src/catchup.ts, packages/core/src/mastery.ts, packages/core/test/catchup.test.mjs, packages/core/test/mastery.test.mjs | merged |
| b2-4 | ms-02.04 | haiku | Graded timing and accommodations | AC-47, AC-48 | packages/core/src/timing.ts, packages/core/test/timing.test.mjs | merged |
| b3-1 | ms-03.01 | sonnet | Rotating attendance code, pairing codes, certificate ids | AC-11, AC-12, AC-13, AC-58 | packages/core/src/attendance.ts, packages/core/src/pairing.ts, packages/core/src/certificate.ts, packages/core/test/attendance.test.mjs, packages/core/test/pairing.test.mjs, packages/core/test/certificate.test.mjs | merged |
| b3-2 | ms-03.02 | sonnet | Section keys and teleprompter-paced release | AC-14, AC-15, AC-16 | packages/core/src/release.ts, packages/core/test/release.test.mjs | merged |
| b3-3 | ms-03.03 | sonnet | Append-only hash-chained ledger | AC-19, AC-20, AC-21 | packages/core/src/ledger.ts, packages/core/test/ledger.test.mjs | merged |
| b3-4 | ms-03.04 | sonnet | Manifests, tar archives, signed class packages | AC-42, AC-43, AC-44 | packages/core/src/export.ts, packages/core/test/export.test.mjs | merged |
| b3-5 | ms-03.05 | sonnet | Recovery words and crypto-shredding | AC-45, AC-46 | packages/core/src/keys.ts, packages/core/test/keys.test.mjs | merged |
| b4-1 | ms-04.01 | haiku | Teleprompter pacing and script parsing | AC-17, AC-18 | packages/core/src/pace.ts, packages/core/test/pace.test.mjs | merged |
| b4-2 | ms-04.02 | sonnet | Shift engine | AC-22, AC-23, AC-24 | packages/core/src/shift.ts, packages/core/test/shift.test.mjs | merged |
| b4-3 | ms-04.03 | haiku | Appeals and AI policy | AC-25, AC-26, AC-27 | packages/core/src/appeal.ts, packages/core/src/aipolicy.ts, packages/core/test/appeal.test.mjs, packages/core/test/aipolicy.test.mjs | merged |
| b4-4 | ms-04.04 | sonnet | Conflict merge | AC-28, AC-29 | packages/core/src/merge.ts, packages/core/test/merge.test.mjs | merged |
| b4-5 | ms-04.05 | haiku | Study groups, estimation poker, stand-up, explain-it-back | AC-30 to AC-34 | packages/core/src/groups.ts, packages/core/src/poker.ts, packages/core/src/standup.ts, packages/core/src/explain.ts, packages/core/test/groups.test.mjs, packages/core/test/poker.test.mjs, packages/core/test/standup.test.mjs, packages/core/test/explain.test.mjs | merged |
| b4-6 | ms-04.06 | haiku | Screenshot rules, FAQ, at-risk, item analysis, clusters, re-flow | AC-35 to AC-41 | packages/core/src/screenshot.ts, packages/core/src/faq.ts, packages/core/src/atrisk.ts, packages/core/src/items.ts, packages/core/src/cluster.ts, packages/core/src/reflow.ts, packages/core/test/screenshot.test.mjs, packages/core/test/faq.test.mjs, packages/core/test/atrisk.test.mjs, packages/core/test/items.test.mjs, packages/core/test/cluster.test.mjs, packages/core/test/reflow.test.mjs | merged |
| b4-7 | ms-04.07 | haiku | Drop plan, retention, messages | AC-55, AC-56, AC-57 | packages/core/src/drop.ts, packages/core/src/retention.ts, packages/core/src/messages.ts, packages/core/test/drop.test.mjs, packages/core/test/retention.test.mjs, packages/core/test/messages.test.mjs | merged |
| b5-1 | ms-05.01 | sonnet | Package import and content gate | AC-51 to AC-54 | packages/core/src/gate.ts, packages/core/test/gate.test.mjs | merged |

## Batch B6 (server) and B10 (adapters)

| Task | Step | Model | Title | Rows | Code paths | Status |
|---|---|---|---|---|---|---|
| b6-1 | ms-06.01 | sonnet | Server foundation: main, Hono app, /db mount, data dir, CA, sessions, roles, test mode, health, join/T&C/me | AC-60, AC-61, AC-62, AC-63, AC-64, AC-78 | packages/server/package.json, packages/server/src/main.ts, packages/server/src/app.ts, packages/server/src/core, packages/server/src/routes/index.ts, packages/server/src/routes/health.ts, packages/server/src/routes/accounts.ts, packages/server/src/routes/testmode.ts, packages/server/src/routes/pairing.ts, packages/server/src/routes/attendance.ts, packages/server/src/routes/content.ts, packages/server/src/routes/sync.ts, packages/server/src/routes/grading.ts, packages/server/src/routes/export.ts, packages/server/test/foundation.test.mjs | todo |
| b6-2 | ms-06.02 | sonnet | Pairing, devices, attendance | AC-65, AC-66 | packages/server/src/routes/pairing.ts, packages/server/src/routes/attendance.ts, packages/server/test/pairing.test.mjs, packages/server/test/attendance.test.mjs | todo |
| b6-3 | ms-06.03 | sonnet | Packages, gate on upload, sealed sections and teleprompter release | AC-67, AC-68 | packages/server/src/routes/content.ts, packages/server/test/content.test.mjs | todo |
| b6-4 | ms-06.04 | sonnet | Sync: replication, schema check, merge pass, personal DB rules | AC-69, AC-70, AC-71, AC-121 | packages/server/src/routes/sync.ts, packages/server/test/sync.test.mjs | todo |
| b6-5 | ms-06.05 | sonnet | Attempts, grade ledger, appeals, integrity log | AC-72, AC-73 | packages/server/src/routes/grading.ts, packages/server/test/grading.test.mjs | todo |
| b6-6 | ms-06.06 | sonnet | Export, import, signed class packages, device keys | AC-74, AC-75, AC-76, AC-77 | packages/server/src/routes/export.ts, packages/server/test/export.test.mjs | todo |
| b6-7 | ms-06.07 | sonnet | Minor profile rules and secret-free logs across routes | AC-120, AC-122 | packages/server/src | todo |
| b10-1 | ms-10.01 | sonnet | GitHub App and Forgejo adapters, push-check hook | AC-110, AC-111, AC-112, AC-115 | packages/adapters/src/github.ts, packages/adapters/src/forgejo.ts, packages/adapters/test/github.test.mjs, packages/adapters/test/forgejo.test.mjs | todo |
| b10-2 | ms-10.02 | haiku | Backup targets and Google adapters | AC-113, AC-114 | packages/adapters/src/backup.ts, packages/adapters/src/google.ts, packages/adapters/test/backup.test.mjs, packages/adapters/test/google.test.mjs | todo |
| b10-3 | ms-10.03 | haiku | Health digest and morning checklist | AC-117 | packages/adapters/src/health.ts, packages/adapters/test/health.test.mjs | todo |

Later batches (server B6, web B7, board B8, perf B9, adapters B10, hardening B11) are added
here when the core batches are merged, following SPEC §9.1.
