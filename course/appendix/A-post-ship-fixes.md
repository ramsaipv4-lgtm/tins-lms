# Appendix A: post-ship fixes

Everything here was found **after** a task had passed its own gate. The tasks were built in parallel; the failures appeared when branches met. Each item gives the problem, the cause, how it was found, the fix and the lesson, and cites the journal it comes from. Facts are copied from the journals; where a journal gives no reason, this page says so.

How to use it: read an item, then ask whether your own build could have the same defect today. The [strategy](../01-strategy.md) groups the twelve items into six patterns and says how to spot each early.

Sources: `docs/build-journal/integration.md` (items I-1 to I-9, I-11, I-12), the task journals named below (I-5 to I-7 and I-10), and `docs/build-journal/AUDIT.md`. Item I-10 is recorded in the b7-6 journal, not in `integration.md`.

## Part 1. Integration items I-1 to I-12

### I-1: two learner screens named "Today", two "Delivery reports" (attend b7-3 + tele b7-4)

- **Problem.** b7-4 passed alone, but `kit merge` refused: the gate failed on the merged tree. Failing rows AC-83, AC-89, AC-150, AC-151 on desktop and phone, for example `AC-151 [desktop] after step "learner signed in": expected self-learn player to be visible`.
- **Cause.** Both groups registered the learner route `/learn/today`, and both added a trainer nav entry "Delivery reports". The trainer's day-screen link order put "Teleprompter" before the wrap-up "Today".
- **How found.** The merge gate on the merged tree; the same rows passed on each branch alone.
- **Fix.** Compose. The tele group's "Today" page embeds attend's wrap-up panel, the tele "Delivery reports" page embeds attend's draft list, attend's duplicate routes stay reachable by URL but leave the nav, and the trainer wrap-up "Today" sorts first. Proof: the teleprompter, wrap-up and substitute journeys, 8 of 8 pass.
- **Lesson.** A feature registry needs a rule for shared screens: one owner per route and nav name, others contribute panels.
- **Source.** `docs/build-journal/integration.md`, I-1.

### I-2: two screens answer to "schedule" (admin b7-2 + tele b7-4)

- **Problem.** b7-2 passed alone, but the merge was refused. AC-169 failed on desktop and phone: `after step "switches on": timed out waiting for calendar sync and Google Forms controls shown once on`. The Forms button appeared; "Sync to calendar" never did.
- **Cause.** A browser probe on the merged tree showed the journey's schedule link resolving to `<a href="/teach/substitute">Class schedule</a>` (tele, order 20), not b7-2's "Schedule" (`/teach/schedule`, order 30). The calendar button lives on b7-2's page, so it was never reached. The API was fine: `PUT /api/admin/switches` then `GET /api/switches?classId=class:c1` returned `calendarSync: true`.
- **How found.** The failing row, then a browser probe; the API check ruled out the server.
- **Fix.** Compose, as in I-1: the trainer's "Schedule" screen embeds tele's substitute panel; `/teach/substitute` stays reachable by URL but leaves the nav. Proof: google-optin, substitute and admin-setup journeys, 8 of 8 pass.
- **Lesson.** The collision was by meaning, not by path, so a path-only uniqueness check would not have caught it. The orchestrator's own mistake belongs here too: the first fix ran in a session with the task's default scope, so `kit merge` refused ("packages/web/src/features/tele/index.tsx is outside task b7-2's paths"). The unpushed branch was reset and the fix redone in a session started with `--paths` widened to the exact files. An integration fix must declare the files it touches in other groups up front.
- **Source.** `docs/build-journal/integration.md`, I-2.

### I-3: unit tests race on the shared web build (`packages/web/dist`)

