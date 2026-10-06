# Strategy: how to work through the course

The syllabus says what to build. This page says how to work so you do not repeat the build's expensive mistakes. Everything here comes from the build itself: `CONTINUE.md`, `BUILDER.md`, [Appendix A](appendix/A-post-ship-fixes.md) and the journals in `docs/build-journal/`.

## 1. SPEC first, always

`SPEC.md` is the contract and the only thing you may build from. Two rules from `AGENTS.md` carry the whole method:

- To change behaviour, edit the SPEC first (a D-row or an AC-row that names the test file), then make the code match. Never fix a defect in code alone.
- Done means the gate passes. There is no skip flag.

Two builders stopped and reported a SPEC defect instead of working around it, and both were right: b4-2 found a contradiction in the `ShiftState` description, and b6-3 found a bad fixture in a test. The SPEC or the test was fixed, and the build went on. When your code and the SPEC disagree, decide which one is wrong before you touch either.

## 2. One task at a time, in a tins-kit session

Each step in this course matches one build task (see `TASKS.md`; step ids are the task's step column). Work the way the builders did:

1. Start a session with the files you intend to touch declared up front: `node .tins/kit/bin/kit.mjs start --task <id> --paths <paths> --model <name>`. The session records its scope. If you edit a file outside the scope, `kit close` refuses (this happened in b6-8 and in integration item I-2).
2. Read the SPEC rows for the step and write your own unit tests first.
3. Claim rows in `build/progress/<task>.json` only after the gate has shown them green.
4. Run `node .tins/kit/bin/kit.mjs gate`. It runs the SPEC lint, the dependency pin check, the nav-label check, your unit tests, the acceptance rows you claimed, and the course checks. Every failure is course material: keep the exact output, because your own notes become the "mistakes" part of your journal.
5. Finish with `kit close --why "<reason>"`. It commits and records the session from git.

Keep a journal per task from `skill-template/templates/journal.md`: the decision (Problem, Options considered, Choice, Why), every mistake with its exact failing output, how you noticed, the fix and the command that proved it. The builders' self-reports were checked against transcripts afterwards (`docs/build-journal/AUDIT.md`): in 12 of 14 Haiku first attempts the self-report understated the failures, so write the journal from the output you kept, not from memory.

## 3. Order of work and merge order

Follow the module order in the syllabus: core (modules 1 to 5), server (6), web (7), board (8), performance (9), adapters (10), hardening (11), the last rows (12). Core steps depend only on module 1, which is why the builders could run them in parallel. The server needs the core; the web needs the server.

The builders merged in a different order from the course order because they worked in parallel (for example the web feature groups merged as b7-1, b7-3, b7-4, b7-2, b7-9, b7-8, b7-5, b7-7, b7-6). You are one developer, so build in course order and merge each step before you start the next. In a team, expect the failures in section 4: each feature group passed alone and failed only when merged.

## 4. Why integration fixes happen, and how to spot them early

Nine web feature groups were built in parallel. Each passed its own rows. Merging them broke journeys that no group owned. Twelve integration items (I-1 to I-12) were fixed afterwards; see Appendix A for each. They fall into six patterns, and each has an early warning you can set up on day one.

| Pattern | What went wrong | Items | Spot it early |
|---|---|---|---|
| Nav-name collisions | Two groups registered the same screen idea ("Today", "Schedule", "Review") or a nav label that a journey's pattern also matched in another group's entry; the wrong page won | I-1, I-2, I-5, I-6, I-7 | Give each screen idea one owner; other groups contribute panels. Run a collision check over every journey nav pattern against every visible label (`scripts/navcheck.mjs`, wired into the gate in step 2b). Paths alone are not enough: I-2 collided by meaning, not by path |
| Shared build output | A test rebuilt `packages/web/dist` while others served it, so unrelated tests failed at random; a hidden dependency on that test appeared once it was fixed | I-3 | Give each test its own output folder; make the server's static folder configurable from the start; build the shared output once in the gate before any test reads it |
| Two Reacts | npm hoisted one React to the root and kept a pinned one in `packages/web`, so worktrees and the main checkout built different apps | I-8 | Dedupe the framework in the bundler config; make every environment link the same nested `node_modules`; check what the bundle contains, not just that it builds |
| Data-not-loaded-yet controls | A button or checkbox rendered in a placeholder state, and a test or a fast click acted on it before the data arrived (or a stale poll reset it afterwards) | I-10, I-12 | Show "Loading" until the real value is known; let a save win over stale reads. A disabled state must always mean one thing |
| Test memory blowups | A failing assertion printed a live browser object, and the diff inspection grew a Node process to about 13.6 GB | I-9 | Assert booleans, never live objects; add a memory watchdog to the harness; bound log buffers |
| Budget tests that measure the wrong thing | A "shell size" test summed every JavaScript file, including lazy chunks | I-4 | State what the budget measures and measure exactly that (the files `index.html` loads, followed transitively, not `import()` targets) |

Two more habits come from the same items. A feature that hides another feature's links must use that feature's declared routes (a shell hook), not a guessed URL prefix (I-9). Response middleware that rewrites a body must run before compression, or decode first (I-11).

## 5. One gate at a time on a small machine

The build machine had 16 GB of memory and 4 CPUs. Parallel gates starved each other: one run saw a machine load average of 17 to 26 and a load test that passed alone failed (b9-1, mistake M3). So the orchestrator ran every gate one at a time, behind a lock, and the later builders were told not to run full gates themselves (`CONTINUE.md`). On your own machine:

- Run a single journey while you work: `node --test acceptance/journeys/<name>.journey.mjs`. It is a run, not a read of the source.
- Run the full gate before you close a step. It built the web app and ran every unit test and every claimed acceptance row. The whole acceptance suite took 29.5 minutes in item I-12, which is why the gate timeout had to be raised.
- Do not start a second gate while one is running, and do not run a full gate in the background and forget it (b7-8 waited 40 minutes on a background gate that printed nothing).
- Watch memory. If a Node process grows past a few gigabytes, kill it and look at what your assertion is printing (I-9).

## 6. Working with the acceptance suite

Build from the SPEC and from failure output, not from the hidden tests (SPEC D-40). Appendix D of the SPEC lists the test ids and accessible names the journeys use, so you never need to open them. In the build, four Haiku tasks (b4-5, b7-5, b10-2, b10-3) read hidden tests; the audit flagged them and excluded them from the model comparison. See Appendix B for the model-choice decision.

## 7. How a step in this course is laid out

Every step folder has five files: the lesson, an instructor script, recall cards, an activity key and a trainer prep. Learners read the lesson. A trainer uses the other four. In the lesson, "Your turn: faulty first" shows the real failure first: predict, run, diagnose, then fix. After modules 2, 4, 6, 7, 9 and 12 there is a checkpoint with a rubric and an answer key, and the course ends with a final project.

## 8. When to stop and ask

Stop and write down the question when: the SPEC contradicts itself; a test fails and your reading of the SPEC says the test is wrong; a row needs a file outside your declared scope; or the gate refuses a claim you cannot explain. In b4-2 the builder changed the hash function twice on a wrong guess (journal b4-2, mistakes 2 and 3) before the real cause, a contradiction in the SPEC, was fixed by the orchestrator. Stopping to ask earlier would have saved two gate runs.
