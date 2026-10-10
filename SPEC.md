# Coach LMS — SPEC v1 (build targets 1a + 1b)

Source of truth for the v1 build. Derived from `docs/PLAN.md` v14 (decisions DEC-1 to DEC-72).
Where this file and the plan disagree, **this file wins** for the build; the plan explains why.

**Rows:**

- `D-n` rows are decisions. Status is `locked`, `open`, or `superseded by D-n`.
- `AC-n` rows are acceptance checks. The last column names the test file in the acceptance suite
  that checks it, or `manual` with the reason.

**Acceptance suite:** a separate public repo,
[`ramsaipv4-lgtm/tins-lms-tests`](https://github.com/ramsaipv4-lgtm/tins-lms-tests). At gate time it
is cloned into `acceptance/` at this repo's root (that path is git-ignored here). Builder sessions
are not given that repo or its URL; it is public, so this is a convention, not a guarantee (see D-40).
Every path in a Check column is relative to this repo's root.

**Tins-kit:** the build uses tins-kit (session ledger, gate, scope, secret scan, SPEC lint). The gate
runs the acceptance suite plus the builder's own tests. No flag skips it.

---

## 0. Scope

**In v1 (1a + 1b, built in full; no pilot, DEC-67):** everything in §4–§9.

**Not in v1 (phase 2):**

- ERPNext / Frappe HR (payroll, expenses, invoices);
- the Google Meet add-on (v1 only creates Meet links);
- Jira (C-15);
- mock interviews (B-6), certification tracker (B-9), timesheets (C-6), client escalation (C-10),
  handover (C-13), 1:1 and appraisal (C-14), resume bullets (B-8), placement report (D-4), batch
  comparison (D-5);
- on-device AI models (Needle/Laya), story mode, visualizers and the trace viewer;
- iOS beyond the installable web app;
- multilingual UI (English only; strings externalised).

Phase-2 items get **feature switches** in v1 (off, and hidden when off) only where §4.27 lists them.

---

## 1. Decisions

### 1.1 Stack and dependencies

Every runtime and dev dependency is named in a locked row below **with its exact version**. The
tins-kit gate rejects any dependency not named here. Versions were read from npm on 2026-10-04.

| ID | Decision | Status | Source |
|---|---|---|---|
| D-1 | Language: TypeScript, written in the **erasable-syntax subset** only (no `enum`, `namespace`, parameter properties or decorators), so Node 22 runs `.ts` files directly with type stripping. Node **22.22** or newer. Dev dependency `typescript` 7.0.2 for type checking only | locked | DEC-53 |
| D-2 | Repo layout is an npm workspace: `packages/core` (pure logic, zero runtime dependencies), `packages/server` (hub and cloud server), `packages/web` (the app UI), `packages/board` (the trimmed Excalidraw fork), `packages/adapters` (integrations), `packages/cli` (installer, export/import, load test). The acceptance suite imports `packages/core/src/index.ts` | locked | DEC-53 |
| D-3 | `packages/core` has **no runtime dependencies** except `ts-fsrs` 5.4.2 (MIT) for card scheduling. Crypto uses the platform's Web Crypto (`globalThis.crypto.subtle`), which exists in Node 22 and in browsers | locked | DEC-53, review 1.2 |
| D-4 | Server: `hono` 4.13.13 with `@hono/node-server` 2.1.3; request validation with `zod` 4.6.5 | locked | DEC-53 |
| D-5 | UI: `react` 19.3.0 and `react-dom` 19.3.0, built with `vite` 8.3.2 and `@vitejs/plugin-react` 6.1.1; installable offline web app via `vite-plugin-pwa` 2.0.0 | locked | DEC-53 |
| D-6 | Sync: CouchDB replication protocol. `pouchdb` 9.0.0 on the hub and in tests, `pouchdb-browser` 9.0.0 in the app, `pouchdb-adapter-memory` 9.0.0 for tests. Cloud profile may use Apache CouchDB 3.x (installed separately, not an npm dependency) | locked | DEC-53, experiments/sync |
| D-7 | Board: hard fork of `@excalidraw/excalidraw` 0.18.1 (MIT) vendored into `packages/board` (not installed from npm after the fork), plus `@excalidraw/mermaid-to-excalidraw` 2.2.2, loaded on demand | locked | DEC-58 |
| D-8 | Tests and journeys: Node's built-in test runner (`node --test`) and `@playwright/test` 1.63.0 driving the Chromium already installed in the build environment | locked | DEC-65 |
| D-9 | The hub serves the replication endpoint `/db/*` with `express-pouchdb` 4.2.0 on `express` 4.22.3, mounted beside Hono on the **same** Node HTTP server; everything else is Hono | locked | experiments/sync |
| D-10 | QR: `qrcode` 1.5.4 to draw codes; `jsqr` 1.4.0 to read them from the camera in the web app | locked | DEC-22 |
| D-11 | Screen text recognition (P-16, screenshot import): `tesseract.js` 7.0.0 in the web app, with the English data loaded from the hub (never a third-party CDN at runtime); the hub serves it from `@tesseract.js-data/eng` 1.0.0 (MIT), pinned in packages/server | locked | DEC-70 |
| D-12 | Native shell (1b): `@capacitor/core` 8.5.2 and `@capacitor/cli` 8.5.2, Android only, used for clock-app alarms, reliable notifications and file sharing | locked | DEC-45, DEC-47 |
| D-13 | Content conversion: Microsoft MarkItDown (Python) as an optional sidecar process. Never the npm package named `markitdown` | locked | DEC-12 |
| D-14 | No other dependency may be added without a new locked D-row. Versions are pinned exactly (no `^` or `~`), and `package-lock.json` is committed | locked | DEC-53 |

### 1.2 Architecture

| ID | Decision | Status | Source |
|---|---|---|---|
| D-20 | One codebase, four deployment profiles: `phone` (no server; the app alone), `hub` (LAN server), `cloud` (internet server), `hybrid` (small records on cloud, content on hub). The profile is a config value, never a code fork | locked | DEC-54, DEC-69 |
| D-21 | Databases: one **class database** per class (`class-<classId>`), one **personal database** per learner (`person-<personId>`), one **org database** (`org`). Coach data lives only in the personal database and is encrypted before it leaves the device (D-26) | locked | DEC-55, F-38 |
| D-22 | All logic that decides anything (grades, unlocks, schedules, merges, codes) lives in `packages/core` as pure functions (time and randomness passed in as arguments). UI and server only call it | locked | Review 6 |
| D-23 | Every document has `type`, `id`, `schema` (integer) and `updatedBy` fields. A client syncs only if its schema version is within 2 of the hub's (F-21); older clients are told to update and are never wiped | locked | F-21 |
| D-24 | Conflicts from replication are resolved by the core merge function (§4.13) and written back as a merged revision; nothing is resolved by "whichever revision CouchDB picked" | locked | F-22, experiments/sync |
| D-25 | HTTPS on the LAN: the hub creates its own certificate authority at setup and serves HTTPS; the pairing QR carries the certificate fingerprint. A DuckDNS + Let's Encrypt certificate (renewed by `acme.sh`, in a container or as a script) is the optional sidegrade | locked | F-11, §20 |
| D-26 | Encryption: AES-GCM 256 with a fresh 96-bit IV per message; keys derived with HKDF-SHA-256; passphrases stretched with PBKDF2-SHA-256 at 600,000 iterations. Signing: ECDSA P-256 with SHA-256. All through Web Crypto | locked | F-20, F-24, DEC-69 |
| D-27 | Time: anything graded uses hub-signed start/end times plus a monotonic duration; device wall-clock time is never trusted for grading (F-17). Display time zone is the program's (default `Asia/Kolkata`) | locked | F-17 |
| D-28 | Secrets (keys, tokens, passphrases) are never logged, never written to exports in plain text, and never shown after entry | locked | tins-kit rule |

### 1.3 Product decisions carried from the plan

| ID | Decision | Status | Source |
|---|---|---|---|
| D-30 | Roles: `admin`, `trainer`, `substitute`, `learner`, `coordinator` (read-only batch view). One person may hold several roles; one app with role spaces | locked | DEC-29, DEC-36 |
| D-31 | AI proposes, people decide: no AI action that changes grades, posts to more than one person or edits a repo happens without a person confirming a diff (P-2, F-30). The app works fully with AI switched off (P-3) | locked | P-2, P-3 |
| D-32 | P-16: the connected strong AI writes rules once (concept checklists, screenshot parsing rules); the phone runs them offline. A person confirms every extracted value | locked | DEC-70 |
| D-33 | Under-18 learners get the minor profile (consent record, Coach trackers off, integrity log limited to exam events) | locked | F-36 |
| D-34 | Forge: GitHub organisation automated by a GitHub App; Forgejo is the practice forge and the full path for learners without GitHub. Every forge exercise runs on the practice forge first | locked | DEC-60, §20.1 |
| D-35 | Messaging: no automatic WhatsApp sending. Messages are prefilled for tap-to-send and can be copied | locked | §20.6 |
| D-36 | Board is shown on the projector from the trainer's laptop; phones get the PDF afterwards; live viewing on phones only through a Google Meet link | locked | §20 |
| D-37 | No paid service is required anywhere in v1. Every paid option is optional and off | locked | Owner |
| D-38 | Content release follows the teleprompter: sections unlock when the trainer reaches them, or at their scheduled time as a fallback; graded material never unlocks by time alone | locked | §20.4 |
| D-39 | The rebuild course (§11) is generated after v1 from the code, commits and build journal | locked | DEC-71 |
| D-40 | The acceptance suite lives in the public repo `tins-lms-tests`. Builders work from this SPEC, the visible smoke subset (`acceptance/smoke/`) and the data fixtures (`acceptance/fixtures/`) only; reading the rest of the suite during the build experiment voids that run's score | locked | Owner, iteration 16 |
| D-41 | Course `source_refs` and code-fence citations name commits reachable from `main`, that is the commit as it exists after `kit close` (close rewrites commits to add `Session:` trailers, so a sha taken before close is lost). The course check (`check.mjs course`) must pass on a fresh clone | locked | tins-kit RF-33 |
| D-67 | The gate keeps the full output of its builder unit-test step (`node --test --test-reporter=tap` over every `packages/*/test/*.test.*` file, stdout then stderr) in `.tins/state-gate-unit.tap` on every run, pass or fail, next to `.tins/state-gate-last.tap`; on a failure the terminal still shows the last 30 lines and then names that file (from g-0's first close: one flaky unit failure could not be named from the 30-line tail) | locked | owner |
| D-68 | **No copyleft code or assets ship in the app.** Nothing under `packages/` that reaches a learner's or trainer's device or the hub (web bundle, server, CLI, packs, story data, audio, images) may be under GPL, AGPL or another licence that would bind the app's own licence (the app's licence is not decided yet). Development and authoring tools (for example Blender or a speech model run on the author's machine) may have any licence; they are never bundled, and the licence of what they produce is recorded in the D-row that adopts the tool. So speech is offline recordings plus the device's own voice as a fallback; no eSpeak-based browser speech | locked | owner |

---

## 2. How the acceptance suite talks to the code

- **Core:** tests import named exports from `packages/core/src/index.ts`. Every function listed in
  §4 must be exported from there **with exactly the name and argument order given**. Functions
  marked `async` return Promises. Times are milliseconds since the Unix epoch (numbers). No
  function in core reads the clock, the network, the file system or `Math.random`; time and
  randomness come in as arguments.
- **Server:** tests start the server with `node packages/server/src/main.ts` and these environment
  variables:
  - `PORT`;
  - `LMS_PROFILE=hub`;
  - `LMS_DATA_DIR` (a temporary folder);
  - `LMS_TEST_MODE=1`, which enables `/__test/*` routes (§5.9);
  - `LMS_TLS=off` (tests use plain HTTP on localhost).

  The server prints `LISTENING <port>` on stdout when ready.
- **Web:** journey tests run `npm run build -w packages/web`, then start the server above, which
  also serves the built app at `/`. Elements that journeys touch carry the `data-testid` values
  listed in §6.
- **Fixtures:** the suite brings its own synthetic course package and data. The owner's real
  packages are never committed to the public suite.

---

## 3. Data model (document types)

All documents are JSON with `type`, `id`, `schema`, `updatedAt` and `updatedBy`. Ids are
`<type>:<key>`. Only the main fields are listed; builders may add fields but not rename these.

| Type | Lives in | Main fields |
|---|---|---|
| `org` | org | `name`, `brand` (logo, colours, certificate and report templates), `switches` |
| `person` | org | `name`, `roles[]`, `dob?`, `minor` (bool), `consent?`, `accommodations?`, `githubUser?`, `forgeUser?`, `phone?` |
| `program` | org | `name`, `timezone`, `packageRef`, `switches` |
| `cohort` | org | `programId`, `name`, `classIds[]` |
| `class` | class | `cohortId`, `name`, `trainerIds[]`, `schedule[]` (date, start, end), `seedSalt`, `switches`, `passMark` (default 6) |
| `enrolment` | class | `personId`, `joinedAt`, `status` (`active` / `dropped`), `droppedAt?`, `profile` (`phone`/`hub`/`cloud`/`hybrid`/`files`) |
| `day` | class | `index`, `date`, `sections[]` (id, title, plannedSec, graded, kind), `released` (section ids) |
| `attendance` | class | `personId`, `dayIndex`, `method` (`rotating`/`printed`/`file`/`manual`), `verified` (bool), `at` |
| `card` | person | `deck`, `front`, `back`, `fsrs` (state from ts-fsrs), `sourceRef` |
| `attempt` | class | `personId`, `itemId`, `seed`, `mode` (`live`/`recorded`/`emulated`), `answers`, `score`, `timing` (§4.26), `aiPolicy`, `aiUsage[]` |
| `ledger` | class or person | `subject`, `entries[]` (§4.9) |
| `shiftRun` | class | `packId`, `seed`, `teamId`, `state` (§4.10) |
| `appeal` | class | `attemptId`, `state` (§4.11), `history[]` |
| `ticket` | class | `title`, `status`, `points?`, `iteration?`, `assignee?`, `forgeRef?` |
| `exitTicket` | class | `personId`, `dayIndex`, `choiceIds[]`, `text?` |
| `doubt` | class | `personId?` (null when anonymous), `text`, `votes[]`, `answered` |
| `errorNote` | person | `dayIndex`, `subtopic`, `question`, `given`, `correct` |
| `coachEntry` | person (encrypted) | `kind` (`food`/`money`/`steps`/`sleep`/`note`), `values`, `source` (`manual`/`screenshot`/`healthconnect`), `confirmed` (bool) |
| `parseRules` | org | `app`, `fields[]` (§4.18), `author` (`ai`/`person`), `approvedBy?` |
| `certificate` | org | `personId`, `programId`, `issuedAt`, `certId` (§4.35) |

---

## 4. Core logic (`packages/core`): interfaces and acceptance

### 4.1 Seeded randomness (P-6)

```ts
createRng(seed: string): () => number              // returns numbers in [0, 1)
seedFor(classSalt: string, itemId: string): string // per-class seed for a graded item
shuffle<T>(items: readonly T[], rng: () => number): T[] // returns a new array
```

| ID | Behaviour | Check |
|---|---|---|
| AC-1 | `createRng` with the same seed returns the same sequence (first 1,000 values identical); different seeds give different sequences; every value is in [0, 1) | `acceptance/core/rng.test.mjs` |
| AC-2 | `seedFor` differs for two classes and the same item, and is stable across calls; `shuffle` returns a permutation of the input, never mutates it, and is identical for identical rng seeds | `acceptance/core/rng.test.mjs` |

### 4.2 Cards and spaced repetition (ts-fsrs)

```ts
type Rating = 'again' | 'hard' | 'good' | 'easy'
newCard(id: string, now: number): Card            // Card has at least { id, due: number, reps: number }
reviewCard(card: Card, rating: Rating, now: number): Card
dueCards(cards: readonly Card[], now: number): Card[] // due <= now, oldest due first
spreadBacklog(cardIds: readonly string[], startDay: number, days?: number, maxPerDay?: number): Record<number, string[]> // defaults 7, 30
```

| ID | Behaviour | Check |
|---|---|---|
| AC-3 | After `reviewCard(c, 'good', t)` the new `due` is later than after `reviewCard(c, 'hard', t)`, which is later than after `'again'`; `'again'` puts the card due within 24 h; `reps` increases by 1 | `acceptance/core/cards.test.mjs` |
| AC-4 | `dueCards` returns only cards with `due <= now`, oldest first, without mutating input | `acceptance/core/cards.test.mjs` |
| AC-5 | `spreadBacklog` assigns every id exactly once, never more than `maxPerDay` per day while it fits in `days` days, keeps input order, and puts any overflow on the last day | `acceptance/core/cards.test.mjs` |

### 4.3 Catch-up gate (F-02, DEC-37)

```ts
catchUpState(input: {
  dayIds: readonly string[]            // all class days in order
  todayIndex: number                   // index into dayIds of today's day
  attended: readonly string[]          // day ids the learner attended
  bestScores: Record<string, number>   // day id -> best diagnostic score (0..8)
  passMark?: number                    // default 6
}): { missed: string[]; nextGate: string | null; unlocked: string[]; selfStudyBlocked: boolean }
gradedDueDate(gatePassedAt: number, extensionDays?: number): number   // default 7 days
```

Rules: a day before today that was not attended is **missed**. Missed days unlock **in order**: a
missed day is unlocked when its best score ≥ pass mark **and** every earlier missed day is
unlocked. `nextGate` is the first missed day not yet unlocked. Attended days and today are always
unlocked (live class stays open). `selfStudyBlocked` is true while any missed day is locked.

| ID | Behaviour | Check |
|---|---|---|
| AC-6 | A learner who attended every day has no missed days, `nextGate` null, all days up to today unlocked, `selfStudyBlocked` false | `acceptance/core/catchup.test.mjs` |
| AC-7 | A learner who joined on day 3 (missed days 0–2) has `nextGate` = day 0; passing day 1's diagnostic before day 0's does **not** unlock day 1; after day 0 passes (day 1 not yet passed), `nextGate` = day 1 | `acceptance/core/catchup.test.mjs` |
| AC-8 | Score 5 of 8 does not unlock with the default pass mark; 6 does; a class pass mark of 7 is respected; today stays unlocked even while missed days are locked | `acceptance/core/catchup.test.mjs` |
| AC-9 | `gradedDueDate` is exactly 7 × 24 h after the gate was passed by default, and honours a custom extension | `acceptance/core/catchup.test.mjs` |

### 4.4 Mastery map (review §4, B-12)

```ts
masteryMap(checks: readonly { skill: string; score: number; at: number }[]): Record<string, 'mastered' | 'not-yet'>
```

A skill is **mastered** when its two most recent checks both score ≥ 0.8 and are at least 24 h
apart; any other skill with at least one check is **not-yet**. Skills with no checks are absent.

| ID | Behaviour | Check |
|---|---|---|
| AC-10 | Two checks of 0.8 and 0.9, 25 h apart → mastered; same scores 2 h apart → not-yet; a later 0.5 after mastery → not-yet; a skill with one check → not-yet | `acceptance/core/mastery.test.mjs` |

### 4.5 Rotating attendance code (F-04, OQ-18)

```ts
async attendanceCode(secret: Uint8Array, now: number, periodSec?: number): Promise<string> // default 60
async verifyAttendanceCode(code: string, secret: Uint8Array, now: number, periodSec?: number): Promise<boolean>
```

The code is a 6-digit string computed like HOTP (RFC 4226, dynamic truncation) with HMAC-SHA-256
over the counter `floor(now / 1000 / periodSec)` as an 8-byte big-endian integer. Verification
accepts the current and the **previous** period only.

| ID | Behaviour | Check |
|---|---|---|
| AC-11 | The code is exactly 6 digits (leading zeros kept), identical anywhere within one period, and different in the next period for the test secret | `acceptance/core/attendance.test.mjs` |
| AC-12 | Verification accepts the current and previous period's code and rejects a code two periods old or from another secret; `periodSec` 120 works the same way | `acceptance/core/attendance.test.mjs` |

### 4.6 One-time pairing codes (F-35)

```ts
issuePairing(state: PairingState, code: string, now: number, ttlMs?: number): PairingState // default 5 min
claimPairing(state: PairingState, code: string, deviceId: string, now: number):
  { state: PairingState; result: 'ok' | 'expired' | 'used' | 'unknown' }
emptyPairingState(): PairingState
```

| ID | Behaviour | Check |
|---|---|---|
| AC-13 | A fresh code claims `ok` once; a second claim is `used`; a claim after the TTL is `expired`; an unknown code is `unknown`; state is never mutated in place | `acceptance/core/pairing.test.mjs` |

### 4.7 Content release in step with the teleprompter (D-38)

```ts
async sectionKey(dayKey: Uint8Array, sectionIndex: number): Promise<Uint8Array> // HKDF-SHA-256, empty salt, 32 bytes, info "section:<index>"
async sealSection(key: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array>  // AES-GCM, IV prefixed
async openSection(key: Uint8Array, sealed: Uint8Array): Promise<Uint8Array>     // throws on wrong key or tampering
releasePlan(classStart: number, sections: readonly { id: string; plannedSec: number; graded: boolean }[]):
  { id: string; at: number | null }[]          // at = start + 1000 × (sum of earlier plannedSec); null when graded
isReleased(section: { id: string; graded: boolean }, plan: { id: string; at: number | null }[],
  ctx: { now: number; reachedIds: readonly string[]; releaseAll: boolean }): boolean
```

Rules: a section is released if the trainer's teleprompter has reached it (`reachedIds`), or
`releaseAll` was tapped, or (only if **not graded**) `now >= at`.

| ID | Behaviour | Check |
|---|---|---|
| AC-14 | `sectionKey` is deterministic, differs per section index, and is 32 bytes; `openSection(sealSection(x))` returns `x`; a wrong key or one flipped byte makes `openSection` throw; two seals of the same text differ (fresh IV) | `acceptance/core/release.test.mjs` |
| AC-15 | `releasePlan` gives cumulative times from the class start and `null` for graded sections | `acceptance/core/release.test.mjs` |
| AC-16 | An ungraded section is released by reaching it, by `releaseAll`, or by time; a graded section is **never** released by time alone, only by reaching it or `releaseAll` | `acceptance/core/release.test.mjs` |

### 4.8 Teleprompter pacing and rehearsal (A-9)

```ts
pace(sections: readonly { id: string; plannedSec: number }[],
     events: readonly { sectionId: string; at: number }[], now: number):
  { perSection: { id: string; actualSec: number | null; deltaSec: number | null }[]; currentId: string | null; behindSec: number }
parseScriptSections(markdown: string): { id: string; title: string; plannedSec: number; graded: boolean }[]
scriptTotalSec(markdown: string): number | null   // from a "Total runtime: **N hours**" (or "N minutes") line
```

`events` are "entered section" moments. A section's actual time runs from entering it until
entering the next one (or `now` for the current one). `deltaSec` = actual − planned (positive =
over time). `behindSec` = sum of deltas of finished sections plus the current section's overrun
(if any); it is negative when the trainer is ahead. `parseScriptSections` reads `## <title> (h:mm — h:mm)` headings (em dash, en dash or
hyphen) from an instructor script and returns their planned durations; ids are slugs of the titles (lowercase, each run of non-alphanumerics → one `-`, trimmed). A heading
containing `[graded]` marks the section graded (the marker is removed from the title).
Headings like `## **Break (2:15 — 2:30)**` are sections too (bold markers removed).

| ID | Behaviour | Check |
|---|---|---|
| AC-17 | With planned 600 s + 600 s and entries at 0 and 720 s, at now = 900 s: first actual 720 / delta 120, current is the second, `behindSec` 120; sections never entered have `null` | `acceptance/core/pace.test.mjs` |
| AC-18 | `parseScriptSections` on the fixture script returns the blocks with durations (e.g. `(0:15 — 1:15)` → 3600 s) and ignores headings without a time range | `acceptance/core/pace.test.mjs` |

### 4.9 Append-only ledger (P-10)

```ts
async appendEntry(ledger: readonly Entry[], entry: { subject: string; value: unknown; by: string; at: number; reason?: string; corrects?: number }): Promise<Entry[]>
async verifyLedger(ledger: readonly Entry[]): Promise<{ ok: boolean; brokenAt: number | null }>
currentValue(ledger: readonly Entry[], subject: string): unknown
```

Each `Entry` gets `seq` (0, 1, 2…), `prevHash` and `hash` (SHA-256 hex over a canonical JSON of
the entry without `hash`). A correction is a new entry with `corrects` = the original's `seq`.
`currentValue` returns the value of the latest entry for that subject.

| ID | Behaviour | Check |
|---|---|---|
| AC-19 | Appending returns a new array (input unchanged) with consecutive `seq` and a valid hash chain; `verifyLedger` is ok | `acceptance/core/ledger.test.mjs` |
| AC-20 | Editing any field of an earlier entry makes `verifyLedger` report `brokenAt` = that entry's seq | `acceptance/core/ledger.test.mjs` |
| AC-21 | After a correction, `currentValue` returns the corrected value and the original entry is still present and unchanged | `acceptance/core/ledger.test.mjs` |

### 4.10 Shift engine (M-10, DEC-1)

Pack format (JSON, produced by the skill template, checked by the gate):

```ts
type ShiftPack = { id: string; durationMin: number;
  tickets: { id: string; title: string; arrivesAtMin: number; slaMin: number; priority: 'p1'|'p2'|'p3';
             variants?: string[]; check: { kind: 'answer' | 'command' | 'file'; expected: string } }[];
  rubric: { mode: 'live' | 'recorded' | 'emulated'; rows: { id: string; weight: number }[] }[] }
startShift(pack: ShiftPack, seed: string, startedAt: number): ShiftState
applyShiftEvent(state: ShiftState, event: { kind: 'ack' | 'resolve' | 'escalate'; ticketId: string; atMs: number; answer?: string }): ShiftState
slaReport(state: ShiftState, elapsedMs: number): { ticketId: string; status: 'waiting' | 'acked' | 'resolved' | 'breached'; minutesLeft: number | null }[]
scoreShift(state: ShiftState, mode: 'live' | 'recorded' | 'emulated'): { score: number; max: number; rows: { id: string; earned: number }[]; modeFlag: boolean }
```

`ShiftState` has at least `tickets: { id, variant: string | null, status, arrivesAtMs }[]`, listing **every**
pack ticket from the start in arrival order (`variant` is chosen by the seed when the shift starts;
`null` for tickets without variants). Arrival only affects `slaReport`, which lists tickets whose
`arrivesAtMin` has passed. Each rubric row scores the ticket with the **same id**; a
wrong answer scores like an unresolved ticket. `atMs` and `elapsedMs` are **monotonic milliseconds since the shift started** (D-27). Ticket
variants are chosen by the seed, so two learners with different seeds may get different variants
of the same ticket. A ticket not resolved within its SLA (counted from its arrival) is
**breached**. `modeFlag` is true when `mode` differs from the pack's first rubric mode.

| ID | Behaviour | Check |
|---|---|---|
| AC-22 | Same pack + same seed → identical ticket variants and order; different seeds can choose different variants; tickets appear only after `arrivesAtMin` | `acceptance/core/shift.test.mjs` |
| AC-23 | A ticket resolved after its SLA shows `breached`; resolved in time shows `resolved`; an unacknowledged ticket inside its SLA shows `waiting` with minutes left | `acceptance/core/shift.test.mjs` |
| AC-24 | `scoreShift` uses the rubric rows for the given mode, never exceeds `max`, and sets `modeFlag` for a non-default mode; a wrong answer earns nothing for that ticket | `acceptance/core/shift.test.mjs` |

### 4.11 Appeals (F-07, DEC-42)

```ts
openAppeal(attempt: { id: string; publishedAt: number; unreadConfirmations: number }, now: number):
  { ok: true; appeal: Appeal } | { ok: false; reason: 'window-closed' }
appealStep(appeal: Appeal, action: { kind: 'uphold' | 'reject' | 'escalate' | 'decide-final'; by: string; at: number; outcome?: 'uphold' | 'reject' }): Appeal
appealTick(appeal: Appeal, now: number): Appeal   // applies the automatic escalation
```

States: `open` → `upheld` / `rejected` (trainer) → `escalated` (learner unhappy, or trainer did
not act within 7 days) → `final-upheld` / `final-rejected` (second reviewer). An attempt with any
unread confirmed AI suggestion opens directly as `upheld` with reason `unread-confirmation`.

| ID | Behaviour | Check |
|---|---|---|
| AC-25 | Opening within 7 days works; after 7 days returns `window-closed`; an attempt with unread confirmations opens as `upheld` | `acceptance/core/appeal.test.mjs` |
| AC-26 | `appealTick` escalates an `open` appeal 7 days after it opened, not before; a final decision cannot be changed; every step is appended to `history` | `acceptance/core/appeal.test.mjs` |

### 4.12 AI policy during graded work (F-08, DEC-43)

```ts
aiAllowed(policy: 'off' | 'allowed' | 'explain-only', toolKind: 'chat' | 'repo-write' | 'run-command'): boolean
aiUsageSummary(policy: string, events: readonly { at: number; toolKind: string }[]): string
```

| ID | Behaviour | Check |
|---|---|---|
| AC-27 | `off` allows nothing; `allowed` allows everything; `explain-only` allows `chat` only. The summary reads `AI off` or `AI allowed; used N times` / `AI explain-only; used N times` | `acceptance/core/aipolicy.test.mjs` |

### 4.13 Conflict merge (F-22, D-24)

```ts
mergeRevisions(docType: string, revisions: readonly Doc[]): { doc: Doc; conflictBadge: boolean }
```

Policies: `person`, `program` and other profile documents: the revision with the latest
`updatedAt` wins (ties broken by the larger `updatedBy` string). `ticket`: status takes the most
advanced value in `todo < doing < review < done`, other fields latest-wins, and `conflictBadge` is
true if the statuses differed. Arrays of objects with `id` (e.g. `history`, `votes`): union by `id`, **sorted by `id`** (for equal ids the
latest-wins revision's element is kept).
`class`-owned fields (`schedule`, `passMark`, `switches`) keep the value from the latest revision
whose `updatedBy` starts with `hub:`; the merged document records that source in
`hubFields: { <field>: { value, updatedAt } }` so later merges stay associative.

| ID | Behaviour | Check |
|---|---|---|
| AC-28 | Merging is order-independent (any permutation gives the same result), idempotent (merging a result with itself changes nothing) and associative, on generated random revisions | `acceptance/core/merge.test.mjs` |
| AC-29 | Ticket `doing` vs `done` merges to `done` with `conflictBadge` true; equal statuses → badge false; arrays are unioned without duplicates; a learner's change to `passMark` is ignored | `acceptance/core/merge.test.mjs` |

### 4.14 Study groups (B-11)

```ts
formGroups(people: readonly { id: string; mastery: Record<string, 'mastered' | 'not-yet'> }[], size: number, seed: string): string[][]
applyGroupOverrides(groups: string[][], moves: readonly { personId: string; toGroup: number }[]): string[][]
```

| ID | Behaviour | Check |
|---|---|---|
| AC-30 | Every person appears exactly once; group sizes differ by at most 1; the result is deterministic for the same seed; where possible each group has someone who mastered a skill that another member has not | `acceptance/core/groups.test.mjs` |
| AC-31 | Overrides move exactly the named people and keep everyone else in place | `acceptance/core/groups.test.mjs` |

### 4.15 Estimation poker (C-2)

```ts
pokerRound(votes: Record<string, number>): { result: 'consensus'; points: number } | { result: 'discuss'; low: string[]; high: string[] }
```

Allowed cards: 1, 2, 3, 5, 8, 13 (anything else throws). Consensus when the highest and lowest
votes are the same card or neighbouring cards; the points are then the most common value (ties →
the higher). Otherwise `discuss`, naming the lowest and highest voters.

| ID | Behaviour | Check |
|---|---|---|
| AC-32 | {3,3,5} → consensus 3; {3,5,5} → consensus 5; {2,8,3} → discuss with low [voter of 2] and high [voter of 8]; a vote of 4 throws | `acceptance/core/poker.test.mjs` |

### 4.16 Stand-up bot (C-1, no AI)

```ts
parseStandup(answers: { yesterday: string; today: string; blockers: string }): { blocked: boolean; blockerText: string | null }
```

`blocked` is true when the blockers answer contains (case-insensitive, whole words) *blocked*,
*stuck*, *waiting on*, *waiting for*, *can't*, *cannot*, *need help*, unless it is a negation
(*no blockers*, *none*, *not blocked*, *nothing*, empty).

| ID | Behaviour | Check |
|---|---|---|
| AC-33 | "Waiting on Ravi's PR" → blocked; "None" / "no blockers" / "not blocked" / "" → not blocked; "unblocked yesterday" → not blocked | `acceptance/core/standup.test.mjs` |

### 4.17 Explain-it-back concept check (B-3, P-16, offline default)

```ts
type Checklist = { concepts: { id: string; anyOf: string[] }[]; misconceptions: { id: string; anyOf: string[] }[] }
checkExplanation(transcript: string, checklist: Checklist): { covered: string[]; missing: string[]; misconceptions: string[] }
```

Matching is case-insensitive, ignores punctuation, and matches whole words or whole phrases.

| ID | Behaviour | Check |
|---|---|---|
| AC-34 | A transcript mentioning a synonym of a concept marks it covered; absent concepts are missing; a misconception phrase is reported; partial words do not match ("cache" does not match "cached" unless listed) | `acceptance/core/explain.test.mjs` |

### 4.18 Screenshot parsing rules (P-16)

```ts
type ParseRules = { app: string; fields: { name: string; anchor: string; pick: 'same-line-number' | 'next-line-number'; unit?: string }[] }
validateRules(rules: ParseRules): string[]   // problems; [] = ok
applyParseRules(lines: readonly string[], rules: ParseRules): Record<string, { value: number | null; line: number | null }>
```

`anchor` is a case-insensitive regular expression (at most 200 characters, compiled with the `u`
flag). Numbers may contain thousands separators (`1,234`) and a decimal point; a leading currency
sign (`₹`, `Rs`, `$`) is ignored. `line` is the 0-based index of the line the value came from.

| ID | Behaviour | Check |
|---|---|---|
| AC-35 | On the fixture OCR lines of a diet screenshot, rules extract calories 1,850 → 1850 and protein 72.5; on an expense screenshot, amount `₹1,234.50` → 1234.5; a missing field gives `null` | `acceptance/core/screenshot.test.mjs` |
| AC-36 | `validateRules` rejects an anchor longer than 200 characters, an invalid regex and a duplicate field name | `acceptance/core/screenshot.test.mjs` |

### 4.19 Exit tickets and auto-FAQ (B-1, A-6)

```ts
tallyExitTickets(responses: readonly { choiceIds: string[] }[]): { choiceId: string; count: number }[] // most first, then by id
suggestFaq(questions: readonly { id: string; text: string }[], minRepeats?: number): { representative: string; ids: string[] }[] // default 3
```

Two questions are "the same" when the Jaccard similarity of their lowercase word sets (stop
words removed: a, an, the, is, are, to, of, in, how, what, why, do, i) is ≥ 0.6.

| ID | Behaviour | Check |
|---|---|---|
| AC-37 | Tally counts and orders correctly; three rephrasings of "how do I deploy a bicep file" form one FAQ group; two repeats with the default threshold do not | `acceptance/core/faq.test.mjs` |

### 4.20 At-risk digest (A-3)

```ts
atRisk(s: { lockedMissedDays: number; overdueCards: number; daysSinceCommit: number | null; lastShiftScorePct: number | null }):
  { level: 'ok' | 'watch' | 'risk'; reasons: string[] }
```

One point each for: locked missed days ≥ 1; overdue cards ≥ 50; days since commit ≥ 5; last Shift
score < 50%. Level: 0 points `ok`, 1 `watch`, 2 or more `risk`. Reasons name each point in plain
words. `null` values never add points.

| ID | Behaviour | Check |
|---|---|---|
| AC-38 | The thresholds above give the stated levels and reasons; all-null input is `ok` | `acceptance/core/atrisk.test.mjs` |

### 4.21 Item analysis (E-1)

```ts
itemAnalysis(rows: readonly { personId: string; itemId: string; correct: boolean }[]):
  { itemId: string; p: number; discrimination: number; flag: boolean }[]
```

`p` = share correct. Learners are ranked by total correct; the top and bottom 27% (rounded down,
at least 1) form the groups; `discrimination` = p(top) − p(bottom). `flag` when p < 0.2, p > 0.95
or discrimination < 0.2.

| ID | Behaviour | Check |
|---|---|---|
| AC-39 | On the fixture answer matrix, values match the hand-computed ones to 3 decimals and the planted bad item is flagged | `acceptance/core/items.test.mjs` |

### 4.22 Mistake clustering (A-4, rule-based)

```ts
clusterSubmissions(subs: readonly { id: string; failing: readonly string[] }[]): { signature: string[]; ids: string[] }[]
```

Submissions with the same set of failing checks (order ignored) form one cluster; all-passing
submissions form the cluster with an empty signature. Biggest cluster first, ties by signature.

| ID | Behaviour | Check |
|---|---|---|
| AC-40 | Same failing sets in different order cluster together; clusters are sorted by size; every id appears once | `acceptance/core/cluster.test.mjs` |

### 4.23 Plan vs actual re-flow (A-8, off by default)

```ts
reflow(plan: readonly { dayIndex: number; topics: string[] }[], covered: Record<number, string[]>, throughDay: number):
  { plan: { dayIndex: number; topics: string[] }[]; moved: { topic: string; from: number; to: number }[] }
```

Topics planned up to `throughDay` but not covered move to the start of day `throughDay + 1`, in
their original order, pushing nothing else off; days after keep their topics.

| ID | Behaviour | Check |
|---|---|---|
| AC-41 | Uncovered topics move to the next day in order and are listed in `moved`; a fully covered plan is unchanged | `acceptance/core/reflow.test.mjs` |

### 4.24 Export, manifest, archives and signed class packages (§19.8, DEC-69)

```ts
async buildManifest(files: readonly { path: string; bytes: Uint8Array }[]): Promise<{ version: 1; files: { path: string; sha256: string; size: number }[] }>
async verifyManifest(files: readonly { path: string; bytes: Uint8Array }[], manifest: Manifest): Promise<{ missing: string[]; extra: string[]; changed: string[] }>
tarPack(files: readonly { path: string; bytes: Uint8Array }[]): Uint8Array        // POSIX ustar, uncompressed
tarUnpack(archive: Uint8Array): { path: string; bytes: Uint8Array }[]
async generateSigningKeys(): Promise<{ publicJwk: JsonWebKey; privateJwk: JsonWebKey }> // ECDSA P-256
async signPackage(archive: Uint8Array, privateJwk: JsonWebKey): Promise<Uint8Array>   // returns signed container
async openPackage(container: Uint8Array, trustedPublicJwks: readonly JsonWebKey[]): Promise<{ ok: true; files: { path: string; bytes: Uint8Array }[] } | { ok: false; reason: 'bad-signature' | 'untrusted' | 'corrupt' }>
```

| ID | Behaviour | Check |
|---|---|---|
| AC-42 | `verifyManifest` reports missing, extra and changed files exactly; paths are sorted in the manifest | `acceptance/core/export.test.mjs` |
| AC-43 | `tarUnpack(tarPack(x))` returns `x` for text and binary files, nested paths and empty files; the system `tar -tf` lists the same paths | `acceptance/core/export.test.mjs` |
| AC-44 | A signed package opens with the right public key; one changed byte gives `bad-signature` or `corrupt`; an unknown key gives `untrusted` | `acceptance/core/export.test.mjs` |

### 4.25 Recovery key and crypto-shredding (F-20, F-24)

```ts
recoveryWords(entropy: Uint8Array): string[]               // 32 bytes -> 32 words (one byte each) from the 256-word list in core
wordsToEntropy(words: readonly string[]): Uint8Array        // throws on an unknown word or wrong count
async wrapPersonKey(personKey: Uint8Array, wrappingKey: Uint8Array): Promise<Uint8Array>
async unwrapPersonKey(wrapped: Uint8Array, wrappingKey: Uint8Array): Promise<Uint8Array>
shred(keyring: Record<string, Uint8Array>, personId: string): Record<string, Uint8Array> // removes that person's wrapped key
```

| ID | Behaviour | Check |
|---|---|---|
| AC-45 | 32 bytes → 32 words → the same 32 bytes; the word list has 256 unique lowercase words; a misspelt word throws | `acceptance/core/keys.test.mjs` |
| AC-46 | Data sealed with a person's key opens after wrap/unwrap; after `shred`, that person's key is gone from the keyring and other people's keys are untouched | `acceptance/core/keys.test.mjs` |

### 4.26 Graded timing and accommodations (F-17, F-09)

```ts
gradedTiming(t: { hubStart: number | null; hubEnd: number | null; monotonicMs: number; deviceStart: number; deviceEnd: number }):
  { durationMs: number; flags: ('offline-attempt' | 'clock-skew')[] }
effectiveLimitMs(baseMs: number, accommodation: { timeMultiplier?: number } | null): number
```

Duration is the hub-signed end − start when both exist; otherwise the monotonic duration with flag
`offline-attempt`. `clock-skew` is added when the device's wall-clock duration differs from the
monotonic duration by more than 60 s. The time multiplier defaults to 1 and is limited to 1–3.

| ID | Behaviour | Check |
|---|---|---|
| AC-47 | Hub times win when present; missing hub times use monotonic with `offline-attempt`; a device clock moved 10 minutes adds `clock-skew` | `acceptance/core/timing.test.mjs` |
| AC-48 | A 1.5× accommodation turns 60 min into 90 min; values outside 1–3 are clamped | `acceptance/core/timing.test.mjs` |

### 4.27 Feature switches (P-14)

```ts
switchDefaults(): Record<string, boolean>
isOn(name: string, layers: { class?: Record<string, boolean>; program?: Record<string, boolean>; org?: Record<string, boolean> }): boolean
```

Precedence: class over program over org over default. Unknown names throw. Defaults (exact keys):

| Key | Default | Key | Default |
|---|---|---|---|
| `secretScan` | on | `diskEncryptionCheck` | off |
| `planVsActual` | off | `calendarSync` | off |
| `pairProgramming` | off | `explainBackAi` | off |
| `googleForms` | off | `meetLinks` | off |
| `storyMode` | off | `headingStrike` | on |
| `teamBadges` | on | `celebrationWall` | on |
| `githubPass` | on | `jira` | off |
| `printedQrFallback` | on | `voiceFollow` | off |
| `certificates` | on | `gradedShifts` | on |

| ID | Behaviour | Check |
|---|---|---|
| AC-49 | `switchDefaults` returns exactly the table above plus the nine games keys of D-49 (`games`, `game.syntaxDrop`, `game.mazeCoder`, `game.breakout`, `game.raid`, `game.sniper`, `game.whackABug`, `game.aftershock`, `game.garage`, all on) and `games.unlockAll` (off); precedence is class > program > org > default; an unknown name throws | `acceptance/core/switches.test.mjs` |

### 4.28 Version compatibility (F-21)

```ts
canSync(clientSchema: number, hubSchema: number): { ok: boolean; action: 'sync' | 'upgrade-on-hub' | 'update-app' | 'update-hub' }
```

Same version → `sync`; client 1–2 older → `upgrade-on-hub`; client more than 2 older →
`update-app`; client newer → `update-hub`.

| ID | Behaviour | Check |
|---|---|---|
| AC-50 | All four cases return the stated action; `ok` is true only for `sync` and `upgrade-on-hub` | `acceptance/core/compat.test.mjs` |

### 4.29 Package import and content gate (M-26, P-9, F-27, F-28)

```ts
parsePackage(files: Record<string, string>): { days: PkgDay[]; problems: string[] }
runGate(files: Record<string, string>, waivers?: readonly { check: string; reason: string; by: string; expiresAt: number }[], now?: number):
  { pass: boolean; checks: { id: string; pass: boolean; waived: boolean; detail: string }[] }
```

`PkgDay` is `{ index, track, sections (as §4.8), questions: { text, answer }[], cards: { front, back }[] }`.
`files` maps relative paths to text. The importer accepts both skill-template layouts: day
companions inside `day{N}/` (v1.2) **or** in the track root (v1.1, as in the owner's package5), keeping their `*_dayNN.md` names. A
day needs `quicklearn.md`, `deepdive.md`, `instructor_script.md`, `printable_handout.md` and a
student guide; whiteboard, live-coding and memory-recall companions are optional.

| Check id | Rule |
|---|---|
| `G1-files` | Each day has the required files |
| `G2-readme` | Each README's file table lists exactly the files that exist in its folder, including `README.md` itself; subfolders are not listed (no drift) |
| `G3-diagnostic` | Each quick-learn has an "8-question diagnostic" with 8 numbered questions and an answer key with 8 numbered answers |
| `G4-script-times` | The instructor script has timed sections, and their total is within ±10% of the script's own "Total runtime" line (`scriptTotalSec`) |
| `G5-links` | No relative Markdown link points to a missing file |
| `G6-code-lang` | Every fenced code block has a language tag |
| `G7-graded` | Every graded item parses and has an answer key or checks: Shift packs are `<track>/shift/*.json` (§4.10, every ticket has a `check`), exam banks are `<track>/exam/*.json` (`{ questions: [{ id, text, answer }] }`, every question has an `answer`) |
| `G8-cards` | Memory-recall files (if present) parse into cards: each `## Exercise N — <title>` section is one card; front = title + the `**What to do:**` paragraph, back = everything from the `**The answer` line to the next exercise. An exercise without both parts fails |

A failing check can be waived only with a reason, by a named person, until a set expiry; an
expiry more than 7 days after `now` is treated as `now` + 7 days. `G7-graded` can **never** be waived. Offline, link checks to the internet are warnings
(they are not part of G5).

| ID | Behaviour | Check |
|---|---|---|
| AC-51 | The fixture package (v1.2 layout) passes all checks; the same package rearranged into the v1.1 layout also imports with the same days | `acceptance/core/gate.test.mjs` |
| AC-52 | Each planted defect fails exactly its check: missing file (G1), README listing a removed file (G2), 7 diagnostic questions (G3), script total 50% of the slot (G4), broken link (G5), unlabelled code block (G6), Shift pack without checks (G7), card without back (G8) | `acceptance/core/gate.test.mjs` |
| AC-53 | A waiver turns a failed G1–G6/G8 check into `waived` until it expires; a waiver for G7 is ignored (and on the hub, a waiver for `G9-games`, §13, D-55); an expired waiver is ignored | `acceptance/core/gate.test.mjs` |
| AC-54 | `parsePackage` extracts day sections from the instructor script (via §4.8), the 8 diagnostic questions with answers, and cards from memory-recall files | `acceptance/core/gate.test.mjs` |

### 4.30 Dropping a learner (F-03, DEC-38)

```ts
dropPlan(classState: { tickets: { id: string; assignee: string | null }[]; reviews: { id: string; reviewer: string }[]; teams: Record<string, string[]> }, personId: string):
  { unassignTickets: string[]; reassignReviews: string[]; removeFromTeam: string | null; archiveRepos: true; stopBots: true }
undoDropPlan(plan: DropPlan): { restoreTeam: string | null; restoreRepos: true; resumeBots: true }
```

| ID | Behaviour | Check |
|---|---|---|
| AC-55 | The plan lists exactly that person's tickets and reviews and their team; undo restores team, repos and bots but does **not** list tickets (they stay reassigned) | `acceptance/core/drop.test.mjs` |

### 4.31 Retention (F-26)

```ts
retentionDue(docs: readonly { id: string; type: string; createdAt: number; batchEndedAt: number | null; resultsAt: number | null }[], now: number): { delete: string[]; pseudonymise: string[] }
```

Integrity log entries (`integrity`): delete 180 days after `resultsAt`. Commons/Shift chat
(`chat`): delete 1 year after `createdAt`. Lab containers (`container`): delete at `batchEndedAt`.
Grades (`grade`) and certificates (`certificate`): pseudonymise 3 years after `batchEndedAt`, never
delete. A year is 365 days.

| ID | Behaviour | Check |
|---|---|---|
| AC-56 | Each rule triggers exactly at its boundary (one millisecond before: not due); grades are never in `delete` | `acceptance/core/retention.test.mjs` |

### 4.32 Messages for other apps (D-35, A-2, A-3)

```ts
waLink(phone: string, text: string): string
copyAll(messages: readonly { name: string; text: string }[]): string
```

Indian numbers are normalised to `91XXXXXXXXXX` (10 digits with or without `+91`, `0`, spaces or
dashes); other lengths throw. The link is `https://wa.me/<digits>?text=<encodeURIComponent(text)>`.
`copyAll` joins messages as `<name>:\n<text>` separated by a blank line.

| ID | Behaviour | Check |
|---|---|---|
| AC-57 | `+91 98765-43210`, `09876543210` and `9876543210` give the same link; text with `&`, `?`, emoji and newlines round-trips through `decodeURIComponent`; a 7-digit number throws | `acceptance/core/messages.test.mjs` |

### 4.33 Certificate ids (D-3)

```ts
async certificateId(secret: Uint8Array, personId: string, programId: string, issuedAt: number): Promise<string> // 12 chars, Crockford base32
async verifyCertificateId(id: string, secret: Uint8Array, personId: string, programId: string, issuedAt: number): Promise<boolean>
```

| ID | Behaviour | Check |
|---|---|---|
| AC-58 | Ids are 12 Crockford base32 characters, deterministic, and verification fails for any changed input or secret | `acceptance/core/certificate.test.mjs` |

---

## 5. Server (`packages/server`): hub and cloud

The same server runs as hub or cloud (D-20). The server only stores, syncs, signs and serves;
every decision calls core (D-22). All request bodies are validated with zod; invalid input gets
`400` with `{ error: { field: message } }`.

### 5.1 Health and setup

| ID | Behaviour | Check |
|---|---|---|
| AC-60 | `GET /api/health` returns `200` with `{ ok: true, profile, schema, version }` and never includes secrets | `acceptance/api/health.test.mjs` |
| AC-61 | First start creates an org, an admin invite code printed once on stdout (`ADMIN_INVITE <code>`) and, in the hub profile, a certificate authority whose fingerprint `GET /api/pairing/fingerprint` returns | `acceptance/api/health.test.mjs` |

### 5.2 Accounts, sign-in and roles (§19.8 row 7.2)

Sign-in methods: **passkey** (WebAuthn) and **Sign in with Google** (when configured). A join code
or invite creates the account; there are no passwords and no SMS. Sessions are HTTP-only cookies.
Tests use `/__test/login` (§5.9) instead of a real passkey.

| ID | Behaviour | Check |
|---|---|---|
| AC-62 | Every `/api/*` route except health, join, sign-in and pairing claim returns `401` without a session; a learner gets `403` on trainer and admin routes; a substitute gets `403` on grade sign-off and syllabus edits (D-30) | `acceptance/api/roles.test.mjs` |
| AC-63 | Joining with a valid one-time class code creates an enrolment; reusing the code fails; joining twice with the same roll number warns `already-enrolled` (F-23) | `acceptance/api/roles.test.mjs` |
| AC-64 | Signup records acceptance of the current Terms & Conditions version with a timestamp; a new T&C version asks again (F-06); a date of birth under 18 creates a minor profile with Coach trackers off (D-33) | `acceptance/api/roles.test.mjs` |

### 5.3 Pairing and devices (F-13, F-35)

| ID | Behaviour | Check |
|---|---|---|
| AC-65 | `POST /api/pairing` (trainer) returns a one-time code valid 5 minutes and a QR payload containing hub id, current address and certificate fingerprint; the code can be claimed once (`/api/pairing/claim`); `GET /api/devices` lists the device and `DELETE` revokes it so its next request gets `401` | `acceptance/api/pairing.test.mjs` |

### 5.4 Attendance (F-04)

| ID | Behaviour | Check |
|---|---|---|
| AC-66 | `GET /api/classes/:id/attendance-code` (trainer) returns the current rotating code and seconds left; `POST /api/classes/:id/attendance` with that code marks the learner present and `verified: true`; a code two periods old is rejected; the printed fallback code marks `verified: false` | `acceptance/api/attendance.test.mjs` |

### 5.5 Content and release (D-38)

| ID | Behaviour | Check |
|---|---|---|
| AC-67 | `POST /api/packages` (admin/trainer) with a tar of a package runs the gate and returns its checks; a failing package is stored as `draft` and cannot be published | `acceptance/api/content.test.mjs` |
| AC-68 | Learners get sealed sections before release; `POST /api/classes/:id/teleprompter` `{ sectionId }` (trainer) releases that section's key to the class; ungraded sections also release at their planned time; graded sections only by reaching them or "release all" | `acceptance/api/content.test.mjs` |

### 5.6 Sync (D-6, D-9, D-23, D-24)

| ID | Behaviour | Check |
|---|---|---|
| AC-69 | `/db/class-<id>` speaks the CouchDB replication protocol: a PouchDB client with a valid session can replicate both ways; a learner cannot read another learner's personal database (`403`) | `acceptance/api/sync.test.mjs` |
| AC-70 | Two clients editing the same ticket offline, then syncing, both end with the core-merged revision (§4.13); the server's merge pass runs within 5 s of a conflicting write and leaves no conflicts | `acceptance/api/sync.test.mjs` |
| AC-71 | A client whose schema is 3 versions behind is refused with `update-app` and its local data is untouched | `acceptance/api/sync.test.mjs` |

### 5.7 Grading, appeals and ledgers

| ID | Behaviour | Check |
|---|---|---|
| AC-72 | Submitting an attempt stores its seed, mode, timing flags and AI-usage summary; the grade is a ledger entry; a correction keeps the original entry (P-10) | `acceptance/api/grading.test.mjs` |
| AC-73 | A learner can open an appeal within 7 days; it appears in the trainer's inbox with the evidence pack (seed, mode, events, rubric rows, unread-confirmation count) | `acceptance/api/grading.test.mjs` |

### 5.8 Export, import and class packages (DEC-69, §19.8)

| ID | Behaviour | Check |
|---|---|---|
| AC-74 | `GET /api/export` (admin) returns a tar with `manifest.json`, CSV (roster, attendance, grades), Markdown content, JSON ledgers and events, and board files; `verifyManifest` passes on it. `GET /api/me/export` returns only the caller's data | `acceptance/api/export.test.mjs` |
| AC-75 | `POST /api/import` of that export into an empty server reproduces the same roster, attendance and grades (checked through the API) | `acceptance/api/export.test.mjs` |
| AC-76 | `GET /api/classes/:id/package?day=N` (trainer) returns a signed class package; a learner submission file signed by an enrolled learner's device key is accepted by `POST /api/classes/:id/files`; a tampered or unknown-signer file is rejected | `acceptance/api/export.test.mjs` |
| AC-77 | Export files never contain private keys, tokens, passphrases or session cookies (scanned with the tins-kit secret patterns) | `acceptance/api/export.test.mjs` |

### 5.9 Test mode

`LMS_TEST_MODE=1` enables:

- `POST /__test/login {personId, roles}`: sets a session;
- `POST /__test/seed {fixture}`: loads a fixture from `acceptance/fixtures`;
- `POST /__test/clock {now}`: sets the server's clock for core calls;
- `POST /__test/reset`: wipes data.

| ID | Behaviour | Check |
|---|---|---|
| AC-78 | Without `LMS_TEST_MODE=1`, every `/__test/*` route returns `404` | `acceptance/api/testmode.test.mjs` |

---

## 6. App (`packages/web`) and user journeys

**Journeys** are Playwright scripts that act like a person. Each takes a screenshot per step,
records a video and a trace, and runs twice: on desktop (1280×800) and on a **low-end phone
profile** (360×740, 4× CPU slowdown, network 1.6 Mbps down / 750 kbps up / 150 ms latency). A
failing journey fails the gate (D-8, DEC-65).

Every element a journey touches has the `data-testid` named in the journey's file header. The
names below are fixed; builders may add more.

| ID | Journey | Check |
|---|---|---|
| AC-80 | **Admin sets up a class**: sign in → create program, cohort and class (`create-class`) → upload the fixture package → see the gate report with all checks passing (`gate-report`) → publish → see the class schedule | `acceptance/journeys/admin-setup.journey.mjs` |
| AC-81 | **Learner joins**: open the join link → accept T&C (`tnc-accept`) → enter date of birth → see Day −1 setup check with green/red items (`setup-check`) | `acceptance/journeys/learner-join.journey.mjs` |
| AC-82 | **Attendance**: the trainer opens the rotating code (`attendance-code`), the learner enters it (`attendance-input`) and sees "present"; the trainer's roster shows the learner as verified | `acceptance/journeys/attendance.journey.mjs` |
| AC-83 | **Teleprompter release**: the trainer opens the teleprompter (`teleprompter`), taps next (`tp-next`); the learner's day page shows the newly released section (`section-<id>`) without reloading; the pacing bar shows ahead/behind (`tp-pace`) | `acceptance/journeys/teleprompter.journey.mjs` |
| AC-84 | **Catch-up**: a learner who joined on day 3 sees day 0's gate (`gate-day-0`), fails with 5/8, retries and passes with 6/8, and day 1's gate appears | `acceptance/journeys/catchup.journey.mjs` |
| AC-85 | **Daily cards**: the learner reviews due cards (`card-show`, `rate-good`), and the due count drops; the error notebook lists the day's wrong answers by subtopic (`error-notebook`) | `acceptance/journeys/cards.journey.mjs` |
| AC-86 | **Shift**: a team starts the fixture Shift (`shift-start`); tickets arrive over (test-clock) time; acknowledging and resolving one updates the SLA board (`sla-<ticketId>`); the score screen shows mode and rubric rows (`shift-score`) | `acceptance/journeys/shift.journey.mjs` |
| AC-87 | **Sprint rituals**: stand-up answers post a summary with "blocked" highlighted; estimation poker reveals cards together and asks low/high voters to explain on a spread (`poker-reveal`); a retro item becomes a ticket | `acceptance/journeys/rituals.journey.mjs` |
| AC-88 | **Appeal**: a learner appeals a score (`appeal-open`); the trainer sees it with the evidence pack (`appeal-evidence`) and upholds it; the learner sees the corrected score and the original kept in history | `acceptance/journeys/appeal.journey.mjs` |
| AC-89 | **Wrap-up (A-1)**: one tap (`wrap-up`) publishes the board PDF, quick-learn and cards, closes attendance and creates the draft delivery report | `acceptance/journeys/wrapup.journey.mjs` |
| AC-90 | **Messages (A-2, A-3)**: the absentee list offers a prefilled WhatsApp link per learner (`wa-<personId>`, correct `wa.me` URL) and "Copy all" (`copy-all`) puts all messages on the clipboard | `acceptance/journeys/messages.journey.mjs` |
| AC-91 | **Doubt queue (A-5)**: learners post doubts (one anonymous) and upvote; the trainer view orders by votes and hides the anonymous author's name | `acceptance/journeys/doubts.journey.mjs` |
| AC-92 | **Exit ticket (B-1)**: the learner picks pre-generated choices and types text; the trainer sees the tally for the day | `acceptance/journeys/exit-ticket.journey.mjs` |
| AC-93 | **Explain-it-back (B-3)**: with AI off, the learner submits a typed explanation (speech is replaced by text in tests) and sees covered, missing and misconception feedback from the offline checklist | `acceptance/journeys/explain.journey.mjs` |
| AC-94 | **Coach screenshot import (P-16)**: the learner uploads the fixture diet screenshot (`shot-upload`); the app shows extracted calories and protein for confirmation (`shot-confirm`); nothing is saved until confirmed | `acceptance/journeys/coach-shot.journey.mjs` |
| AC-95 | **Phone-only profile**: with the server stopped after the first load, the learner can still open released content, review cards, take the diagnostic and see the mastery map; on reconnect the changes sync | `acceptance/journeys/offline.journey.mjs` |
| AC-96 | **File exchange**: the trainer downloads a day package (`pkg-download`); a phone-only learner imports it (`pkg-import`) and sees the content; the learner exports a submission file and the trainer imports it | `acceptance/journeys/files.journey.mjs` |
| AC-97 | **Board**: the trainer opens the board (`board`), adds a page, draws a rectangle and text, drags in the fixture `.mmd`, and exports a PDF (`board-export-pdf`) whose first page has the notebook ruling while the canvas background stays plain | `acceptance/journeys/board.journey.mjs` |
| AC-98 | **Export my data**: a learner downloads their export, and it contains only their own records | `acceptance/journeys/export.journey.mjs` |
| AC-99 | **Accessibility basics**: on every journey's main screens there are no axe-style violations of these rules: images without alt text, buttons without names, form fields without labels, contrast below 4.5:1 for body text (checked with the suite's own small checker) | `acceptance/journeys/a11y.journey.mjs` |

### 6.3 Remaining features (each needs a row so nothing is dropped)

| ID | Behaviour | Check |
|---|---|---|
| AC-150 | **Substitute (F-01)**: the trainer taps "I can't take day N" and picks a substitute; the substitute sees the handover pack (script, board pages, quick-learn, class status, at-risk list, trainer notes) and marks it read; the delivery report records who taught | `acceptance/journeys/substitute.journey.mjs` |
| AC-151 | **AI-delivered session (F-01)**: with no substitute, "self-learn mode" plays the day's script section by section with board pages, runs the scripted quiz automatically, queues questions it cannot answer from the day's content, and the report marks the day `AI-delivered`. With AI off, it plays the script as text without answering questions | `acceptance/journeys/substitute.journey.mjs` |
| AC-152 | **Drop switch (F-03)**: the confirmation lists the actions from `dropPlan`; after confirming, the learner leaves the roll and live quiz; switching back restores team and repo access | `acceptance/journeys/drop.journey.mjs` |
| AC-153 | **Accommodations (F-09)**: a learner can request one at signup or later through the admin; once approved, the Shift and exam timers show the extended limit | `acceptance/journeys/accommodations.journey.mjs` |
| AC-154 | **Verbal syllabus (§17.1)**: the admin types or pastes topic notes; the app drafts a syllabus and produces a confirmation PDF for the college; later changes go into a cohort change log with dates | `acceptance/journeys/syllabus.journey.mjs` |
| AC-155 | **First run (§17.4)**: a fresh app offers 4 choices (join a class with a code, connect to a hub, use the hosted service, use on this phone only); each path reaches its home screen | `acceptance/journeys/first-run.journey.mjs` |
| AC-156 | **Coach space (§7.0, §7.2)**: the coaching conversation runs its stages with "accept defaults" (≤ 25 taps to a plan); the plan is versioned; the day timeline shows study blocks from the class schedule and cards due; the Coach space needs a PIN or biometric, and course content never does (F-05) | `acceptance/journeys/coach.journey.mjs` |
| AC-157 | **Trainer pack (A-11, E-5)**: per day, the trainer sees their card deck, cheat sheet, command reference and likely questions; the package library lists every imported package with versions and rehearsal history | `acceptance/journeys/trainer-pack.journey.mjs` |
| AC-158 | **Rehearsal (A-9, A-10, E-3)**: rehearsal mode runs the teleprompter with pacing, then shows planned vs actual per section; "teach-back" (AI on) or a self-check list (AI off) follows; the freshness check result for the day's lab commands is shown | `acceptance/journeys/rehearsal.journey.mjs` |
| AC-159 | **Voice notes (A-7)**: a note dictated or typed after class is attached to the chosen learner's profile, visible only to trainers | `acceptance/journeys/trainer-notes.journey.mjs` |
| AC-160 | **At-risk digest and mistake clusters (A-3, A-4)**: the Friday digest lists learners by level with reasons and prefilled messages; the lab results view groups submissions by failing checks and one comment reaches every member of a cluster | `acceptance/journeys/digest.journey.mjs` |
| AC-161 | **Peer review and pair programming (B-5, B-4)**: a learner is assigned a classmate's PR with a checklist and their review is scored; with `pairProgramming` on, a lab shows paired names and a 15-minute swap timer | `acceptance/journeys/peer.journey.mjs` |
| AC-162 | **Portfolio (B-7)**: "Build my portfolio" creates a site from the hub's template with the learner's repos, badges and certificates, previewable in the app | `acceptance/journeys/portfolio.journey.mjs` |
| AC-163 | **Audio quick-learn (B-10)**: the day's quick-learn has a play button using the device's speech synthesis, with speed control | `acceptance/journeys/audio.journey.mjs` |
| AC-164 | **Corporate practice in the Shift (C-4, C-5, C-8, C-9, C-11, C-12)**: an incident page arrives with an acknowledge timer; a "prod" deploy needs an approved change request; tickets require acceptance criteria; runbook and ADR templates are graded by rubric; demo day has a presentation slot; the leaked-key drill runs | `acceptance/journeys/corporate.journey.mjs` |
| AC-165 | **College outputs (D-1, D-2, D-3, 7.4)**: attendance sheet and completion report in the brand pack's layout (PDF and CSV); CO-PO attainment export; anonymous weekly feedback; coordinator read-only view; certificate PDF with QR, verify page, and Google Sheet export of certificate ids | `acceptance/journeys/college.journey.mjs` |
| AC-166 | **Content improvement (E-1, E-2, E-4)**: the item-analysis view flags weak questions; frequent wrong answers appear as suggested misconceptions the trainer can accept, edit or reject; uploading a changed syllabus shows which days and questions change | `acceptance/journeys/content-improve.journey.mjs` |
| AC-167 | **Robustness (F-1, F-2, F-3)**: the fire-drill wizard stops the hub mid-rehearsal and confirms phones keep working and catch up afterwards; kiosk mode hides the Coach space and logs out after 30 min idle; the data meter shows bytes used and honours "Wi-Fi only downloads" | `acceptance/journeys/robustness.journey.mjs` |
| AC-168 | **Engagement (G-1 to G-4)**: Heading Strike plays one round; team badges and the merged-PR wall show team-level only (no individual leaderboard); story mode is off by default and changes only presentation when on | `acceptance/journeys/engagement.journey.mjs` |
| AC-169 | **Calendar sync and Google Forms (A-12, 1.11)**: both are hidden until the switch is on; once on, they use the adapters from AC-114 | `acceptance/journeys/google-optin.journey.mjs` |
| AC-170 | **Practice forge first (§20.1)**: a learner without a GitHub account completes the forge exercise on Forgejo; linking a GitHub account later offers the GitHub pass and moves their practice repos | `acceptance/journeys/forge.journey.mjs` |

### 6.1 Performance budgets (low-end phone profile)

| ID | Behaviour | Check |
|---|---|---|
| AC-100 | App shell interactive within 4 s on first load and 1.5 s on repeat load (service worker); the day page within 2 s after the shell | `acceptance/perf/budgets.test.mjs` |
| AC-101 | The board page becomes usable within 3 s (§19.5); the board's JavaScript is not downloaded until the board is opened | `acceptance/perf/budgets.test.mjs` |
| AC-102 | Total JavaScript for the app shell is under 300 KB compressed; no third-party CDN requests at runtime | `acceptance/perf/budgets.test.mjs` |

### 6.2 Load (F-42)

| ID | Behaviour | Check |
|---|---|---|
| AC-103 | `packages/cli` provides `lms loadtest --learners 200 --target <url>`: 200 simulated learners sign in, mark attendance, answer a live quiz (200 answers within 10 s) and sync; pass when 95% of requests finish within 1 s and no write is lost. The suite runs it against a local hub | `acceptance/perf/load.test.mjs` |

---

## 7. Integrations (`packages/adapters`), 1b

Each integration is an adapter behind an interface, tested against a **fake** server that the suite
provides (no real accounts in tests). Every adapter is switchable off and the app works without it.

| ID | Behaviour | Check |
|---|---|---|
| AC-110 | **GitHub App adapter**: given a GitHub username, creates the org invite, team membership, a repo from the template, branch protection on `main` (no force-push, PR required) and a project with an iteration field, against the fake GitHub API; it never calls an account-creation endpoint | `acceptance/adapters/github.test.mjs` |
| AC-111 | **AI persona bots**: a persona (as its own App installation) opens a branch and a PR from a prepared branch; it cannot merge or push to `main` (the fake rejects it and the adapter reports it); tokens carry an expiry at batch end | `acceptance/adapters/github.test.mjs` |
| AC-112 | **Forgejo adapter**: the same contract as AC-110/111 against the fake Forgejo API, including creating the learner's Forgejo login (D-34) | `acceptance/adapters/forgejo.test.mjs` |
| AC-113 | **Backup targets**: R2/S3 (S3 API), Google Drive and USB/folder adapters each upload an encrypted backup and restore it byte-identical through the fakes; the backup is encrypted before upload (the fake sees no plaintext) | `acceptance/adapters/backup.test.mjs` |
| AC-114 | **Google (opt-in)**: Meet link creation, Calendar event sync and Forms quiz export (with explicit publish, because API-created forms start unpublished) work against fakes; each is off by default (§4.27) | `acceptance/adapters/google.test.mjs` |
| AC-115 | **Secret scan on push** (practice forge): a push containing a test credential (invented, never real) is blocked with a "rotate this key" message; with the `secretScan` switch off the push passes and a log entry records who turned it off | `acceptance/adapters/forgejo.test.mjs` |
| AC-116 | **AI over MCP**: the hub exposes an MCP server whose tools are read-only while the AI reads other people's content; any write tool (grade edit, post to more than one person, repo write) returns a pending diff that needs a person's confirmation (D-31) | `acceptance/adapters/mcp.test.mjs` |
| AC-117 | **Health digest (F-44, A-13)**: the digest lists last successful backup per target, sync lag and failed checks, turns red when a backup is older than 48 h, and the morning checklist runs offline checks first and shows last-known times for online ones | `acceptance/adapters/health.test.mjs` |
| AC-118 | **Native shell (Capacitor, Android)**: "Add to my clock app" builds an `ACTION_SET_ALARM` intent with hour, minutes, message and days for each selected block; the list of created alarms is kept | manual: needs an Android device or emulator; verified on a phone before the live batch |
| AC-119 | **HTTPS sidegrade**: the `acme.sh` helper script and container definition renew a DuckDNS certificate and hand it to the hub | manual: needs a DuckDNS account and internet; verified once by the owner |

---

## 8. Cross-cutting rules

| ID | Behaviour | Check |
|---|---|---|
| AC-120 | No log line (each acceptance file's server stdout/stderr) contains a value the suite planted as a secret | `acceptance/api/secrets.test.mjs` |
| AC-121 | Coach entries are stored encrypted: reading the raw personal database on the server shows ciphertext only for `coachEntry` documents | `acceptance/api/secrets.test.mjs` |
| AC-122 | A minor account cannot create Coach tracker entries, and its integrity log keeps exam events only (D-33) | `acceptance/api/roles.test.mjs` |
| AC-123 | All visible text comes from the English strings file (`packages/web/src/strings/en.json`); a test build with a pseudo-locale shows no untranslated literal on the journey screens | `acceptance/journeys/a11y.journey.mjs` |

---

## 9. Build plan

### 9.1 Order (each step ends with its acceptance rows green)

| Step | Contents | Rows |
|---|---|---|
| B-1 | Workspace, tins-kit gate wired to `acceptance/`, CI script | AC-49, AC-50 |
| B-2 | Core: rng, cards, catch-up, mastery, timing, switches | AC-1 to AC-10, AC-47 to AC-49 |
| B-3 | Core: crypto (attendance, pairing, release, ledger, keys, certificates, packages) | AC-11 to AC-21, AC-42 to AC-46, AC-58 |
| B-4 | Core: Shift, appeals, AI policy, merge, groups, poker, stand-up, explain, screenshot, FAQ, at-risk, items, clusters, reflow, drop, retention, messages | AC-22 to AC-41, AC-55 to AC-57 |
| B-5 | Core: package import and gate | AC-51 to AC-54 |
| B-6 | Server: health, accounts, pairing, attendance, content, sync, grading, export, test mode | AC-60 to AC-78 |
| B-7 | Web: shell, journeys in the order of §6 | AC-80 to AC-99, AC-123, AC-150 to AC-170 |
| B-8 | Board fork | AC-97, AC-101 |
| B-9 | Performance and load | AC-100 to AC-103 |
| B-10 | Adapters and native shell | AC-110 to AC-119 |
| B-11 | Cross-cutting checks, hardening | AC-120 to AC-122 |

### 9.2 Who builds what (review §6)

- **Before any task starts:** Sonnet or the owner writes the interface file for it (types and
  signatures, copied from this SPEC).
- **Haiku:** pure functions and screens.
- **Sonnet:** sync, crypto, timers and the board fork.
- **Size:** every task is small enough to finish in one session (§10).

### 9.3 The build experiment (PLAN §14)

- The same SPEC is built twice: once by Haiku and once by Sonnet, each with tins-kit.
- Measured per run:
  - acceptance rows passing;
  - gate failures caught before commit;
  - tasks needing a human;
  - time and cost;
  - lessons that carry back into tins-kit.
- The journey gate (screenshots, video, throttled phone) is a candidate tins-kit feature.

---

## 10. Continuity (PLAN §22)

| ID | Behaviour | Check |
|---|---|---|
| AC-130 | `CONTINUE.md` names the last green task, the next task and the gate command, and is changed in the same commit as every task's completion | manual: the tins-kit session ledger shows it per task; reviewed at each milestone |
| AC-131 | A fresh clone plus `npm ci` plus the gate command reproduces the last recorded green state (run at every milestone, B-1 to B-11) | manual: run by the builder at each milestone and logged in `docs/build-journal/` |

---

## 11. After v1: the rebuild course (PLAN §21, DEC-71)

The course follows the owner's example layout:

- README, syllabus and strategy;
- one file per micro-step, in **build order**;
- checkpoints and a final project;
- an appendix of post-ship fixes;
- marketing material.

An evaluation of the example (`docs/COURSE-FORMAT-EVALUATION.md`) found defects that this course
must not repeat (layout and section template: that report's §C, the skill template's new `case-study` variant): README out of sync with the files, missing checkpoint files, inconsistent
sections, broken "Next" links, wrong step totals, no answer keys, heavy steps, and two wrong
technical claims. So the course is **generated from a manifest** and checked by a script:

| ID | Behaviour | Check |
|---|---|---|
| AC-140 | `course/manifest.json` is the source of truth; `README.md` is generated from it and lists exactly the files that exist | manual: run `node course/check.mjs` after generation (script written with the course) |
| AC-141 | Every micro-step has all standard sections with the fixed Detective-question labels (Problem / Approaches considered / Approach selected / Why), a correct "Step X of N", and a "Next" link to the following step; following "Next" from step 1 visits every step once | manual: `node course/check.mjs` |
| AC-142 | Every reinforcement activity and checkpoint has an answer key; every step has recall cards | manual: `node course/check.mjs` |
| AC-143 | Every code excerpt matches the repo at the commit the step cites | manual: `node course/check.mjs` |
| AC-144 | Each step stays within a load budget: words/100 + code lines/8 + activity minutes ≤ the step's `est_minutes`; at most 4 learning objectives and 8 new glossary terms | manual: `node course/check.mjs` |
| AC-145 | A fresh agent follows the course from step 1 in an empty folder and reaches a passing acceptance suite | manual: run once after the course is generated; result recorded in the course appendix |

---

## 12. Traceability to the plan

| Plan | SPEC |
|---|---|
| P-1 to P-16, DEC-53 to DEC-72 | D-1 to D-40 |
| F-01 to F-46 (FAILURE-QUESTIONS.md) | §4.3, §4.5, §4.6, §4.9 to §4.13, §4.25, §4.26, §4.31, §5, §8 |
| FEATURE-IDEAS picks (DEC-68) | §4.14 to §4.23, §4.32, §4.33, §6 |
| Phase 2 items | §0 "Not in v1" |

D-41 onward come from build findings (tins-kit RF-n) and the games design (SPEC §13), not from the plan.

---

## 13. Games (v2-G)

The games add-on. Same rules as the rest of this file: `D-n` rows are decisions, `AC-n` rows are
acceptance checks naming a test in the acceptance suite (`acceptance/games/…`), and where this section and
the rest of SPEC disagree on a game, this section wins. Everything in §8 (cross-cutting rules) still holds:
offline-first, no individual leaderboards (AC-168), test clock, `en.json` strings, accessible names.

Eight games share one engine, one code interpreter and one content-pack format. **A new subject or new
levels are a new pack (data), not new code.** A new kind of preview or machine is a small plug-in (one file
implementing one interface).

Each game has two layers (D-60). The **play layer** (story, mechanics, rewards) is the same for every subject
and is meant to be fun on its own; the **learning layer** (the pack) is written by the trainer. They meet
only at **Knowledge sockets**: questions the pack answers.

| Id | Game | Teaches | Kind |
|---|---|---|---|
| `syntax-drop` | Syntax Drop | what each piece of syntax does (HTML/CSS, charts, Python output, regex, patterns) | 2D rhythm game, keyboard or tap |
| `maze-coder` | Maze Coder | loops, conditionals, functions, pattern programming, search | 3D diorama, write code |
| `breakout` | Breakout | data structures and algorithms, story + timed escapes | 3D third person, write code |
| `raid` | Seal the Beast | any topic, as a whole class in teams | 2D projector + phones, multiplayer |
| `sniper` | Snippet Sniper | predicting output | 2.5D sniping |
| `whack-a-bug` | Whack-a-Bug | finding the line that causes a wrong result | 2D arcade defense |
| `aftershock` | Aftershock | ordering and indenting lines (Parsons problems) | 2D action platformer |
| `garage` | Complexity Garage | time and space complexity | 3D race, choose parts or write code |

**First wave and later.** This section fully specifies the shared engine, Snek, packs, the play layer and the
four 2D games `syntax-drop`, `sniper`, `whack-a-bug` and `aftershock`. `maze-coder`, `breakout`, `garage`
and `raid` keep their design text (§13.8), but their acceptance rows are reserved until their contract is
written (before task g-7); the play layer applies to them too.

### 13.1 Decisions

D-42 to D-49 were D-G1 to D-G8 of the games design (SPEC-games.md, folded here); D-50 to D-65 come from the
first-wave test contract; D-66 is the builders' per-row feedback tool.

| ID | Decision | Status | Source |
|---|---|---|---|
| D-42 | (was D-G1) **Light by default.** 2D games draw on one `<canvas>` with Canvas 2D. 3D games use `three` 0.186.1 (core only, named imports so unused parts are tree-shaken). No physics engine (movement is grid or axis-aligned-box collision), no game framework | locked | games design |
| D-43 | (was D-G2) **No downloaded art or sound.** Models are built in code from boxes (block style) and merged per object; textures are drawn on small canvases (≤ 256 px, one atlas per game); sounds and music are synthesized with WebAudio. The only files a game loads are its code chunk, its pack JSON and its story data | locked | games design |
| D-44 | (was D-G3) **One code language first: "Snek", a Python subset** interpreted by our own small interpreter in `packages/games/src/lang` (pure TypeScript, no dependencies, runs in the browser and in Node). Chosen over Pyodide (about 10 MB, slow start on weak CPUs) and Skulpt (unmaintained since 2022) because the games need stepping, deterministic operation and memory counts, hard limits and friendly errors. A Java-subset front end on the same evaluator is a later decision | locked | games design |
| D-45 | (was D-G4) **Fair on any CPU.** Nothing a learner is scored on depends on the wall-clock speed of their device: complexity is measured in Snek operations and memory cells; timers use the game clock (it pauses when the tab is hidden; the test clock in test mode) | locked | games design |
| D-46 | (was D-G5) **Packs are JSON** files inside the course package (layout in D-55), validated against `packages/games/schema/<gameId>.schema.json`. The package content gate runs the pack check on import (D-55). Packs are released with the day they belong to (`day` field), like other content | locked | games design |
| D-47 | (was D-G6) **Results stay in the LMS.** Each finished round writes one `gameResult` document; each Knowledge mistake becomes a card tagged with its concept and feeds the mastery map. Scores are shown to the learner; anything other people see is team-level only (AC-168) | locked | games design |
| D-48 | (was D-G7) **Multiplayer only through the hub.** `raid` (and optional garage challenges) use the existing sync (`/db`) for votes and the hub as the authority that resolves turns. No new server, no WebSocket requirement | locked | games design |
| D-49 | (was D-G8) Each game has a feature switch (§4.27), default **on**: `game.syntaxDrop`, `game.mazeCoder`, `game.breakout`, `game.raid`, `game.sniper`, `game.whackABug`, `game.aftershock`, `game.garage`, plus `games` (the whole arcade). A game is available only when both `games` and its own switch are on. `games.unlockAll` (default **off**) opens every level for a class (D-78) | locked | games design |
| D-50 | (was D-G9) **One test contract for all games, not one design per game.** Every game supports the deep link `/learn/games/<gameId>/<packId>/<levelId>`; the common actions `start`, `pause`, `resume`, `quit`, `assist`, `continue` and the story actions `next`, `skip`, `replay`; a short per-game action list with keys (§13.7); the common `__game.state()` fields plus one per-game `extra` object; and the common test ids (§13.11) | locked | games contract |
| D-51 | (was D-G10) **Deterministic play in test mode.** In test mode only, the deep link and `/learn/games` accept `?seed=<int>`, `?clock=manual` and `?story=off`. With `clock=manual` the game clock and the scene clock move only through `__game.advance(ms)`. With `story=off` no scene plays and no `seen` flag changes; every row other than AC-231 to AC-233 runs with it. Without a seed, the seed is `seedFor(class.seedSalt, 'game:<gameId>:<packId>:<levelId>')` (§4.1) | locked | games contract |
| D-52 | (was D-G11) **The Snek API is pinned** (§13.4): entry file `packages/games/src/lang/index.ts`; results are discriminated unions on `ok`; values convert between JS and Snek by one table; host functions are plain JS functions passed in `globals` | locked | games contract |
| D-53 | (was D-G12) **The Snek language is everyday Python** (§13.4). The oracle is **CPython 3.14**, and the fixtures record the exact version used. Out of scope: generators and `yield`, decorators, `with`, `async`, `global` and `nonlocal`, imports other than `math`, `collections` and `heapq`, `%`-formatting and `str.format` (f-strings only) | locked | games contract, owner |
| D-54 | (was D-G13) **Error messages are matched loosely.** A test checks an error's `kind`, its `line` and one required keyword (§13.11), never the exact wording. Every message is a single plain sentence | locked | games contract, owner |
| D-55 | (was D-G14) **Packs follow the v1 package layout.** A pack lives at `<track>/games/<gameId>/<packId>.json`. Its `day` is the 0-based class-day index, matching the `day<N>/` folders, and it is released at the start of `class.schedule[day]` in the program's time zone. On import the hub adds the gate check `G9-games`, which runs the pack check on every pack, passes when there are no packs and can never be waived (AC-53). Core's `runGate` stays G1 to G8 | locked | games contract, owner |
| D-56 | (was D-G15) **Results live with the learner.** `gameResult`, `player`, game `card`s and game `errorNote`s go in the learner's personal database (`person-<key>`). Anything other people see comes from the hub-computed `teamScore` (§13.11). The trainer's concept-miss map gets its own hub-computed class document when its row is written | locked | games contract, owner |
| D-57 | (was D-G16) **Bundle chunks are named.** The web build writes Vite's manifest (`packages/web/dist/.vite/manifest.json`). The game chunks are the entries whose `name` is `games-engine`, `games-story`, `snek`, `three` or `game-<gameId>`; tests find them by these names | locked | games contract |
| D-58 | (was D-G17) **The suite owns the test drivers.** Drivers play only through `__game.act`, `__game.state` and `__game.advance`, plus the keys and `act-<action>` buttons; games ship no driver. Every mechanic (timing windows, sway, debris, charge times) depends only on the game clock and the seed, so a driver using `clock=manual` gets the same outcome on every run and every CPU | locked | games contract |
| D-59 | (was D-G18) **Sample packs reach a class through a test seed.** The `/__test/seed` file format (Appendix C) gains `samplePacks: [{ classId, day }]`, which imports every pack under `packages/games/packs/<gameId>/<packId>.json` into that class as if it came from its package, with each pack's `day` replaced by `day` | locked | games contract |
| D-60 | (was D-G19) **Two layers, two scores.** The play layer asks the learning layer only at named Knowledge sockets (§13.7). Every round reports **Skill** (timing, aim, reflexes, survival) and **Knowledge** (answers at sockets). Only Knowledge mistakes go into `mistakes[]`, and only `mistakes[]` creates cards, error notes and mastery checks; an action miss never does. Assist lowers Action only, never Challenge (the pack level, set by the trainer) | locked | owner (play-layer design) |
| D-61 | (was D-G20) **The story is data.** Cutscenes are in-engine beat scripts, not video: `packages/games/story/universe.json` and `packages/games/story/<gameId>.json`, with their text keys in `packages/web/src/strings/en.json` under `story.`. `games check` validates them. Every scene can be skipped and replayed | locked | owner (play-layer design) |
| D-62 | (was D-G21) **Meta progression without dark patterns.** XP and coins are computed from `gameResult`s and purchases, so they persist and merge safely. The shop catalog `packages/games/shop.json` has fixed prices and no random rewards. Gear changes play (Action) only: it never changes a socket, a correct answer, or how Knowledge is judged. No streak-shaming and no "come back or lose it" | locked | owner (play-layer design) |
| D-63 | (was D-G22) **Fun is signed off by a person.** Each first-wave game has a manual playtest row (AC-243 to AC-246): the owner plays it for 10 minutes from the task's worktree build and commits `acceptance/games/signoff/<gameId>.json` to the tests repo; the orchestrator then adds the row to that task's `build/progress` in a short session, closes and merges. Each row checks only its own game's file, so an unsigned game blocks only its own task | locked | owner |
| D-64 | (was D-G23) **One tuning source.** Every number that sets game feel or scoring is in the Tuning table (§13.9); `packages/games/src/tuning.ts` exports `TUNING` with exactly the table's names and values, and a unit test in `packages/games/test` checks that they are equal. The acceptance tests parse the table from this file at run time, so a retune is an edit of this table plus `tuning.ts`, and no test file changes | locked | owner |
| D-65 | (was D-G24) **Phasing.** The first build covers the engine, Snek, packs, the story, the two scores, the `player` document with XP and coins, and the four first-wave games, built as a vertical slice (§13.10). The shop and gear (AC-237, AC-238) are their own task after the owner's playtests; until then `player.cosmetics`, `player.gear` and `player.purchases` exist and stay empty | locked | owner |
| D-66 | **`scripts/rowcheck.mjs` is the builders' per-row feedback tool.** Usage: `node scripts/rowcheck.mjs AC-217 [AC-218 ...] [--part <gameId or shared>] [--no-build]`, run under the shared lock (`flock ~/tins-orch/gate.lock node scripts/rowcheck.mjs ...`). For each id it finds the row's check files in SPEC.md exactly as `scripts/gate.mjs` does, claimed or not. An unknown id, a `manual` row or a check file outside `acceptance/` is a usage error (exit 2). It runs `node --test --test-concurrency=1 --test-reporter=tap` on just those files with `--test-name-pattern` selecting the test names that start with the id (suite names start with the AC id; per-game parts are `<AC-id> <gameId>: ...`, shared parts `<AC-id> shared: ...`; journeys append ` [desktop]` or ` [phone]`); with `--part X` only names starting `<AC-id> X:`. If a selected file is a `*.journey.mjs` it first builds the web app once (`npm run build -w packages/web`) unless `--no-build`. It prints each selected test as ok or not ok and, for a failure, the first lines of its error block as `scripts/gate.mjs` prints them (message, expected, actual, artifacts folder) with every stack line that points into `acceptance/` removed, then a passed/failed count per id and part. **Zero matches is a failure:** an id or id plus part that matches no test (skipped tests do not count) prints `no tests matched <AC-id>[ <part>]` and exits 1. The full TAP goes to `.tins/state-rowcheck-last.tap`. Exit 0 only when every selected test passed and every requested id and part matched at least one test. It is feedback only: the gate (`kit gate`) stays the proof | locked | owner |
| D-69 | **Audience and wording.** Learners are young people in India. Every learner-facing text in the games (hub, story, instructions, lesson cards, results, errors) is simple Indian English: short sentences, everyday words, references familiar to young people in India, no Western idioms or slang, and no game jargon (combo, socket, decoy, fever, boss, power-up) without a plain explanation the first time it appears. The owner reviews the wording in each game's playtest | locked | owner |
| D-70 | **Hub layout.** The games hub follows the layout patterns of the big kids' game platforms (a left rail or, on phones, a bottom tab bar; a top bar with the player; rows of large cards; a game page with one big Play button) but uses no other platform's name, logo, assets or currency names; coins and XP keep their names. Hub screens are styled as part of the games (the games theme, large rounded cards, touch targets of at least 44 px), not as LMS pages; every control is still a real link or button with an accessible name | locked | owner |
| D-71 | **g-3 is built in three phases, each ending with the owner's check:** A, screens, wording and the hub (§13.3); B, voice (offline recordings, D-68); C, art (sprite pipeline). AC-243 (the Syntax Drop sign-off) is played after phase C. Later games reuse what each phase builds | locked | owner |
| D-78 | **Levels open in order.** Within a pack, level 1 opens when the pack is released (§4.29, D-55); level n+1 opens when level n is won with any number of stars. A locked level shows a plain unlock line (`game-level-unlock-<levelId>`, for example "Win level 1 to open this") and its deep link shows `game-unavailable`. The class switch `games.unlockAll` (§4.27, default **off**, set by the class's trainer) opens every released level of every pack for that class; in test mode only, `LMS_GAMES_UNLOCK_ALL=1` does the same for playtests. Game-specific locks (the sniper boss level's rank, §13.7.2) still apply on top. AC-201, which opens a sample pack's last level by deep link, seeds the wins before it | locked | owner |
| D-79 | **Games screens are full-page.** Every `/learn/games…` route renders without the LMS header and space nav: a feature route may set `fullPage: true` (the FEATURE API in `packages/web/src/features/registry.ts`) and the shell then draws only that screen. The hub's rail and tab bar carry "Back to LMS" (`hub-nav-lms`), which opens `/learn` | locked | owner |
| D-80 | **Video tooling is a development tool, never part of the app.** Trailers (30 to 45 s per product, 15 s teasers per game, each 16:9 and 9:16), title and closing cards for the product demo videos, and the optional cinematic prologue are made with `hyperframes` 0.8.77 (npm, Apache-2.0), pinned in `~/tools/hyperframes` on the author's machine and never a dependency of any package; its compositions load GSAP 3.14.2 at render time (GSAP Standard "No Charge" License by Webflow: free including commercial use; prohibited only inside visual no-code animation builders that compete with Webflow). Rendered MP4s carry no dependency. Telemetry is off, and its cloud, publish and feedback commands are never used. **Exception to D-43 and D-61 (no video files):** an optional cinematic prologue may be served by the hub (at most 8 MB, cached after the first play, skippable at any time), with the in-engine prologue as the fallback whenever the file is missing or fails; its behaviour gets an acceptance row before it is built. In-game cutscenes stay story-runner beats (offline, translatable, voice-synced). Video text follows D-69 | locked | owner |

### 13.2 Performance budgets

| ID | Budget | Check |
|---|---|---|
| AC-200 | **Bundle:** gzip sizes of the manifest-named chunks (D-57) in `packages/web/dist`: `games-engine` ≤ 60 KB; `games-story` ≤ 30 KB; `snek` ≤ 40 KB; each 2D `game-<gameId>` ≤ 80 KB; `three` ≤ 180 KB and each 3D game chunk ≤ 90 KB (excluding three) once those chunks exist. No game chunk (and not three) is requested before the learner opens the arcade (a service worker may precache in the background) | `acceptance/games/budgets.test.mjs` |
| AC-201 | **2D frame rate:** on the low-end phone profile (4× CPU slowdown) each first-wave 2D game, played by the suite's driver for 20 s of real time with `story=off` (after seeding the wins that open it, D-78) at the last level of its pack in §13.11, reports p50 frame time ≤ 20 ms and p95 ≤ 34 ms from `__game.stats()`. `raid` joins this row with its contract. Claimed by the last first-wave game to merge; earlier games run their own part | `acceptance/games/perf2d.journey.mjs` |
| AC-203 | **Start and memory:** from following the deep link (with `story=off`) to `state().status` `'title'` with `stats().frames` ≥ 1 takes ≤ 3 s on the phone profile for 2D games (≤ 5 s on desktop for 3D games, with their contract); JS heap (CDP `Runtime.getHeapUsage().usedSize`) after 60 s of play ≤ 150 MB; leaving a game makes `window.__game` undefined and calls `requestAnimationFrame` 0 times over the next 2 s (3D games also leave their WebGL context lost) | `acceptance/games/lifecycle.journey.mjs` |

AC-202 (3D scene cost: draw calls, triangles, textures and quality tiers at each checkpoint) is reserved for
the 3D contract, which defines "checkpoint"; nobody claims it until then.

Engine rules that make these hold (builders' guidance, not separately tested): fixed-step update (60 Hz)
with interpolated rendering; render only when something moved; pause on `visibilitychange`; pooled objects
(no allocation in the frame loop); instanced or merged meshes; one directional and one hemisphere light; fog
instead of far geometry; shadows only on `high`.

### 13.3 The engine, arcade and test hooks (`packages/games/src/engine`)

```ts
interface GameModule {
  id: string;                                   // e.g. 'syntax-drop'
  mount(el: HTMLElement, ctx: GameContext): GameInstance;
}
interface GameContext {
  pack: Pack; level: string; seed: number;      // seeded randomness (§4.1)
  clock: GameClock;                             // game time; test clock in test mode
  input: Input;                                 // keyboard, pointer/touch, gamepad, and DOM action buttons
  audio: Sfx; quality: Quality; strings: (key: string) => string;
  story: Story; player: Player; tuning: Tuning; // scenes (§13.6), the player document, §13.9 values
  finish(result: RoundResult): void;            // writes gameResult + cards (D-47, D-60)
}
interface GameInstance { pause(): void; resume(): void; destroy(): void; act(action: string, arg?: unknown): boolean; state(): unknown; }
```

**Routes.**
- `/learn/games` is the hub's Home (nav name "Games"; called "the arcade" elsewhere in this section). A scene
  replayed from "Story so far" plays above the page it was started from, which stays on the page while it plays.
- `/learn/games/avatar`, `/learn/games/inventory`, `/learn/games/team`, `/learn/games/story` and
  `/learn/games/settings` are the hub's other pages; `/learn/games/shop` is the shop (built with AC-237). These
  names are reserved: no `gameId` may use them.
- `/learn/games/<gameId>` is the game page (it replaces the plain pack and level picker).
- `/learn/games/<gameId>/<packId>/<levelId>` opens the game on that level.
- Trainers see `/teach/games` with the class's concept-miss map and the raid controls (rows later).

**The hub (D-70).** Every hub page has:
- **Navigation** (`hub-rail`): Home, Avatar, Inventory, My Team, Story so far, Settings (`hub-nav-home`,
  `hub-nav-avatar`, `hub-nav-inventory`, `hub-nav-team`, `hub-nav-story`, `hub-nav-settings`). On a wide screen
  it is a left rail (`data-layout="rail"`); on a phone it is a bottom tab bar (`data-layout="tabs"`).
- **A top bar** (`hub-topbar`): the player's avatar (`player-avatar`), `player-coins`, `player-xp`, a full-screen
  button (`hub-fullscreen`) and Ada's mission alerts (`hub-alerts`, one `hub-alert-<n>` each: a short line such
  as a new pack, a level left half-done, or a concept to practise, each linking to where it points).

**Home** shows rows of large cards, each row scrolling sideways (`hub-row-<rowId>`), in this order, and a row
with no cards is not shown:
1. `continue`, "Continue playing": packs the learner has played and not finished (a level left to win), most
   recently played first;
2. `recommended`, "Recommended for you": for the learner's weakest mastery concepts (§4.4, lowest score first,
   concepts never checked count as weakest only once the learner has played that game), the pack and the first
   unlocked level not yet won with 3 stars that has sockets of that concept; at most 12 cards;
3. `new`, "New this week": packs released to the learner's class in the last 7 days (§4.29 release, by the
   server clock);
4. `games`, "All games": one `game-tile-<gameId>` per available game (the tile of AC-204 and AC-206);
5. `live` is reserved for trainer-hosted class games (rows later); it is not shown in this build.

Below the rows Home keeps "Story so far" (`story-replay`), the same list as the Story so far page.

**A card** (`hub-card-<gameId>-<packId>` inside a row) shows a thumbnail (`hub-card-thumb`), the pack title, and
either the learner's own progress (`data-stars` and `data-stars-max`: stars won over the pack's levels × 3;
`data-levels-left`) or, when locked, `data-locked="true"` with a plain line saying how to unlock it
(`hub-card-unlock`). No card, row or page of the hub shows ratings, play counts, or any other learner's score
or XP (AC-206). Thumbnails are drawn by the game module (an optional `thumbnail(canvas, pack)` in
`GameModule`) until phase C art exists, kept as compressed images (WebP, at most 40 KB) and loaded lazily.

**The game page** (`game-page-<gameId>`): the game's story blurb (`game-blurb`), one big Play button
(`game-play`: opens the first unlocked level not yet won in the pack last played, else in the first pack), the
packs (`game-pack-<packId>`), and for the chosen pack the level path: every level in order (`game-level-<levelId>`),
a locked one with `data-locked="true"` and a plain hint saying how to open it (`game-level-unlock-<levelId>`, for
example "Win level 1 to open this"); the learner's own best (`game-best`, `data-score`, `data-stars`) and the
team's total (`game-team-total`, the team's average XP, as `wall-team-<teamId>`). A back button (`hub-back`)
returns to Home.

