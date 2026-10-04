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
| D-11 | Screen text recognition (P-16, screenshot import): `tesseract.js` 7.0.0 in the web app, with the English data loaded from the hub (never a third-party CDN at runtime) | locked | DEC-70 |
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
| D-40 | The acceptance suite lives in the public repo `tins-lms-tests`. Builders work from this SPEC and the visible smoke subset (`acceptance/smoke/`) only; reading the rest of the suite during the build experiment voids that run's score | locked | Owner, iteration 16 |

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
| AC-7 | A learner who joined on day 3 (missed days 0–2) has `nextGate` = day 0; passing day 1's diagnostic before day 0's does **not** unlock day 1; after day 0 passes, `nextGate` = day 1 | `acceptance/core/catchup.test.mjs` |
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
async sectionKey(dayKey: Uint8Array, sectionIndex: number): Promise<Uint8Array> // HKDF-SHA-256, 32 bytes, info "section:<index>"
async sealSection(key: Uint8Array, plaintext: Uint8Array): Promise<Uint8Array>  // AES-GCM, IV prefixed
async openSection(key: Uint8Array, sealed: Uint8Array): Promise<Uint8Array>     // throws on wrong key or tampering
releasePlan(classStart: number, sections: readonly { id: string; plannedSec: number; graded: boolean }[]):
  { id: string; at: number | null }[]          // at = start + sum of earlier plannedSec; null when graded
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
(if any). `parseScriptSections` reads `## <title> (h:mm — h:mm)` headings (em dash, en dash or
hyphen) from an instructor script and returns their planned durations; ids are slugs of the titles (lowercase, non-alphanumerics → `-`, trimmed). A heading
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

`atMs` and `elapsedMs` are **monotonic milliseconds since the shift started** (D-27). Ticket
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
true if the statuses differed. Arrays of objects with `id` (e.g. `history`, `votes`): union by `id`.
`class`-owned fields (`schedule`, `passMark`, `switches`) are taken only from revisions whose
`updatedBy` starts with `hub:`.

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
votes are the same card or neighbouring cards; the points are then the higher of the two most
common values (ties → higher). Otherwise `discuss`, naming the lowest and highest voters.

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
sign (`₹`, `Rs`, `$`) is ignored.

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
recoveryWords(entropy: Uint8Array): string[]               // 32 bytes -> 24 words from the 256-word list in core
wordsToEntropy(words: readonly string[]): Uint8Array        // throws on an unknown word or wrong count
async wrapPersonKey(personKey: Uint8Array, wrappingKey: Uint8Array): Promise<Uint8Array>
async unwrapPersonKey(wrapped: Uint8Array, wrappingKey: Uint8Array): Promise<Uint8Array>
shred(keyring: Record<string, Uint8Array>, personId: string): Record<string, Uint8Array> // removes that person's wrapped key
```

| ID | Behaviour | Check |
|---|---|---|
| AC-45 | 32 bytes → 24 words → the same 32 bytes; the word list has 256 unique lowercase words; a misspelt word throws | `acceptance/core/keys.test.mjs` |
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
| AC-49 | `switchDefaults` returns exactly the table above; precedence is class > program > org > default; an unknown name throws | `acceptance/core/switches.test.mjs` |

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

`files` maps relative paths to text. The importer accepts both skill-template layouts: day
companions inside `day{N}/` (v1.2) **or** in the track root (v1.1, as in the owner's package5). A
day needs `quicklearn.md`, `deepdive.md`, `instructor_script.md`, `printable_handout.md` and a
student guide; whiteboard, live-coding and memory-recall companions are optional.

| Check id | Rule |
|---|---|
| `G1-files` | Each day has the required files |
| `G2-readme` | Each README's file table lists exactly the files that exist in its folder (no drift) |
| `G3-diagnostic` | Each quick-learn has an "8-question diagnostic" with 8 numbered questions and an answer key with 8 numbered answers |
| `G4-script-times` | The instructor script has timed sections, and their total is within ±10% of the script's own "Total runtime" line (`scriptTotalSec`) |
| `G5-links` | No relative Markdown link points to a missing file |
| `G6-code-lang` | Every fenced code block has a language tag |
| `G7-graded` | Every graded item (Shift pack, exam bank) parses and has an answer key or checks |
| `G8-cards` | Memory-recall files (if present) parse into cards: each `## Exercise N — <title>` section is one card; front = title + the `**What to do:**` paragraph, back = everything from the `**The answer` line to the next exercise. An exercise without both parts fails |

A failing check can be waived only with a reason, by a named person, until a set expiry (max 7
days). `G7-graded` can **never** be waived. Offline, link checks to the internet are warnings
(they are not part of G5).

| ID | Behaviour | Check |
|---|---|---|
| AC-51 | The fixture package (v1.2 layout) passes all checks; the same package rearranged into the v1.1 layout also imports with the same days | `acceptance/core/gate.test.mjs` |
| AC-52 | Each planted defect fails exactly its check: missing file (G1), README listing a removed file (G2), 7 diagnostic questions (G3), script total 50% of the slot (G4), broken link (G5), unlabelled code block (G6), Shift pack without checks (G7), card without back (G8) | `acceptance/core/gate.test.mjs` |
| AC-53 | A waiver turns a failed G1–G6/G8 check into `waived` until it expires; a waiver for G7 is ignored; an expired waiver is ignored | `acceptance/core/gate.test.mjs` |
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
Grades and certificates: pseudonymise 3 years after `batchEndedAt`, never delete.

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
| AC-62 | Every `/api/*` route except health, join and sign-in returns `401` without a session; a learner gets `403` on trainer and admin routes; a substitute gets `403` on grade sign-off and syllabus edits (D-30) | `acceptance/api/roles.test.mjs` |
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
| AC-70 | Two clients editing the same ticket offline, then syncing, both end with the core-merged revision (§4.13); no conflicts remain after the server's merge pass | `acceptance/api/sync.test.mjs` |
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
| AC-120 | No log line (server stdout/stderr during the full suite) contains a value the suite planted as a secret | `acceptance/api/secrets.test.mjs` |
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
