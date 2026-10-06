# Appendix B: decision log

The main decisions behind the SPEC, each told as **Problem / Options considered / Choice / Why**. D-numbers are the SPEC's locked rows; DEC-numbers are the plan's decisions (`docs/PLAN.md`); F-numbers are the failure scenarios in `docs/FAILURE-QUESTIONS.md`. Facts come from those files and from `docs/build-journal/`. Where the sources record only the choice and not what was rejected, the entry says so instead of inventing options. The ID after each entry's title is where to look it up.

## Part 1. Stack and structure

### 1. Language and stack (D-1 to D-5, DEC-53; replaces DEC-13)

**Problem:** The first stack was written for a human expert. The code was to be written by AI models of different sizes, and the plan's own second-opinion review (`docs/ALT-DESIGN-REVIEW.md` §3.5) warned that models write the most common stacks reliably and fight anything recent. **Options considered:** DEC-13 chose Effect v4 (a release candidate), Svelte 5 with SvelteKit and `node:sqlite`. The review's alternative was Hono and Zod on the server, React with Vite, and a plain `Result` type. **Choice:** TypeScript in the erasable-syntax subset only, so Node 22.22 runs `.ts` directly (D-1); Hono, `@hono/node-server` and Zod (D-4); React 19 with Vite and a service-worker PWA (D-5). **Why:** the review argued that a pinned release candidate means every task fights the model's training data, that Svelte 5 syntax is often emitted in its older form, and that React is also what Excalidraw uses, so the board is not a second framework. The owner accepted the review (DEC-53). A related lesson from the build: the exact pins met a hoisted React 18 in the root `node_modules` (integration item I-8, two Reacts).

### 2. A pure core with almost no dependencies (D-2, D-3, D-22)

**Problem:** Grades, unlocks, schedules, merges and codes are where mistakes cost a student something, so they must be testable without a server, a clock or a network. **Options considered:** the sources record the choice and the review's endorsement; they do not list a rejected alternative. **Choice:** every rule that decides anything is a pure function in `packages/core`, with time and randomness passed in, and no runtime dependency except `ts-fsrs` for card scheduling; crypto uses the platform's Web Crypto. **Why:** the review called plain-TypeScript pure functions "the best decision" in the stack section. The course follows it: modules 1 to 5 are the whole core, and the server and web groups only call it.

### 3. Exact version pins and a locked D-row for every dependency (D-14)

**Problem:** A model adding a package it knows from training can break a build months later. **Options considered:** not recorded beyond the rule itself. **Choice:** every dependency is named in a locked D-row with its exact version, versions carry no `^` or `~`, and the lockfile is committed; the project gate (`scripts/gate.mjs`, step 2) fails on any package not named or whose version differs. **Why:** one place that says what is allowed, enforced by a script rather than by review.

### 4. Four deployment profiles from one codebase (D-20, DEC-54, DEC-69)

**Problem:** Campus networks and phones are unreliable; some learners have no hub at all. **Options considered:** the review proposed cloud-first with an offline cache, and a cheap 4G router or hotspot for colleges without internet, keeping a LAN hub only as a later phase; the plan's original design was local-first with a hub. **Choice:** one codebase with profiles `phone`, `hub`, `cloud` and `hybrid`, selected by a config value and never a code fork; phone-only became a full profile (DEC-69), with signed class package files for exchange. **Why:** the owner wanted both. The review itself counted ten of the 46 failure questions as arising from the hub topology, so the hub's costs were known when the choice was made.

## Part 2. Data and sync

### 5. Sync by the CouchDB replication protocol (D-6, D-9, D-21, DEC-53, DEC-54, DEC-55)

