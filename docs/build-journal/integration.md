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

## I-5, I-6, I-7: nav order between files (b7-9) and shift, classroom, learn

Recorded in the task journals (b7-6, b7-7, b7-5 "Orchestrator note"). In each case a journey's nav
pattern matched a files-group entry that sorted first; fixed by `order` only, labels unchanged.

## I-8: two Reacts in the main checkout; nothing compressed

**Problem 1:** `kit merge b8-1` failed AC-97 twice in main's checkout ("expected board to be visible"
right after sign-in), while the same merged tree passed every time in a separate worktree.
**Cause 1:** the Playwright trace showed `TypeError: Cannot read properties of null (reading 'useRef')`
from the board chunk: two Reacts. npm workspaces hoisted React 18.3.1 to the root node_modules (pulled
in for Excalidraw) and kept packages/web's pinned React 19.3.0 in packages/web/node_modules. Task
worktrees link only the root node_modules, so every worktree build since the start used React 18 for
everything; main's checkout used React 19 for the app and React 18 inside Excalidraw.
**Problem 2:** AC-164's phone test failed in four full-suite merge gates and never alone; AC-102 (shell
< 300 KB on the wire) failed at 377 KB after b7-9 merged. The static server sent nothing compressed.
**Options considered:** pin React 18 everywhere (against SPEC D-pins); install per worktree (slow,
16 GB machine); make both environments the same and the bundle use one React.
**Choice:** (a) vite `resolve.dedupe` for react, react-dom and scheduler, so the build uses
packages/web's React 19 for every importer; (b) scripts/setup.mjs also links each package's own
node_modules into worktrees, so worktrees build exactly what main builds; (c) packages/server static
handler sends text files with brotli or gzip (Accept-Encoding, cached by mtime, Vary header).
**Why:** one environment, one React, and the phone profile no longer pays for uncompressed bytes.
**Proof:** in i-8 (now React 19): all unit tests 289/289; on main + I-8 + b8-1: board journey
(AC-97) desktop and phone pass, unit tests 297/297; static.test.mjs covers br/gzip/none/small/images.
**Lesson for the rebuild course:** a shared dependency folder must include nested workspace folders,
or "it passes on my branch" means a different React. And compress static files from day one.
## I-9: kiosk mode did not hide the coach group's learner link (and a test that ate the machine)

**Problem:** after b7-5 and b7-8 merged, every gate running AC-167 (robustness journey) hung while its
node process grew to ~13.6 GB, twice nearly exhausting the 16 GB machine.
**Cause:** two parts. App: kiosk mode (files group, net.ts) hid only links starting with `/coach`, but
the coach group (b7-8) added a learner-nav link `/learn/coach`, so Coach stayed visible in kiosk mode.
Test: the journey asserted `assert.equal(<Playwright Locator>, null)`; the failing diff deep-inspected
the Locator's object graph at ~340 MB/s (measured: 250 MB at 5 s, 3.5 GB at 15 s).
**Options considered:** hide coach links by label (breaks with translations); move kiosk into the shell
(b11-2 will); fix the selector and redirect to cover both paths now.
**Choice:** net.ts hides `a[href^="/coach"]` and `a[href^="/learn/coach"]` and redirects either path
away while kiosk is on. Tests repo (e986a1a): boolean assertion, a worker-thread memory watchdog in
the journey harness (kills the journey above 3 GB), bounded server-log buffers.
**Proof:** robustness journey 6/6 on main + this fix; with the fix reverted the kiosk test now fails
cleanly in 22 s instead of eating memory.
**Lesson for the rebuild course:** a feature that hides another feature's links must use that
feature's declared routes (a shell hook), not a guessed URL prefix; and never put a live browser object
inside an assertion that may need to print it.

## I-11: pseudo-locale meta injected into a compressed page

