# Integration log (orchestrator)

Feature groups are built in parallel and pass alone; merging two of them can still break journeys.
Each integration fix is recorded here with the evidence that found it.

## I-1: attend (b7-3) + tele (b7-4): duplicate "Today" and "Delivery reports"

**Problem:** b7-4 passed alone, but `kit merge` refused: "gate fails on the merged tree (each side
passed alone)". Failing: AC-83, AC-89, AC-150, AC-151 (desktop and phone), e.g.
`AC-151 [desktop] after step "learner signed in": expected self-learn player to be visible`.
**Cause:** both groups registered the learner route `/learn/today` (only one page can win) and both
added a trainer nav "Delivery reports"; the trainer's day-screen link order put "Teleprompter" before
the wrap-up "Today".
**Options considered:** rename one group's labels (breaks the journeys' accessible names); make one
group own both pages (rewrites working code); compose the pages.
**Choice:** compose: the learner "Today" page (tele) embeds the wrap-up panel (attend `LToday`,
`embedded`), the "Delivery reports" page (tele) embeds the draft list (attend `Reports`); attend's
duplicate routes stay reachable by URL but leave the nav; the trainer wrap-up "Today" sorts first.
**Why:** each group keeps its logic and tests; one nav entry per name; no journey changes.
**Proof:** `node --test` on teleprompter, wrapup and substitute journeys after the change: 8/8 pass.
**Lesson for the rebuild course:** a feature registry needs a rule for shared screens (one owner per
route and nav name, others contribute panels), or parallel teams collide exactly here.

## I-2: admin (b7-2) + tele (b7-4): two screens answer to "schedule"

**Problem:** b7-2 passed alone, but `kit merge` refused on the merged tree. Failing: AC-169 desktop
and phone, `after step "switches on": timed out waiting for calendar sync and Google Forms controls
shown once on`. The Google Forms button appeared; "Sync to calendar" never did.
**Cause:** a browser probe on the merged tree showed the journey's schedule link resolved to
`<a href="/teach/substitute">Class schedule</a>` (tele, nav order 20), not b7-2's "Schedule"
(`/teach/schedule`, order 30). The calendar button lives on b7-2's page, so it was never seen. The
API was fine: `PUT /api/admin/switches` then `GET /api/switches?classId=class:c1` returned
`calendarSync: true`.
**Options considered:** rename tele's link (then the substitute journey, which also looks for a
"schedule" screen, would land on b7-2's page and miss "I can't take day 1"); move the calendar
button into tele's page (puts admin-group logic in tele); compose the two on one screen.
**Choice:** compose, as in I-1. The trainer's "Schedule" screen (admin `TrainerSchedule`) embeds
tele's substitute panel (`Substitute embedded`, which renders an h2 titled "Substitute cover");
`/teach/substitute` stays reachable by URL but leaves the nav.
**Why:** one nav entry for one idea ("the class schedule"), each group keeps its own logic and tests,
no journey or SPEC change.
**Proof:** on the merged tree, `node --test` on google-optin, substitute and admin-setup journeys:
8/8 pass (AC-169, AC-150, AC-151, AC-80; desktop and phone).
**Lesson for the rebuild course:** the same as I-1. Registry rule: one owner per screen idea; other
groups contribute panels. The collision was by meaning ("schedule"), not by path, so a path-only
uniqueness check would not have caught it.
**Orchestrator mistake:** the first attempt ran in a session with the task's default scope, so
`kit merge` refused at its check step ("packages/web/src/features/tele/index.tsx is outside task
b7-2's paths"). The unpushed task branch was reset to before that session and the fix redone in a
session started with `--paths` widened to the exact tele files (as I-1 did). Scope is recorded per
session, so an integration fix must declare the files it touches in other groups up front.

## I-3: unit tests race on the shared web build (packages/web/dist)

**Problem:** on a tree with b7-2, b7-6 and b7-7 merged, the gate failed at "builder unit tests":
`AC-150 / AC-151 substitute handover … locator.waitFor: Timeout 30000ms exceeded … waiting for
getByRole('cell', { name: 'AI-delivered' })` (packages/web/test/tele.test.mjs). The same file passed
4/4 alone on the same tree, and on b7-2 alone.
**Cause:** `packages/web/test/foundation.test.mjs` (b7-1) rebuilt `packages/web/dist` three times
(plain, pseudo-locale, then plain again), and vite empties the folder first. Node runs test files in
parallel, so every other web test that serves `dist` could load an empty or pseudo-locale build.
b7-4 had already worked around it inside its own test (retry, rebuild only when stale); builders
b7-5 and b7-6 saw the same intermittent failures in other groups' rows (AC-89, AC-122).
**Options considered:** run unit tests with `--test-concurrency=1` (hides the bug and makes the gate
slower); add retries in every test (more workarounds); stop sharing the folder.
**Choice:** the foundation tests build into their own folders (`packages/web/.test-dist/<name>`,
via `LMS_WEB_OUT`, which vite.config.ts now reads) and start their server with `LMS_WEB_DIST`
pointing there (server config reads it; default unchanged). The gate (`scripts/gate.mjs`, step 3)
now builds the shared `dist` once before the unit tests; only that build and tele's stale check
write it.
**Why:** removes the cause; one env var each side; no behaviour change for users.
**Proof:** on the b7-2 + b7-6 + b7-7 tree, `node --test packages/*/test/*.test.mjs`: 276 pass,
0 fail (before: 275 pass, 1 fail).
**Orchestrator mistake:** the first close failed with 4 tele unit tests red: in a fresh worktree
nothing built `dist` any more, because the foundation test had been the one building it for every
other test and journey. A hidden dependency on the racing test itself. Fixed by the gate build above.
**Lesson for the rebuild course:** tests that write a shared build output are a hidden coupling.
Give each test its own output folder, and make the server's static folder configurable from day one.

## I-4: the shell-size unit test counted lazy chunks

**Problem:** b8-1 (board) reported `packages/web/test/foundation.test.mjs` failing in its tree:
"shell JS 2616573 bytes gzip" against the 300 KB budget (SPEC AC-102). The board is lazy-loaded.
**Cause:** the test (b7-1) summed the gzip size of every `.js` file in `dist/assets`, including chunks
that are only reached through `import()`: the board's Excalidraw (~1 MB compressed) and every
feature screen. It measured the whole app, not the shell.
**Options considered:** raise the budget (hides real growth); exclude files by name (breaks when a
chunk is renamed); measure what the browser loads first.
**Choice:** the shell is the scripts and modulepreloads that `index.html` references, plus every chunk
they import statically (followed transitively); `import()` targets are not followed.
**Why:** that is what AC-102 means by "app shell", and it does not depend on chunk names.
**Proof:** on b8-1's build: shell = 2 chunks (runtime + index), 58,615 bytes gzip; all 209 chunks =
2,609,607 bytes. On main the test passes (1/1).
**Lesson for the rebuild course:** a budget test must measure the thing the budget is about; "all
files in the output folder" silently changes meaning as soon as code splitting starts.