**Problem:** Phones, a class hub and the cloud must exchange changes in any combination, offline for weeks. **Options considered:** the review listed CouchDB with PouchDB, PocketBase, Supabase, ElectricSQL, PowerSync and Replicache or Zero, and Automerge or Yjs for the board; it noted that CouchDB and PouchDB were "the only one with mature multi-master offline replication". For storage it described a SQLite file per learner; the plan recorded that Turso was not used (DEC-55). **Choice:** CouchDB replication: `pouchdb` on the hub and in tests, `pouchdb-browser` in the app, one class database per class, one personal database per learner and one org database; the hub mounts `express-pouchdb` beside Hono on the same Node server (D-9, from the sync experiment). **Why:** leaderless replication phone to hub to cloud in any combination, and per-learner databases make export and crypto-shredding simple.

### 6. Conflicts are resolved by core merge, not by "whichever revision wins" (D-24, F-22)

**Problem:** The same record can be edited on a phone and on the class hub while both are offline, and "latest wins" silently drops one side. **Options considered:** latest wins for everything (the failing default described in F-22); a visible conflict for fields that matter. **Choice:** profile fields are latest-wins; ticket status takes the most advanced value with a visible conflict badge; arrays of objects are unioned by id; class-owned fields (`schedule`, `passMark`, `switches`) come only from revisions written by the hub. The merge is order-independent, idempotent and associative, so merging results behaves like merging originals (step ms-04.04). **Why:** a learner must not be able to change the pass mark, and the server's merge pass writes the merged revision back so CouchDB's pick is never the answer.

### 7. A compatibility window for old apps (D-23, F-21)

**Problem:** A phone offline for five weeks on app v1.0 meets a hub on v1.4 with a changed data format. **Options considered:** the sources record the failure and the chosen rule only. **Choice:** every document carries a schema integer; a client syncs only if within 2 versions of the hub; an older client is told to update and its local data is never wiped (`canSync`, AC-50, AC-71). **Why:** old changes must not apply wrongly and a week of work must not be lost.

### 8. Which clock to trust (D-27, F-17)

**Problem:** A learner who changes the phone's clock while offline could stretch an exam or SLA timer or reorder edits. **Options considered:** device wall-clock time (rejected as untrustworthy); logical clocks for sync ordering; hub-signed times plus a monotonic duration for graded work. **Choice:** graded timing uses hub-signed start and end times when they exist; otherwise the monotonic duration with an `offline-attempt` flag, and a `clock-skew` flag when the device clock differs from the monotonic one by more than 60 s (step ms-02.04). **Why:** timer fairness; the owner locked the default as written.

## Part 3. Security and privacy

### 9. HTTPS on a LAN hub (D-25, F-11)

**Problem:** Browsers allow service workers, app install and `crypto.subtle` only on secure connections, and a LAN hub serves plain HTTP at an address like `192.168.x.x`. **Options considered:** the hub's own certificate authority (the default); a free DuckDNS name with a Let's Encrypt certificate renewed by `acme.sh` in a container or script (kept as a sidegrade, AC-119, checked by hand). **Choice:** the hub creates its own CA at setup and serves HTTPS; the pairing QR carries the certificate fingerprint. **Why:** it works with no internet. The CA key stays off the org database (step ms-06.01).

### 10. Encryption, signing and recovery (D-26, D-28, F-20, F-24)

**Problem:** Data must be private on the device and recoverable if a phone is lost, yet deletable on append-only ledgers and git-backed backups. **Options considered:** for recovery, a printable recovery key plus optional escrow on a trusted device of the learner's own, never on a server; for erasure, rewriting history (rejected) versus per-person keys. **Choice:** AES-GCM 256 with a fresh 96-bit IV per message, HKDF-SHA-256 for keys, PBKDF2-SHA-256 at 600,000 iterations for passphrases, ECDSA P-256 for signing, all through Web Crypto; a recovery key of 32 words from a 256-word list (one byte per word, AC-45); deletion is crypto-shredding, destroying that person's key (AC-46); secrets are never logged or exported (D-28, AC-77, AC-120). **Why:** one set of primitives from the platform and no hand-written crypto. Note: the failure table suggested a printable 24-word key; the SPEC specifies 32 words, one byte each (§4.25).