- **Problem.** On a tree with b7-2, b7-6 and b7-7 merged, the gate failed at "builder unit tests": `AC-150 / AC-151 substitute handover ... locator.waitFor: Timeout 30000ms exceeded ... waiting for getByRole('cell', { name: 'AI-delivered' })`. The same file passed 4 of 4 alone.
- **Cause.** `packages/web/test/foundation.test.mjs` rebuilt `dist` three times (plain, pseudo-locale, plain), and the bundler empties the folder first. Node runs test files in parallel, so any other test serving `dist` could load an empty or pseudo-locale build. b7-4 had worked around it in its own test; b7-5 and b7-6 had seen the same intermittent failures in other groups' rows.
- **How found.** A test failing only in the full run and passing alone; several builders' reports of the same flake.
- **Fix.** The foundation tests build into their own folders (`packages/web/.test-dist/<name>`, via `LMS_WEB_OUT`) and serve them with `LMS_WEB_DIST`. The gate builds the shared `dist` once before the unit tests. Proof: 276 pass, 0 fail (before: 275 pass, 1 fail).
- **Lesson.** Tests that write a shared build output are a hidden coupling. The orchestrator's first close then failed with four tele tests red: in a fresh worktree nothing built `dist` any more, because the racing test had been building it for everyone. Make the server's static folder configurable from day one.
- **Source.** `docs/build-journal/integration.md`, I-3.

### I-4: the shell-size test counted lazy chunks

- **Problem.** b8-1 reported `packages/web/test/foundation.test.mjs` failing in its tree: shell JS 2,616,573 bytes gzip against the 300 KB budget (AC-102), although the board is lazy-loaded.
- **Cause.** The test summed the gzip size of every `.js` file in `dist/assets`, including chunks reached only through `import()`.
- **How found.** The builder's report from its own tree.
- **Fix.** The shell is the scripts and module preloads that `index.html` references plus every chunk they import statically, followed transitively; `import()` targets are not followed. Proof: on b8-1's build, 2 chunks and 58,615 bytes gzip against 2,609,607 bytes for all 209 chunks; on main the test passes.
- **Lesson.** A budget test must measure the thing the budget is about.
- **Source.** `docs/build-journal/integration.md`, I-4.

### I-5, I-6, I-7: nav order between the files group (b7-9) and shift, classroom and learn

After b7-9 (files) merged, three more branches failed in `kit merge`. In each case a journey's nav pattern, which matches by substring, hit a files-group entry that sorted first.

| Item | Failing | Cause | Fix |
|---|---|---|---|
| I-5 | AC-161 (peer review) and AC-170 (forge), desktop and phone | Files entries "Review" (order 7) and "Settings" (order 2) matched the patterns `/reviews?\|peer review/` and `/settings\|profile\|accounts/` before shift's "Peer review" (order 49) and "Accounts" (order 52). A prototype of the later nav check found them | Shift's two entries sort first (orders 6 and 1.5); labels unchanged. Peer 4 of 4, forge 2 of 2, corporate 10 of 10 pass |
| I-6 | AC-96 (file exchange) | The journey reaches its screen by `/packages?\|files\|file exchange/`; classroom's "Packages" (order 29) came before files' entry (order 35). Moving "Packages" later would have handed AC-166's `/library\|packages/` to tele's "Package library" | Files' trainer entry sorts at 28, one line, with the task's scope widened for it. Files, content-improve and trainer-pack journeys pass |
| I-7 | AC-95 (offline): `after step "content offline": timed out waiting for due cards offline` | The journey reaches cards by `/cards\|review/`; learn's "Daily cards" (order 2) came before files' "Review" (order 7), whose screen works with the server stopped | "Daily cards" sorts at 7.5. Offline (AC-95) and cards (AC-85) journeys pass. Longer term (b11-2): one cards screen that works online and offline |

- **Lesson.** Substring matches make nav order part of the contract. This is what `scripts/navcheck.mjs` was written for (see Part 3).
- **Sources.** `docs/build-journal/integration.md` (I-5, I-6, I-7 summary); `docs/build-journal/b7-6.md` (I-5), `docs/build-journal/b7-7.md` (I-6), `docs/build-journal/b7-5.md` (I-7). In b7-7 the builder also records that its own first fix was by label and order instead of by meaning (the I-1/I-2 lesson), and fixed AC-157 and AC-166 by giving one owner per idea (roster, packages).

### I-8: two Reacts in the main checkout; nothing compressed