**Other hub pages.** Avatar: the avatar and its editor (the prologue's `avatar` choices). Inventory: owned
cosmetics and gear (`inventory-item-<id>`), or a plain empty-state line. My Team: the team's name, its
members by avatar and `nameTag` in alphabetical order (no per-member XP or score), and the team's XP.
Story so far: `story-replay` with one `story-replay-<sceneId>` per seen scene. Settings: sound, quality,
autoplay dialogue (`player.settings.autoAdvance`), assist by default, and timing calibration for games that
have it.

When `games` is off, every one of these routes shows `game-unavailable` (text "not available") and the nav
entry is gone. When only `game.<x>` is off, or the pack is not released yet, or the level is locked, that
game's tile (or pack, or level) is missing or locked and its deep links show `game-unavailable`.

**Shared screens** every game uses, drawn as part of the game (D-70), with a visible menu button
(`act-pause`) in every status where `pause` is valid and a visible way out in every other status:
- **Title and how to play** (`howto`): one entry per action the learner uses while playing, including
  `pause` (`howto-<n>`), each with its key or keys shown as key caps (`data-keys`, for example `"←,A"`), one plain
  sentence saying what it does (D-69), and a short looping demo next to it (`howto-demo-<n>`, a canvas the
  game draws itself, at most 4 s per loop, moving on its own with no input; no video files). Buttons:
  `act-start`, `act-back` (to the game page), `act-fullscreen`.
- **Pause menu** (`pause-menu`): resume, retry, back to the game page, quit to Home, lesson cards, Story so
  far, sound, quality, full screen, timing calibration where the game has it.
- **Lesson card overlay** between stages (each card ≤ 280 characters plus an optional code sample).
- **Results** (score, Skill, Knowledge stars, each Knowledge mistake with a one-line "what it does" and "added
  to your cards"), after a win or a loss alike, with three large buttons: `act-retry` (play this level
  again), `act-back` (the game page, with the level path) and `act-quit` (Home).
- **Dialogue bar** in every scene, drawn as game UI: `act-previous`, `act-next`, `act-pause`, `act-autoplay`
  (`aria-pressed` shows whether autoplay is on) and `act-skip`. A tap or click anywhere on the scene outside
  these buttons is `next`.
- **Full screen:** `act-fullscreen` (and `hub-fullscreen` on the hub) asks the browser for full screen on
  the games area and asks it to leave full screen when pressed again.

**Statuses.** `state().status` is one of:
- `'story'`: a scene or dialogue is playing; the play clock (`clockMs`) is stopped and the scene clock runs;
- `'title'`: the title screen, before the first `start`;
- `'playing'`;
- `'paused'`: the pause menu or the lesson card is open; both clocks are stopped;
- `'won'` or `'lost'`: the round is finished, `game-results` is shown and the `gameResult` is written.

**Order of a launch.**
1. On a game's first launch for this learner (`player.seen.intro[gameId]` not set) the scene
   `<gameId>.intro` plays (`'story'`).
2. Then the title screen (`'title'`).
3. After the last level of a pack is won, the result is written, then the scene `<gameId>.chapter-end`
   plays, then the status is `'won'` with the results.

**Prologue.** On the first visit to `/learn/games` for a learner (`player.seen.prologue` not set) the prologue
is mounted like a game: `window.__game.id` is `'prologue'` and the status is `'story'`. It contains one
`avatar` beat. When it ends or is skipped, `seen.prologue` is set, `__game` is removed and the arcade shows.

**Scene state and timing.** `extra.scene` is `{ id, beat, line }` or `null` in every game and in the
prologue (`beat` is the 0-based index of the running beat; `line` is the `en.json` key of the current `say`
text, or `null`).
- A `say` beat waits for `next`; it never advances by itself unless autoplay is on: `autoplay` toggles
  `player.settings.autoAdvance` (default `false`, kept in the player document), and while it is on a `say`
  line advances after `story.sayNominalMs` of scene time.
- `previous` goes back to the previous `say` line of the running scene (`extra.scene.line` shows it again);
  on the first `say` line it does nothing and returns false.
- Other beats take their `ms`; `skip` ends the scene at once; in `'story'`, `advance(ms)` moves the scene
  clock; a scene's `seen` flag is set when the scene ends or is skipped.

**Test hooks.** When the server runs with `LMS_TEST_MODE=1` it injects `<meta name="lms-test-mode"
content="1">`; only then, and only while a game or the prologue is mounted, `window.__game` exists:

```ts
interface TestGame {
  id: string;                                         // gameId, or 'prologue'
  state(): GameState;
  act(action: string, arg?: unknown): boolean;        // true = it did something; false = not valid now; throws on an unknown action
  advance(ms: number): GameState;                     // runs the fixed-step update for ms of driver time, synchronously
  stats(): GameStats;
}
interface GameState {
  status: 'story' | 'title' | 'playing' | 'paused' | 'won' | 'lost';
  score: number; lives: number | null; stage: number;  // stage counts from 1; lives is null in every first-wave game
  levelId: string; clockMs: number; assist: boolean;   // clockMs = game time since start
  skill: number; knowledgeMistakes: number; actionMisses: number;
  extra: object;                                       // per game (§13.7); always includes scene
}
interface GameStats {
  frames: number;                                      // frames rendered since mount
  fps50: number | null; frameP50: number | null; frameP95: number | null; // over the last 20 s of rendered frames; null under 30 frames
  drawCalls: number | null; triangles: number | null; textures: number | null; // null for 2D
  heapMB: number | null; tier: 'low' | 'medium' | 'high'; pixelRatio: number; shadows: boolean;
}
```

**Game clock.** It advances at 1× while playing and at `common.assistFactor` with assist on; it does not
advance while paused, in `'story'`, or while the tab is hidden. `advance(ms)` moves it by `ms` × that factor.
Every timing window is measured in game time, so assist widens it in real time (Action only).

**Common actions and keys.** Within a status no two actions share a key.

| Action | Key | Valid when |
|---|---|---|
| `start` | Enter | title |
| `pause` | P or Escape | playing, story |
| `resume` | P or Escape | paused (pause menu) |
| `continue` | Enter | paused (lesson card) |
| `quit` | Q | paused, won, lost; destroys the game and returns to `/learn/games` |
| `retry` | R | paused, won, lost; starts the same level again |
| `back` | Backspace | title, paused, won, lost; destroys the game and opens the game page `/learn/games/<gameId>` |
| `fullscreen` | G | every status; enters or leaves full screen |
| `assist` (arg: boolean; no arg toggles) | H | title, paused |
| `next` | N or Enter | story: advance the current `say` line |
| `skip` | F or Backspace | story: end the scene |
| `previous` | B | story: go back to the previous `say` line |
| `autoplay` (arg: boolean; no arg toggles) | A | story: autoplay the dialogue on or off |
| `replay` (arg: sceneId; no arg = the most recent seen scene) | L | paused, title, and the arcade's "Story so far" |
| `avatar` (arg: `{ look, color, nameTag }`) | ←/→ to choose, Enter to confirm | prologue, `avatar` beat |

**Every action has a keyboard key and an on-screen button.** Every action valid in the current status has a
visible `act-<action>` button, or `act-<action>-<arg>` for an action with an argument; buttons reached with
Tab and pressed with Enter count as keyboard use. Held actions (`breathe`, `run`, `charge`) act for as long
as the pointer is down on the button. Structured arguments use fixed button names: `act-nudge-left`,
`act-nudge-right`, `act-nudge-up`, `act-nudge-down`; `act-run-left`, `act-run-right` (0 on pointer up);
`act-charge-<line>` (pointer up is `release`); `act-indent-<n>`; `act-strike-<key>`; `act-whack-<line>`;
`act-offset-minus`, `act-offset-plus`; `act-replay-<sceneId>`. The games are fully playable without a
pointer and without fine motor control: the "assist" option slows the game clock and is recorded on the
result, never punished.

**Stars, scores and mistakes.**
- `knowledgeStars` (0 to 3) counts Knowledge only: 3 = every socket of the level answered with no Knowledge
  mistake; 2 = every socket answered with at most `common.starsTwoMaxMistakes` Knowledge mistakes; 1 = at
  least one socket answered correctly; 0 = none. "Answered" means answered without assistance: a socket closed
  by an assisted hit (§13.7, Whack-a-Bug) counts as neither correct nor a mistake, so a level with an assisted
  socket gets at most 1 star, and the socket stays closed once fixed.
- `stars` equals `knowledgeStars`. `skill` is the sum of Skill points (§13.7).
- `score` = `skill` + `common.knowledgePoints` × sockets answered correctly.
- Action misses lower `skill` and may end the round (shield or health at 0, ammo out); they never lower
  `knowledgeStars` directly.

**Finishing a round.** The game writes one `gameResult` (§13.11) carrying the XP and coins it earned
(§13.6). For each entry in `mistakes[]` (Knowledge only) it upserts one `card` (id
`card:game-<gameId>-<packId>-<itemId>`, so repeating a mistake does not duplicate it) and one `errorNote`,
and it adds one mastery check per concept played to the §4.4 map (`score` = 1 − mistakes on that concept ÷
sockets of that concept answered, `at` = `gameResult.at`). Action misses create nothing in cards, error notes
or mastery.

**Arcade tile.** `game-tile-<gameId>` shows the learner's own last score and stars in `data-last-score` and
`data-stars`; when the learner has not played, these attributes are absent.

| ID | Behaviour | Check |
|---|---|---|
| AC-204 | The arcade lists only available games that have a released pack; switching `games` off removes the nav entry and every games route shows `game-unavailable`; switching one `game.<x>` off removes that tile and its deep links show `game-unavailable`; each tile opens its game and `quit` returns to the arcade | `acceptance/games/arcade.journey.mjs` |
| AC-205 | Finishing a round writes one `gameResult` with `personId`, `classId`, `gameId`, `packId`, `levelId`, `score`, `stars`, `skill`, `knowledgeStars`, `xp`, `coins`, `outcome`, `mistakes` (each `{ itemId, concept }`), `assist`, `durationMs`, `at`, with `stars` equal to `knowledgeStars`; each Knowledge mistake upserts a `card` with that `concept` and an `errorNote` with `subtopic` equal to the concept, and the error notebook lists it; the mastery map gains or updates `mastery-skill-<concept>` for the concepts played | `acceptance/games/results.journey.mjs` |
| AC-206 | Nothing in the arcade or any game shows another learner's individual score or XP; the celebration wall shows `wall-team-<teamId>` with the team's average XP per current member (`teamScore.xp`) only | `acceptance/games/privacy.journey.mjs` |
| AC-207 | Every game can be finished with keyboard only and with on-screen buttons only; pause and story scenes stop the game clock; assist halves speed (Action only: sockets and Knowledge judging are unchanged) and sets `assist: true` | `acceptance/games/controls.journey.mjs` |

**Phase A rows** (g-3 phase A, D-71):

| ID | Behaviour | Check |
|---|---|---|
| AC-247 | **Hub:** every hub page has `hub-rail` (a left rail, `data-layout="rail"`, on a wide screen; a bottom tab bar, `data-layout="tabs"`, on a phone) whose six entries open their pages, and `hub-topbar` with `player-avatar`, `player-coins`, `player-xp`, `hub-fullscreen` and `hub-alerts`; for a seeded learner Home shows `hub-row-continue` (played, unfinished packs, most recent first), `hub-row-new` (packs released in the last 7 days only) and `hub-row-games`, with no `live` row; each card shows the learner's own `data-stars`, `data-stars-max` and `data-levels-left` or a lock with its unlock line; My Team lists members by avatar and game name with no per-member score; no hub page shows another learner's score or XP | `acceptance/games/hub.journey.mjs` |
| AC-248 | **Recommended for you:** after the learner plays a round with a Knowledge mistake on one concept and a clean round on another, `hub-row-recommended`'s first card is a pack and level with sockets of the weaker concept | `acceptance/games/hub-recommended.journey.mjs` |
| AC-249 | **Game page:** `game-page-<gameId>` shows `game-blurb`, the packs, the chosen pack's full level path in order (a locked level has `data-locked="true"` and a `game-level-unlock-<levelId>` hint), `game-best` (own only) and `game-team-total`; `game-play` opens the first unlocked level not yet won; `hub-back` returns to Home | `acceptance/games/game-page.journey.mjs` |
| AC-250 | **A way out everywhere:** after a win and after a loss the results show `act-retry`, `act-back` and `act-quit`; `retry` (R) starts the same level again, `back` (Backspace) opens the game page and `quit` (Q) opens Home; `act-pause` is visible while playing; title and pause menu offer `back` too | `acceptance/games/way-out.journey.mjs` |
| AC-251 | **Dialogue bar:** in a scene, `act-previous`, `act-next`, `act-pause`, `act-autoplay` and `act-skip` are visible; `previous` (B) shows the previous `say` line again and returns false on the first; a tap on the scene outside the buttons is `next`; `autoplay` (A) sets `player.settings.autoAdvance`, which survives a reload, and while it is on a `say` line advances after `story.sayNominalMs` | `acceptance/games/dialogue.journey.mjs` |
| AC-252 | **Full screen:** `hub-fullscreen` on the hub and `act-fullscreen` (or G) in a game ask the browser for full screen, and pressing again asks it to leave | `acceptance/games/fullscreen.journey.mjs` |
| AC-253 | **How to play:** the title screen's `howto` has one `howto-<n>` per action used while playing (including `pause`), each with its keys in `data-keys` and one plain sentence, and a `howto-demo-<n>` canvas whose frames change with no input | `acceptance/games/howto.journey.mjs` |
| AC-254 | **Full page:** on every `/learn/games…` route (hub pages, game page, a running game) the LMS header and space nav are absent, on desktop and on a phone; `hub-nav-lms` in the rail and in the tab bar opens `/learn`, where the LMS header is back | `acceptance/games/full-page.journey.mjs` |
| AC-255 | **Levels open in order:** in a fresh pack only level 1 is open; the game page shows levels 2 and 3 locked with their unlock lines and their deep links show `game-unavailable`; winning level 1 opens level 2 and not level 3; with the class switch `games.unlockAll` on, every level of the pack is open | `acceptance/games/unlock.journey.mjs` |

### 13.4 Snek, the Python-subset interpreter (`packages/games/src/lang`)

The entry is `packages/games/src/lang/index.ts`. The module has no imports outside `packages/games/src/lang`
and uses no DOM or Node API.

```ts
type SnekErrorKind =
  | 'SyntaxError' | 'IndentationError' | 'NameError' | 'TypeError' | 'ValueError' | 'IndexError'
  | 'KeyError' | 'ZeroDivisionError' | 'AttributeError' | 'OverflowError' | 'EOFError' | 'RuntimeError'
  | 'AssertionError' | 'Exception'
  | 'TooManySteps' | 'TooDeep' | 'TooBig' | 'NotAllowed';
interface SnekError { kind: SnekErrorKind; line: number; col: number; message: string } // line and col count from 1
type Compiled = { ok: true; program: Program } | { ok: false; error: SnekError };
interface RunOpts {
  input?: string[];
  globals?: Record<string, unknown | ((...args: unknown[]) => unknown)>; // JS functions are host functions
  maxOps?: number; maxDepth?: number; maxCells?: number;   // defaults 1 000 000, 200, 100 000
}
type RunResult =
  | { ok: true;  value: unknown; stdout: string; ops: number; peakCells: number }
  | { ok: false; error: SnekError; stdout: string; ops: number; peakCells: number };
type StepEvent =
  | { kind: 'line'; line: number; vars: Record<string, unknown> }        // before the statement on `line` runs
  | { kind: 'call'; line: number; name: string; args: unknown[] };      // a host function is about to run

compile(source: string): Compiled
run(p: Program, opts?: RunOpts): RunResult
step(p: Program, opts?: RunOpts): Generator<StepEvent, RunResult>
callFunction(p: Program, name: string, args: unknown[], opts?: RunOpts): RunResult
```

- **`value`:** for `run`, the value of the last top-level statement when it is an expression, else `null`;
  for `callFunction`, the function's return value (the module body runs first; its stdout and ops are
  included).