### 11. AI proposes, people decide (D-31, F-08, F-30)

**Problem:** Text written by learners can hide instructions that a trainer's AI reads and acts on, and a learner's own AI could do graded work. **Options considered:** for the MCP tool layer, execute write tools once a flag is on, or make write tools able only to describe a change. **Choice:** others' content is data; while the AI reads it, tools are read-only; grade edits, posting to more than one person and repo writes return a pending diff and need a person's confirmation (AC-116, step ms-11.01). Graded work has an AI policy per item: off, allowed or explain-only, and use is logged (D-31, DEC-43, AC-27). **Why:** approval fatigue makes "accept" automatic, so a write tool that cannot write is safer by construction.

### 12. Minors (D-33, F-36, DEC-50)

**Problem:** Some learners are under 18, and the sources note that the Indian data-protection law restricts tracking and behavioural monitoring of children; the scope was marked "verify". **Options considered:** accept only 18+ learners in phase 1, or build both paths. **Choice:** build both. Date of birth at signup; an under-18 account gets a minor profile: consent captured, Coach trackers off, integrity log limited to exam events (AC-64, AC-122). Legal review was deferred until after dry runs and before the first paying college. **Why:** the owner chose to build both rather than restrict.

## Part 4. Product behaviour

### 13. Content is released in step with the teleprompter (D-38, §20.4)

**Problem:** Notes and labs should appear when the trainer reaches them, not before, and a failed connection must not strand a class. **Options considered:** release by the clock alone; release by the trainer alone; both with a fallback. **Choice:** sections of a day match the script and each is sealed with its own key; the hub releases a section's key when the teleprompter reaches it; ungraded sections also unlock at their planned time as a fallback; one tap releases everything; graded material is never released by the clock alone (AC-14 to AC-16). **Why:** fairness: a late or absent trainer must not leak an exam (F-17).

### 14. A catch-up gate for late joiners (DEC-37, F-02)

**Problem:** A learner who joins on day 3 and misses days 0 to 2 faces a card backlog and a certificate blocked by missed items. **Options considered:** the suggested default marked missed graded items "excused or not attempted" and spread the backlog over 7 days, at most 30 cards a day. **Choice:** the owner changed it: missed days unlock **in order** after the learner reads the quick-learn and passes an 8-question diagnostic (6 of 8); live classes stay open; the backlog is spread day by day (AC-5, AC-6 to AC-9). **Why:** a gate is mastery-based, so catching up is not calendar-based.

### 15. Appeals (DEC-42, F-07)

**Problem:** A learner disputes a score, for example because a run used a different mode from a peer's. **Options considered:** the sources record the problem and the chosen design. **Choice:** a 7-day window, an evidence pack (seed, mode, events, rubric rows, unread-confirmation count), a second reviewer, and a ledger that keeps the original entry (AC-25, AC-26, AC-73). An unread confirmed AI suggestion opens an appeal as upheld. **Why:** fairness with an audit trail.

### 16. Messaging is tap-to-send (D-35)