- **Problem 1.** `kit merge b8-1` failed AC-97 twice in main's checkout ("expected board to be visible" right after sign-in) while the same tree passed in a separate worktree. **Problem 2.** AC-164's phone test failed in four full-suite merge gates and never alone, and AC-102 failed at 377 KB after b7-9 merged; the static server sent nothing compressed.
- **Cause 1.** The Playwright trace showed `TypeError: Cannot read properties of null (reading 'useRef')` from the board chunk: two Reacts. npm workspaces hoisted React 18.3.1 to the root (pulled in for Excalidraw) and kept `packages/web`'s pinned React 19.3.0 in its own folder. Task worktrees linked only the root `node_modules`, so every worktree build since the start used React 18 for everything, while main used React 19 for the app and React 18 inside Excalidraw.
- **Fix.** (a) Vite `resolve.dedupe` for react, react-dom and scheduler; (b) `scripts/setup.mjs` links each package's own `node_modules` into worktrees; (c) the static handler sends text files with brotli or gzip, cached by mtime, with a `Vary` header. Proof: all unit tests 289 of 289 after the change; board journey (AC-97) passes on desktop and phone with 297 of 297 unit tests.
- **Options rejected.** Pin React 18 everywhere (against the SPEC pins); install per worktree (slow on a 16 GB machine).
- **Lesson.** A shared dependency folder must include nested workspace folders; and compress static files from day one.
- **Source.** `docs/build-journal/integration.md`, I-8.

### I-9: kiosk mode missed a link, and a test that ate the machine

- **Problem.** After b7-5 and b7-8 merged, every gate running AC-167 (robustness) hung while its Node process grew to about 13.6 GB, twice nearly exhausting the 16 GB machine.
- **Cause.** Two parts. App: kiosk mode hid only links starting with `/coach`, but the coach group had added a learner link `/learn/coach`. Test: the journey asserted `assert.equal(<Playwright Locator>, null)`, and the failing diff deep-inspected the Locator's object graph at about 340 MB per second (250 MB at 5 s, 3.5 GB at 15 s, as measured).
- **Fix.** The kiosk module hides `a[href^="/coach"]` and `a[href^="/learn/coach"]` and redirects either path. In the tests repository: a boolean assertion, a worker-thread memory watchdog that kills a journey above 3 GB, and bounded server-log buffers. Proof: robustness journey 6 of 6; with the fix reverted the test fails cleanly in 22 s.
- **Lesson.** A feature that hides another feature's links must use that feature's declared routes (a shell hook), not a guessed prefix; never put a live browser object in an assertion that may need to print it.
- **Source.** `docs/build-journal/integration.md`, I-9.

### I-10: a button that rendered disabled before its data arrived (AC-164, phone)

- **Problem.** AC-164 "a prod deploy needs an approved change request" failed on the phone profile in every full-suite gate and passed alone.
- **Cause.** Trace evidence: the trainer's `POST ...` decide call returned 200 and the learner page re-fetched `/api/corp/change-requests` 48 times (all 200) over 40 s without "Deploy to prod" ever reading as enabled. The button rendered disabled while the list was still loading, so a check made right after navigation saw "not approved" whenever the fetch was slower than the check (throttled phone, loaded machine). The earlier `cache: 'no-store'` change was a plausible guess, not the cause.
- **Fix.** Show a loading status in place of the button until the data has arrived, so its disabled state always means "no approved change request".
- **Lesson.** Never render an interactive control in a placeholder state.
- **Source.** `docs/build-journal/b7-6.md`, "Orchestrator note: integration I-10". `integration.md` refers to I-10 (inside I-12) but does not have a section of its own.

### I-11: the pseudo-locale meta injected into a compressed page

- **Problem.** b11-2 found every AC-123 page hanging once `index.html` grew past 1,024 bytes (`page.goto: Timeout 30000ms exceeded`).
- **Cause.** I-8 made `static.ts` compress text files of 1 KB and more. `main.ts` in pseudo-locale test mode read the compressed body as text, injected `<meta name="lms-pseudo-locale">` and sent corrupt bytes with `content-encoding` still set. The builder had `wc -c dist/index.html` = 1,032.
- **How found.** AC-99 passed while AC-123 failed on all six pages; the only difference was the injected meta.
- **Fix.** In pseudo-locale mode, decode br or gzip first, inject, and send the page uncompressed (the mode exists only for the strings check).
- **Lesson.** Response middleware that rewrites bodies must run before compression, or decode what it rewrites.
- **Sources.** `docs/build-journal/integration.md`, I-11; `docs/build-journal/b11-2.md`, mistake 1 (where it was found).