- **`input`:** `input(prompt)` writes `prompt` to stdout and returns the next line of `opts.input`; once
  exhausted it raises `EOFError`.
- **Host functions** cost 1 op; arguments and return values convert with the table below; under `step` the
  `call` event is yielded first and the host function runs on the next `next()`; if it throws, the run ends
  with `RuntimeError`.
- **`line` events:** one before each simple statement; each evaluation of an `if`, `elif` or `while`
  condition; each iteration of a `for` header, plus once when the loop ends; each `def` or `class` statement
  as it executes; each `return`. For programs whose statements each fit on one line this equals CPython
  3.14's `sys.settrace` line events.
- **Limits:** `TooManySteps`, `TooDeep` and `TooBig` fire when `maxOps`, `maxDepth` or `maxCells` is
  exceeded, and each stops the run cleanly; `NotAllowed` covers the sandbox list (AC-213).
  On a `TooManySteps` stop, `ops` is the count after the operation that took it past `maxOps`: the first
  value over the limit, not clamped to `maxOps` (so it can exceed `maxOps` by more than 1 when a built-in's
  cost crosses it). `peakCells` counts a string by its length. Both are owner rulings; do not change them.

**Value conversion** (for `globals`, `args`, `value` and `vars`):

| JS | Snek | Back to JS |
|---|---|---|
| safe integer `number` | `int` | `number` |
| other finite `number`, or `{ $float: n }` | `float` | `number` |
| `boolean` | `bool` | `boolean` |
| `null`, `undefined` | `None` | `null` |
| `string` | `str` | `string` |
| `Array` | `list` | `Array` |
| `{ $tuple: [...] }` | `tuple` | `{ $tuple: [...] }` |
| `{ $set: [...] }` | `set` | `{ $set: [...] }` in iteration order |
| plain object | `dict` with str keys | plain object if every key is a str, else `{ $dict: [[k, v], ...] }` |
| (none) | class instance | `{ $object: '<ClassName>', attrs: { ... } }` |
| (none) | function | `{ $function: '<name>' }` |