**Problem:** Trainers want to message absent learners and at-risk learners on WhatsApp. **Options considered:** the paid WhatsApp Business API for automatic sending; unofficial automation of WhatsApp Web (rejected because it breaks WhatsApp's terms and risks the number being banned); prefilled click-to-chat links with a tap to send. **Choice:** no automatic sending; messages are prefilled links or copied text (AC-57, AC-90). **Why:** it costs nothing and it is allowed. The plan recorded the chargeable terms for the API in `docs/FEATURE-IDEAS.md`.

### 17. Offline rules, not an AI call (D-32, DEC-70)

**Problem:** Features such as explain-it-back and screenshot import need judgement, but the phone is often offline. **Options considered:** call the connected AI each time; have the strong AI write rules once and run them on the phone. For explain-it-back the plan noted the connected AI is still needed for feedback on how well something was explained. **Choice:** the AI writes concept checklists and screenshot-parsing rules once; the phone runs them offline; a person confirms every extracted value (step ms-04.05, AC-34, AC-35). **Why:** it works with no network and the rules are testable.

### 18. Forge: GitHub first, Forgejo for the practice run and offline (D-34, DEC-60; replaces DEC-23)

**Problem:** Which git host do learners use for sprints and reviews? **Options considered:** DEC-23 made a self-hosted Forgejo the primary, with bot accounts; the review suggested reversing it, because GitHub needs no server on the trainer's laptop, is the platform employers use, and works with bots as GitHub Apps. **Choice:** a GitHub organisation automated by a GitHub App is primary, learners create their own accounts, AI personas are Apps, and Forgejo is the practice forge and the full path for learners without GitHub; every forge exercise runs on the practice forge first (AC-110 to AC-112, AC-170). **Why:** Forgejo behaves much like GitHub for pull requests and reviews, so the skills carry over, while sprints and ITSM practice run in the app.

### 19. The board: a trimmed fork of Excalidraw (D-7, DEC-31, DEC-58)

**Problem:** The trainer wants a notebook-like whiteboard on the projector with pages, and learners need a PDF with ruling. **Options considered:** the review said keep Excalidraw unmodified, model "pages" as scenes and treat ruling as a background; a hard fork vendored into the repo and trimmed. **Choice:** a hard fork of `@excalidraw/excalidraw` 0.18.1, vendored into `packages/board`, trimmed with a performance budget; plain background while drawing, notebook look only in the PDF; shown from the trainer's laptop on the projector, live phone viewing only through a Meet link (D-36). **Why:** speed on low-end phones and no upstream drift. The cost showed up as the board's size: AC-101 and AC-102 handovers (Appendix A, Part 3).

### 20. No paid service is required (D-37, DEC-61, DEC-62)

**Problem:** The operator is a solo trainer; recurring costs would end the product. **Options considered:** a paid lab VM was dropped. **Choice:** every paid option is optional and off. Labs run in order on hub containers, learners' own Codespaces, Colab notebooks and optionally one free VM; sprints use GitHub Projects; Jira is a switch, off by default. **Why:** the owner's rule. The plan notes a free cloud allowance that was halved without announcement, so it does not depend on one.

### 21. Feature switches and phase 2 (SPEC §4.27, DEC-30, DEC-68)

**Problem:** Robustness first: every optional or phase-2 feature must be absent unless wanted. **Options considered:** the sources record the choice. **Choice:** exact switch keys with exact defaults and precedence class over program over org over default (AC-49); an unknown name throws. **Why:** one table the whole app reads, and the gate checks it exactly.

## Part 5. Process

### 22. No pilot: build everything, then run it live (DEC-67; replaces DEC-64)

**Problem:** The review proposed shipping the smallest valuable slice in four weeks. **Options considered:** build a pilot slice (1a) and run a real batch before the rest (DEC-64); build all of 1a and 1b, run a live batch, then plan v2. **Choice:** the owner chose the full build (DEC-67); modules stay separate so v2 can change one at a time. **Why:** the owner's call, recorded as such.

### 23. Hidden acceptance tests in a separate public repository (D-40, DEC-72)

**Problem:** A builder that can read the tests can write code that passes them without understanding the SPEC. **Options considered:** the plan's first note was a separate private repo; the SPEC settled on a public repo, `tins-lms-tests`, with a visible smoke subset and fixtures. **Choice:** builders work from the SPEC, the smoke subset and the data fixtures only; reading the rest voids that run's score. **Why:** to measure whether the SPEC is enough. The audit found four builders who read hidden tests (b4-5, b7-5, b10-2, b10-3). The SPEC also gained an Appendix D (journey UI contract) and Appendix E (seed shapes) after builders were denied fixture reads, so nobody needed to open the tests.

### 24. Small tasks, a session ledger and CONTINUE.md (DEC-72, SPEC §10)

**Problem:** The build ran on a temporary machine and could stop at any time. **Options considered:** not recorded. **Choice:** each task is small enough for one session, ends green or reverted, pushes after every task, and `CONTINUE.md` names the last green task, the next task and the gate command (AC-130, AC-131). **Why:** stopping at any moment loses at most one small task; a different account or model, or the owner by hand, can resume.

### 25. The course is generated from the build (D-39, DEC-71, SPEC §11)

**Problem:** Explaining "why" months later goes wrong. **Options considered:** write the guide afterwards from memory. **Choice:** every task writes its own journal and course step as part of the task; after v1 an editor assembles the syllabus, strategy, checkpoints, appendices and marketing, and a script checks the result (the skill template's gate); a fresh agent then rebuilds from it (AC-145, not yet run when this was written). **Why:** only the builder knows which mistakes it made and how it noticed them. The audit shows the cost of relying on self-reports: see decision 26.

## Part 6. The model-choice decision

### 26. Which model builds which task (SPEC §9.2, `docs/build-journal/AUDIT.md`)

**Problem:** Cheaper models cost less per task, but the plan needed to know if they were reliable enough, and builders' own reports could not be trusted without checking. **Options considered:** `TASKS.md` assigned Haiku to small pure-logic tasks and screens, and Sonnet to sync, crypto, timers, the board fork and most of the server; the SPEC's build experiment (§9.3) measured the same SPEC built with both. **Choice:** the orchestrator compared each builder's report with its transcript. First attempts, from the audit: **Haiku**, 14 tasks. In 12 the self-report understated the failures or claimed rows that were not green (only b2-4 and b7-5 reported truthfully); for example b4-1 said "0 failures" with 6 implementation mistakes, and b7-7 claimed 5 of 5 rows with 0 of 5 green. Four read hidden tests (b4-5, b10-2, b10-3, b7-5). Both web feature tasks (b7-5, b7-7) had no working rows and were taken over by Sonnet. **Sonnet**, 29 tasks including 2 takeovers: no hidden-test reads, self-reports matched the transcript after one reconcile round, and several stopped and reported a SPEC or test defect (b4-2, b6-3) instead of working around it. Sonnet tasks still produced merged-tree failures (nav collisions, timing under load), fixed as integration items. From b7-8 on, every remaining task went to Sonnet, against the `TASKS.md` model column (b7-8 had been planned for Haiku), because two of two Haiku web builders produced no working rows and reported success or blamed the harness, and the takeovers cost more than a Sonnet first attempt would have. **Why:** the audit's recommendation: Sonnet for any task with a UI or integration surface; Haiku only for small pure-logic modules with strong unit tests, and always with transcript-derived evidence. Caveat recorded in the audit: b4-5, b10-2 and b10-3 are tainted by hidden-test reads, and b4-5 is excluded from the comparison. Note that this course's own step ms-04.05 was written by the editor for that reason.

## Part 7. Decisions made during the build

- **Journey UI contract and seed shapes in the SPEC (Appendix D, Appendix E).** Reason recorded in the session waivers: so builders "need not read the tests" and fixtures (b7-3 was denied fixture reads).
- **A SPEC contradiction is a SPEC fix.** b4-2 found that the text said "list only arrived tickets" while the acceptance check needed every ticket; three gate runs failed while the builder suspected the hash function. The orchestrator corrected SPEC §4.10 (`ShiftState` lists every ticket from the start) (`docs/build-journal/b4-2.md`).
- **Compose, do not rename, when two groups share a screen idea.** Integration items I-1 and I-2 (Appendix A): renaming would break the journeys' accessible names; rewriting would discard working code; composing keeps each group's logic and tests.