### I-12: a settings checkbox reverted by its own first load (AC-161, phone)

- **Problem.** With the gate timeout raised so that the whole suite finally ran (29.5 minutes), AC-161 [phone] failed: `locator.check: Clicking the checkbox did not change its state` (the trainer's pair-programming switch).
- **Cause.** The checkbox rendered as "off" before the class settings had loaded. On the throttled phone the click landed first; the first poll answer, still "off", then reset the box. The same shape as I-10.
- **Fix.** Render the switch only after the settings load, and ignore poll answers while a save is in flight.
- **Lesson.** Show "Loading" until the real value is known, then let a save win over stale reads.
- **Source.** `docs/build-journal/integration.md`, I-12.

## Part 2. Branch re-recordings and why

Six task branches were rebuilt from main inside one new tins-kit session before they could merge. The code did not change meaning; the **record** was wrong. Two kit rules explain it:

- **RF-27.** A session that is aborted mid-task leaves commits with no session record. The re-record of b6-8 carries the waiver "re-record b6-8 in one session: the earlier aborted session left commits with no record (tins-kit RF-27)" (`sessions/20261005T022909-ab08c9f9.md`). The audit lists b6-8 as "used `kit abort` mid-task (RF-27)" (`docs/build-journal/AUDIT.md`).
- **RF-29.** `CONTINUE.md` rule 4 states it: a branch with commits made outside a session, or a claim that the gate later refutes, is rebuilt from main in one new session (see tins-kit RF-29). The text of RF-29 itself is in the tins-kit, not in this repository.

| Branch | What was wrong | What was done | Source |
|---|---|---|---|
| b6-8 | Commits from an aborted session had no record (RF-27) | Re-recorded in one session; the lesson cites the new code commit | AUDIT.md row b6-8; the session waiver above |
| b7-5 | The Haiku builder's two commits (7b78c86, 8aecf74) carried no `Session:` trailer, so `kit merge` would refuse at its check step | Never pushed. Rebuilt from main with only this task's paths, from the Sonnet takeover's final tree, in one new session; lesson `source_refs` repointed | `docs/build-journal/b7-5.md`, "branch re-recorded" |
| b7-7 | `kit merge` refused: "commit 0cbda77907: needs exactly one Session trailer (has 0)" and "session 9d0218ad: no record in sessions/". The Haiku builder had committed its "all 5 rows failing" notes after its session ended and the session was never closed | Same remedy as b7-5 | `docs/build-journal/b7-7.md`, "branch re-recorded" |
| b8-1 | The code commit claimed AC-101 before any gate verified it; the gate failed twice on the phone (2.73 to 3.09 s against 3 s, never with margin). The gate forbids removing a committed claim | Rebuilt from main with only AC-97 claimed; AC-101 moved to b11-2. The journal's lesson: claim a row only after the gate, not one local run, has shown it green | `docs/build-journal/b8-1.md`, "AC-101 not claimed; branch re-recorded" |
| b9-1 | The code commits claimed AC-102 before the gate verified it after b7-9 merged | Rebuilt from main with AC-100 and AC-103; AC-102 handed to b11-1 | `docs/build-journal/b9-1.md`, "branch re-recorded without AC-102" |
| b11-2 | Session waiver: "re-recorded; implements AC-99, AC-101, AC-123, AC-165 as specified" | The journal gives no separate reason beyond `CONTINUE.md` rule 4 (sync with main inside a session; re-record when the record is wrong). Later, `kit merge` failed one unit test (five new nav collisions after Shift merged) and the pins in `scripts/navcheck.mjs` were extended | `docs/build-journal/b11-2.md` (orchestrator note); session waiver in `sessions/` |
| b7-6 | Session waiver: "re-recorded; implements AC-86, AC-87, AC-161, AC-164, AC-170 as specified (I-5, I-10)" | The journal gives no separate reason either; the re-record carries the two integration fixes I-5 and I-10 | `docs/build-journal/b7-6.md`; session waiver in `sessions/` |

What to take from it: the record (a session per commit, honest claims) is part of the product. Commit inside a session, never `kit abort` mid-task, and do not claim a row the gate has not shown green.

## Part 3. The AC-101 and AC-102 handovers

Two performance rows passed locally in one task and failed once the merged tree changed. They moved between owners, and the moves are a map of how the budgets work.

**AC-101 (board usable within 3 s on the phone profile; board JavaScript not downloaded until the board opens).**

1. b8-1 (board) measured it at 7,982 ms, then 3,839, 4,468, 3,208, 3,002, 3,097 and 3,810 ms as it added brotli/gzip for `/assets/*` and a single boot call, and found it stuck at 2.7 to 3.1 s. The trace showed a 1.6 Mbps link with about 170 ms latency: roughly 1.75 s for three critical files of about 304 KB compressed, then about 0.8 s to run them.
2. The orchestrator's note: run alone, it measured 2.73 to 3.09 s, "under 3 s on most runs, never with margin". The remaining cost was the service worker precaching the board chunks about 2 s after the shell loaded, which is build-config work. Decision: claim AC-97 only; AC-101 moves to b11-2. (`b8-1.md`)
3. b11-2 wrote its own service worker: the core cache fills in parallel at install, the board chunks are warmed in the background for staff only. Probe on the phone profile: 2.5 to 2.9 s before, 0.96 to 1.45 s after (8 runs); the real test passed 3 of 3 runs together with AC-100 and AC-102. The core precache fell from 252 entries and 8.2 MB to 83 entries and 0.67 MB. (`b11-2.md`)

**AC-102 (app shell JavaScript under 300 KB compressed; no third-party CDN at runtime).**

1. b9-1: after b7-9 merged, `AC-102: app shell JavaScript is 377.1 KB on the wire in 6 files (budget < 300 KB)`. The shell now loads index (245 KB raw, 77 KB gzip) and pouchdb (137 KB raw, 44 KB gzip), and the static handler sent no compression. Chunking changes only move bytes; the fix lives in server code outside b9-1's scope. Decision: do not claim it; moved to b11-1. (`b9-1.md`)
2. b11-1: the brief said the static handler sent nothing compressed, but I-8 had already added compression, so the first budgets run passed AC-102 before any change (b11-1, mistake 1: "I trusted the brief"). The real defect was a second compression implementation in `board.ts` that answered `/assets/*` first; the extras moved into `static.ts` and the copy was deleted. (`b11-1.md`)
3. I-4 fixed the unit test that measured the wrong thing (Part 1).

**Lesson.** Move a row only with its evidence, and re-run it where the owner now sits: the premise in a brief can be out of date (b11-1), and a row that passed alone can regress after another group merges (b9-1).

## Part 4. Hardening defects found while merging (b11-1 and b11-2)

These are not numbered integration items but belong with them.

- **b11-1** (`docs/build-journal/b11-1.md`): five defects. A strict enrolment lookup that missed seed ids like `enrolment:c1-l1`; a regex literal containing `${d.index}` that never matched, so sealed lesson bodies held only titles; the guard prefix `/api/sign-in` against the SPEC's `/api/signin`, which had forced a second app in `main.ts`; no English OCR data; and compression implemented twice. It also built the two rows nobody had owned: the MCP server (AC-116, write tools only store a pending proposal) and the minor integrity log (AC-122). AC-94 was attempted and not claimed (see checkpoint 6).
- **b11-2** (`docs/build-journal/b11-2.md`): eight shell defects, among them a database library that did not bundle (Node's `events` import; the fix aliases `pouchdb-browser` to the prebuilt `pouchdb.js`), shell hooks for home, switch-gated nav, kiosk and links, `scripts/navcheck.mjs` in the gate, and the service worker. Its navcheck found 24 substring collisions among 74 patterns and 68 labels; one was a real defect (AC-153's `/settings|profile|accommodations?/` opened "Settings" instead of "Accommodations", fixed with order 1.5). Its mistake 1 found I-11.

## Part 5. Open items when this appendix was written

- AC-153 and AC-94 were assigned to task b12-1, still in progress (`CONTINUE.md`, 2026-10-06).
- The desktop flake in AC-94 (`1 !== 0`, "no document may be saved before the learner confirms") was left as an open question in `docs/build-journal/b11-1.md`.
- SPEC AC-145 (a fresh agent rebuilds the app from this course and reaches a passing suite) had not been run when the course was assembled. Record the result here when it has.