`vars` holds the current scope's variables (locals inside a function, globals at top level), leaving out
functions, classes, modules and host functions.

**Language:** `int` (53-bit safe range; `OverflowError` beyond), `float`, `bool`, `None`, `str` (indexing,
slicing, `+`, `*`, f-strings, `len`, `upper`, `lower`, `split`, `join`, `strip`, `replace`, `find`,
`startswith`, `endswith`, `isdigit`, `isalpha`), `list`, `tuple`, `dict`, `set`, slicing, `in`, comparisons
and chained comparisons, `and`/`or`/`not`, `if`/`elif`/`else`, the conditional expression `x if c else y`,
`while`, `for … in`, `range`, `break`, `continue`, `pass`, `def` with defaults, `return`, recursion,
`lambda`, list/dict/set comprehensions, `class` with `__init__`, attributes and methods (no inheritance),
`try`/`except` (one level), `print` (with `sep`, `end`), `input()`, builtins `len abs min max sum sorted
reversed enumerate zip map filter any all int float str bool list dict set tuple ord chr round isinstance`,
and modules `math` (floor, ceil, sqrt, inf), `collections.deque`, `heapq` (heappush, heappop, heapify). Also:
- operators `+ - * / // % **` (`%` as the numeric operator only), unary `-`, `is` and `is not`, `in` and
  `not in`; augmented assignment and chained assignment (`a = b = 0`); tuple unpacking in assignments and
  `for` targets, including swaps; negative indexing; `del` on names, list items and dict keys;