**Problem:** b11-2 found every AC-123 page hanging once index.html grew past 1,024 bytes.
**Cause:** I-8 made static.ts compress text files of 1 KB and more; main.ts (pseudo-locale test mode)
then read the compressed body as text, injected `<meta name="lms-pseudo-locale">` into it and sent
corrupt bytes with `content-encoding` still set.
**Choice:** in pseudo-locale mode, decode br/gzip first, inject, and send the page uncompressed (the
mode exists only for the strings check; production never takes this path).
**Proof:** a11y journey (AC-99, AC-123) passes after the change (see the I-11 verify run); the gate run on close covers the rest.
**Lesson for the rebuild course:** response middleware that rewrites bodies must run before compression,
or decode what it rewrites.

## I-12: a settings checkbox reverted by its own first load (AC-161, phone)

**Problem:** with the gate's timeout raised so the whole suite finally ran (29.5 min), AC-161 [phone]
failed: `locator.check: Clicking the checkbox did not change its state` (trainer's pair-programming switch).
**Cause:** the checkbox rendered as "off" before the class settings had loaded. On the throttled phone the
click landed first; the first poll answer (still off) then reset the box. The same shape as I-10.
**Choice:** render the switch only after the settings load, and ignore poll answers while a save is in flight.
**Proof:** peer journey (AC-161) passes desktop and phone; the gate on close runs the full suite.
**Lesson for the rebuild course:** never render an interactive control in a placeholder state; show
"Loading" until the real value is known, then let a save win over stale reads.

## I-13: unit tests crashed on a machine without /opt/pw-browsers; .lms-data/ was not ignored

**Problem:** on a fresh machine seven unit tests failed at once (tele, board and foundation test files):
`ENOENT: no such file or directory, scandir '/nonexistent/path'` (the same message names `/opt/pw-browsers`
when that folder is absent). Separately, running the server from the repo left an untracked `.lms-data/`
(the default data folder, README section 2) in `git status`.
**Cause:** the three test files looked for Chromium with
`readdirSync(process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers')`, a cloud-container path, and
`readdirSync` throws on a missing folder. A second trap: Playwright reads `PLAYWRIGHT_BROWSERS_PATH`
once, when it is imported, so merely skipping `readdirSync` still made a bare `chromium.launch()` look in
the missing folder (`Executable doesn't exist at /nonexistent/path/chromium_headless_shell-1243/...`).
**Options considered:** a shared helper (no file for it inside this task's scope); three small identical
blocks; wrap `readdirSync` in try/catch only (does not fix the cached variable).
**Choice:** in each file's `browser()`, if the folder does not exist, delete the variable before importing
Playwright and call plain `chromium.launch()`; keep the `executablePath` branch when the folder exists.
foundation.test.mjs gets a test for it. `.gitignore` gains `.lms-data/`.
**Proof:** before: with `PLAYWRIGHT_BROWSERS_PATH=/nonexistent/path` the three files gave 7 failed of 16.
After: 17/17 with the variable unset and 17/17 pointing at the missing folder; all unit tests 334/334.
**Lesson for the rebuild course:** a test must not depend on a path that exists only in the author's
environment, and a library that reads an environment variable at import time needs the variable fixed
before the import, not after.

## I-14: the gate printed only the last 30 lines of a failing unit-test run

**Problem:** g-0's first close failed with one unit-test failure, but the gate printed only the last
30 lines of `node --test` output, which did not name the failing test. Four reruns passed (351/351), so the
flake could not be identified afterwards.
**Cause:** `scripts/gate.mjs` step 3 kept nothing of the unit run except that tail; the acceptance step
already saved its full TAP to `.tins/state-gate-last.tap`, the unit step did not.
**Choice (D-67):** run the unit step with `--test-reporter=tap` and write its full stdout and stderr to
`.tins/state-gate-unit.tap` on every run, pass or fail (ignored by `.tins/state*` in `.gitignore`); on a
failure the terminal still shows the tail and then names the file. Same session: SPEC §13.4's Snek limits
now state the owner's rulings that `ops` on a `TooManySteps` stop is the first value over `maxOps`
(not clamped; measured 1002 for `while True: pass` and 4996 for a `sorted` loop with `maxOps` 1000) and that
`peakCells` counts a string by its length.
**Proof:** the gate on close passes and leaves `.tins/state-gate-unit.tap` holding every unit test's line.
**Lesson for the rebuild course:** keep the full output of every check a gate runs, not only the part
shown on screen; a flaky failure you cannot name is a failure you cannot fix.

## I-15: Syntax Drop feel numbers outside the Tuning table; strike misses; two SPEC gaps (from g-3)

**Problem:** g-3 kept five numbers that set Syntax Drop's feel (base beat 1.5 × `minBeatMs`, fall 3 beats,
fill gap 2 beats, bonus share 0.5, decoy share 0.25) in a `FEEL` constant in the game's model, outside the
§13.9 Tuning table that D-64 says holds every such number. Its journal also asked what
`extra.slots[].filled` holds and whether "Story so far" stays on the page during a replay, and pointed out
that a missed strike piece never returned, so one miss capped Knowledge at 1 star.
**Choice (owner):** the five values become `syntaxDrop.*` Tuning rows, values unchanged, and `tuning.ts`
gains them in the same session (its D-64 unit test compares the two); g-3 then reads them from `TUNING`.
§13.7.1: `filled` is the placed pieceId or null; a non-decoy piece that reaches the line unpressed is a Skill
miss (shield chip) and comes back later in the round in both modes, so its concept is still asked; wrong
keys and struck decoys stay Knowledge mistakes. §13.3: a scene replayed from "Story so far" plays above the
arcade, which stays on the page. The owner confirms or changes the strike rule after the playtest.
**Proof:** the gate on close passes (tuning unit test 2/2 before close).
**Lesson for the rebuild course:** a game's feel lives in numbers; if one number escapes the single tuning
table, retuning silently stops covering it.

## I-16: a sixth Syntax Drop feel number outside the Tuning table (from g-3)

**Problem:** after I-15 moved five feel numbers into §13.9, the orchestrator's check of g-3 found two more
uses of one number in the game's model: `r() < 0.25` decides whether an extra rest beat comes before the next
piece (strike and fill). The builder's grep looked for the five named values, so it missed an unnamed one.
**Choice (owner):** a Tuning row `syntaxDrop.restChance` 0.25 (value unchanged; `tuning.ts` gains it in the
same session), and §13.9 now requires a unit test that fails on any bare decimal literal or `r() <`
comparison in a game's `model.ts` that does not come from `TUNING`; g-3 writes that test and reads the row.
**Proof:** the gate on close passes (tuning unit test 2/2 before close).
**Lesson for the rebuild course:** a rule that is checked only by a person reading code ("every feel number
is in the table") will be broken; turn it into a test.

## I-17: the first Syntax Drop playtest was not signed off; phase A of g-3 (screens, wording, hub)

**Problem:** the owner's first 10-minute playtest of Syntax Drop (AC-243) ended without a sign-off. Notes:
the wording was not familiar to young Indian learners; only one level seemed to exist (levels 2 and 3 were
locked and shown as plain "(locked)" text); no way out after losing, no menu or Back; dialogue controls
were keys only; the level picker after the prologue looked like a plain web page; the instructions used game
words a non-player does not know and did not show the keys; no full screen; simple graphics; no voice.
**Choice (owner):** g-3 grows into three phases (D-71). Phase A (this session) adds: a hub in the layout
patterns of the big kids' game platforms (D-70: rail or tab bar, top bar, Home rows "Continue playing",
"Recommended for you" from the weakest mastery concepts, "New this week", "All games", a reserved "Live"
row; a game page with one Play button and the full level path with unlock hints); a way out in every
status (`retry`, `back`, `quit`); a dialogue bar (`previous`, `next`, `pause`, `autoplay`, `skip`, tap to
advance); `fullscreen`; how to play with key caps and a self-running demo per action; the wording rule
(D-69). D-68: no copyleft code or assets ship in the app, so voice (phase B) is offline recordings plus the
device voice. The phase A acceptance rows (AC-247 to AC-253) are written as pending text until the test
writer's checks land, because the gate needs each row's check file to exist.
**Proof:** the gate on close passes.
**Lesson for the rebuild course:** a playtest by someone outside the build finds what no acceptance row asked
for: the way out, the words, and whether the player can even see that more levels exist.