- keyword arguments at call sites, including `sorted(key=, reverse=)`, `print(sep=, end=)` and the learner's
  own `def`s;
- list methods `append pop insert remove index count extend sort reverse`; dict methods `get items keys
  values setdefault pop`; set methods `add discard remove`;
- `except X as e`, bare `except` and `except Exception`; `raise X(message)` and `raise X` for the
  Python-named kinds and `Exception`; `assert cond` and `assert cond, message` (raise `AssertionError`);
- f-string specs `:.2f`, `:>5`, `:<5` and `:d`.

Out of scope: see D-53, plus user-defined exception classes.

**Output matches CPython 3.14:** `str` and `repr` of int, float (shortest round trip; exponent form when the
exponent is < −4 or ≥ 16), str, list, tuple, dict, bool and `None`; `/` always gives a float; `//` and `%`
follow floor semantics; `round` is round-half-even. **Differs from CPython:** a set iterates in insertion
order (the corpus never prints a set or depends on set order); exception messages are Snek's own (D-54).

**Counting (D-45):** every evaluated expression node and statement costs 1 op; built-in calls cost their
documented complexity (`sorted` n·log2 n, `in` on a list n, on a set or dict 1, slicing k, …); `peakCells`
is the largest number of live list/dict/set/str elements at any point. The same program and options always
give the same `ops` and `peakCells`. No random-number hook exists yet; `garage` adds one with its contract.

| ID | Behaviour | Check |
|---|---|---|
| AC-208 | The 120 programs in the fixture corpus give exactly their expected stdout, as printed by CPython 3.14 (version recorded in the fixture) (lists, dicts, classes, recursion, comprehensions, deque, heapq, f-strings, slicing) | `acceptance/games/snek.test.mjs` |
| AC-209 | Errors are friendly and located: a syntax error, a `NameError`, an `IndexError`, wrong indentation and a type mismatch each report the error `kind`, the line, and a one-sentence message containing the required keyword (§13.11) | `acceptance/games/snek-errors.test.mjs` |
| AC-210 | Limits: an infinite loop stops at `maxOps` with kind `TooManySteps` and a message containing N (suggested text: "your code ran too long (more than N steps)"); deep recursion stops at `maxDepth` with `TooDeep`; building a huge list stops at `maxCells` with `TooBig`; none hang or crash the page | `acceptance/games/snek-limits.test.mjs` |
| AC-211 | Counting is deterministic: the same program and input give the same `ops` and `peakCells` on every run; for the fixture sorts, `ops` for n = 1000 vs n = 100 grows by ≥ 80× for bubble sort and ≤ 15× for merge sort | `acceptance/games/snek-count.test.mjs` |
| AC-212 | `step` yields the `line` events above in order, equal to CPython 3.14's for the single-line fixtures, with `vars` snapshots; a host function (e.g. `move()`) yields a `call` event and runs only on the next `next()`, so the game can animate it first | `acceptance/games/snek-step.test.mjs` |
| AC-213 | The interpreter has no access to the page or Node: `open`, `import os`, `__import__`, `eval`, `exec`, attribute access to `__class__` and `__globals__` are refused with a plain message | `acceptance/games/snek-sandbox.test.mjs` |

### 13.5 Packs and story data

Common fields for every pack:

```json
{ "game": "syntax-drop", "id": "html-headings", "title": "Headings and text sizes",
  "day": 2, "concepts": ["html.headings", "css.font-size"], "language": "en",
  "levels": [ { "id": "1", "title": "…", "lesson": [ { "concept": "html.headings", "text": "…" } ], "…": "game-specific" } ] }
```

- **Schema:** `packages/games/schema/<gameId>.schema.json`, JSON Schema 2020-12. Common required fields:
  `game`, `id` (matches `^[a-z0-9][a-z0-9-]*$`), `title`, `day`, `concepts`, `language` and `levels[]`; each
  level requires `id`, `title` and `lesson[]`. A concept matches `^[a-z][a-z0-9-]*(\.[a-z0-9][a-z0-9-]*)+$`,
  and every item `concept` must be listed in the pack's `concepts`. A `"$comment"` string is allowed in any
  object and ignored.
- `concepts` are the tags used for cards and the mastery map. `lesson` cards are shown between stages; each
  is ≤ 280 characters plus an optional code sample.
- **Tests in packs:** each entry in `tests` is `{ args: [...], expect: <value> }` (calls the level's
  function, named by `signature` or `entry`) or `{ input?: [...], stdout: "<text>" }` (runs the whole
  program). Values are compared after conversion, floats within 1e-9; stdout exactly, after trailing
  whitespace is removed.
- Every code sample, answer and test in a pack is checked by the pack check (it runs Snek where a pack says
  `"lang": "snek"`).
- **Sample packs** live in `packages/games/packs/<gameId>/<packId>.json` (also used by the tests through
  D-59); the packs per game are listed in §13.7.

**Story data (D-61).** `packages/games/story/universe.json` is `{ cast: [{ id, nameKey }], scenes: {
prologue: Scene } }`; `packages/games/story/<gameId>.json` is `{ gameId, front: { nameKey }, cast: [...],
scenes: { intro: Scene, 'chapter-end': Scene, …optional scenes } }`. Scene ids are `prologue`,
`<gameId>.intro`, `<gameId>.chapter-end` and `<gameId>.<name>`. A `Scene` is `{ beats: Beat[] }`:

```ts
type Beat =
  | { t: 'say'; who: string; key: string; holdMs?: number }
  | { t: 'move'; target: string; to: number[]; ms: number }
  | { t: 'camera'; to: number[]; ms: number }
  | { t: 'wait'; ms: number }
  | { t: 'sfx'; name: string }
  | { t: 'music'; name: string }
  | { t: 'shake'; ms: number; power: number }
  | { t: 'spawn'; what: string; at: number[] }
  | { t: 'fade'; to: 'in' | 'out'; ms: number }
  | { t: 'avatar' };                                   // prologue only
```

A scene's length (for the length check only) is the sum of its beats' `ms`, plus each `say`'s `holdMs`
(default `story.sayNominalMs`).

**CLI.**
- `node packages/cli/src/main.ts games check <dir-or-file>` checks packs and story files (a file with
  `scenes` at the top level is a story file). It prints one line per problem in the form
  `<file>: <pack, level <id> or scene <id>>: <message>` and exits 1; with no problems it prints only
  `ok: <n> file(s)` and exits 0; it exits 2 on a usage error.
- `games new <gameId> <packId> [--dir <dir>]` writes `<dir or cwd>/games/<gameId>/<packId>.json`, a commented
  starter pack, prints its path, and refuses to overwrite (exit 1).

**Pack-check rules (first wave).**
- All games: the common schema; level ids unique within a pack; lesson text ≤ 280 characters.
- `syntax-drop`: every slot's `accepts` names at least one existing non-decoy piece; the template contains
  `{{<slotId>}}` for every slot; strike keys are the digits 1 to 9, unique within a level; `renderer` is a
  known renderer; for `console` and `pattern` levels, the template filled with each slot's first accepted
  piece compiles and runs.
- `whack-a-bug`: the program has at most `whack.maxProgramLines` lines; each bug's `line` is inside the
  program; the fixed and buggy programs both run and their outputs differ.
- `aftershock`: `lines` in order, with their indents, pass `tests`, and so does every entry in `altOrders`.
- `sniper`: every snippet runs; every bounty's output is printed by exactly one snippet among that level's
  monsters; the boss's `plates` and `callouts` name existing snippets.

**Story-check rules.** Every beat type is known; every `say.key` exists in `en.json`; every `say.who` is in
the universe cast or the game's cast; `universe.json` has `prologue`, and every game story file present has
`intro` and `chapter-end` (each game's task adds its file); `avatar` appears only in the prologue, exactly once; scene lengths are within the
`story.*` Tuning values (prologue, intro, chapter-end).

| ID | Behaviour | Check |
|---|---|---|
| AC-214 | `games check` passes every sample pack and fails each broken fixture pack with a problem line containing the case's keyword (§13.11): missing field, unknown concept format, a snek answer that does not pass its tests, a syntax-drop slot with no correct piece, a level id repeated. (The maze case joins with the maze contract.) | `acceptance/games/packcheck.test.mjs` |
| AC-215 | Importing a course package with a broken game pack fails the content gate check `G9-games` with the pack check's message; a valid pack is released on its `day` and appears in the arcade only from then | `acceptance/games/pack-release.journey.mjs` |
| AC-216 | `games new <gameId> x` writes `games/<gameId>/x.json`, which passes `games check`, for every first-wave game id | `acceptance/games/packnew.test.mjs` |
| AC-234 | **Story check:** `games check packages/games/story` passes; each broken story fixture fails with its keyword (unknown beat type, missing `en.json` key, unknown speaker, missing required scene, intro length out of range) | `acceptance/games/storycheck.test.mjs` |

### 13.6 The play layer: story, scores and the player

**One universe, the Codeverse.** A world that runs on code; **the Glitch**, a corruption, scrambles syntax,
plants bugs, collapses structures and hides inside creatures. Each game is a **front** of the same war.
Recurring cast: **Ada** the mentor (briefs missions and delivers lesson cards in character), the player's
block-built **avatar**, **Null** (the Glitch's voice and the chapter bosses), and one local character per
front. The **prologue** (first visit to the arcade, 60 to 90 s, in-engine): the Codeverse working; the Glitch
spreading; Ada finds the player; avatar creation (look, color, name tag); the map of fronts opens, which is
the arcade. Each game's first launch plays a 30 to 45 s front intro; each chapter (pack) ends with a 15 to 30 s
cutscene and its last level is a boss. Scene text is in `en.json` (translatable).

**Feel ("juice"), required in every game** (covered by the manual playtest rows): hit-stop on success
(40 to 80 ms), screen shake on impacts, particles, synthesized sounds, procedural music that intensifies with
combo and stage, readable feedback within 100 ms of any input, a visible combo or streak, and a "one more try"
loop from failure back to play in ≤ 2 s.

**Earnings.** Every `gameResult` carries `xp` = round(`skill` ÷ `common.xpSkillDivisor`) +
`common.xpPerStar` × `knowledgeStars`, and `coins` = `common.coinsPerStar` × `knowledgeStars` +
floor(`skill` ÷ `common.coinsSkillDivisor`) + golden-critter coins.

**The `player` document** (person database, §13.11). `xp` and `coins` are caches, always equal to the sum
of `gameResult.xp`, and the sum of `gameResult.coins` minus the sum of `purchases[].price`; they are
recomputed on every write, so they persist across sessions and devices and merge safely (`purchases` and
results are unioned, as in §4.13).

**Shop and gear (built after the playtests, D-65).** `packages/games/shop.json` is `{ items: [{ id, kind:
'cosmetic' or 'gear', gameId?, price, effect }] }`. Buying appends `{ itemId, price, at }` to `purchases` and
the id to `cosmetics` or `gear`; buying an item already owned, or one the learner cannot afford, is refused
and changes nothing; nothing is random. Owned gear applies to its game and may change only the Action
parameters named in §13.7: it never changes a socket, a pack's answers or how a Knowledge mistake is judged,
never adds or changes `glow`, and never adds a field or on-screen mark that tells which target, slot, row or
slab is correct. When a learner owns several items for one gear slot, one is equipped per slot, chosen in the
pause menu (default; the gear task may refine it).

**Team total.** `teamScore.xp` is the average `player.xp` over the team's current members (a member with no
`player` counts as 0), rounded to an integer.

| ID | Behaviour | Check |
|---|---|---|
| AC-231 | **Prologue:** the first visit to `/learn/games` plays the prologue (`__game.id` is `'prologue'`, status `'story'`); its `avatar` beat saves `player.avatar`; skipping it opens the arcade and sets `player.seen.prologue`; a second visit (also after reload) does not play it; "Story so far" replays it | `acceptance/games/story.journey.mjs` |
| AC-232 | **Front intro and chapter end:** a game's first launch plays `<gameId>.intro` before the title screen and the second launch does not; winning a pack's last level writes the result, then plays `<gameId>.chapter-end`; during any scene `clockMs` does not move | `acceptance/games/story.journey.mjs` |
| AC-233 | **Story controls:** `next` advances `extra.scene.line` and `skip` ends the scene, both by keyboard only (N, F) and by buttons only (`act-next`, `act-skip`); Escape pauses a scene; `replay` plays a seen scene again; with `?story=off` no scene plays and no `seen` flag changes | `acceptance/games/story.journey.mjs` |
| AC-235 | **Two scores:** in each first-wave game, a fixture round with only action misses (late timing, a missed shot, a ducked critter, a debris hit) gives `mistakes: []` and `knowledgeStars` 3 and creates no card, no error note and no mastery change; the same round with exactly one Knowledge mistake creates exactly one of each; `stars` equals `knowledgeStars`. Claimed by the last first-wave game to merge; earlier games run their own part | `acceptance/games/scoring.journey.mjs` |
| AC-236 | **Progression persists:** XP and coins earned in a round equal the formulas above, appear in `player-xp` and `player-coins`, and are unchanged after a reload, after signing out and in, and in a second browser context; `player.xp` and `player.coins` equal the totals over `gameResult`s and `purchases` | `acceptance/games/player.journey.mjs` |
| AC-237 | **Deterministic shop** (its own task, after the playtests): buying an item from `packages/games/shop.json` deducts exactly its price and adds it to `cosmetics` or `gear`; buying it again or without enough coins is refused and changes nothing; the same purchases from the same start give the same `player` document | `acceptance/games/shop.journey.mjs` |
| AC-238 | **Gear changes play only** (its own task, after the playtests): for each first-wave gear item, the same scripted round with and without it gives the same `mistakes`, `knowledgeStars` and socket outcomes; the gear's Action parameter changes as §13.7 says; no gear adds a field or on-screen mark that reveals a correct answer | `acceptance/games/gear.journey.mjs` |

### 13.7 The first-wave games

For each game a **Knowledge socket** is a question the pack answers; a wrong answer is a Knowledge mistake
(`mistakes[]` gets `{ itemId, concept }`). A **Skill event** is timing, aim or movement; a failure is an
action miss (`actionMisses` + 1, Skill points lost, nothing in `mistakes[]`). Keys are unique within each game
and none clashes with the common keys. Every number below is the default of a Tuning name (§13.9); the table
wins.

#### 13.7.1 Syntax Drop (`syntax-drop`): front "Skyline", a rhythm game

**Story.** The City of Markup's skyline is drawn from blueprints the Glitch has shredded. The player is
apprenticed to the Typesetters' Guild; every completed template **rebuilds a building**, which rises in the
background and stays. Chapter boss: Null's Glitch Tower, where pieces fall to Null's music and decoys mimic
real syntax.

**Screen.** Left half is the game, right half the live preview (`game-preview`). The left half shows the
level's code template in large type with empty **slots** (`{{1}}`, `{{2}}` …). **Pieces** fall from the top
on the beat; each is a piece of syntax drawn at a size that matches its meaning where that helps (`<h1>`
large, `<small>` tiny).

**Modes.** **Fill:** move the falling piece to a slot and drop it as it crosses the line; the right piece in
the right slot locks in; a wrong piece is shown in the preview for `syntaxDrop.wrongPreviewMs` and then breaks
off. **Strike:** each piece kind has a digit key (shown on the piece and on a key strip); press it as the piece
crosses the line; decoys (`<h7>`, `colour:`) must be let through.

**Preview renderers** (each one file `packages/games/src/renderers/<name>.ts` exporting `render(code: string,
el: HTMLElement): void`; adding one does not change the game): `html` (`<iframe sandbox="" srcdoc>`, no
scripts); `chart` (a built-in SVG renderer for a matplotlib/seaborn subset: `plt.bar/plot/scatter/hist/pie`,
`title/xlabel/ylabel/legend`, `sns.barplot/histplot/scatterplot/lineplot`; drawn from the parsed calls, not
by running Python; `chart.ts` also exports the pure `chartSvg(code: string): string`, which runs in Node; marks
carry `data-mark`: bars and histogram bars `<rect data-mark="bar">`, scatter points `<circle
data-mark="point">`, lines `<path data-mark="line">`, pie wedges `<path data-mark="wedge">`, and `<text>` with
`data-mark` `title`, `xlabel`, `ylabel` or `legend`; `hist` uses `bins=` or 10); `console` (runs the code with
Snek and shows stdout); `pattern` (Snek stdout as a grid); `regex` (the pattern applied to sample text with
matches highlighted).

| Action | Key | Effect |
|---|---|---|
| `left`, `right` | ← or A, → or D | fill: move the falling piece to the previous or next open slot |
| `drop` (arg: slotId, optional) | ↓, S or Space | fill: drop the piece into the current slot (or `slotId`), judged at the press |
| `strike` (arg: key) | the digit 1 to 9 | strike: hit the lowest piece with that key that is inside its window |
| `power` (arg: powerId, optional) | E | use the oldest held power-up (or `powerId`) |
| `calibrate` | C | title or paused: start the tap-to-the-beat test |
| `tap` | T or Space | during calibration: tap on the beat |
| `offset` (arg: ms) | − or = (±10 ms) | title or paused: set `timingOffsetMs` directly |

- **Rhythm:** pieces spawn on beats; each has `hitAtMs`, the game time at which it crosses the line; `bpm` in
  stage n is base × `speed`^(n−1) (level field `speed`, default `syntaxDrop.speedPerStage`; the base beat is
  `syntaxDrop.baseBeatFactor` × `syntaxDrop.minBeatMs`), and beats are at least `syntaxDrop.minBeatMs` apart;
  the fall speed is tied to `bpm` (a piece is visible `syntaxDrop.fallBeats` beats before its `hitAtMs`; in
  fill mode pieces come `syntaxDrop.fillGapBeats` beats apart; with chance `syntaxDrop.restChance` one extra rest
  beat comes before the next piece). In strike mode, when the level has decoys,
  about `syntaxDrop.decoyShare` of a stage's pieces (at least 1, in stages of 4 pieces or more) are decoys. Timing grade = |press −
  `timingOffsetMs` − `hitAtMs`|: Perfect ≤ `syntaxDrop.windowPerfectMs`, Good ≤ `syntaxDrop.windowGoodMs`,
  Late ≤ `syntaxDrop.windowLateMs`; beyond is a miss. A strike stage has `piecesPerStage` pieces (level field,
  default `syntaxDrop.piecesPerStage`); a fill stage ends when every slot is filled.
- **Calibration:** `calibrate` sets `extra.calibration` = `{ beatsAtMs, taps, done }` and plays
  `syntaxDrop.calibrationBeats` beats at (i + 1) × `syntaxDrop.calibrationIntervalMs` of the calibration
  clock (moved by `advance`). After that many taps, or one interval after the last beat, the offset is the
  median of (tap − beat) over the taps made, rounded and clamped to ±`syntaxDrop.calibrationMaxOffsetMs`; it is
  saved to `player.timingOffsetMs` and `done` becomes true. `extra.timingOffsetMs` shows the offset in use. A
  positive offset means the learner hears the beat late. The offset applies only to graded presses (letting a
  decoy pass is not timed).
- **Knowledge sockets:** which slot a piece belongs in (fill); which key a piece has (strike); letting decoys
  pass (strike).
- **Knowledge mistakes** (each cracks the shield by `syntaxDrop.shieldCrack`): fill, a drop into a slot that
  does not accept the piece (`itemId` = pieceId, `concept` = that piece's concept; shown in the preview, then it
  breaks off); strike, striking a decoy inside its window (`itemId` = the decoy's pieceId); strike, a digit
  pressed while a non-decoy piece is inside its window and no piece with that key is (`itemId` = the in-window
  piece's id).
- **Action misses** (each chips the shield by `syntaxDrop.shieldChip`; Skill only, never a Knowledge mistake): a
  non-decoy piece reaches the line and passes its window without a press. In both modes that piece **comes
  back later in the round** (fill: its socket stays open; strike: it is queued again after the stage's
  remaining pieces, as an extra piece beyond `piecesPerStage`, and the strike stage ends only when no piece is
  left to fall), so its concept is still asked; a press with no piece inside
  any window; in fill mode, a correct slot with a miss grade.
- **Shield** (replaces lives): `syntaxDrop.shieldStart` at the start; 0 means `'lost'`.
- **Skill points:** Perfect, Good and Late give `syntaxDrop.pointsPerfect`, `pointsGood`, `pointsLate`.
- **Combo:** a correct Perfect or Good hit adds to the combo; anything else resets it. ×2 at `common.comboX2`,
  ×3 at `common.comboX3`. At `syntaxDrop.feverCombo`, **Fever** starts for `syntaxDrop.feverMs` of game time
  (points × `syntaxDrop.feverFactor` on top; the music layers in and the skyline lights up).
- **Power-ups:** one per `syntaxDrop.powerEveryCombo` combo, cycling `slowmo` (fall speed ×
  `syntaxDrop.slowmoFactor` for `syntaxDrop.slowmoMs`), `repair` (shield + `syntaxDrop.shieldRepair`), `echo`
  (the preview replays the last placed piece). They never answer a socket.
- **Progression:** after each stage a lesson card for the concepts just played (Ada, in character), then a
  **bonus round** where those pieces score double (`syntaxDrop.bonusShare` × `piecesPerStage` pieces, at least 2).
- **`extra`:** `{ scene, mode, bpm, shield, combo, timingOffsetMs, calibration, fever, powers, piece, pieces,
  slots, previewPiece, lastGrade, skyline }` where `fever` is `{ untilMs }` or null; `piece` is `{ uid, pieceId,
  over, hitAtMs }` or null; `pieces` is `[{ uid, pieceId, key, decoy, hitAtMs }]`; `slots` is `[{ id, filled
  }]` with `filled` the pieceId placed in that slot, or null while it is empty; `lastGrade` is `'perfect'`, `'good'`, `'late'`, `'miss'` or null; `skyline` counts buildings rebuilt in
  this pack.
- **Level fields:** `mode` (`fill` or `strike`), `renderer`, `template`, `slots: [{ id, accepts:[pieceId]
  }]`, `pieces: [{ id, text, size?, key?, concept, decoy? }]`, `stages`, `speed`, `piecesPerStage`.
- **Sample packs:** `html-headings` (strike), `css-flexbox` (fill; its level 1 boxes carry `class="box"`),
  `matplotlib-basics` (fill, chart), `python-print` (fill, console), `star-patterns` (fill, pattern),
  `regex-starter` (strike, regex).

| ID | Behaviour | Check |
|---|---|---|
| AC-217 | Fill mode: placing the right pieces completes the template and the preview shows the expected result (fixture `css-flexbox` level 1: its preview iframe has three `.box` elements with equal top, ±1 px, and increasing left); a wrong piece shows its effect in the preview, then breaks off, cracks the shield and is a Knowledge mistake | `acceptance/games/syntax-drop.journey.mjs` |
| AC-218 | Strike mode: the right key inside the piece's window destroys it and scores; letting a decoy through is correct and striking it cracks the shield and is a Knowledge mistake; `bpm` in stage 3 is ≥ 1.3× stage 1; the lesson card and bonus round appear between stages | `acceptance/games/syntax-drop-strike.journey.mjs` |
| AC-219 | The `chart` renderer's `chartSvg` draws the fixture calls (bar with 4 bars and a title, scatter with 10 points, a histogram) as SVG with those `data-mark` counts | `acceptance/games/renderers.test.mjs` |
| AC-239 | **Syntax Drop rhythm:** presses at 0, 100 and 180 ms and at half of `syntaxDrop.minBeatMs` off `hitAtMs` grade Perfect, Good, Late and miss (with the Tuning windows); with `timingOffsetMs` +80 a press 80 ms after `hitAtMs` grades Perfect; a calibration whose taps are all 60 ms late stores +60 in `player.timingOffsetMs`, and taps 400 ms late store the clamp, +150; an action miss chips the shield and a Knowledge mistake cracks it; shield 0 ends in `'lost'`; combo 10 starts Fever; each power-up step grants `slowmo`, then `repair`, then `echo` | `acceptance/games/syntax-drop-rhythm.journey.mjs` |
| AC-243 | **Manual playtest, Syntax Drop:** the owner plays 10 minutes from the task's worktree build and commits `acceptance/games/signoff/syntax-drop.json` saying "I wanted to keep playing" (D-63); until the file exists and is valid this row fails and blocks only its task | `acceptance/games/playtest.test.mjs` |

#### 13.7.2 Snippet Sniper (`sniper`): front "Ridgewatch", sniping

**Story.** A new ranger on the Ridge above Valley Town. Glitch beasts hide among the valley's creatures,
each carrying a scroll of corrupted code; the town's **bounty board** posts what each beast's scroll prints
("Bounty: the snippet that prints `[1, 4, 9]`"). Ranger Captain Rook trains the player; Null sends the
**Glitch Colossus** (boss), whose armor plates are scrolls, while the player calls shots for a squad pushing
up the valley.

| Action | Key | Effect |
|---|---|---|
| `target-prev`, `target-next` | Z, C | snap the crosshair to the previous or next target, in x order |
| `aim` (arg: targetId) | (pointer) | snap the crosshair to a target |
| `nudge` (arg: `{ dx, dy }`) | arrows or W A S D | move the crosshair one `sniper.nudgeStep` per press (does not move the clock) |
| `breathe` (arg: boolean) | Shift (hold) | hold breath: sway × `sniper.breathSwayFactor` while the breath meter lasts |
| `binoculars` | B | toggle binoculars: scrolls become readable, firing is blocked |
| `fire` | Space | shoot; uses 1 ammo |

- **Aim model** (deterministic in game time and seed; units are scene tiles): impact = crosshair + sway(t)
  + wind drift(distance) + drop(distance). `extra.aimError` is the vector from the impact to the aimed
  target's centre; a shot hits when its length ≤ the target's `radius` (every radius ≥
  `sniper.minTargetRadius`, at least 2 × `nudgeStep`); a shot at a target behind `cover` misses. Breath lasts
  `sniper.breathMs` and recovers at `sniper.breathRecoverPerSec`.
- **Knowledge socket:** which target to shoot (the snippet whose output matches the bounty or the callout).
  Outputs are computed by Snek at pack-check time (the pack stores snippets; the expected output is derived,
  so a pack cannot carry a wrong answer).
- **Knowledge mistake:** a hit on a target whose snippet does not match (`itemId` = that snippetId, `concept`
  = that snippet's concept); the miss lists the snippet's real output.
- **Action misses:** a shot that hits nothing, including a miss on the right target (ammo − 1, no mistake);
  the herd then scatters: every target hides behind cover for `sniper.scatterMs`.
- **Skill points:** a hit `sniper.pointsHit`; a clean hit (|aimError| ≤ radius ÷ `sniper.cleanHitDivisor`)
  adds `sniper.pointsClean`.
- **Ammo** per mission = bounties + `slack`; when a level has no `slack` it is `sniper.slackLevel1` to
  `slackLevel4` by level position (4th and later use `slackLevel4`). Running out of ammo with work left means
  `'lost'`.
- **Rank** = the sum of `gameResult.claimed` over the learner's results for the pack: Recruit 0, Marksman
  `sniper.rankMarksman`, Sharpshooter `sniper.rankSharpshooter`, Ghost `sniper.rankGhost`. Each rank-up plays
  a short scene.
- **Boss:** the level that has `plates` is locked (`data-locked`, deep link `game-unavailable`) below
  Sharpshooter. Callouts ("open the plate that prints 6") are answered in order; each right plate opens and
  the squad advances (`squadStep`). Plate targets have ids `plate-<n>`.
- **Gear** (Action only, built after the playtests): `scope-zoom` (zoom level), `stabilizer` (sway ×
  `sniper.stabilizerSwayFactor`), `suppressor` (scatter lasts `sniper.suppressorScatterMs`), `rangefinder`
  (shows each target's distance).
- **`extra`:** `{ scene, ammo, rank, claimed, binoculars, breath, breathing, wind, crosshair: { x, y }, aimed,
  aimError, scatterUntilMs, zoom, targets: [{ id, snippetId, x, y, distance, radius, cover }], bounties: [{
  snippetId, output, claimed }], lastShot: { targetId, hit, clean, output } or null, boss: { plates: [{ id,
  snippetId, open }], callout: { output } or null, squadStep } or null }`.
- **Level fields:** `bounties: [{ output?, snippetId }]`, `snippets: [{ id, code, concept }]`, `monsters`,
  `speed`, `slack`; boss: `plates: [{ snippetId }]`, `callouts`.
- **Sample packs:** `print-basics`, `lists-and-loops`, `strings`, `boss-recursion`.

| ID | Behaviour | Check |
|---|---|---|
| AC-227 | Hitting the target whose snippet prints the bounty output claims it; hitting a wrong target wastes one ammo, is a Knowledge mistake, and the miss lists the snippet's real output; missing every target uses one ammo with no mistake; ammo equals bounties + slack for the level; claimed bounties raise the rank (thresholds from §13.9) and Sharpshooter unlocks the boss; in the boss battle the right plate opens and the squad advances | `acceptance/games/sniper.journey.mjs` |
| AC-240 | **Sniper mechanics:** holding breath shrinks the sway in `aimError` for at most `sniper.breathMs`; wind and drop shift the impact with distance; a missed shot scatters the targets for `sniper.scatterMs`; firing is blocked while binoculars are up; a miss on the right target uses ammo with no mistake | `acceptance/games/sniper-mechanics.journey.mjs` |
| AC-244 | **Manual playtest, Snippet Sniper:** as AC-243, with `acceptance/games/signoff/sniper.json` | `acceptance/games/playtest.test.mjs` |

#### 13.7.3 Whack-a-Bug (`whack-a-bug`): front "Bugfield", arcade defense

**Story.** Farmer Mo grows programs as crops: each line is a crop row and the harvest is the program's
output. Glitch bugs burrow in and rot rows; the player defends the field with a mallet. At night the **Bug
Queen** (boss) sends armored bugs. The top shows **expected** and **actual** output side by side (the
**harvest sign**, which wilts while bugs live).

| Action | Key | Effect |
|---|---|---|
| `charge` (arg: line, 1-based) | hold the line's digit | start a swing at the critter on that line |
| `release` | let go of the digit | a tap if the hold was ≤ `whack.tapMaxMs`; a smash if it was within `whack.smashMinMs` to `whack.smashMaxMs`; otherwise a fizzle |
| `whack` (arg: line) | (pointer) | `charge` and `release` at 0 ms (a tap) |
| `undo` | U | restore the last flattened line (one token per round) |
| `xray` | V | use an X-ray goggles charge: glow on bug rows for `whack.xrayMs` |

- **Critters:** `{ id, hole, line or null, upAt, downAt, armored, golden }`; `downAt − upAt` equals the
  level's `upTimeMs`; fake-outs move a critter to another hole (`hole` changes, `line` stays); armored
  critters need a smash; `armored` is assigned by seed, independent of whether the row is buggy. Golden
  critters hold no line, are hit as line 0 (key 0, `act('whack', 0)`, `act-whack-0`), give `whack.goldenCoins`
  coins and are pure Skill.
- **Knowledge socket:** which row holds the bug.
- **Knowledge mistake:** a successful tap or smash on a critter holding a healthy row: the row is flattened
  (the line is deleted and the actual output changes); `itemId` = `bug:<index of the first unfixed bug>`,
  `concept` = that bug's concept.
- **Fixing a bug:** a successful hit on a critter holding a buggy row replaces the line with its fix.
- **Action misses:** the critter ducks before the hit; a hit on an empty hole; a tap on an armored critter
  (a "clank"); a fizzled release.
- **Hint:** on levels with `hint: 'color'` (Challenge, set by the trainer) bug-row critters always have
  `glow: true` and hits are judged normally; on `hint: 'none'` levels they glow only while X-ray goggles are
  active. A goggles charge is earned every `whack.xrayEveryCombo` combo; it is a power-up, not gear.
- **Assisted hits:** a hit on any critter while X-ray is active is *assisted*: on a buggy row it fixes the
  row and pays Skill but gives no Knowledge credit; on a healthy row it flattens the row but is not a
  mistake. Each assisted hit adds 1 to `extra.assisted` and `gameResult.assisted` and creates no card, error
  note or mastery check.
- **Skill points:** tap `whack.pointsTap`, smash `whack.pointsSmash`, golden `whack.pointsGolden`; combos as
  in Syntax Drop.
- `actual` is the current program's stdout; when the run fails it is stdout followed by one line
  `Error: <kind>`.
- **The round** is won when actual equals expected; it cannot be lost. Rot grows while bugs live and lowers
  Skill only. Waves (day and night) speed up the pop-up rate by stage; difficulty shortens `upTimeMs`, puts
  more critters up at once and two bugs in a program.
- **Gear** (Action only, built after the playtests): mallets `wide` (a tap also hits the neighbouring hole),
  `heavy` (smash window `whack.heavySmashMinMs` to `heavySmashMaxMs`), `quick` (tap up to
  `whack.quickTapMaxMs`); `scarecrow` (pop-up rate × `whack.scarecrowRateFactor`).
- **`extra`:** `{ scene, lines, expected, actual, critters: [{ id, hole, line, upAt, downAt, armored, golden,
  glow }], charging: { line, sinceMs } or null, undoLeft, xray: { charges, untilMs }, assisted, bugsLeft, rot,
  combo }` where `lines` holds `null` for flattened lines.
- **Level fields:** `program`, `bugs: [{ line, fix, concept, why }]`, `upTimeMs`, `hint` (`color` or
  `none`), `molesAtOnce`. Expected and actual outputs are computed with Snek from the fixed and buggy program.
- **Sample packs:** `off-by-one`, `loop-bugs`, `string-bugs`, `dsa-bugs`.

| ID | Behaviour | Check |
|---|---|---|
| AC-228 | Hitting the buggy line's critter replaces it with the fix and the actual output becomes the expected; hitting a healthy line's critter deletes it and the actual output changes; the undo token restores it once; on `hint: 'color'` levels bug-row critters have `glow: true`, and on `hint: 'none'` levels only while X-ray goggles are active; `downAt − upAt` equals `upTimeMs` | `acceptance/games/whack-a-bug.journey.mjs` |
| AC-241 | **Whack-a-Bug mechanics:** a tap hits a normal critter; an armored critter needs a smash and a tap clanks (action miss); a golden critter gives coins; a critter that ducks before the hit is an action miss; X-ray charges are earned every `whack.xrayEveryCombo` combo and show `glow` for `whack.xrayMs` on `hint: 'none'` levels; a hit while X-ray is active is assisted: it fixes the row, counts in `assisted`, and is neither correct nor a mistake | `acceptance/games/whack-a-bug-mechanics.journey.mjs` |
| AC-245 | **Manual playtest, Whack-a-Bug:** as AC-243, with `acceptance/games/signoff/whack-a-bug.json` | `acceptance/games/playtest.test.mjs` |

#### 13.7.4 Aftershock (`aftershock`): front "Faultline", an action platformer

**Story.** A quake has split Faultline City. The player is on the rescue team with pilot Kit, leading
trapped survivors to the helicopter on the roof. Slabs fall from collapsing buildings; each slab is one line
of code (plus decoy slabs). The right slabs in the right order and indent become a ramp; survivors follow
once a section is built. Null's aftershocks keep coming; the chapter boss is the **Collapse**, a tower falling
floor by floor while the player builds.

| Action | Key | Effect |
|---|---|---|
| `run` (arg: −1, 0 or 1) | ← or A, → or D (held) | run left, stop, or run right |
| `jump` | ↑, W or Space | jump (with the double-jump gear, again in mid-air) |
| `dash` | Shift | dash `aftershock.dashTiles` tiles (with the dash gear) |
| `grab` | E | pick up the slab within reach |
| `place` | ↓ or S | in the build zone: append the held slab to the bottom of the stack |
| `indent` (arg: 0 to 3) | 0, 1, 2, 3 | set the held slab's indent |
| `kick` | K | kick the held slab, or the slab within reach, away |

- **World:** positions are in tiles; `extra.player` = `{ x, y, vx, vy, onGround, health, carrying }`; x grows
  to the right and y is the height above the ground (a falling slab or debris has decreasing y). `grab` works
  on a slab with |slab.x − player.x| ≤ `aftershock.reachTiles` and slab.y ≤ `aftershock.jumpTiles`; `place`
  works while `buildZone.x0` ≤ player.x ≤ `buildZone.x1`. Run speed `aftershock.runTilesPerSec`, ×
  `aftershock.carryFactor` while carrying; jump height `aftershock.jumpTiles`. Debris falls on seeded paths;
  a hit costs `aftershock.debrisDamage` health (of `aftershock.health`); health 0 means `'lost'`. An aftershock
  (every `shockSec` of game time) stuns a player on the ground for `aftershock.stunMs`.
- **Correct place:** a stacked slab is in the right place when the stack up to and including it is a prefix
  of `lines`, or of any order in `altOrders`, with matching indents. Each aftershock knocks the topmost wrongly
  placed slab back into play.
- **Completion:** when the stack is as long as `lines`, the program runs with Snek against `tests` (so any
  correct order counts). A pass plays the scene `aftershock.escape` (skipped under `story=off`), then
  `'won'`; a fail sets `lastTest` and shows the failing test.
- **Knowledge sockets:** slab order, slab indent and rejecting decoys.
- **Knowledge mistakes:** a decoy placed on the stack (`itemId` = `decoy:<i>`); a slab knocked loose for a
  wrong place or indent (`itemId` = `line:<i>`, once per line per round); a finished stack that fails its
  tests (`itemId` = `test:<i>` of the first failing test). The concept is the decoy's or level's `concept`,
  falling back to the pack's first concept.
- **Action misses:** a debris hit, and a missed slab (it returns to play).
- **Skill points:** a placed slab `aftershock.pointsSlab`; a dodge streak `aftershock.dodgePoints` per
  `aftershock.dodgeEveryMs`; a rescue time bonus.
- **Gear** (Action only, built after the playtests): `double-jump`, `dash`, `boots` (×
  `aftershock.bootsCarryFactor` instead of `carryFactor` while carrying).
- **`extra`:** `{ scene, player, slabs: [{ uid, text, decoy, x, y, state }], debris: [{ id, x, y, vy }],
  stack: [{ uid, text, indent }], heldIndent, buildZone: { x0, x1 }, nextShockMs, lastTest: { passed, failing:
  { test, got } or null } or null, escaped, rescued }`, where a slab's `state` is `'falling'`, `'held'`,
  `'stacked'`, `'kicked'` or `'landed'`.
- **Level fields:** `lines: [{ text, indent }]`, `decoys: [{ text, why, concept? }]`, `tests`, `shockSec`,
  `fallSpeed`, `altOrders?` (arrays of indexes into `lines`), `entry?`, `concept?`.
- **Sample packs:** `loops-order`, `functions-order`, `dsa-order` (binary search, BFS).

| ID | Behaviour | Check |
|---|---|---|
| AC-229 | Grabbing and placing the fixture lines in a correct order with correct indents passes the tests and plays the escape; an alternative correct order (fixture) also passes; a wrong indent (not a prefix of `lines` or of any `altOrders`) is knocked off by the next aftershock (test clock) and is a Knowledge mistake; kicking a decoy away is scored; placing a decoy fails the tests and shows the failing test | `acceptance/games/aftershock.journey.mjs` |
| AC-242 | **Aftershock mechanics:** running, jumping and (with gear) double-jump and dash move the player as above; carrying slows running to `aftershock.carryFactor`; a debris hit costs health with no mistake, and health 0 ends in `'lost'`; a passing stack plays the escape scene | `acceptance/games/aftershock-mechanics.journey.mjs` |
| AC-246 | **Manual playtest, Aftershock:** as AC-243, with `acceptance/games/signoff/aftershock.json` | `acceptance/games/playtest.test.mjs` |

### 13.8 Later games (design kept; contract and rows before task g-7)

The play layer (§13.6) applies to these games too. Their acceptance ids are reserved: AC-202 (3D scene
cost), AC-220 and AC-221 (Maze Coder), AC-222 to AC-224 (Breakout), AC-225 and AC-226 (Seal the Beast),
AC-230 (Complexity Garage). The 3D/raid contract turns the behaviours below into rows, defines AC-202's
"checkpoint", adds `garage`'s seeded-RNG host hook, and moves AC-214's "maze with no path to the exit" case
into AC-214.

**Maze Coder (`maze-coder`).** A block-built maze diorama sits on a table (camera orbits with drag or Q/E;
zoom with wheel or +/−). A blocky character stands on the start tile. The learner writes Snek in the editor
on the right (beginners can use the block palette, which writes the same Snek) and presses **Run**. Host
functions: `move()`, `turn_left()`, `turn_right()`, `jump()`, `paint(color)`, `is_wall_ahead()`,
`is_on(color)`, `at_exit()`, `pick()`, `drop()`, `look()`; each call animates (via `step`) and the current
line is highlighted. **Pattern levels:** the floor shows a target pattern; painting it needs the same nested
loop that prints it, and a side panel shows the equivalent `print` output growing. **Stars:** 1 = reached the
exit or completed the pattern; 2 = within the step budget; 3 = within the line budget. Level fields: `map`
(ASCII rows: `#` wall, `.` floor, `S` start with `>`/`<`/`^`/`v` facing, `E` exit, `0`–`9` heights, `r g b`
colored tiles, `*` item, `~` water), `target`, `allowed`, `budget: { steps, lines }`, `starter`, `fog`.
Sample packs: `first-steps`, `star-patterns-3d`, `conditions`, `functions`, `search`. Reserved behaviours:
AC-220 (the fixture solution reaches the exit with 3 stars; extra steps give 2; walking into a wall stops on
that line with a message; an infinite loop is stopped without freezing the page) and AC-221 (a pattern level
completes only when the painted tiles equal the target; the side panel shows the matching output; the block
palette produces Snek that runs the same).

**Breakout (`breakout`).** A block-built prison walked in third person (WASD or arrows, mouse or drag to
look; a touch joystick). Cell blocks are chapters; each room's door is a **machine** that shows one data
structure working, and each escape is a function to write. Room flow: story; machine (the data structure as
a 3D mechanism: stack lock, queue guard line, binary-search dial, hash-map lockers, linked-list vent tunnel,
tree elevator shaft, graph corridor map, heap meal line, two-pointer laser grid, sliding-window patrol gap,
DP power grid); tutorial (operate the machine by hand); practice (unlimited time, hints); escape (write the
function under a countdown; each test is a lock; hints cost seconds; **full manual** mode gives no signature).
Rooms unlock on their pack `day`. Menu: codex, story or practice mode, settings. Machine types are plug-ins
`{ build(scene), apply(op), check(state) }`. Level fields: `concept`, `machine`, `story`, `tutorial: { start,
goal, ops }`, `practice: { prompt, signature, tests, hints }`, `escape: { prompt, signature, tests, timeSec,
hints: [{ text, costSec }] }`. Sample packs: `cell-block-a` (stack, queue, two pointers), `cell-block-b`
(binary search, hash map, sliding window), `cell-block-c` (linked list, tree, graph BFS, heap, DP). Reserved
behaviours: AC-222 (stack room end to end), AC-223 (escape locks, hint costs, countdown reset, full manual),
AC-224 (codex replays; future rooms locked with their unlock date).

**Seal the Beast (`raid`).** The trainer starts a raid for the class with a pack and a difficulty; the class's
teams (`class.teams`) play together against one beast. The projector screen (`/teach/raid/<raidId>/screen`)
shows the beast, the seal meter, the class's chances and each team's banner; phones (`/learn/raid`) show the
team's turn. Each round the beast casts a curse (a problem from the pack); every team votes on its phones on
3 or 4 candidate pieces of code, or writes in code that the hub runs with Snek against the curse's tests. The
team's choice is the most-voted option (ties → earliest vote). Each correct team adds a seal; the beast's
damage = base × (1 − seals ÷ sealsNeeded) is taken from the class's shared chances (easy 5, normal 3, hard 2).
Seal meter full → sealed; chances at 0 → escaped (retry). Only team results are public, never individual
votes. The hub is the authority: phones write `raidVote` docs; the hub's raid module resolves the round and
writes the `raid` doc. Level fields: `curses: [{ prompt, code?, options, tests?, concept }]`, `sealsNeeded`,
`turnSec`, `baseDamage`. Sample packs: `loops-beast` (options), `dsa-beast` (write-in). Reserved behaviours:
AC-225 (three teams of two, majority and tie rules, same result on projector and phones) and AC-226
(difficulty chances, sealed and escaped endings, write-in judged on the hub, no individual votes shown).

**Complexity Garage (`garage`).** Build a car from parts, each a programming choice: **engine** = the
algorithm (from the pack, or "Build your own" in Snek); **tyres** = the data structure (list, set, dict,
deque); **fuel tank** = the memory allowance in cells. **Race:** checkpoints at growing input sizes; each
car's time to a checkpoint is its Snek operation count for that n (D-45); a car whose `peakCells` exceeds its
tank runs out of fuel; past `opsCap` the count is projected (log-log fit) and shown as "projected".
Opponents: computer cars and classmate challenges (ghost race; the result is visible only to the two of
them). Results: the race chart (ops vs n, log scale), each car's complexity class, a lesson card. Level
fields: `task`, `engines: [{ id, name, code, concept }]`, `tyres?`, `sizes`, `inputGen`, `tank`, `opsCap`,
`opponents`. Sample packs: `sorting-grand-prix`, `search-sprint`, `lookup-rally`. Reserved behaviour: AC-230
(merge sort beats bubble sort with ops equal to Snek's counts; a failing learner engine may not race; out of
fuel; projected sizes; a challenge result is not visible to a third learner).

### 13.9 Tuning (`packages/games/src/tuning.ts`)

Every value below is exported by `packages/games/src/tuning.ts` as `TUNING['<name>']` (D-64). The acceptance
suite reads this table at run time. Names are fixed; values may be retuned by editing this table and
`tuning.ts` together. A unit test in `packages/games/test` also fails on any bare decimal literal or `r() <`
comparison in a game's `packages/games/src/games/<gameId>/model.ts` that does not come from `TUNING`, so a
feel number cannot stay outside this table.

| Name | Value | Meaning |
|---|---|---|
| `common.assistFactor` | 0.5 | game-clock speed with assist on |
| `common.knowledgePoints` | 100 | score per socket answered correctly |
| `common.starsTwoMaxMistakes` | 2 | most Knowledge mistakes for 2 stars |
| `common.comboX2` | 5 | combo for ×2 points |
| `common.comboX3` | 10 | combo for ×3 points |
| `common.xpSkillDivisor` | 10 | xp = round(skill / this) + … |
| `common.xpPerStar` | 20 | … + this × knowledgeStars |
| `common.coinsPerStar` | 5 | coins = this × knowledgeStars + … |
| `common.coinsSkillDivisor` | 100 | … + floor(skill / this) + golden coins |
| `story.sayNominalMs` | 4000 | nominal `say` length (length check; autoAdvance delay) |
| `story.prologueMinMs` | 60000 | prologue length, minimum |
| `story.prologueMaxMs` | 90000 | prologue length, maximum |
| `story.introMinMs` | 30000 | front intro length, minimum |
| `story.introMaxMs` | 45000 | front intro length, maximum |
| `story.chapterEndMinMs` | 15000 | chapter-end length, minimum |
| `story.chapterEndMaxMs` | 30000 | chapter-end length, maximum |
| `syntaxDrop.windowPerfectMs` | 50 | Perfect window (±) |
| `syntaxDrop.windowGoodMs` | 120 | Good window (±) |
| `syntaxDrop.windowLateMs` | 200 | Late window (±) |
| `syntaxDrop.pointsPerfect` | 30 | Skill points |
| `syntaxDrop.pointsGood` | 20 | Skill points |
| `syntaxDrop.pointsLate` | 10 | Skill points |
| `syntaxDrop.shieldStart` | 100 | shield at start |
| `syntaxDrop.shieldChip` | 10 | shield lost per action miss |
| `syntaxDrop.shieldCrack` | 25 | shield lost per Knowledge mistake |
| `syntaxDrop.shieldRepair` | 30 | shield restored by `repair` |
| `syntaxDrop.feverCombo` | 10 | combo that starts Fever |
| `syntaxDrop.feverMs` | 8000 | Fever length |
| `syntaxDrop.feverFactor` | 2 | Fever points factor |
| `syntaxDrop.powerEveryCombo` | 15 | a power-up per this many combo |
| `syntaxDrop.slowmoFactor` | 0.5 | fall-speed factor during slowmo |
| `syntaxDrop.slowmoMs` | 3000 | slowmo length |
| `syntaxDrop.speedPerStage` | 1.15 | default level `speed` |
| `syntaxDrop.minBeatMs` | 500 | shortest time between two beats (keeps a press at half of it outside both neighbours' windows) |
| `syntaxDrop.piecesPerStage` | 8 | default strike pieces per stage |
| `syntaxDrop.wrongPreviewMs` | 1500 | how long a wrong piece shows in the preview |
| `syntaxDrop.calibrationBeats` | 8 | beats in the calibration test |
| `syntaxDrop.calibrationIntervalMs` | 500 | time between calibration beats |
| `syntaxDrop.calibrationMaxOffsetMs` | 150 | offset clamp (±) |
| `syntaxDrop.baseBeatFactor` | 1.5 | stage 1's beat is this × `syntaxDrop.minBeatMs` |
| `syntaxDrop.fallBeats` | 3 | a piece is visible this many beats before its `hitAtMs` |
| `syntaxDrop.fillGapBeats` | 2 | fill: beats between two pieces |
| `syntaxDrop.bonusShare` | 0.5 | bonus round pieces as a share of `piecesPerStage` (at least 2) |
| `syntaxDrop.decoyShare` | 0.25 | strike: share of a stage's pieces that are decoys when the level has decoys |
| `syntaxDrop.restChance` | 0.25 | chance of one extra rest beat before the next piece |
| `sniper.breathMs` | 4000 | breath meter, full |
| `sniper.breathRecoverPerSec` | 0.5 | breath regained per second (s/s) |
| `sniper.breathSwayFactor` | 0.2 | sway factor while breathing |
| `sniper.stabilizerSwayFactor` | 0.6 | sway factor with the stabilizer |
| `sniper.scatterMs` | 3000 | targets hide after a miss |
| `sniper.suppressorScatterMs` | 1500 | the same with the suppressor |
| `sniper.cleanHitDivisor` | 3 | clean hit when error ≤ radius / this |
| `sniper.nudgeStep` | 1 | crosshair step per nudge (tiles) |
| `sniper.minTargetRadius` | 2 | smallest target radius (tiles) |
| `sniper.pointsHit` | 20 | Skill points |
| `sniper.pointsClean` | 10 | extra Skill points for a clean hit |
| `sniper.rankMarksman` | 3 | claimed bounties for Marksman |
| `sniper.rankSharpshooter` | 6 | claimed bounties for Sharpshooter (unlocks the boss) |
| `sniper.rankGhost` | 10 | claimed bounties for Ghost |
| `sniper.slackLevel1` | 3 | default slack, level position 1 |
| `sniper.slackLevel2` | 2 | default slack, level position 2 |
| `sniper.slackLevel3` | 1 | default slack, level position 3 |
| `sniper.slackLevel4` | 0 | default slack, level position 4 and later |
| `whack.tapMaxMs` | 200 | longest hold that is a tap |
| `whack.smashMinMs` | 600 | smash window, start |
| `whack.smashMaxMs` | 900 | smash window, end |
| `whack.heavySmashMinMs` | 500 | heavy mallet smash window, start |
| `whack.heavySmashMaxMs` | 1000 | heavy mallet smash window, end |
| `whack.quickTapMaxMs` | 300 | quick mallet tap limit |
| `whack.goldenCoins` | 10 | coins per golden critter |
| `whack.xrayEveryCombo` | 8 | an X-ray charge per this many combo |
| `whack.xrayMs` | 5000 | X-ray length |
| `whack.scarecrowRateFactor` | 0.8 | pop-up rate factor with the scarecrow |
| `whack.pointsTap` | 10 | Skill points |
| `whack.pointsSmash` | 25 | Skill points |
| `whack.pointsGolden` | 15 | Skill points |
| `whack.maxProgramLines` | 9 | longest program (pack check) |
| `aftershock.health` | 3 | health at start |
| `aftershock.debrisDamage` | 1 | health lost per debris hit |
| `aftershock.runTilesPerSec` | 6 | run speed |
| `aftershock.carryFactor` | 0.7 | run-speed factor while carrying |
| `aftershock.bootsCarryFactor` | 0.85 | the same with boots |
| `aftershock.jumpTiles` | 2 | jump height |
| `aftershock.dashTiles` | 3 | dash length |
| `aftershock.stunMs` | 500 | stun from an aftershock |
| `aftershock.pointsSlab` | 10 | Skill points per placed slab |
| `aftershock.dodgePoints` | 5 | Skill points per dodge streak |
| `aftershock.dodgeEveryMs` | 5000 | dodge streak length |
| `aftershock.reachTiles` | 1 | grab reach (horizontal) |

### 13.10 Build plan

Tasks (each a tins-kit task with its own worktree and scope). A row is claimed by the task that makes its
last part green. The cross-game rows (AC-200, AC-201, AC-203, AC-207, AC-214, AC-234, AC-235) are split in
the suite into a shared part plus one part per game; each game task makes its own part (and g-3 the shared
part) pass, checked with `scripts/rowcheck.mjs` (D-66), and the last first-wave game to merge claims the whole row.

| Task | Builds | Rows it claims | Depends on |
|---|---|---|---|
| g-0 | `scripts/rowcheck.mjs` (a builder runs one row's acceptance file without reading it) and the nine D-49 switch keys in core (AC-49) | (keeps AC-49 green) | (none) |
| g-1 | Snek interpreter, counting, sandbox | AC-208 to AC-213 | g-0 |
| g-2 | Engine, arcade shell, shared screens, test hooks, story system (scene player, `games check` for story files), `player` document with XP and coins, results, cards and mastery hooks, switches, pack schemas and pack check for the four first-wave games, content gate `G9-games`, `games new`, `tuning.ts` with its unit test, budgets tooling | AC-216 | g-0; uses g-1's API by interface; merges after g-1 |
| g-3 | **Vertical slice, in three phases (D-71):** A, screens, wording and the hub (AC-247 to AC-255); B, voice; C, art; then the owner's playtest. Syntax Drop complete (rhythm, calibration, renderers, its story) and the prologue; then the owner's playtest. Also makes the shared and Syntax Drop parts of AC-200, AC-203, AC-207, AC-214, AC-234 and AC-235 pass (checked per part with `scripts/rowcheck.mjs`). May fix engine defects it finds inside `packages/games`, logged as integration fixes in its journal | AC-204 to AC-206, AC-215, AC-217 to AC-219, AC-231 to AC-233, AC-236, AC-239, AC-243 | g-1, g-2 |
| g-6 | Snippet Sniper | AC-227, AC-240, AC-244 | g-3 and the owner's playtest |
| g-4 | Whack-a-Bug | AC-228, AC-241, AC-245 | g-3 and the owner's playtest |
| g-5 | Aftershock | AC-229, AC-242, AC-246 | g-3 and the owner's playtest |
| (last of g-4, g-5, g-6 to merge) | also the cross-game rows as a whole (each earlier game task makes its own part pass) | AC-200, AC-201, AC-203, AC-207, AC-214, AC-234, AC-235 | the other two |
| g-12 | Shop and gear | AC-237, AC-238 | g-4, g-5, g-6 |
| g-7 … g-11 | Voxel kit and Maze Coder (g-7), Complexity Garage (g-8), Breakout slice and rest (g-9, g-10), Seal the Beast (g-11) | after the 3D/raid contract (§13.8) | g-2 |

Order: g-0; g-1 and g-2 in parallel (gates and merges one at a time); g-3; the owner's playtest of Syntax
Drop; then g-6, g-4 and g-5 (sniper, whack-a-bug, aftershock); g-12 after their playtests. Each game's task
merges only after its playtest row is signed (D-63).

### 13.11 Test ids, sample packs for the performance rows, document shapes, seeds and error keywords

These entries are part of the contract, like Appendices C and E.

**Test ids (games).**

| Test id | Element | Used by |
|---|---|---|
| `game-tile-<gameId>` | Arcade tile; `data-last-score`, `data-stars` (own results only) | AC-204, AC-206 |
| `game-pack-<packId>`, `game-level-<levelId>` | Picker entries; a level has `data-locked="true"` when locked | AC-204, AC-215, AC-227 |
| `game-unavailable` | "not available" screen | AC-204, AC-215, AC-227 |
| `game-canvas` | The game's single `<canvas>` | AC-201, AC-203 |
| `game-preview` | Syntax Drop live preview (html: `<iframe sandbox="">`) | AC-217 |
| `lesson-card` | Lesson card overlay between stages | AC-218 |
| `pause-menu` | Pause menu | AC-207, AC-233 |
| `game-results`, `result-score`, `result-stars` (`data-stars`), `result-skill`, `result-knowledge`, `result-assisted` | Results screen (`result-assisted`: Whack-a-Bug) | AC-205, AC-235, AC-241 |
| `result-mistake-<n>` | One Knowledge mistake on the results screen | AC-205, AC-235 |
| `act-<action>`, `act-<action>-<arg>` | On-screen button for every action | AC-207, AC-233 |
| `mastery-skill-<skill>` | One row of `mastery-map`, `data-state` `mastered` or `not-yet` | AC-205, AC-235 |
| `wall-team-<teamId>` | One team on `celebration-wall`; its text includes the team's XP | AC-206 |
| `story-scene` | Container of the running scene; `data-scene-id` | AC-231 to AC-233 |
| `story-line` | The current `say` text | AC-233 |
| `story-replay`, `story-replay-<sceneId>` | "Story so far" list (arcade and pause menu) and its entries | AC-231, AC-233 |
| `avatar-choice` | Avatar creation panel in the prologue | AC-231 |
| `player-xp`, `player-coins` | XP and coin counters (arcade and shop) | AC-236, AC-237 |
| `calibration` | Syntax Drop calibration panel (`data-offset-ms` once done) | AC-239 |
| `shop-item-<id>`, `shop-buy-<id>` | Shop entry and its Buy button (`data-owned="true"` once owned) | AC-237, AC-238 |
| `code-editor` | Code editor (reserved for the later games) | (none yet) |
| `hub-rail` (`data-layout` `rail` or `tabs`), `hub-nav-<page>` | Hub navigation and its entries (`home`, `avatar`, `inventory`, `team`, `story`, `settings`) | AC-247 |
| `hub-topbar`, `player-avatar`, `hub-fullscreen`, `hub-alerts`, `hub-alert-<n>` | Hub top bar | AC-247, AC-252 |
| `hub-row-<rowId>` | A Home row: `continue`, `recommended`, `new`, `games` (`live` reserved) | AC-247, AC-248 |
| `hub-card-<gameId>-<packId>`, `hub-card-thumb`, `hub-card-unlock` | A card in a row (`data-stars`, `data-stars-max`, `data-levels-left`, or `data-locked="true"`) | AC-247 |
| `game-page-<gameId>`, `game-blurb`, `game-play`, `game-best`, `game-team-total`, `game-level-unlock-<levelId>`, `hub-back` | The game page | AC-249 |
| `inventory-item-<id>` | An owned cosmetic or gear item | AC-247 |
| `hub-nav-lms` | "Back to LMS" in the hub's rail and tab bar | AC-254 |
| `howto`, `howto-<n>` (`data-keys`), `howto-demo-<n>` | How to play on the title screen | AC-253 |

**Sample packs for the performance rows.** AC-201 uses the last level of these sample packs, with `story=off`
(after seeding the wins that open it, D-78); AC-203 opens level 1 of the suite's own packs: `syntax-drop/html-headings`, `whack-a-bug/dsa-bugs`, `aftershock/dsa-order` and
`sniper/boss-recursion` (unlocked by seeding sniper results).

**Document shapes (adds to Appendix E).**

| Database | Type | Fields |
|---|---|---|
| `person` | `gameResult` | `personId`, `classId`, `gameId`, `packId`, `levelId`: string; `score`: number; `stars`: 0 to 3 (equals `knowledgeStars`); `skill`: number; `knowledgeStars`: 0 to 3; `outcome`: `'won'` or `'lost'`; `xp`, `coins`: number; `claimed`: number (sniper); `assisted`: number (whack-a-bug); `mistakes[]`: `{ itemId, concept }` (Knowledge only); `assist`: boolean; `durationMs` (game time): number; `at`: number; `seed`: number |
| `person` | `player` (id `player:<personKey>`) | `xp`, `coins`: number (caches, §13.6); `cosmetics[]`, `gear[]`: string; `purchases[]`: `{ itemId, price, at }`; `seen`: `{ prologue: boolean, intro: { <gameId>: true }, scenes: { <sceneId>: true } }`; `avatar`: `{ look, color, nameTag }`; `timingOffsetMs`: number (default 0, within ±150); `settings`: `{ autoAdvance: boolean }` (default false) |
| `person` | `card` (game) | as v1, plus `concept`: string; `deck`: `"games"`; `sourceRef`: `"gameResult:<key>#<itemId>"` |
| `person` | `errorNote` (game) | `dayIndex` = pack `day`; `subtopic` = concept; `question` = the item's text; `given`; `correct` |
| `class` | `teamScore` | `teamId`: string; `xp`: number (the average `player.xp` over the team's current members, rounded). The hub recomputes it within 5 s of any `gameResult` or `player` write, including writes from `/__test/seed` |
| `class` | `class.switches` | may hold the D-49 keys |

**Seeds.** Game seeds live in `acceptance/fixtures/games/seeds/` and are posted as `/__test/seed { fixture:
'games/seeds/<name>.json' }`; the games fixture package is `acceptance/fixtures/games/package/` (the v1
package plus `track1/games/…`), so no v1 fixture changes. Seed files may carry `samplePacks` (D-59).

**Required error keywords (D-54).** A message is one sentence: no line break, at most 160 characters, ends
with `.`, `!` or `?`, and contains none of `undefined`, `null`, `NaN`, `[object` or a stack frame.

| Case | Kind | Keyword the message must contain |
|---|---|---|
| `if x > 1` without a colon | `SyntaxError` | `:` |
| `print(totl)` | `NameError` | `totl` |
| `[1, 2, 3][3]` | `IndexError` | `index` |
| a body line indented differently from its block | `IndentationError` | `indent` |
| `"age: " + 7` | `TypeError` | `+` |
| `while True: pass` with `maxOps` N | `TooManySteps` | N |
| unbounded recursion with `maxDepth` N | `TooDeep` | N |
| a list growing past `maxCells` N | `TooBig` | N |
| `open`, `import os`, `__import__`, `eval`, `exec`, `.__class__`, `.__globals__` | `NotAllowed` (or `SyntaxError` for `import os`) | the refused name |
| `assert 1 == 2, "nope"` | `AssertionError` | `nope` |
| pack missing `title` | check line | `title` |
| concept `HTML Headings` | check line | `HTML Headings` |
| aftershock lines fail their tests | check line | `test` |
| syntax-drop slot `s2` with no correct piece | check line | `s2` |
| level id `2` repeated | check line | `2` |
| beat `{ t: 'dance' }` | check line | `dance` |
| `say.key` `story.x.missing` not in `en.json` | check line | `story.x.missing` |
| `say.who` `ghost` not in any cast | check line | `ghost` |
| `sniper.json` without `chapter-end` | check line | `chapter-end` |
| an intro lasting 12 s | check line | `intro` |

### 13.12 Later (not in this build)

- Java subset front end for Snek (D-44); SQL renderer for Syntax Drop; game ideas 6 to 9 from the design
  discussion (conveyor factory, pointer train yard, type tower defense, git platformer), pending the
  trainer's notes.
- The trainer's per-class daily play cap and the concept-miss map (D-56), each with its own row.

---

## Appendix A. API details (part of the contract)

Routes, fields and formats that §5 does not spell out. Builders implement exactly these.

### Ids, seeds and sessions

- Ids are `<type>:<key>`. Route parameters, `/__test/login` `personId`, `enrolment.personId` and
  database names use the **key**: class `c1` is `class:c1` in `class-c1`; learner `l1` is `person:l1` with
  personal database `person-l1`.
- `POST /__test/seed { fixture }`: `fixture` is a path relative to `acceptance/fixtures`
  (e.g. `api/base.json`). The file is `{ "databases": { "<dbName>": [doc, ...] } }`; docs are written as
  given (`_id` = `id`). A `day` section may carry `body`: the section's plaintext, which the server serves
  only sealed (AC-68).
- `POST /__test/login { personId, roles }` works for any person id, seeded or not.
- Validation errors: `400 { error: { <field>: <message> } }` (SPEC §5).

### Routes not named in SPEC

| Route | Who | Request -> response |
|---|---|---|
| `GET /api/me` | any session | `{ personId, roles, minor, coachTrackers, tnc: { version, acceptedAt, needsAcceptance } }` |
| `GET /api/join/tnc` | no session | `{ version, text }` |
| `POST /api/join` | no session | `{ code, name?, rollNumber?, dob, tncVersion }` (name and roll number optional) -> 2xx + session cookie; body contains `already-enrolled` when the roll number is already enrolled in that class; reused code -> 4xx |
| `POST /api/classes/:id/join-codes` | trainer | -> `{ code }` (one-time) |
| `POST /api/admin/tnc` | admin | `{ version, text }` publishes a new T&C version |
| `POST /api/me/tnc` | any session | `{ version }` accepts it |
| `POST /api/pairing` | trainer | -> `{ code, qr }`; `qr` (string or object) holds the hub id, the current address and the fingerprint |
| `GET /api/pairing/fingerprint` | any session | body holds the CA's SHA-256 fingerprint as hex (colons allowed) |
| `POST /api/pairing/claim` | no session | `{ code, deviceId }` -> 2xx + device session; 4xx whose body says `used` / `expired` / `unknown` |
| `GET /api/devices`, `DELETE /api/devices/:deviceId` | trainer/admin | list contains device ids |
| `GET /api/classes/:id/attendance-code` | trainer | a 6-digit string field and a numeric seconds-left field (key containing `sec`, `left` or `remain`) |
| `GET /api/classes/:id/printed-code?day=N` | trainer | -> `{ code }` printed fallback |
| `POST /api/classes/:id/attendance` | learner | `{ code }`; writes an `attendance` doc (`method` `rotating` or `printed`, `verified`) |
| `POST /api/packages` | admin/trainer | body = ustar tar -> `{ id, status, checks: [{ id, pass, waived, detail }] }`; failing -> `status: 'draft'` |
| `POST /api/packages/:id/publish` | admin/trainer | 4xx for a draft with failing checks |
| `GET /api/classes/:id/days/:index` | learner | `{ sections: [{ id, graded, sealed, key? }] }`; `sealed` = base64 of `sealSection` output (IV prefixed); `key` = base64 raw AES key, present only once released |
| `POST /api/classes/:id/teleprompter` | trainer | `{ sectionId }` or `{ releaseAll: true }` |
| `POST /api/classes/:id/attempts` | learner | `{ itemId, mode, answers, timing: { hubStart, hubEnd, monotonicMs, deviceStart, deviceEnd }, aiUsage }` -> `{ id }`; stores an `attempt` doc with `seed`, `timing.flags` and an AI-usage summary string |
| `POST /api/classes/:id/attempts/:attemptId/grade` | trainer (sign-off; substitute 403) | `{ score, reason? }`; first call appends a ledger entry, later calls append a correction (`corrects`) |
| `POST /api/classes/:id/appeals` | learner | `{ attemptId, reason }`; after 7 days 4xx with `window-closed` |
| `GET /api/classes/:id/appeals` | trainer | list (or `{ appeals }`) of `{ attemptId, evidence: { seed, mode, events, rubricRows, unreadConfirmations } }` |
| `POST /api/classes/:id/integrity`, `GET ...?personId=` | learner / trainer | event `{ context: 'exam' | 'practice', kind, at }`; list (or `{ events }`) |
| `POST /api/me/device-key` | any session | `{ deviceId, publicJwk }` registers the device signing key used by AC-76 |
| `POST /api/import` | admin | body = the tar from `GET /api/export` |
| `POST /api/signout` | any session | ends the session and clears the cookie |
| `POST /api/passkeys/register/options`, `POST /api/passkeys/register` | any session | WebAuthn registration (attestation `none`, ES256); stores the credential's public key for the person |
| `POST /api/signin/passkey/options`, `POST /api/signin/passkey` | no session | WebAuthn assertion; verifies the signature against the stored key and the challenge, then creates a session |
| `POST /api/signin/google` | no session | exchanges a Google ID token for a session when Google sign-in is configured; otherwise `501 { error: { code: 'not-configured' } }` |

### Sync

- Old clients announce their schema with the request header `x-lms-schema: <n>`. Every `/db/*` request
  from a client more than 2 versions behind is refused with 4xx and a body containing `update-app`.
- The hub's merge pass (D-24) runs on its own within a few seconds of a conflicting write.
- Personal databases refuse `coachEntry` documents that carry plaintext fields (`kind`, `values`,
  `source`); an encrypted entry carries `enc: { iv, ct }` instead. A minor's personal database refuses every
  `coachEntry` with 403.

### Export

- The export tar has `manifest.json` (paths relative to the manifest's folder, sorted; the manifest does
  not list itself), CSV files whose names contain `roster`, `attendance` and `grade`, at least one `.md`,
  JSON files whose name or folder contains `ledger` and `event`, and a `board` file or folder.
- `GET /api/classes/:id/package?day=N` returns the `signPackage` container (§4.24) as raw bytes.

---

## Appendix B. Adapter and CLI surface (part of the contract)

Modules live in `packages/adapters/src/`. Every base URL is injectable, so no test touches a real
service. Times are ms since the epoch. "Reports" means the promise resolves to
`{ ok: false, reason, status? }` or rejects with an `Error`.
promise resolves to `{ ok: false, reason, status? }` or rejects with an `Error`; tests accept both.

### `github.ts` (AC-110, AC-111)

`createGithubAdapter({ apiUrl, graphqlUrl, token, org })` returns:

| Method | Calls (fake GitHub) | Result |
|---|---|---|
| `provisionLearner({ username, team, template, repo, projectTitle })` (`template` = `"owner/name"`) | `GET /users/:u`, `POST /orgs/:org/invitations` (`invitee_id`), `PUT /orgs/:org/teams/:team/memberships/:u`, `POST /repos/:tOwner/:tName/generate`, `PUT /repos/:org/:repo/branches/main/protection` (`allow_force_pushes: false`, `required_pull_request_reviews` set), GraphQL `createProjectV2` + `createProjectV2Field` with `dataType: ITERATION` | `{ repo: "org/repo", projectId }` |
| `openPullRequest({ repo, branch, title, body? })` | `GET .../git/ref/heads/main`, `POST .../git/refs`, `POST .../pulls` | `{ number }` |
| `mergePullRequest({ repo, number })` | `PUT .../pulls/:n/merge` | `{ ok: true }` or reports |
| `writeFile({ repo, branch, path, content })` | `PUT .../contents/:path` | `{ ok: true }` or reports |
| `personaToken({ installationId, batchEndsAt, now })` | `POST /app/installations/:id/access_tokens` | `{ token, expiresAt }`, `expiresAt <= batchEndsAt`; reports when `now >= batchEndsAt` |

It never calls an account-creation endpoint (`POST /admin/users` or similar).

### `forgejo.ts` (AC-112, AC-115)

`createForgejoAdapter({ apiUrl, token, org })` (`apiUrl` ends before `/api/v1`) has the same methods.
`provisionLearner({ username, email, team, template, repo })` first creates the Forgejo login
(`POST /api/v1/admin/users`, `must_change_password: true`) when `GET /api/v1/users/:u` is 404, then adds the
team member (`PUT /api/v1/teams/:id/members/:u`), generates the repo, and sets protection on `main`
(`POST .../branch_protections`). `personaToken({ username, batchEndsAt, now })` uses
`POST /api/v1/users/:u/tokens`. Plus:

- `installPushCheck({ repo, hookUrl })` registers the push-check hook: `POST /api/v1/repos/:o/:r/hooks`
  with `config.url = hookUrl`.
- `createPushCheck({ log })` returns `{ handler, setSecretScan(on, by) }`. `handler` is a Node
  `(req, res)` listener. It receives `POST { repository, pusher, files: [{ path, content }] }` and answers
  `200 { allowed: true }` or `200 { allowed: false, message }`. With `secretScan` on (the default) any
  file matching the tins-kit secret patterns is refused with a message that says to rotate the key and
  never repeats the key. `setSecretScan(false, by)` calls `log({ switch: 'secretScan', on: false, by, at })`.

### `backup.ts` (AC-113)

- `createS3Target({ endpoint, bucket, region, accessKeyId, secretAccessKey })`: path-style S3 (works for R2).
- `createDriveTarget({ apiUrl, accessToken, folderId })`: Drive v3 upload (`uploadType=media` or `multipart`) and `?alt=media` download.
- `createFolderTarget({ dir })`: USB stick or folder.
- `backup(target, { name, bytes, passphrase })` -> `{ ref }`: encrypts (D-26) **before** upload.
- `restore(target, { ref, passphrase })` -> `Uint8Array`: rejects with a wrong passphrase.

### `google.ts` (AC-114)

`createGoogleAdapter({ baseUrls: { meet, calendar, forms }, accessToken, switches })`. A missing switch
key is off (§4.27). A call whose switch is off rejects with an error naming the switch and makes no
request.

| Method | Switch | Calls |
|---|---|---|
| `createMeetLink({ title })` -> `{ url }` | `meetLinks` | `POST /v2/spaces` |
| `syncCalendar({ calendarId, events: [{ id, title, start, end, timezone }] })` -> `{ synced }` | `calendarSync` | `POST /calendar/v3/calendars/:id/events` |
| `exportQuiz({ title, questions: [{ text, choices, answerIndex }] })` -> `{ formId, responderUri, published: true }` | `googleForms` | `POST /v1/forms`, `POST /v1/forms/:id:batchUpdate`, `POST /v1/forms/:id:setPublishSettings` |

### `health.ts` (AC-117)

- `healthDigest({ now, backups: [{ target, lastSuccessAt }], syncLagMs, checks: [{ id, ok }] })` ->
  `{ status: 'green' | 'red', backups: [{ target, lastSuccessAt, stale }], syncLagMs, failedChecks: string[] }`.
  A backup older than 48 h (or never) is `stale` and makes `status` red.
- `runMorningChecklist({ now, online, checks: [{ id, kind: 'offline' | 'online', run, lastKnownAt? }] })` ->
  results `[{ id, kind, ok, ranAt, lastKnownAt }]`, offline checks first and run first. When `online` is
  false, online checks are not run: `ok: null`, `ranAt: null`, `lastKnownAt` as given.

### MCP on the hub (AC-116)

The hub serves MCP (Streamable HTTP, JSON-RPC 2.0) at `POST /mcp`, authenticated by the session cookie.
Write tools are named `grade_edit`, `post_message` and `repo_write` and have `annotations.readOnlyHint: false`;
every other tool has `readOnlyHint: true`. A write tool changes nothing and returns
`structuredContent: { status: 'pending', diff, pendingId }`.

### Load test CLI (AC-103)

`node packages/cli/src/main.ts loadtest --learners 200 --target <url>` runs against a hub in test mode
(it may use `/__test/*`). It exits 0 when the run passes, and its **last stdout line** is a JSON summary:

```json
{ "learners": 200, "requests": 1234, "within1sPct": 99.1, "p95Ms": 310,
  "quizAnswers": 200, "quizWindowMs": 4200, "lostWrites": 0, "pass": true }
```

---

## Appendix C. App details for journeys (part of the contract)

### Shell, routes and build

- The app shell root carries `data-testid="app-ready"`, visible once the shell is interactive
  (rendered and handlers attached); AC-100 times it.
- The web build output is `packages/web/dist`; the server serves it at `/` (SPA fallback to
  `index.html`).
- A join link is `<hub>/join/<code>`. A public certificate check is `/verify/<certId>` (valid or
  invalid).
- With `LMS_PSEUDO_LOCALE=1` (server environment; the server injects `<meta name="lms-pseudo-locale" content="1">` into `index.html`) the app shows every `en.json` string wrapped as `⟦…⟧`; user data and
  course content may be marked `translate="no"`.
- The practice forge's base URL comes from `LMS_FORGEJO_URL`.
- AC-97: the PDF's notebook ruling is drawn as vector lines (at least 15 evenly spaced,
  full-width horizontal lines on page 1). The board fork keeps Excalidraw's `toolbar-*` test ids
  and imports a dropped `.mmd` file.
- AC-101: the board chunk must not be requested by the page before the board is opened (a
  service worker may precache it in the background).
- AC-151: only the AI-off behaviour is tested automatically; AI-on is checked manually with a
  connected model.

### Test seeds

`/__test/seed { fixture }` loads `acceptance/fixtures/<fixture>`, a file shaped
`{ databases: { <dbName>: [docs] }, packages: [{ path, classId, publish }], joinCodes: [{ code, classId }] }`.
Seeds are additive. Seeds may contain these extra document types and fields: `checklist`,
`review` and `badge` documents; `class.teams`; `attempt.failing`, `attempt.publishedAt` and
`attempt.unreadConfirmations`; `shiftRun.scorePct`.

### Test ids beyond those named in §6

`<personId>` is the full id, e.g. `roster-person:l1`. `<n>` counts from 1, `<index>` from 0.

| Test id | Element | Used by |
|---|---|---|
| `app-ready` | App shell root; visible once the shell is interactive (rendered, handlers attached) | every journey, AC-100–102, smoke |
| `class-schedule`, `schedule-day-<index>` | Class schedule after publishing; one entry per class day | AC-80 |
| `gate-check-<checkId>` | One row per gate check inside `gate-report`, with `data-state="pass\|fail\|waived"` | AC-80 |
| `roster-<personId>` | A learner's row in the trainer's roster/attendance roll (text includes "verified" / "dropped" / "active") | AC-82, AC-152, AC-159 |
| `diag-q-<n>` | Question n (display order) of a diagnostic: radios or a text box | AC-84, AC-95 |
| `cards-due-count` | Number of cards due now (text contains the number) | AC-85, AC-89, AC-95 |
| `score-row-<rubricRowId>` | One row per rubric row inside `shift-score` | AC-86 |
| `standup-summary` | Stand-up summary; a blocked answer has `data-blocked="true"` (or is in `<mark>`) | AC-87 |
| `poker-result` | Result after `poker-reveal`: all cards, consensus or low/high voters asked to explain | AC-87 |
| `score-history` | A grade's history (original and corrected scores) | AC-88 |
| `doubt-list` | Doubt queue; each doubt is a `role=listitem` | AC-91 |
| `exit-tally` | Exit-ticket tally; each choice is a `role=listitem` ending with its count | AC-92 |
| `explain-covered`, `explain-missing`, `explain-misconceptions` | Explain-it-back feedback lists | AC-93 |
| `mastery-map` | Mastery map | AC-95 |
| `handover-pack` | Substitute's handover pack | AC-150 |
| `self-learn` | Self-learn (AI-delivered) player | AC-151 |
| `drop-confirm` | Drop confirmation dialog listing the `dropPlan` actions | AC-152 |
| `shift-timer` | Shift countdown showing the (accommodated) limit | AC-153 |
| `syllabus-draft`, `change-log` | Drafted syllabus; cohort change log with dates | AC-154 |
| `first-run` | First-run screen with the 4 choices | AC-155 |
| `home-<space>` (e.g. `home-learner`) | Home screen of a role space | AC-155 |
| `coach-plan` | Current coaching plan (shows its version) | AC-156 |
| `day-timeline` | Coach day timeline | AC-156 |
| `trainer-pack`, `package-library` | Per-day trainer pack; package library | AC-157 |
| `rehearsal-report` | Planned vs actual after a rehearsal | AC-158 |
| `learner-notes` | Trainer notes on a learner's profile | AC-159 |
| `digest`, `digest-<personId>` | Friday at-risk digest; one row per learner (level + reasons + `wa-<personId>`) | AC-160 |
| `lab-clusters` | Lab results grouped by failing checks; each cluster a `role=listitem` | AC-160 |
| `review-checklist`, `review-score` | Peer-review checklist; the review's score | AC-161 |
| `pair-timer` | Pair-programming swap timer | AC-161 |
| `portfolio-preview` | `<iframe>` previewing the generated portfolio | AC-162 |
| `incident-page` | Incident page with the acknowledge timer | AC-164 |
| `certificate-id` | Issued certificate id (12 Crockford characters) | AC-165 |
| `item-analysis`, `item-row-<itemId>` | Item analysis; a row has `data-flag="true"` when flagged | AC-166 |
| `misconception-suggestions` | Suggested misconceptions; each a `role=listitem` with Accept / Edit / Reject | AC-166 |
| `package-diff` | Changes between an uploaded package and the current one (days and questions) | AC-166 |
| `fire-drill`, `data-meter` | Fire-drill wizard; data meter | AC-167 |
| `heading-strike`, `celebration-wall` | Heading Strike round; team badges / merged-PR wall | AC-168 |
| `forge-exercise` | Practice-forge exercise, `data-state="todo\|done"` | AC-170 |

Also used, but not new:

- `toolbar-rectangle`, `toolbar-text`: upstream Excalidraw's own test ids; the board fork should keep them (AC-97).
- `setup-check` (SPEC): its items carry `data-state="pass\|fail"` (green/red) (AC-81).
- `section-<id>` (SPEC): rendered **only** for released sections; a locked section must not use this id (AC-83).
- `shot-confirm` (SPEC): treated as the confirmation panel holding the fields labelled "Calories" and "Protein" and a
  "Confirm" button (AC-94).

---

## Appendix D. Journey UI contract (part of the contract)

For each journey: the test ids it touches, the accessible names (regular expressions, matched
case-insensitively against roles, labels and button text) it uses to find controls, and the seed it
starts from. `*` marks ids listed in Appendix C. Seeds are synthetic files in
`acceptance/fixtures/journeys/` and `acceptance/fixtures/api/`; builders **may read
`acceptance/fixtures/`** (data only) to see document shapes.

### a11y.journey.mjs
AC-99 Accessibility basics and AC-123 externalised strings (SPEC §6, §8).
data-testids used: app-ready*
Screens checked: for each role space (admin, trainer, learner), the home screen and every same-origin link in
the app's navigation (<nav> or role="navigation"), up to 10 per role, opened by URL (SPA routes must be
deep-linkable). The journeys' main screens are reachable from this navigation.
AC-99 uses lib/a11y.mjs checkA11y (image alt, button/link names, form labels, 4.5:1 text contrast).
### accommodations.journey.mjs
AC-153 Accommodations (F-09) (SPEC §6.3, §4.26).
data-testids used: app-ready*, shift-timer*
Accessible names used: learner nav /settings|profile|accommodations?/; button /request (an )?accommodation/;
  field /extra time|time multiplier/ (1.5); field /reason/; button /submit|send|request/;
  admin nav /accommodations?|requests/; button /approve/; learner nav /shift/.
Fixture Shift is 60 min, so with 1.5x the timer shows a 90-minute limit ("90 min" or "1:30:00"/"1:30").
### admin-setup.journey.mjs
AC-80 Admin sets up a class (SPEC §6).
data-testids used: app-ready*, create-class, gate-report, gate-check-<checkId>* (data-state="pass|fail|waived"),
  class-schedule*, schedule-day-<index>*                       (* = not named in SPEC, see TESTIDS.md)
Accessible names used: fields labelled /program/, /cohort/, /class name/, /start date|first day/;
  file field labelled /package/; buttons /publish/.
Flow: admin signs in (org-only seed) -> fills program, cohort, class -> create-class -> uploads the fixture
### appeal.journey.mjs
AC-88 Appeal (SPEC §6, §4.11, AC-73).
data-testids used: app-ready*, appeal-open, appeal-evidence, score-history*
Accessible names used: nav /grades|results|scores/ (learner), /appeals|inbox/ (trainer); field /reason/;
  buttons /submit|send|appeal/, /uphold/, /confirm|save/; field /corrected score|new score/.
Seed "appeal": l1's day-0 quiz scored 5/8 with seed "seed-c1-l1-day0-quiz", mode live, published day 0 13:00.
### attendance.journey.mjs
AC-82 Attendance with the rotating code (SPEC §6, §4.5, AC-66).
data-testids used: app-ready*, attendance-code, attendance-input, roster-<personId>* (e.g. roster-person:l1)
Accessible names used: nav /attendance|check in/; submit button /submit|mark|check in|mark present/.
### audio.journey.mjs
AC-163 Audio quick-learn (B-10) (SPEC §6.3).
data-testids used: app-ready*
Accessible names used: learner nav /today|day 0/ then /quick.?learn/; button /play|listen|read aloud/;
  field /speed/ (select, slider or number) set to 1.5.
speechSynthesis is replaced by a recorder (init script) so the test does not depend on installed voices:
window.__spoken = [{ text, rate }].
### board.journey.mjs
AC-97 Board (SPEC §6, D-7, D-36).
data-testids used: app-ready*, board, board-export-pdf, toolbar-rectangle and toolbar-text (Excalidraw's own
  testids, kept by the fork; keyboard shortcuts R / T are the fallback)
Accessible names used: nav /board/; button /add page|new page/.
Checks:
- Drawing a rectangle, text, and dropping fixtures/journeys/flow.mmd each change the board's static canvas
### cards.journey.mjs
AC-85 Daily cards and error notebook (SPEC §6, §4.2).
data-testids used: app-ready*, card-show, rate-good, cards-due-count* (text contains the number due),
  error-notebook
Accessible names used: nav /cards|review|daily cards/, /error notebook|mistakes|my mistakes/.
Seed "cards": l1 has 3 due cards and day-0 error notes under subtopics "Commands" and "Folders".
### catchup.journey.mjs
AC-84 Catch-up gate for a learner who joined on day 3 (SPEC §6, §4.3).
data-testids used: app-ready*, gate-day-<n>, diag-q-<1..8>* (one per diagnostic question, display order)
Accessible names used: nav /catch.?up|today|my days/; buttons /start|take (the )?diagnostic/,
  /submit|check|finish/, /retry|try again/. Scores shown as "5/8" / "6/8".
The diagnostic is the fixture day-0 quick-learn's 8 questions (free-text answers, matched by text).
### coach-shot.journey.mjs
AC-94 Coach screenshot import (P-16) (SPEC §6, §4.18, D-11).
data-testids used: app-ready*, shot-upload, shot-confirm (the confirmation panel; it contains the fields
  labelled /calories/ and /protein/ and a button /confirm|save/)
Accessible names used: nav /coach/, /food|diet|import screenshot|screenshot/; Coach PIN field /pin/.
Fixture: fixtures/journeys/diet-screenshot.png (rendered text "Calories 1,850", "Protein 72.5 g");
seed "coach" has approved rules for it. OCR runs in the browser (tesseract.js, data from the hub).
### coach.journey.mjs
AC-156 Coach space (§7.0, §7.2, F-05) (SPEC §6.3).
data-testids used: app-ready*, coach-plan*, day-timeline*, section-<id>
Accessible names used: nav /coach/; Coach PIN field /pin/ (+ /confirm pin/); button /accept defaults/;
  nav /timeline|my day/; nav /today|day 0/.
Counts every tap from opening the Coach conversation to the plan (PIN entry excluded): <= 25.
### college.journey.mjs
AC-165 College outputs (D-1, D-2, D-3, 7.4) (SPEC §6.3, §4.33).
data-testids used: app-ready*, certificate-id* (text = the 12-char certificate id)
Accessible names used: admin nav /reports?|college reports/; download buttons/links /attendance sheet.*pdf/,
  /attendance sheet.*csv/, /completion report.*pdf/, /completion report.*csv/, /co.?po/; learner nav /feedback/,
  field /feedback|what went well/, button /submit|send/; trainer nav /feedback/; admin nav /certificates/,
  button /issue certificate/ for Lena, button /download( certificate)?( pdf)?/.
### content-improve.journey.mjs
AC-166 Content improvement (E-1, E-2, E-4) (SPEC §6.3, §4.21).
data-testids used: app-ready*, item-analysis*, item-row-<itemId>* (data-flag="true" when flagged),
  misconception-suggestions* (each suggestion a role=listitem with buttons /accept/, /edit/, /reject/),
  package-diff*
Accessible names used: trainer nav /item analysis|question quality|analytics/, /misconceptions/ (optional);
  upload field labelled /package/ on nav /library|packages/.
### corporate.journey.mjs
AC-164 Corporate practice in the Shift (C-4, C-5, C-8, C-9, C-11, C-12) (SPEC §6.3).
data-testids used: app-ready*, shift-start, incident-page*, sla-<ticketId>
Accessible names used:
  incident: nav /shift/; incident-page shows an acknowledge timer (m:ss) and button /acknowledge/.
  change request: nav /deploy|deployments/; button /deploy to prod/ (disabled or refused without an approved
    change request); button /new change request/; fields /summary|title/, /rollback/; button /submit/;
### digest.journey.mjs
AC-160 At-risk digest and mistake clusters (A-3, A-4) (SPEC §6.3, §4.20, §4.22).
data-testids used: app-ready*, digest*, digest-<personId>* (one row per learner), wa-<personId>, lab-clusters*
  (each cluster is a role=listitem)
Accessible names used: trainer nav /digest|at.?risk|friday digest/, /lab results|labs/; in a cluster: field /comment/,
  button /send|post|comment/; learner nav /lab|results|feedback/.
Seeds: late-joiner (l4: locked missed days -> watch), digest (l3: 50 overdue cards + last Shift 25% -> risk;
### doubts.journey.mjs
AC-91 Doubt queue (A-5) (SPEC §6).
data-testids used: app-ready*, doubt-list* (each doubt is a role=listitem inside it)
Accessible names used: nav /doubts|ask a doubt|questions/; field /your doubt|doubt|question/;
  checkbox /anonymous|post anonymously/; buttons /post|ask|submit/, /upvote|\+1|vote/.
### drop.journey.mjs
AC-152 Drop switch (F-03) (SPEC §6.3, §4.30).
data-testids used: app-ready*, roster-<personId>*, drop-confirm*, attendance-code
Accessible names used: trainer nav /roster|learners|class/; in roster-person:l2: button /drop/, later /undo|restore|re-?activate/;
  button /confirm|drop/ in drop-confirm.
Seed: l2 is in team-a and assigned ticket "Add a health endpoint".
### engagement.journey.mjs
AC-168 Engagement (G-1 to G-4) (SPEC §6.3, §4.27 headingStrike, teamBadges, celebrationWall, storyMode).
data-testids used: app-ready*, heading-strike*, celebration-wall*, section-<id>
Accessible names used: nav /heading strike/, button /start|play/, answer buttons inside heading-strike, result
  /round (over|complete)|score/; nav /wall|badges|celebration/; admin switches checkbox /story mode/.
Seed "portfolio" adds the team-a badge "First merged PR".
### exit-ticket.journey.mjs
AC-92 Exit ticket (B-1) (SPEC §6, §4.19).
data-testids used: app-ready*, exit-tally* (each choice is a role=listitem with its count)
Accessible names used: nav /exit ticket/; pre-generated choices are checkboxes; field /anything else|comment|in your words/;
  button /submit|send/.
### explain.journey.mjs
AC-93 Explain-it-back (B-3) with AI off (SPEC §6, §4.17).
data-testids used: app-ready*, explain-covered*, explain-missing*, explain-misconceptions*
Accessible names used: nav /explain/; field /explanation|explain/; button /check|submit/.
Seed "explain": day-0 checklist with concepts "Build output folder" (public folder | build output),
"Themes apply templates" (theme | template) and misconception "The build edits page sources"
(changes the pages folder | edits the sources). AI is off by default (switch explainBackAi off).
### export.journey.mjs
AC-98 Export my data (SPEC §6, AC-74 GET /api/me/export).
data-testids used: app-ready*
Accessible names used: nav /settings|my data|profile|privacy/; button or link /export my data|download my data/.
Seeds "appeal" + "cards": l1 and l2 both have attempts; l2 has a private error note.
The download is a tar (optionally gzip); every file is scanned: l1's records are present, no other
person's name, attempt or private text appears.
### files.journey.mjs
AC-96 File exchange (SPEC §6, AC-76).
data-testids used: app-ready*, pkg-download, pkg-import, section-<id>
Accessible names used: nav /packages?|files|file exchange/ (both); learner button /export submission|submission file/;
  trainer file field /import submission|submission file/; result text /accepted|imported/.
The phone-only learner (l3, enrolment profile "phone") is taken offline (context offline) before importing.
### first-run.journey.mjs
AC-155 First run (§17.4) (SPEC §6.3).
data-testids used: app-ready*, first-run*, home-learner*, tnc-accept, setup-check
Accessible names used: in first-run, four buttons /join a class/, /connect to a hub/, /hosted service/,
  /(this|on this) phone only/; fields /class code|join code/, /hub address/, /pairing code/;
  buttons /continue|join|connect|next/. Hosted path: a sign-in screen naming the hosted service (/sign in/).
Each path is its own test. The hub path pairs with a code from POST /api/pairing (AC-65) issued by the trainer.
### forge.journey.mjs
AC-170 Practice forge first (§20.1, D-34) (SPEC §6.3).
data-testids used: app-ready*, forge-exercise* (data-state="todo|done")
Accessible names used: learner nav /forge|repos|git/; inside forge-exercise text /practice forge|forgejo/ and a
  button /check|verify|i('ve)? done it/; nav /settings|profile|accounts/; field /github user(name)?/;
  button /link( github)?/; text /github pass/ and button /move (my )?practice repos/.
Completing the exercise needs a practice forge: the suite's fake Forgejo (fixtures/fakes, AC-112) is started by the
### google-optin.journey.mjs
AC-169 Calendar sync and Google Forms opt-in (A-12, 1.11) (SPEC §6.3, §4.27 calendarSync, googleForms).
data-testids used: app-ready*
Accessible names used: admin nav /settings|switches|features/, checkboxes/switches /calendar sync/, /google forms/;
  trainer controls /calendar/ (e.g. "Sync to calendar") and /google forms/ (e.g. "Export to Google Forms") on the
  schedule and quiz screens. Using the adapters against fakes is covered by acceptance/adapters/google.test.mjs (AC-114).
### learner-join.journey.mjs
AC-81 Learner joins (SPEC §6).
data-testids used: app-ready*, tnc-accept, setup-check, items inside setup-check carry data-state="pass|fail"*
Accessible names used: field /date of birth/; optional /full name|your name/, /roll/; buttons
  /continue|next|join|create account|create passkey|sign up/.
Join link format (SPEC gap G-3): <hub>/join/<code>. Passkey sign-up uses a CDP virtual authenticator.
### messages.journey.mjs
AC-90 Messages (A-2, A-3) (SPEC §6, §4.32).
data-testids used: app-ready*, wa-<personId> (e.g. wa-person:l2), copy-all
Accessible names used: nav /absentees|absent|messages|follow.?up/.
Seed "attendance-day0": only l1 attended day 0; l2 (9876500002) and l3 (9876500003) are absent.
### offline.journey.mjs
AC-95 Phone-only use after the first load (SPEC §6, D-5 installable offline app, D-6 sync).
data-testids used: app-ready*, section-<id>, card-show, rate-good, cards-due-count*, diag-q-<n>*, mastery-map*
Accessible names used: nav /today|day 0/, /cards|review/, /diagnostic|quick.?learn|quiz/, /mastery|progress/;
  buttons /start|take (the )?diagnostic/, /submit|check|finish/.
Steps: first load online (service worker installs) -> server stopped -> reload works from the service worker ->
released content, a card review, the diagnostic and the mastery map all work -> server restarted on the
### peer.journey.mjs
AC-161 Peer review and pair programming (B-5, B-4) (SPEC §6.3, §4.27 pairProgramming).
data-testids used: app-ready*, review-checklist*, review-score*, pair-timer*
Accessible names used: learner nav /reviews?|peer review/; checklist items are checkboxes; field /comment/;
  button /submit( review)?/; trainer nav /settings|switches|class settings/, checkbox /pair programming/;
  learner nav /lab/.
Seed "peer": l1 reviews l2's PR "Add an about page" with 3 checklist items. Teams: team-a = l1 + l2.
### portfolio.journey.mjs
AC-162 Portfolio (B-7) (SPEC §6.3).
data-testids used: app-ready*, portfolio-preview* (an <iframe> showing the generated site)
Accessible names used: learner nav /portfolio/; button /build my portfolio/.
Seed "portfolio": l1 has certificate 7KQ2M9X4TB1R and team-a has the badge "First merged PR".
### rehearsal.journey.mjs
AC-158 Rehearsal (A-9, A-10, E-3) (SPEC §6.3, §4.8).
data-testids used: app-ready*, teleprompter, tp-next, tp-pace, rehearsal-report*
Accessible names used: nav /rehears/; buttons /start rehearsal|rehearse/, /end|finish( rehearsal)?/;
  self-check list = checkboxes under a heading /self.?check/; text /freshness/ with a result /ok|pass|stale|fail|not checked/.
Time moves with the Playwright page clock (fastForward) so the actual section times differ from plan.
### rituals.journey.mjs
AC-87 Sprint rituals: stand-up, estimation poker, retro (SPEC §6, §4.15, §4.16).
data-testids used: app-ready*, poker-reveal, standup-summary*, poker-result*
Accessible names used: nav /stand.?up/, /poker|estimat/, /retro/; fields /yesterday/, /today/, /blockers?/,
  /retro item|went well|to improve|add item/; buttons with the card values "2", "3", "8" (exact names),
  /submit|post|send/, /start|estimate/, /make (a )?ticket|create ticket|to ticket/; nav /tickets|board|backlog/.
Votes {l1: 2, l2: 8, l3: 3} are a spread -> poker-result names Lena (low) and Liam (high) and asks them to explain.
### robustness.journey.mjs
AC-167 Robustness (F-1, F-2, F-3) (SPEC §6.3).
data-testids used: app-ready*, fire-drill*, data-meter*, cards-due-count*, card-show
Accessible names used: trainer nav /fire drill/, buttons /start( fire)? drill/, /next|continue/; result /passed|complete/;
  learner nav /settings/, checkbox /kiosk( mode)?/, checkbox /wi-?fi only downloads/; nav /coach/ must be absent in kiosk;
  kiosk sign-out after 30 min idle shows /sign in|signed out/; data meter text like "12 KB" / "1.2 MB";
  a download on a cellular connection (CDP connectionType cellular3g) is held with a /wi-?fi/ message.
### shift.journey.mjs
AC-86 Shift (SPEC §6, §4.10).
data-testids used: app-ready*, shift-start, sla-<ticketId>, shift-score, score-row-<rubricRowId>*
Accessible names used: nav /shift/; inside sla-<id>: buttons /acknowledge|ack/, /resolve/, field /answer|resolution/;
  button /end shift|finish shift|submit shift/.
Time travel: j.clock() sets the server clock (/__test/clock) and the page clock (Playwright clock) together.
Fixture pack shift-pack-1: T1 at 0 min (answer "missing build step"), T2 at 5 min, T3 at 20 min, T4 at 30 min.
### substitute.journey.mjs
AC-150 Substitute (F-01) and AC-151 AI-delivered session with AI off (SPEC §6.3).
data-testids used: app-ready*, handover-pack*, self-learn*, wrap-up, teleprompter
Accessible names used: trainer button /can.?t take day 1|cannot take day 1/; field /substitute/ (select, combobox
  or radio) with option "Sam Substitute"; option /self.?learn( mode)?/; buttons /confirm|save|send/;
  substitute nav /handover/, button /mark (as )?read/; nav /teleprompter/; trainer nav /reports?|delivery reports?/;
  learner nav /today|day 1/; self-learn button /next( section)?/; field /question|ask/; button /ask|send|submit/.
### syllabus.journey.mjs
AC-154 Verbal syllabus (§17.1) (SPEC §6.3).
data-testids used: app-ready*, syllabus-draft*, change-log*
Accessible names used: admin nav /syllabus/; field /topic notes|notes|topics/; button /draft( syllabus)?/;
  button or link /confirmation pdf|download pdf|pdf for (the )?college/; button /save|confirm/.
### teleprompter.journey.mjs
AC-83 Teleprompter release (SPEC §6, D-38, AC-68).
data-testids used: app-ready*, teleprompter, tp-next, tp-pace, section-<id> (rendered only once released)
Accessible names used: nav /teleprompter/ (trainer), /today|day 0|class/ (learner).
Section ids come from the fixture script (SPEC §4.8 slug rule): warm-up, concept-walkthrough, …
At 09:01 on day 0 only the first section is released (by time); tp-next reaches the second section.
### trainer-notes.journey.mjs
AC-159 Voice notes (A-7), typed in tests (SPEC §6.3).
data-testids used: app-ready*, roster-<personId>*, learner-notes*
Accessible names used: trainer nav /notes|voice notes|class notes/; field /learner/ (choose Lena Learner);
  field /note/; button /save|attach/; nav /roster|learners/; learner nav /profile|settings|my profile/.
### trainer-pack.journey.mjs
AC-157 Trainer pack and package library (A-11, E-5) (SPEC §6.3).
data-testids used: app-ready*, trainer-pack*, package-library*
Accessible names used: trainer nav /trainer pack|my pack|day pack|prep/; nav /library|package library|packages/.
### wrapup.journey.mjs
AC-89 Wrap-up (A-1) (SPEC §6).
data-testids used: app-ready*, wrap-up, attendance-input, cards-due-count*
Accessible names used: nav /teleprompter|today|class/ (trainer); /today|day 0/ (learner) with links
  /board.*pdf|board pdf/ and /quick.?learn/; nav /attendance|check in/; nav /reports?|delivery reports?/.
After one tap: learners get the board PDF and quick-learn links and day-0 cards; attendance is closed;
the trainer has a draft delivery report for day 0.

---

## Appendix E. Seed document shapes and seed files (part of the contract)

Field names and types found in the synthetic seeds (values omitted). Every document also has `id`,
`type`, `schema`, `updatedAt` and `updatedBy` (§3). Teams are `class.teams: { <teamId>: [personId] }`.

| Database | Type | Fields |
|---|---|---|
| `class` | `attempt` | `aiPolicy`: string, `aiUsage`: list, `answers[].correct`: boolean, `answers[].given`: null, `answers[].given`: string, `answers[].itemId`: string, `answers`: list, `answers`: object, `failing`: list, `itemId`: string, `max`: number, `mode`: string, `personId`: string, `publishedAt`: number, `score`: number, `seed`: string, `timing.durationMs`: number, `timing.flags`: list, `timing`: object, `unreadConfirmations`: number |
| `class` | `attendance` | `at`: number, `dayIndex`: number, `method`: string, `personId`: string, `verified`: boolean |
| `class` | `badge` | `at`: number, `name`: string, `teamId`: string |
| `class` | `checklist` | `concepts[].anyOf`: list, `concepts[].label`: string, `concepts`: list, `dayIndex`: number, `misconceptions[].anyOf`: list, `misconceptions[].label`: string, `misconceptions`: list |
| `class` | `class` | `cohortId`: string, `name`: string, `passMark`: number, `schedule[].date`: string, `schedule[].end`: string, `schedule[].start`: string, `schedule`: list, `seedSalt`: string, `switches`: object, `teams.team-a`: list, `teams.team-b`: list, `teams`: object, `trainerIds`: list |
| `class` | `day` | `date`: string, `index`: number, `released`: list, `sections[].body`: string, `sections[].graded`: boolean, `sections[].kind`: string, `sections[].plannedSec`: number, `sections[].title`: string, `sections`: list |
| `class` | `enrolment` | `joinedAt`: number, `personId`: string, `profile`: string, `status`: string |
| `class` | `review` | `author`: string, `checklist[].text`: string, `checklist`: list, `prRef`: string, `reviewer`: string, `title`: string |
| `class` | `shiftRun` | `finishedAt`: number, `packId`: string, `personIds`: list, `scorePct`: number, `seed`: string, `state.finished`: boolean, `state`: object, `teamId`: string |
| `class` | `ticket` | `assignee`: string, `iteration`: number, `points`: null, `points`: number, `status`: string, `title`: string |
| `org` | `certificate` | `certId`: string, `issuedAt`: number, `personId`: string, `programId`: string |
| `org` | `cohort` | `classIds`: list, `name`: string, `programId`: string |
| `org` | `org` | `brand.colours.primary`: string, `brand.colours.text`: string, `brand.colours`: object, `brand.logo`: null, `brand`: object, `name`: string, `switches`: object |
| `org` | `parseRules` | `app`: string, `approvedBy`: string, `author`: string, `fields[].anchor`: string, `fields[].name`: string, `fields[].pick`: string, `fields[].unit`: string, `fields`: list |
| `org` | `person` | `consent.at`: number, `consent.by`: string, `consent`: object, `dob`: string, `minor`: boolean, `name`: string, `phone`: string, `roles`: list |
| `org` | `program` | `name`: string, `packageRef`: null, `packageRef`: string, `switches`: object, `timezone`: string |
| `person` | `card` | `back`: string, `deck`: string, `front`: string, `fsrs.difficulty`: number, `fsrs.due`: number, `fsrs.elapsed_days`: number, `fsrs.lapses`: number, `fsrs.last_review`: null, `fsrs.learning_steps`: number, `fsrs.reps`: number, `fsrs.scheduled_days`: number, `fsrs.stability`: number, `fsrs.state`: number, `fsrs`: object, `sourceRef`: string |
| `person` | `errorNote` | `correct`: string, `dayIndex`: number, `given`: string, `question`: string, `subtopic`: string |

### Seed files (`/__test/seed { fixture }`)

| Fixture | What it sets up |
|---|---|
| `api/base.json` | Synthetic seed for the API tests (SPEC §5.9 /__test/seed). Ids are <type>:<key>; class and person keys are used in routes, sessions and database names (class-c1, person-l1). Section 'body' is the plaintext the server must serve sealed until release (AC-68). |
| `journeys/appeal.json` | Published day-0 quiz attempts: l1 scored 5/8 (seed "seed-c1-l1-day0-quiz"), l2 scored 7/8; l2 also has a private error note. Clock: day 1. |
| `journeys/attendance-day0.json` | Only l1 attended day 0 (l2 and l3 are absent). |
| `journeys/base.json` | Org, staff, learners l1-l4 (l1-l3 enrolled) in class c1 (4 days from Mon 2 Nov 2026, 09:00-13:00 IST, teams team-a/team-b), the fixture package (3 days) published to c1, two join codes. Day 3 is a class day with no package content. Also: packages, joinCodes. |
| `journeys/cards.json` | Learner l1 has 3 cards due before day 0 and 2 error-notebook entries for day 0 (subtopics Commands, Folders). |
| `journeys/coach.json` | Approved screenshot parsing rules for the synthetic diet app (SPEC §4.18); matches fixtures/journeys/diet-screenshot.png. |
| `journeys/digest.json` | Friday digest data: l3 has 50 overdue cards and a last Shift score of 25%; day-1 lab submissions with failing checks (l1 and l2 share the cluster [check-port, check-readme]). Use with late-joiner (l4 has locked missed days). |
| `journeys/explain.json` | Offline concept checklist for day 0 explain-it-back (SPEC §4.17). |
| `journeys/items.json` | 12 synthetic learners answered the day-0 diagnostic; item day0:diag:8 is answered correctly by everyone (planted weak question); on item 4 the wrong answer "kettle make" repeats. |
| `journeys/late-joiner.json` | Learner l4 joins class c1 on day 3 (missed days 0-2); l1-l3 attended days 0-2. |
| `journeys/org-only.json` | Org with staff only; no program, cohort or class (AC-80 creates them). |
| `journeys/peer.json` | Learner l1 is assigned to review the PR of l2 with a checklist. |
| `journeys/portfolio.json` | Learner l1 has a certificate and team-a has a badge. |

### People in `journeys/base.json` (ids and roles only)

| Person id | Roles | Minor |
|---|---|---|
| `person:admin1` | admin | False |
| `person:tr1` | trainer | False |
| `person:sub1` | substitute | False |
| `person:coord1` | coordinator | False |
| `person:l1` | learner | False |
| `person:l2` | learner | False |
| `person:l3` | learner | False |
| `person:l4` | learner | False |

Class `class:c1`: 4 scheduled days, pass mark 6, teams team-a, team-b.
