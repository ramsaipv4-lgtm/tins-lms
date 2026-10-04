# Coach LMS — Plan v13 (consolidated)

Companion: [`SIMULATED-RUN.md`](SIMULATED-RUN.md) walks one syllabus, one college, one student and one capstone end to end; its Part G is the input for OQ-1.

Status: **DRAFT for owner review.** Comment on any section (quote its ID). The whole file is replaced
by the next version; the changelog at the bottom says what moved.

Nothing here is built yet. After approval this plan becomes `SPEC.md` (numbered D-n decisions and
AC-n acceptance rows) plus a hidden acceptance suite, and is then built with tins-kit by Haiku and
Sonnet (§14).

IDs used: `P-n` principle · `DEC-n` decision already taken with the owner · `M-n` module ·
`OQ-n` open question · resources by their number in §12.

---

## 1. The product in one paragraph

A **coach** for one person's whole life that is also a **bootcamp platform** for an academy.
Every account holder gets:

- a **personal operating system**: an hour-by-hour plan built from their goals, and trackers for
  tasks, money, food and relationships;
- a **learning arc** that serves those goals;
- **realistic enterprise practice**: tickets under time pressure (the *Shift*), a team chat (the
  *Commons*), and AI teammates when no humans are around.

The AI is optional and layered: a small model that runs on the device, and a strong model the user
connects themselves over MCP. **AI proposes; people decide.** Everything works offline on the phone;
a small hub server adds classes, chat and sync.

## 2. Principles (locked unless the owner changes them)

| ID | Principle |
|---|---|
| P-1 | **Local-first.** The phone holds the account holder's data and runs the core logic offline. The hub is optional. |
| P-2 | **AI proposes, people decide.** No AI action (plan edit, ticket close, grade, post) takes effect without a person accepting it. |
| P-3 | **Works with no AI at all.** Every AI feature has a rule-based or scripted fallback. |
| P-4 | **No AI keys stored on the server.** Strong models connect from the user's side over MCP. |
| P-5 | **Personal data stays personal.** Trainers and admins never see money, food, plan, notes or relationship logs unless the learner explicitly shares a specific item. |
| P-6 | **Deterministic core.** Planner, scheduler, exam papers and Shift scenarios are reproducible from their inputs (seeds), so they are fair to a cohort and testable. |
| P-7 | **Study material is always the latest; graded work is pinned.** Exams and graded Shifts stay fixed to what a cohort was taught (taken from exam-forge). |
| P-8 | **Observe, never accuse.** Integrity monitoring records events; it never declares cheating (exam-forge D4–D6). |
| P-9 | **One validated content format, one validator that fails loudly** (exam-forge D1–D3). |
| P-10 | **Corrections are new entries.** Money, grades and attempts are append-only ledgers; nothing is silently edited. |
| P-11 | **Markdown is the content interchange format.** Every teacher upload (PDF, PPTX, DOCX, XLSX, HTML) is converted to Markdown before it enters the content pipeline; the original file is kept alongside. |
| P-13 | **Nothing is mandatory except the core.** Every external dependency has a primary, at least one **sidegrade** (equal capability, different provider) and a **last resort** (reduced capability that still lets the class run). The hub detects what is available at start-up, picks automatically, shows what it picked, and lets the admin override (§4.4). |
| P-14 | **Every feature beyond the core is a switch.** Programs and batches turn features on or off (certificates, graded Shifts, leaderboards, Commons, story mode, AI levels, check-in). A switched-off feature leaves no gap, only an alternative or nothing. |
| P-15 | **Backup and sync are required, not optional.** Personal and class data are always synced to at least one other place and backed up (encrypted) to at least one target; restore is tested. |
| P-12 | **Agree before acting.** Coaching conversations follow the 4-stage framework (§7.0): confirm the goal, surface constraints and risks, propose a pathway, then produce a versioned, agreed plan. |

## 3. Cast used in the walkthroughs

- **Priya**: admin of *Northstar Academy*.
- **Meera**: trainer, runs the "DevOps evenings, Batch 7".
- **Arjun Rao**: learner, 24, Hyderabad, junior web developer.
- **Kabir** and **Sana**: Arjun's teammates.

---

## 4. Architecture

```
 Phone (companion app, native via Cactus)      Browser (installable web app)
 ┌──────────────────────────────────┐          ┌──────────────────────────────────┐
 │ core logic (shared JS modules)   │          │ same core logic                  │
 │ local store + event log          │◄─sync──► │ local store + event log          │
 │ System 1: Needle on Cactus       │          │ System 1: Needle via needle-rs   │
 │ Decide/guard: Laya (if it fits)  │          │ Decide/guard: Laya (laya-ts)     │
 └──────────────┬───────────────────┘          └──────────────┬───────────────────┘
                └──────────────► Hub (optional, LAN or cloud) ◄┘
                    classes · Commons · live quiz · Shift hosting · sync · backups relay
                    MCP server  ◄── Claude Code / any harness (System 2, user's own key)
                    floci (local AWS emulator) for labs and Shifts
```

**Core logic is written once** as plain modules shared by phone, browser and hub:

- the planner;
- the Anki scheduler;
- the money ledger;
- calorie maths;
- exam assembly;
- the Shift engine;
- the graph linker.

**Sync.** Every change is an event carrying a device id. Devices merge by combining events.

- Ledgers (money, food, grades) merge without conflict because they are append-only.
- Profile fields use "latest wins", and the history is kept.

**Backup.** An encrypted bundle (passphrase set on the device) is pushed to the user's own
**private** data repository, or exported to a file. A fork of the *code* is optional and only needed
for customising the app.

### 4.1 The AI stack

| Layer | Phone | Browser | Power user | No AI (fallback, P-3) |
|---|---|---|---|---|
| **Decide / route / guard** (choice, score, yes-no) | Laya, if it fits the device | **Laya** (`laya-ts`, WebGPU → WASM) | Laya MCP server | Rules |
| **Act** (tool calls, extraction) | **Needle** on Cactus | **Needle via needle-rs** (≈560 KB runtime + 13.7 MB Needle 2 / 35.3 MB Needle 3) | — | Rule-based parser ("₹120 chai" → expense) |
| **Think** (plans, content, review) | — | — | **Claude** or any harness over MCP | Templates |
| **Automate** | — | **Node-RED** flows, with Laya making decisions inside them | UiPath via MCP (optional) | Scheduled rules |
| **Visualise** | Node-graph component (Treelab-style) | same | — | — |
| **Convert content** | — | — | **MarkItDown** on the hub (Python) | Upload stays as an attachment; trainer pastes text |
| **Draw** | Notebook board (view, annotate) | **Notebook board** (modified Excalidraw, §6.4) | — | — |
| **Trace code** | — | Trace viewer (pyviz_tutor output) | **pyviz_tutor** on the hub / desktop | Static trace table drawn on the board |

All AI reaches the app through **one tool layer** (`get_plan`, `propose_plan_edit`, `add_expense`,
`log_meal`, `cards_due`, `review_card`, `assign_ticket`, `post_message`, `search_graph`, …) and
**one decision interface** (`choice`, `score`, `yes_no`).

Swapping rules for Needle or Laya changes no other code. Hidden tests run against the rule-based
implementations.

### 4.3 Storage, hosting and devices (iteration 9)

| Thing | Where | Notes |
|---|---|---|
| **Content catalog: text** (Markdown, banks, scenario packs) | **Git repo on self-hosted Forgejo** | Versioned, reviewable, pinned releases (P-7). GitHub/GitLab adapters later |
| **Content catalog: large files** (slides, videos, PDFs) | **Pluggable file storage**; default adapter **Google Drive**; alternatives S3-compatible (self-hosted MinIO/Garage or a cloud bucket) | Drive is not versioned like git and has quotas (15 GB free, then paid) and API rate limits, so a second store may be needed as content grows |
| **Missing content** | Generated by the user's connected AI over MCP with the skill template → draft → content gate | Never published without passing the gate |
| **Code forge** | **Forgejo**, self-hosted next to the hub. GPLv3+ since Aug 2024; running it as a service creates no obligations for our code; includes GitHub-Actions-compatible CI | Learner lab repos, bot accounts for AI teammates, pulse-wall exercise offline |
| **Labs** | **Docker or Podman** containers, one image per day; Azure emulators: **Azurite** (Blob/Queue/Table; no Files or Data Lake), Cosmos DB emulator, Functions Core Tools; AWS: floci | Auto-checks run inside the same containers |
| **Hub** | Laptop on the LAN (offline) and/or a cloud copy | Sync between them when online |
| **Phones** | Companion app with its **own local store** (fully offline). Paired to a hub by a **pairing QR**; check-ins by scanning the **site QR** | Syncs when a hub is reachable |

### 4.4 Graceful degradation: primaries, sidegrades, last resorts (P-13)

The hub runs a **capability check** at start-up (like `kit doctor`). It records each capability as
green / amber / red and **which option is active**, shows this on an admin "Health" screen, and
re-checks when something fails mid-class.

| Capability | Primary | Sidegrade(s) | Last resort | How it switches |
|---|---|---|---|---|
| **Code forge** (lab repos, AI-teammate PRs, Git warm-up) | Self-hosted Forgejo | **GitHub** (GitHub App / bot user), GitLab | Bare git repos on the hub over the LAN (no PR UI: reviews happen in the app's diff view); zip upload | Automatic on health failure; admin can pin one |
| **Catalog: large files** | Google Drive | **Cloudflare R2** (verified free tier: 10 GB-month storage, 1M write ops and 10M read ops a month, free egress), S3, self-hosted MinIO/Garage | Hub's local disk + USB export | Admin chooses; several can be active (mirror) |
| **Backup and sync** (P-15) | Phone ↔ personal hub ↔ class hub ↔ cloud copy | Encrypted bundle to **R2**, Drive, a private git repo, S3 | Encrypted file export to USB / phone storage | All configured targets are used; restore is an acceptance test |
| **Labs** | Containers (Docker or Podman) | **Native tools without containers**: Azurite is an npm package (verified: v3.37.0, MIT), Functions Core Tools on npm (verified: 4.15.2), Python tools via `uv` | Real cloud free tier (Azure for Students, AWS free tier), or **recorded responses** (the check replays known outputs) | Automatic: containers if found, else native, else recorded; the lab page says which |
| **Emulator coverage gaps** (Azurite has no Files / Data Lake; no Document Intelligence emulator) | The emulator | Real service on the student subscription | Recorded responses; or the step becomes a **reasoning check** (explain what the call would return) instead of a live check | Per lab step, declared in the scenario/lab pack |
| **AI** | User's connected AI over MCP (System 2) | Another harness; on-device System 1 (Needle, Laya) | Rules + forms (P-3) | Automatic by availability and policy |
| **Content conversion** | MarkItDown (Python sidecar) | Connected AI converts; conversion on the cloud hub | Trainer pastes text; the original file stays attached | Automatic |
| **Certificates** | Generated certificate | Completion letter / digital badge | **Nothing** (switched off by the program, e.g. the college doesn't want them) | Program switch (P-14) |
| **Live quiz** | Multiplayer PIN quiz | Ghost / target score (one student) | Paper questions | Automatic by headcount; trainer override |
| **Commons** | Real channels | Simulated AI teammates | Off | Program/cohort switch (DEC-2) |
| **Check-in** | Site QR via companion app | Trainer marks attendance manually | Off | Site switch (GPS deferred: DEC-29) |
| **Hub location** | Trainer laptop on the LAN | Cloud hub | **Phone-only mode**: phones keep working offline and sync later | Automatic |
| **Teleprompter** | Trainer's phone | Laptop second screen / tablet | Printed handout from the same script | Trainer choice |
| **Notifications** | Local notifications on the phone | In-app "due now" list | Printed or exported daily plan | Automatic |
| **Trainer couldn't prepare** | Prepared board pages + teleprompter | **Quick-class mode**: the board sidebar lists today's package diagrams, key points and examples to drag in (§6.4); teleprompter shows section summaries only | Teach from the student guide | Trainer taps "I'm not prepared" |
| **Handwriting → text** (§6.4) | Connected AI reading the page image (vision) | On-device ink recognition on the companion (to verify) | Pages exported as PDF/images only; text typed later | Automatic |
| **Content missing from the catalog** | Generated via MCP + skill template + gate | Imported from another package / older bank | Trainer teaches from the syllabus topic list; the content is generated after class | Admin choice |

**Testing rule:** every row's fallback is exercised by an acceptance test that disables the primary
(e.g. stop Forgejo → lab repo operations continue on the sidegrade).

### 4.5 Installing the hub (on the trainer's computer, and on students' computers)

| Option | Who it's for | Needs |
|---|---|---|
| **Single-file download** (Windows / macOS / Linux), built with Node's single-executable-application feature | Everyone; the default | Nothing pre-installed |
| `npx coach-hub` | People who already have Node | Node ≥ 22 |
| One-line script (`curl … \| sh`; PowerShell `irm … \| iex`) | Headless servers | A shell |

**First run** opens a setup page in the browser:

1. Choose a role: **class hub** (trainer) or **personal hub** (student).
2. The **capability check** runs (§4.4) and shows what is available: git, Docker, Podman, Python,
   disk space, network.
3. For each missing optional piece it offers:
   - **install it** (e.g. Podman Desktop, `uv` for Python);
   - **use a fallback** (native npm tools, recorded responses);
   - **skip**.
4. Pairing QR codes are shown for phones.

**Docker or Podman missing:** the hub still works; labs run natively or in recorded mode (§4.4).
Podman is suggested first, because it runs rootless and Podman Desktop is free. Docker Desktop
licensing has conditions for larger organisations (not checked in detail here).

**Students' computers (owner's request, iteration 10):** the same download in **personal hub**
mode:
- runs the student's labs locally (containers or native);
- holds her offline store and serves her phone over home Wi-Fi;
- syncs class data with the class hub when they meet (LAN) or through the cloud copy.

A phone can be paired with **several hubs** (her own and the class's).

**Data authority:**
- personal data lives on her phone and personal hub;
- class data lives on the class hub;
- each syncs to the other only what P-5 allows.

### 4.2 Technology stack (DEC-53, replaces DEC-13 after the second-opinion review)

| Layer | Choice | Why | Checked |
|---|---|---|---|
| Language | **TypeScript** everywhere | One language for phone, browser, hub and tests | Node 22.22 runs `.ts` files directly: verified |
| Core logic (planner, scheduler, ledgers, Shift engine, exam assembly) | **Plain TypeScript pure functions, zero runtime dependencies**, `node --test` | Unchanged; the review called this the best decision in the plan | — |
| Server (hub and cloud, same code) | **Hono** + **Zod** schemas + a small `Result` type | Models write these reliably; replaces Effect v4 RC | Not yet checked against npm |
| UI | **React + Vite**, installable offline web app (PWA) first; **Capacitor** shell in 1b for native-only features (clock alarms, reliable notifications, QR camera) | One UI framework (the board is React anyway); most-written stack | — |
| Data and sync | **CouchDB replication protocol**: PouchDB in the browser/phone and on the hub (Node), CouchDB on the cloud. One database per learner + one per class | Leaderless replication phone ↔ hub ↔ cloud in any combination (§19.3); per-learner databases make export and crypto-shredding simple | PouchDB 9.0 (2024), now an Apache incubator project, maintained but slow-moving (search) |
| Scheduler | **ts-fsrs** (FSRS) | Tested library instead of a hand-written SM-2 | Licence to verify |
| Board | **Hard fork of Excalidraw 0.18 (MIT)**, vendored into the repo, trimmed (§19.5) | Fast on low-end phones; no upstream drift | 0.18.1 MIT: verified earlier |
| Content converter | **MarkItDown** Python sidecar | Unchanged | Verified earlier |
| Automations | **n8n** (self-hosted; free for internal use under its Sustainable Use License) | Replaces Node-RED | Licence terms: search, Oct 2026 |
| Tests | `node --test` for core; **Playwright user-journey scripts** with screenshots and video as a hard gate (§19.6) | The owner's requirement | Chromium available: verified |

**Every version is pinned exactly** (lockfile committed, no `^`/`~`); each dependency is a locked
D-row in `SPEC.md` and the tins-kit gate rejects anything not named.

---

## 5. Admin workflow (Priya)

| Step | What she does | Resources used |
|---|---|---|
| A-1 | Creates the organisation; roles: owner, admin, trainer, learner, viewer. Sends invitations. | PM-app upload (org, roles, invitations) |
| A-2 | Creates **programs → batches → classes**; assigns trainers. | frappe/lms (7) |
| A-3 | Writes or imports the **syllabus** per program: skills, weeks, and which items are graded. The syllabus is the source of grading defaults (DEC-1). | Skill Circuits (16), exam-forge (1) |
| A-4 | **Content governance.** Every question bank and skill passes the validator before use; near-duplicates are flagged; an academy-wide **catalog** of banks and skills. | exam-forge (1) |
| A-5 | **Releases and pins** exams and graded Shifts per cohort (P-7). | exam-forge (1) |
| A-6 | **Lab infrastructure:** hub on a classroom laptop (LAN, no internet needed), floci per class, live-quiz server. | Local-cloud-practice / floci (2), eduplay (5) |
| A-7 | **Assets:** lab laptops, IoT kits, robot kits, each with a QR label; check-out and return. | homebox (8), Sucre4Stem (11), ROSBLOCKS (13) |
| A-8 | **AI policy per program:** off / System 1 only / System 1 + System 2. No keys on the hub (P-4). | — |
| A-9 | **Commons policy:** which channels a cohort *requires*, retention period, moderators. Laya runs moderation checks in 100+ languages. | Laya |
| A-10 | **Privacy rules** enforced as P-5 (not configurable downwards). | — |
| A-11 | **Academy dashboard:** active learners, completion, exam and Shift outcomes, ticket throughput, contribution wall, time spent. | MCQ-Mastery (4), OpenProject (23), contribution tools (24–27) |
| A-12 | **Certificates** issued when capstone and final assessment pass. | frappe/lms (7) |

### 5.1 Trainer management (inspired by "Spark — Trainer Management")

The upload is a website mirror of `spark.devlustro.com` (one compiled JavaScript bundle, no
source). Its features were reconstructed from the bundle's interface text. It is an HR and
operations system for academies that send trainers to client colleges.

| Area | What Spark does | What we take, and how we change it |
|---|---|---|
| **Trainer profiles** | HR master: date of joining, skills and domains, verified resume, contract type, lifecycle (Onboarding → Active → Suspended / Inactive) | Same; skills link to the skill map so admins can match trainers to batches |
| **Compliance documents** | ID proof (Aadhaar), PAN, bank mandate, offer letter, master service agreement; review console (approve / reject with remarks) | Same review console, but **we store verification status, masked numbers (last 4 digits) and an expiry, not the ID images**. Any file kept is encrypted, and every view is logged (P-5, §11) |
| **Training sites** | Client colleges with address, coordinates and a geofence radius | Same; a site links to programs and batches |
| **Attendance** | Check-in with GPS distance from the site plus a photo; exceptions and admin overrides with justification | Two options per site: (a) **scan the site's QR code** (no GPS, no photo; default) or (b) GPS check-in that stores only *within / outside* and the distance, never a location trail. Photos are opt-in per site. Exceptions and overrides keep a reason and an audit entry |
| **Schedules** | Class schedule feed, reschedule requests with justification | Same; feeds the trainer's own timeline (their coach plan) |
| **Class delivery reports** | Hours delivered, remarks, issues | Same; prefilled from the class session (hours, quiz results, Shift run) so the trainer only adds remarks |
| **Expenses** | Claims: travel, food, accommodation, local transport; approve, reject, part-paid, disburse | Same; amounts in **integer paise** (tins-kit money pattern); claims are an append-only ledger |
| **Payroll** | Per-lecture rate or monthly retainer; payroll runs approved, then disbursed; payslips | Same, as an Effect pipeline with a dry run before approval; payslips as PDFs |
| **Commercials** | Quotations → invoices (GST number, amount in words), ageing analysis (0–30 days etc.), billed revenue | Same; invoices are locked once issued; corrections are credit notes |
| **Approvals and audit** | Central approval hub, executive dashboard, audit log, login history | Same; one approval inbox for documents, attendance exceptions, expenses, payroll runs and Shift grading changes (DEC-1) |

Admin steps added: **A-13** trainer onboarding and compliance review · **A-14** sites and check-in
method · **A-15** approvals inbox · **A-16** payroll and expense runs · **A-17** quotations,
invoices and ageing.

Trainer steps added: **T-22** check in at a site · **T-23** file the class delivery report
(prefilled) · **T-24** file expenses · **T-25** view payslips · **T-26** request a reschedule.

## 6. Trainer workflow (Meera)

### 6.1 Before the batch: authoring at speed

The authoring engine is the owner's **Syllabus-to-Study-Plan skill template (v1.2)**. Its real
output is **package5**: 3 tracks × 9 days; 1,074 files (412 `.md`, 307 `.js`, 142 `.py`, 95 `.svg`,
51 `.mmd`, 31 `.pptx`, 12 `.bicep`).

| Step | What happens | Resources |
|---|---|---|
| T-1 | **Upload anything.** Syllabus spreadsheets, slide decks, PDFs and Word notes are converted by **MarkItDown** on the hub into Markdown (slide speaker notes included). A cleanup pass removes spreadsheet noise (`NaN` cells from merged ranges). Handwritten or scanned PDFs have no text layer, so they go to OCR instead. | MarkItDown, Google_Form_Builder OCR (3) |
| T-2 | **Run the skill template** on the syllabus (with Claude over MCP, or another model). For every day it produces the **7-artifact set**: `quicklearn.md`, `deepdive.md`, `instructor_script.md` (teleprompter), `printable_handout.md`, badges/resources, `lab/`, `assets/` (Mermaid). It also produces the **3 companion files** (`whiteboard_dayNN.md`, `live_coding_dayNN.md`, `memory_recall_dayNN.md`) and `student_guide_dayNN.md`, all inside `dayN/`. | skill template v1.2 |
| T-3 | **Faulty-first content:** labs and walkthroughs show the common mistake, the error, the diagnosis, then the fix, so learners recognise failure modes later. | faulty-first-instructions skill |
| T-4 | **Import the package.** The LMS reads a package folder (`track/dayN/…`) directly and maps every file to a place in the app (table below). | package5 |
| T-5 | **Content gate.** The template's 8-point validation checklist becomes a mechanical check that blocks publishing, like exam-forge's validator (P-9). It checks: voice, pacing, the fun cadence, code runs, links live, diagrams render, all companion files present, and instructor scripts in Say/Do format. Link checks need internet and run on the hub when online. | validation-checklist.md, exam-forge (1) |
| T-6 | Imports older banks: MCQ-Mastery text, eduplay JSON. | 4, 5 |
| T-7 | Places skills on the **skill map** (nodes = skills holding tasks; prerequisite links). | Skill Circuits (16) |
| T-8 | Creates **one Git repo per learner** from the package's `lab-repo/` template. | RepoBee (26), package5 |
| T-9 | Writes or adapts **Shift scenario packs**. | floci (2), Plane (20) |

**How a package maps into the LMS:**

| Package file | Becomes |
|---|---|
| `COURSE-MAP.md`, `chronological_study_plan.md` | Program schedule + skill map |
| `student_guide_dayNN.md` | The learner's **90-minute daily block** (read → whiteboard → lab → live coding → memory recall) inserted into the timeline |
| `quicklearn.md` (8-question diagnostic) | Quick quiz → question bank (validated) |
| `deepdive.md` | Lesson page |
| `instructor_script.md` | **Teleprompter view** for the trainer: `[SAY]`/`[DO]`/`[TYPE]`/`[BOARD]`/`[PAUSE]` markers, running clock, `⚠️ LIKELY CROSS-Q` callouts |
| `whiteboard_dayNN.md` | 3 timed drawing exercises on the **Notebook board** (§6.4) |
| `live_coding_dayNN.md` | Live-coding script (intentional bug at about 18:00), linked to the **trace viewer** |
| `memory_recall_dayNN.md` | 5 closed-book recall exercises (diagram / code / recite / Feynman / trade-offs). Recite and Feynman answers also become **Anki cards** |
| `printable_handout.md` | Printable 2-sided card |
| `lab/`, `assets/*.mmd/.svg`, `.pptx` | Lab files, rendered diagrams, slides (converted by MarkItDown for search; originals kept) |

### 6.2 In class (Tue/Thu 20:00)

| Step | What happens | Resources |
|---|---|---|
| T-10 | **Live PIN quiz** on the projector; learners join from phones over local Wi-Fi. Game types: boss battle, debug derby, code sprint, cloze, match, slider estimation, poll. | eduplay (5) |
| T-11 | **Notebook board** (§6.4): Meera teaches on the tablet; learners scan a **QR code** to follow live or open the finished pages; the board auto-links into the learners' knowledge graph. | Excalidraw (modified), AFFiNE (17) |
| T-12 | **Sprint planning** on the class board: tickets, story points, 1-week sprints. Optional **AI Scrum master** and AI teammates. | Plane (20), Taiga (21), PACA (22) |
| T-13 | Runs a **class Shift**: same seed for everyone, leaderboard at the end. Practice or graded per syllabus (DEC-1). | §7 |
| T-14 | **Electives** run as stations: IoT (Sucre4Stem kits), flow-based embedded (Flowboard), robots in simulation (ROSBLOCKS), AI literacy (RAISE Playground), tree algorithms (Treelab). | 9, 11, 12, 13, 15 |

### 6.3 After class

| Step | What happens | Resources |
|---|---|---|
| T-15 | **Progress grid** (learners × skills): lessons, drill and quiz %, card retention, lab checks, tickets, Shift results. | MCQ-Mastery (4), Skill Circuits (16) |
| T-16 | **Git signals** per learner repo: commit and line stats, contribution score on the capstone rubric, class **contribution wall** on the projector. | 24, 25, 27 (see §12 note) |
| T-17 | **Feedback timeline:** dated notes per learner on a photo roster; one-tap stock notes. | student-tracker upload |
| T-18 | **Grading.** Exams and graded Shifts are seeded and pinned, and carry an integrity log that never accuses. Laya *suggests* rubric scores for postmortems and short answers; **Meera confirms** (P-2). | exam-forge (1), Laya |
| T-19 | **Paper route** when the room has no devices: question PDF or Google Form export, then import the responses. | exam-forge (1), Google_Form_Builder (3) |
| T-20 | **Automations:** e.g. "no commits for 3 days → nudge the learner and list them for me". Node-RED flows with Laya deciding. | Node-RED (14), Laya |
| T-21 | **Video stand-ups:** learners post 60-second updates on tickets. | PM-app upload |

### 6.4 The Notebook board (modified Excalidraw)

The reference is the owner's whiteboard PDF: four 3840×2160 (16:9) pages, ruled notebook paper,
several pen colours, layout *problem → Example → Known → Assumption → Observation → Answer (code)
→ TRACE TABLE*.

**Pages, not an infinite canvas.** Excalidraw's canvas is infinite; the board instead works like a
notebook:
- fixed 16:9 pages;
- page thumbnails;
- next / previous / insert page;
- exports per page.

**Auto-hiding sidebar** (like Android's edge panel), the main control surface:

| In the sidebar | Detail |
|---|---|
| **Excalidraw's own toolbar** | Hidden by default; one swipe reveals it |
| **Pens** | The reference palette: black, red, orange, green, blue, purple; pressure-sensitive |
| **Tables** | Insert an n × m table; the **trace table** preset (green grid with named columns); add rows while talking |
| **Common shapes** | Boxes/arrows, flowchart, data-structure shapes (array cells, linked-list node, tree node, stack, queue), cloud-architecture blocks. Shape packs are per subject, so the trainer sees only what they need |
| **Teaching stamps** | Problem, Example, Known, Assumption, Observation, Answer/Solution |
| **Today's material** | Every `.mmd` diagram and image from the day's package (`assets/`), **draggable onto the page**. Mermaid files are converted into editable board shapes with `@excalidraw/mermaid-to-excalidraw` (verified: MIT, v2.2.2); images drop in as images |
| **Quick-class mode** (trainer couldn't prepare) | The sidebar also shows the teleprompter's section summaries and the day's worked examples, ready to drag in |

**Outputs of every board:**

1. **PDF** of the pages (matching the reference look).
2. **Images** per page.
3. **Markdown**: handwriting → text, with the primary/sidegrade/fallback chain of §4.4. Headings
   come from stamps (*Known*, *Observation*…), tables come from table tools as Markdown tables,
   dragged-in Mermaid stays as Mermaid source, and freehand handwriting is recognised as text.
   The trainer can correct it before publishing.

**Sharing:**
- The laptop shows the board on the projector.
- **When a learner scans the board's QR code with the companion app, the board is added to their
  account** (DEC-27).
- Follow live or open later.
- Learners annotate their own copy.

### 6.5 Trace viewer: Python, JavaScript, Java, C, C++ (DEC-14)

One **trace format** for every language. Each step records: line, call stack with local variables,
heap objects, output, and counters (comparisons, swaps). The format follows the de-facto standard
used by Python Tutor, so one viewer and one "predict, then reveal" mode work for every language.

| Language | How traces are produced | Where it runs | Phase |
|---|---|---|---|
| Python | `sys.settrace` tracer (as in pyviz_tutor, MIT) | Hub or desktop; in the browser via Pyodide later | 2 (browser 3) |
| JavaScript | The code is instrumented by a parser, then run in a sandboxed worker | Browser, offline | 2 |
| Java | Debugger-interface (JDI) backend | Hub (needs a JDK) | 3 |
| C and C++ | Valgrind-based backend (Python Tutor's approach: pointers, uninitialised memory, out-of-bounds) | Hub on Linux | 3 |
| Any other | Hand-drawn trace table on the Notebook board | — | — |

Other rules:

- pyviz_tutor's output loads two libraries from a CDN (`viewer.py` lines 977–979); our viewer
  bundles its own, so traces work offline.
- **Predict, then reveal:** the learner fills a trace table on the Notebook board first, then
  compares it with the real trace, row by row.
- One click sends a trace's steps to the Notebook board as a pre-filled trace table (in the green
  grid style of the reference PDF).
- **Licensing:** Python Tutor's public site is free to use. The licence of its source backends must
  be checked before reusing any code (OQ-10).

### 6.6 Algorithm visualizers (DEC-15)

All four sites the owner listed (and Treelab) are blocked from this build environment, so they are
described from search results only.

| Source | What it offers (from search) | What we take | Licence status |
|---|---|---|---|
| David Galles, USF *Data Structure Visualizations* | Broad coverage (stacks, queues, trees, heaps, hashing, sorting, graph algorithms); HTML5 canvas; source downloadable | Coverage list; canvas-animation approach | Source is downloadable, but the licence is not stated in results; check before reuse |
| VisuAlgo (NUS) | **e-Lecture mode** (narrated walkthrough); **auto-generated, randomised quiz questions with automatic grading**; training mode | e-Lecture mode (story-mode friendly); randomised, auto-graded "what happens next?" questions per structure | Free to use, not open source: inspiration and links only |
| DSA Visualizer (dsavisualizer.in; GitHub `suber-IQ/dsa-visualizer`) | Step-by-step execution, real-time animation, performance metrics, code snippets, **custom input** | Custom input, step metrics, code panel | Open-source repo; licence to check |
| visualizedsa.com (BFS) | Not found by search; assumed graph editing with queue and visited panels | Graph editor and queue/visited side panels | Unknown |
| Treelab (treelab.dev) | Visual tree-structure experiments, custom algorithms | Tree workbench | Unknown |

**Our visualizer framework (one engine, many algorithms):**

1. **Algorithm player.** Each algorithm emits a deterministic list of steps (same idea as the trace
   format). Controls: play, pause, step forward and back, speed, and **custom input**. Side panels
   for stack, queue, visited set and counters. A **code panel** highlights the current line in
   Python, C, C++, Java or JavaScript.
2. **Predict the next step** (VisuAlgo-style training, commit-before-reveal). Randomised from a
   seed, auto-graded, results flow into the learner's drill statistics and Anki (missed steps become
   cards).
3. **e-Lecture mode.** Narrated steps that interleave with explanation; in story mode they become
   panels of a chapter.
4. **To the Notebook board.** Any step can be sent to the board as a drawing or trace table.
5. **Graph and tree editor.** Build your own input graph or tree (visualizedsa-, Treelab-style).
   The same node-graph component also draws the skill map and the knowledge graph.

The first set: arrays and sorting; stacks and queues; linked lists; BST, AVL and heaps; hashing;
BFS, DFS, Dijkstra; recursion trees; dynamic-programming tables.

## 7. Learner workflow (Arjun)## 7. Learner workflow (Arjun)

### 7.0 The coaching conversation framework (owner's prompt, completed: DEC-16)

The owner's 4-stage prompt is the backbone (P-12): goal clarification, constraints and risks,
proposed pathway, final versioned plan, with a halt for the person at each decision point.

**The owner's problem with it:** using it meant writing essays, with no options to pick from.
v6 completes the framework with two missing stages and a **low-friction answer mode** at every step.

| Stage | The coach… | What the person does (low friction) |
|---|---|---|
| 0. **Context** (new) | Asks who the plan is for and what area it covers | Taps a domain card: Career / Learning, Money, Fitness, Relationships, Habits, or "a specific problem" |
| 1. **Goal clarification** | Shows **3–5 predicted goal statements** for that domain, each already in measurable form ("Deploy a real project to the cloud in 90 days") | Taps one or two, edits a word, or types one short sentence (System 1 extracts the fields). Confirms "Yes" or taps a suggested correction |
| 2. **Constraints and risks** | Pre-fills what it can infer, and asks the rest as **sliders and chips**: time windows (drag on a day strip), budget (slider), energy, equipment. Then shows **predicted pitfalls as chips** from a rule table (e.g. "phone after 22:00" → "late-night scrolling"), each with a suggested counter-measure | Ticks the pitfalls that apply; nothing to write |
| 3. **Proposed pathway** | Offers **three plan cards: Light / Standard / Intense**, each with hours per week, expected date to reach the goal, and its trade-off | Picks one, then adjusts with **small modifier chips** ("move learning to evenings", "no weekends") |
| 4. **Final action plan** | Says explicitly which of the person's changes it adopted, then saves the **versioned master plan** (Plan v1) | Taps "Save and start" |
| 5. **Review cadence** (new) | Schedules check-ins (weekly, and after any 3 missed blocks). Each check-in replays stages 2–4 **with the previous answers pre-selected**, so a change takes a few taps and creates Plan v2 | Taps "same as before" or changes one chip |

**What fixes the missing behaviour in the original prompt:**

- **"Halt and await"** is enforced by the app, not trusted to a model.
- **"No" at stage 1** shows the 3 nearest alternatives instead of asking for a rewrite; after two
  "No"s it offers free text.
- **"I have no memory between conversations"** is solved by the app: the saved profile and plan
  versions are the coach's memory, so every session starts from them.
- **Defer anything:** any question can be answered "ask me later"; the coach asks it in context
  (e.g. the calorie question is asked on the first day the person logs a meal).
- **Import instead of typing (later phases):** calendar file (`.ics`) for fixed commitments;
  bank-statement CSV for spending patterns; step counts from the phone.

**Friction targets** (become acceptance criteria, measured by the hidden UI tests on a scripted
persona):

- first plan in **≤ 5 minutes**;
- **≤ 25 taps**;
- **≤ 2 typed sentences**;
- every question has a "skip / ask later".

**Where the framework is used:** onboarding (stages 0–5); any new problem the person brings ("I
keep missing my morning lessons"); Shift postmortems and capstone planning (stages 2–4).

### 7.1 Day 0

1. Sign-up, then a join code (links him to Meera's batch).
2. **Onboarding conversation** using the §7.0 framework, mostly taps:
   - stage 0: domain cards;
   - stage 1: predicted goals;
   - stage 2: time windows on a day strip, sliders for budget and learning hours, chips for diet,
     social energy, coaching tone and predicted pitfalls;
   - stage 3: Light / Standard / Intense cards;
   - stage 4: saves **Plan v1**.

   Questions marked "ask me later" come back in context.
3. **Placement test**: sectioned, points per section (from the readiness assessment upload).
4. Result:
   - a **profile**;
   - a **12-week learning arc** that skips what he already knows;
   - **budgets**: ₹1,000/day discretionary to hit a ₹15,000/month saving;
   - a **calorie target**: Mifflin–St Jeor, shown with a "not medical advice" note;
   - a **social quest level**;
   - an **hour-by-hour plan**.

### 7.2 Every day (personal OS)

- **Timeline** with **local notifications** at the start of each block.
  - A missed block asks "Did it happen?". The **deterministic re-plan** is shown as a diff, and
    the week's learning total is protected.
- **Trackers:**
  - tasks;
  - money ("financial buddy": append-only ledger, category budgets, "what this costs your goal"
    nudges);
  - food (quick-add from his own history);
  - relationship micro-quests (colleagues and friends by default; strangers opt-in).
- **Notes** in the companion app. Every note joins the knowledge graph.
- **"Where did I keep it?"**: personal item locations (homebox, personal edition).
- **System 1 quick bar:** "log ₹120 chai and move my lesson to tomorrow".
  1. Needle produces two tool calls.
  2. Laya checks both.
  3. Arjun taps Accept.

### 7.3 His 8 learning hours a week

| Slot | Time | What |
|---|---|---|
| Anki review | about 1 h (7 × 6–10 min) | Due cards: template cards plus missed quiz questions |
| Daily block (package) | 2 h (3 × 40 min, from the 90-min block) | `student_guide_dayNN`: quicklearn → whiteboard exercise on the Notebook board → lab → live-coding replay with trace viewer → memory recall; then **drill with commit-before-reveal** |
| Warm-up | inside lessons | **Heading Strike** (3 min) |
| Ticket work | 1.5 h | Sprint tickets in his RepoBee repo |
| Saturday lab | 2.5 h | floci lab ending in an auto-checked **boss check** |
| Commute audio | 1 h (optional, counted only when marked done) | Audio summaries |

**12-week arc:**

| Week | Content |
|---|---|
| 0 | Placement |
| 1–2 | Git and terminal |
| 3–5 | Docker |
| 6–8 | Cloud on floci |
| 9–10 | CI/CD |
| 11–12 | **Capstone**: his real project live on a cloud free tier, demo in class, retest on the placement paper, certificate |

**Electives** (optional skill nodes):
- AI literacy (RAISE Playground);
- tree algorithms (Treelab);
- IoT (Sucre4Stem);
- flow-based embedded programming (Flowboard);
- robotics (ROSBLOCKS);
- "build your own MCP tool" (mcp-workshop, with-mcp);
- intelligent automation (Node-RED + Laya; UiPath optional).

### 7.4 Weekly and monthly

- **Weekly review**: learning hours, money, food, quests, class status, and the coach's note in the
  chosen tone.
- **Shifts** from week 6: practice or graded per syllabus (§7.6, DEC-1).
- **Sprints**: team tickets with Kabir and Sana, or with AI teammates (§9).

### 7.5 Exam days (exam-forge exam mode)

1. **Pre-flight**: length, time, seed, explicit proctoring consent.
2. **Fullscreen**, with exits logged, never prevented.
3. **Optional camera tier**: face presence only; frames stay on the device.
4. **Report**: the seed (reproducible paper), the integrity events, the tier that was active.

### 7.6 Story mode (optional, one switch for the whole app)

| Plain | Story (manhua) |
|---|---|
| Lessons | Chapters (Elementari-style panels with text, art, sound, code block) |
| Labs | Training arcs |
| Shifts | Battles |
| Exams, capstone | Tournaments, final |
| Money, food, quests | Gold, stamina, bonds |
| Weekly review | Chapter recap |

The mechanics are identical; only presentation changes.

---

## 8. The Shift: enterprise simulation under time pressure (M-Shift)

- **Setting:** e.g. "Northwind Retail, L1 DevOps on-call, 60 minutes".
- **Ticket queue:** a **seeded arrival schedule** (P-6). Priorities with SLA timers: P1 15 min,
  P2 45 min, P3 end of shift.
- **Work happens in floci.** "Resolve" runs an auto-check; nothing is self-reported.
- **Tickets cover:** break-fix, small changes, customer questions, automation tasks (Node-RED, or
  UiPath via MCP, optional).
- **Communication:** status updates in `#incident` (Commons, or simulated).

**With and without AI:**

| Aspect | Without AI | With AI |
|---|---|---|
| Ticket wording | Scripted packs | Same packs, reworded variants |
| Requesters | Branching scripts | Live replies, more impatient as the SLA nears |
| Classification | — | **Laya** classifies requests for triage scoring |

**Scoring:**
- SLAs met;
- checks passed;
- triage accuracy;
- communication;
- a **blameless postmortem**, scored against a rubric. Laya suggests; the trainer confirms.

### DEC-1 (owner, iteration 5): grading mode of Shifts

- Each Shift is **practice** or **graded**.
- The **admin's syllabus** sets the default per program and week.
- A **trainer** may change it for their batch only where the syllabus allows; every change is
  recorded (who, when, why).
- **If the syllabus is silent:** practice until the capstone; the capstone Shift is graded.
- **Graded Shifts** are pinned to the cohort (P-7) and carry the integrity log (P-8).

## 9. The Commons: team chat, real or simulated (M-Commons)

- **Real channels:** class, team, skill, `#incident`, `#random`. Threads, reactions, file and link
  sharing, direct messages.
  - Anything shared is auto-linked into the knowledge graph.
  - The trainer can **pin** a post as an official resource of a skill.
  - Offline: messages queue on the device.
  - Laya runs moderation (toxicity, personal data) before a post is shared.
- **Simulated workspace:** the same interface, with **AI personas** marked "AI", PACA-style (agents
  sit on the board and own tickets):
  - a **manager**;
  - a tech lead who reviews PRs;
  - QA who files bugs;
  - a stakeholder who changes requirements.

  With no AI connected, personas follow scripts.
- **Mixed teams:** an AI persona fills an empty seat in a real team.

### DEC-2 (owner, iteration 5): real or simulated channels

- A **real** channel exists only if **the trainer created it** or **the cohort requires it**
  (syllabus).
- Otherwise the learner gets the **simulated** workspace with an AI manager (and teammates as
  needed).
- Trainers see channels they created or the cohort requires, never private learner-only channels.

---

## 10. Module list (all phases)

| ID | Module | Phase |
|---|---|---|
| M-1 | Organisation, roles, invitations, accounts | 1 |
| M-2 | Personal OS interview and profile | 1 |
| M-3 | Deterministic planner and re-planner; reminders feed; local notifications | 1 |
| M-4 | Trackers: tasks, money ledger, food, relationship quests, item locations | 1 (item locations 2) |
| M-5 | Content pipeline: exam-forge schema and validator; imports (MCQ-Mastery, eduplay); OCR import | 1 (OCR 2) |
| M-6 | Skill template, generator, skill map | 1 |
| M-7 | Study, drill (commit-before-reveal), exam (seeded, weighted), integrity log (observe-only), report | 1 (camera tier 2) |
| M-8 | Anki: decks; basic, reversed and cloze cards; **ts-fsrs** scheduler (was SM-2, DEC-53); Anki text import/export; due reviews become timeline blocks | 1 (`.apkg` 2) |
| M-9 | Tickets and sprints (board, points, assignment) | 1 |
| M-10 | **Shift engine**: seeded scenarios, SLA timers, scoring, grading mode (DEC-1) | 1 (mock checks), 2 (floci checks) |
| M-11 | ~~**Commons**~~ **Cut to the Shift's simulated channel** (DEC-57); class chat stays on WhatsApp etc. | 1 (Shift only) |
| M-12 | Knowledge graph (tags + text similarity; Needle embeddings later) and node-graph visual | 1 (visual 2) |
| M-13 | MCP server exposing the tool layer | 1 |
| M-14 | Tool and decision interfaces with rule-based implementations (Needle and Laya plug in later) | 1 |
| M-15 | Offline web app shell (PWA), **CouchDB/PouchDB sync across cloud/hub/hybrid profiles** (DEC-54), encrypted backup | 1 (backup 2) |
| M-16 | Live classroom PIN quiz | 2 |
| M-17 | Git analytics: per-learner repos, stats, rubric, contribution wall | 2 |
| M-18 | Story mode, Heading Strike, story panels | 2 (Heading Strike could move to 1) |
| M-19 | Native companion app (Cactus + Needle), true push notifications | 2 |
| M-20 | Needle (needle-rs) and Laya (laya-ts) in the browser | 2 |
| M-21 | Electives integrations: RAISE, Treelab, Sucre4Stem, Flowboard, ROSBLOCKS | 3 |
| M-22 | Node-RED automations; UiPath via MCP | 2 (Node-RED), 3 (UiPath) |
| M-23 | Paper and Google Forms export / import | 2 |
| M-24 | Certificates, academy dashboard, assets with QR codes | 2 |
| M-25 | **Content conversion**: MarkItDown on the hub, cleanup pass, OCR route for scans | 1 (convert + cleanup), 2 (OCR) |
| M-26 | **Package import**: skill-template v1.2 folders → lessons, quizzes, cards, teleprompter, whiteboard exercises; the 8-point content gate | 1 |
| M-27 | **Notebook board**: pages, auto-hiding sidebar, tables, shape packs, drag-in `.mmd` and images, quick-class mode, PDF + images + Markdown (handwriting → text), QR adds to account | 1b |
| M-28 | **Trace viewer**: one trace format; Python and JavaScript (phase 2), Java, C and C++ (phase 3); offline libraries; predict-then-reveal; send to board | 2–3 |
| M-29 | **Coaching framework engine**: stages 0–5, enforced halts, predicted options (rule tables), Light/Standard/Intense plan cards, versioned plans, friction targets | 1 |
| M-30 | **Trainer management** (Spark-inspired; HR, expenses and invoices via ERPNext, DEC-56): profiles, compliance review (masked data), sites with QR or GPS check-in, schedules, delivery reports, expenses, payroll runs, quotations and invoices, approvals inbox, audit | 2 (proposed) |
| M-32 | **Labs** (DEC-61: hub containers, Codespaces, Colab, optional free VM). **Lab containers**: Docker/Podman images per day, Azurite, Cosmos DB emulator, Functions Core Tools, floci; checks run in containers | 1 |
| M-33 | **Teleprompter (trainer phone)**: launch, pacing modes, speed, pause, section jump, per-section summary for improvising, behind-schedule indicator | 1 |
| M-35 | **Capability check + Health screen + fallbacks** (§4.4) and the hub installer (§4.5): single-file download, setup page, personal-hub mode | 1b |
| M-36 | **Backup and sync targets**: R2, Drive, git repo, S3, local export; tested restore | 1b (R2 + local export), others 2 |
| M-34 | **GitHub organisation automated by a GitHub App; AI teammates as GitHub Apps; Forgejo offline sidegrade** (DEC-60). Was: Forgejo integration + AI teammate bot accounts: scripted PRs from prepared branches; AI-driven PRs via MCP tools, scoped and labelled | 1 |
| M-31 | **Visualizer framework**: algorithm player, predict-the-next-step quizzes, e-Lecture mode, graph and tree editor, send to board | 2 |

**Phase-1 size is deferred** until the owner approves (OQ-1).

## 11. Privacy and data rules (become locked D-rows)

- **Data classes:**
  - *personal* (money, food, plan, notes, quests, item locations): owner only;
  - *class work* (submissions, tickets, attempts, Shift results): owner + their trainers;
  - *shared* (posts, pinned resources): channel members.
- **Sharing:** a learner can share a specific personal item (e.g. a fitness streak) with a named
  person. It is revocable and logged.
- **Export and deletion:** everything can be exported. Deleting an account removes personal data
  from the hub; class records are kept per the admin's retention policy, anonymised.
- **Backups:** encrypted on the device before upload (P-4: the passphrase never leaves the device).
- **Uploads used as reference:** no real student data from the uploads is used. The student-tracker
  export contains real names and photos and is **excluded**.

---

## 12. Resource coverage: all 54 items placed

Status column:
- **verified** = I read the repo or the official page;
- **searched** = described from search results only;
- **name only** = could not find it; placed by name.

| # | Resource | Status | What we take | Where | Phase |
|---|---|---|---|---|---|
| 1 | exam-forge | verified (repo) | Bank schema + validator, commit-before-reveal drill, seeded weighted exams, integrity tiers (observe-only), pinned cohort exams, paper export, catalog, authoring prompt | M-5, M-7, A-4/5, T-1/15/16 | 1 |
| 2 | Local-cloud-practice (floci) | verified (repo) | Local AWS emulator for labs and Shifts; auto-checks | A-6, T-6, M-10 | 1–2 |
| 3 | Google_Form_Builder | verified (repo) | OCR import of paper questions; Google Forms export | T-3, T-16 | 2 |
| 4 | MCQ-Mastery | verified (repo) | Text question format; admin/learner analytics | M-5, A-11, T-12 | 1 |
| 5 | eduplay | verified (repo) | Live PIN quiz, game types, offline LAN, content packs | T-7, M-16 | 2 |
| 6 | Anki | known | Card types, SM-2, cloze, text import/export | M-8 | 1 |
| 7 | frappe/lms | known | Programs, batches, assignments, certificates | A-2, A-12 | 1–2 |
| 8 | homebox | verified (repo) | Asset check-out with QR; personal item locations | A-7, M-4 | 2 |
| 9 | MIT RAISE Playground | searched | AI-literacy elective (Scratch-based ML blocks) | M-21 | 3 |
| 10 | Elementari | searched | Story slides with text, art, sound and code blocks; template for story mode | T-1, M-18 | 2 |
| 11 | Sucre4Stem | searched | IoT elective: block programming + microcontroller kits | T-11, A-7 | 3 |
| 12 | Flowboard | searched | Flow-based embedded-programming elective | T-11 | 3 |
| 13 | ROSBLOCKS | searched | Blockly for ROS2 robots (simulator first) | T-11, A-7 | 3 |
| 14 | Node-RED | known | Trainer and personal automations; automation tickets | T-17, M-22 | 2 |
| 15 | Treelab (treelab.dev) | searched (site blocked by proxy) | Tree-structure visual experiments; style of the node-graph visual | M-12, T-11 | 2–3 |
| 16 | Skill Circuits (TU Delft) | searched | Skill map: nodes = skills holding small tasks; prerequisite links; cohort progress | A-3, T-4, T-12 | 1 |
| 17 | AFFiNE | known | Notes, whiteboard, mind map; second-brain feel | T-8, M-12 | 1–2 |
| 18 | mcp-workshop | known (by name) | MCP server patterns; "build your own MCP tool" elective | M-13 | 1 |
| 19 | with-mcp | known (by name) | Expose every app action as an MCP tool | M-13 | 1 |
| 20 | Plane | known | Tickets, issue types, modules | M-9, T-6 | 1 |
| 21 | Taiga | known | Sprints, story points, burndown | M-9 | 1 |
| 22 | PACA | searched | AI agents as Scrum teammates; MCP server; model for AI personas | M-11, T-9 | 1 (scripted) / 2 (AI) |
| 23 | OpenProject | known | Time tracking feeding the timeline; capstone Gantt | A-11 | 2 |
| 24 | classroom-analytics (skooter500) | verified (repo; **GPL-3.0**) | Commit counts per week per student from the classroom roster. **Ideas only: GPL code cannot be copied into this project** | M-17 | 1.5 |
| 25 | TCH-Github_Evaluator (JordiCortesCom) | verified (repo; README says MIT, **no LICENSE file**) | Weighted repo scoring: commit frequency 25, commit quality 25, individual contribution 30, branch strategy 10, documentation 10; CSV/JSON/text reports | M-17, T-18 | 1.5 |
| 26 | RepoBee | known | One repo per learner from a template | T-5 | 2 |
| 27 | open-source-pulse-wall (nanzhi84) | verified (repo; MIT; Node ≥ 18, no runtime dependencies) | A one-class Git exercise: fork → branch → commit → PR → review → merge; the projector wall lights up each student's profile card; issues and PR board; Git history graph | Day 0 warm-up, T-16, A-11 | 1 |
| + | collect-homework 0.1.5 (PyPI; source from the sdist) | verified (MIT; depends on `click`) | Trainer-side clone / pull / summary of every student repo (`00.ids` list of GitHub ids) | M-17 | 1.5 |
| 28 | Manhua classes (idea) | owner idea | Story mode across the app | §7.6, M-18 | 2 |
| 29 | Heading Strike game (idea) | owner idea | Warm-up; drills from cards | M-18 | 2 (or 1) |
| U1 | Readiness assessment (upload) | verified | Placement test; retest at the capstone | §7.1 | 1 |
| U2 | Student-performance-tracker (upload) | verified | Feedback timeline, photo roster, stock notes | T-14 | 1 |
| U3 | Project-management app (upload) | verified | Org/roles/invitations; goal → project → task; whiteboard; video stand-ups; AI-drafted tickets | A-1, T-8, T-18 | 1–2 |
| + | Personal OS prompt (owner) | pending from owner | Interview questions and planner rules | M-2, M-3 | 1 |
| + | UiPath | searched | RPA via MCP, optional | M-22 | 3 |
| + | Cactus | searched | On-device runtime for the native companion app | M-19 | 2 |
| + | Needle / needle-rs | verified (needle-rs repo) | System 1 tool calls and extraction; browser via WASM | M-14, M-20 | 2 |
| + | Jev (TypeSafe AI) | searched | Superseded by Laya for decide/route/guard (Laya is open source and runs in the browser) | — | — |
| + | MarkItDown (Microsoft) | **verified (run on package5's PPTX and XLSX)** | Uploads → Markdown, including slide notes; spreadsheet output needs cleanup | M-25, T-1 | 1 |
| + | Excalidraw | known (MIT, React) | Base of the Notebook board | M-27, §6.4 | 2 |
| U4 | Whiteboard PDF (upload, 4 pages) | verified (rendered and viewed) | Visual target: ruled paper, 16:9 pages, pen colours, teaching layout, trace tables | §6.4 | 2 |
| U5 | pyviz_tutor 0.1.5 (upload) | verified (source read; MIT; zero-dependency Python; CDN libraries in output) | Execution traces, time-travel viewer | M-28, §6.5 | 2 |
| U6 | Skill template v1.2 + faulty-first-instructions (upload) | verified (read) | The authoring engine: 7-artifact set + companions, teleprompter scripts, validation checklist, prompt library | T-2, T-3, T-5, M-26 | 1 |
| U7 | package5 (upload) | verified (1,074 files inventoried; samples read) | Real example package; import target for M-26; `lab-repo/` template | T-4, T-8 | 1 |
| U8 | Coaching framework prompt (pasted) | verified (read) | The 4-stage conversation with halts and versioned plans | §7.0, M-29 | 1 |
| U9 | Spark — Trainer Management (upload, website mirror) | verified (bundle text read; no source) | Trainer HR, compliance review, sites, attendance, expenses, payroll, invoices, approvals | §5.1, M-30 | 2 |
| V1 | David Galles visualizations (USF) | searched (site blocked) | Coverage list; canvas animation | §6.6 | 2 |
| V2 | VisuAlgo | searched (site blocked) | e-Lecture mode; randomised auto-graded questions | §6.6 | 2 |
| V3 | DSA Visualizer (dsavisualizer.in) | searched (site blocked) | Custom input, metrics, code snippets | §6.6 | 2 |
| V4 | visualizedsa.com (BFS) | **name only** (site blocked, not found) | Graph editor, queue/visited panels (assumed) | §6.6 | 2 |
| + | Python Tutor | searched | Multi-language trace approach (C/C++ via Valgrind, Java, JS) | §6.5 | 2–3 |
| + | Svelte 5 / SvelteKit | verified (npm 5.57.1) + searched | UI framework | §4.2 | 1 |
| + | Effect v4 (`effect@rc`) | verified (npm rc.118) + searched | Hub and pipelines | §4.2 | 1 |
| + | Laya | verified (repo) | Decide/route/guard: choice, score, yes-no in 100+ languages; moderation; triage scoring | M-14, M-20, §8, §9 | 2 |

**Note on 24, 25, 27:** found from the owner's links in iteration 8; see licences above.

---

## 13. What is deliberately not in scope

- Payments and billing.
- Medical advice (calorie targets carry a "not medical advice" label).
- Investment advice (the money module tracks and budgets only).
- Storing third-party AI keys on the hub.
- Camera frames leaving the device.
- Stranger quests by default.

## 14. Build experiment (after approval)

1. This plan becomes `SPEC.md`: D-rows from P-n, DEC-n and module decisions; AC-rows per module,
   each bound to a check. Plus a **hidden acceptance suite** the builders never see.
2. Phase-1 modules become scoped `kit task` files: one task per module, size per OQ-1.
3. **Builds:** Haiku and Sonnet each build phase 1 once, task by task, via `kit run`, merged by the
   reconciler. Then a second Haiku run of 2 tasks to measure rebuild repeatability.
4. **Carry-over measurement:**
   - lessons from both builds enter tins-kit as candidate patterns;
   - anything both builds needed (expected: SM-2, money ledger, seeded RNG, question-format parser,
     event-log sync) qualifies as *proven*;
   - re-run one task with the updated kit;
   - report: lessons proposed vs accepted, patterns reused, kit rules exercised or broken, kit
     version change.
5. **Where things live:** this repo holds the project; tins-kit changes stay in
   `ramsaipv4-lgtm/claude-code-cloud-session`.

## 15. Open questions

| ID | Question | Owner's input needed |
|---|---|---|
| OQ-1 | Phase-1 size. Proposal from the simulated run (Part G): about 15 modules at their minimum form; Notebook board optional at 1.5 | **Owner decides after reading SIMULATED-RUN.md** |
| OQ-2 | ~~Is the pasted framework the personal OS prompt?~~ **Resolved**: yes; completed in §7.0 (DEC-16) | — |
| OQ-3 | ~~Links~~ **Resolved** (iteration 8) | — |
| OQ-4 | ~~Stack~~ **Resolved** by Claude at the owner's request: §4.2 (DEC-13) | — |
| OQ-5 | Should Heading Strike move into phase 1 as a small, testable game core? | Yes/no |
| OQ-7 | ~~C traces?~~ **Resolved**: Python, JavaScript, Java, C, C++ (DEC-14, §6.5) | — |
| OQ-8 | ~~Trainer management in phase 1?~~ **Resolved**: minimal only in phase 1 (trainer profile with skills, assignment, site with QR check-in, schedule, prefilled delivery report). Payroll, expenses, quotations and invoices later | — |
| OQ-9 | ~~Check-in default~~ **Resolved**: site QR via the companion app; GPS deferred | — |
| OQ-10 | Licences of Galles' visualizations, dsa-visualizer and Python Tutor backends must be checked before reusing any code; until then they are inspiration only | Accept |
| OQ-11 | ~~Friction targets~~ **Accepted** (≤ 5 min, ≤ 25 taps, ≤ 2 sentences) | — |
| OQ-15 | Handwriting recognition sidegrade on the phone (on-device ink recognition) must be verified before relying on it | Accept as a research item |
| OQ-16 | ~~Answer FAILURE-QUESTIONS.md~~ **Resolved** in iteration 12: all 46 answered (§18, DEC-36 to DEC-52) | — |
| OQ-17 | ~~Second opinion~~ **Resolved** in iteration 13 (§19). Was: An independent reviewer proposes a different design ([`ALT-DESIGN-REVIEW.md`](ALT-DESIGN-REVIEW.md)): cloud-first PWA, borrowed sync/forge/labs, Hono+Zod+React instead of Effect+Svelte, a 4-week pilot first, Coach split out. Adopt which rows, if any? | **Owner decides before SPEC.md** |
| OQ-18 | ~~Rotating QR~~ **Resolved**: yes, the code changes every 60 s (120 s allowed as a setting). Was: F-04: keep the rotating site QR as the anti-proxy control (your answer covered where attendance lives, not proxying)? | Confirm |
| OQ-19 | ~~Pick features~~ **Resolved** (DEC-68) except C-2. Was: Which ideas from [`FEATURE-IDEAS.md`](FEATURE-IDEAS.md) go into 1a, 1b or later? | **Owner picks** |
| OQ-20 | Waydroid experiment (§20.3): run it, then decide whether Coach on a computer uses it | Owner, after the results |
| OQ-21 | C-2 estimation poker: keep or drop (explained in FEATURE-IDEAS.md) | Owner |
| OQ-22 | A-3/A-2 automatic WhatsApp sending costs money (WhatsApp Business API); accept the free "tap to send" queue? | Owner |
| OQ-23 | A-8 plan-vs-actual in the daily report: on or off by default? | Owner |
| OQ-13 | ~~Phase-1 split~~ **Resolved**: build targets 1a (testable core) and 1b (integrations) | — |
| OQ-14 | ~~One app or several~~ **Resolved**: one app with role spaces | — |
| OQ-12 | ~~Azure emulators?~~ **Resolved**: yes, Azurite + Cosmos emulator + Functions Core Tools in lab containers (M-32) | — |
| OQ-6 | Calorie and money "direct" coaching tone: acceptable as default, or default to "gentle"? | Choose |

## 16. Decision log

| ID | Decision | Source |
|---|---|---|
| DEC-1 | Shift grading mode follows the admin's syllabus; trainer may change it where allowed; default practice until capstone | Owner, iteration 5 |
| DEC-2 | Real Commons channels only when trainer-created or cohort-required; otherwise simulated with an AI manager | Owner, iteration 5 |
| DEC-3 | Anki is a first-class module, linked to the timeline, quizzes, the skill template and MCP | Owner, iteration 2 |
| DEC-4 | Companion app is required; full offline use; backup to the user's own repo | Owner, iteration 3 |
| DEC-5 | System 1 on device (Needle/Laya) as the non-technical alternative to MCP | Owner, iterations 3–5 |
| DEC-6 | Laya replaces UiPath's "decision" role; UiPath stays optional for real RPA | Owner suggested, iteration 5 |
| DEC-7 | Story mode is optional, one switch for the whole app | Owner, iteration 3 |
| DEC-8 | MarkItDown converts teacher uploads to Markdown | Owner, iteration 6 |
| DEC-9 | A modified Excalidraw that looks like the reference PDF and is shareable by QR is the content-section whiteboard | Owner, iteration 6 |
| DEC-10 | The skill template (v1.2) is the authoring engine; package5 is the reference output | Owner, iteration 6 |
| DEC-11 | pyviz_tutor visualises Python files | Owner, iteration 6 |
| DEC-12 | The 4-stage framework prompt governs coaching conversations | Owner, iteration 6 |
| DEC-13 | ~~Superseded by DEC-53~~ Stack: TypeScript; plain-TS core with zero dependencies; Effect v4 for hub and pipelines; Svelte 5 / SvelteKit offline web app; Excalidraw only on the board; Capacitor companion; node:sqlite; MarkItDown sidecar | Owner delegated to Claude, iteration 7 |
| DEC-14 | Trace viewer covers Python, JavaScript, Java, C and C++ | Owner, iteration 7 |
| DEC-15 | Algorithm visualizers inspired by Galles, VisuAlgo, DSA Visualizer, visualizedsa, Treelab | Owner, iteration 7 |
| DEC-16 | Coaching framework completed: stages 0 and 5, predicted options, plan cards, friction targets | Owner asked; Claude proposed, iteration 7 |
| DEC-18 | Trainer management stays minimal in phase 1 | Owner, iteration 8 |
| DEC-19 | Onboarding friction targets accepted | Owner, iteration 8 |
| DEC-20 | Spreadsheet cleanup is proposed by the user's connected AI over MCP as a diff (rule-based fallback) | Owner, iteration 9 |
| DEC-21 | Catalog: text in Forgejo git, large files in pluggable storage with Google Drive as default; missing content generated via MCP + skill template + gate | Owner + Claude, iteration 9 |
| DEC-22 | Check-in via the companion app; phones pair to a hub by QR and run offline with their own store | Owner, iteration 9 |
| DEC-23 | ~~Superseded by DEC-60~~ Self-hosted Forgejo for repos and AI teammate bots | Owner suggested, iteration 9 |
| DEC-24 | Shift scenario packs are generated by the skill template and pass the content gate; viewable on phone and desktop | Owner, iteration 9 |
| DEC-25 | Labs in Docker/Podman containers; Azurite added | Owner, iteration 9 |
| DEC-26 | Default learner goal derived from the syllabus; "accept defaults" everywhere, customise optional | Owner, iteration 9 |
| DEC-27 | Teleprompter on the trainer's phone (pacing, speed, pause, jump, summaries); board on the laptop; scanning the board QR adds it to the learner's account | Owner, iteration 9 |
| DEC-28 | Quick learn + diagnostic after class; default Anki cards; describe-a-card via AI or a form | Owner, iteration 9 |
| DEC-29 | Phase-1 build targets 1a + 1b; one app with role spaces; QR check-in, GPS deferred | Owner, iteration 10 |
| DEC-30 | Robustness first: primaries + sidegrades + last resorts for every dependency (P-13), feature switches (P-14), mandatory backup and sync (P-15) | Owner, iteration 10 |
| DEC-31 | Notebook board: pages not infinite canvas, auto-hiding sidebar, tables, shapes, drag-in `.mmd`/images, handwriting → Markdown alongside PDF/images | Owner, iteration 10 |
| DEC-32 | Cloudflare R2 added as a storage and backup target ("too many options is never wrong") | Owner, iteration 10 |
| DEC-33 | Hub installs seamlessly (single file / npx / script) on trainer and student computers; containers optional | Owner, iteration 10 |
| DEC-34 | Verbal syllabus → draft + confirmation PDF; change requests with a cohort change log; cohort → classes model; per-class seeds for graded items; Play Store distribution with a 4-way first-run choice | Owner raised, Claude proposed, iteration 11 |
| DEC-35 | Handwriting → text requires a strong vision model via MCP; only freehand strokes are recognised; trainer review | Experiment, iteration 11 |
| DEC-36 | Substitute role + one-tap handover pack; AI-delivered session in self-learn mode, marked in the report (F-01) | Owner, iteration 12 |
| DEC-37 | Catch-up gate: missed days unlock in order after quick-learn + 8-question diagnostic (6/8); live classes stay open (F-02) | Owner, iteration 12 |
| DEC-38 | Reversible "mark as dropped" switch runs all dropout automation (F-03) | Owner, iteration 12 |
| DEC-39 | Hosted site holds small records (accounts, attendance, grades, reports, health); hubs hold content and media (F-04) | Owner, iteration 12 |
| DEC-40 | PIN/biometric only for the Coach space and graded attempts; course content never behind a PIN (F-05) | Owner, iteration 12 |
| DEC-41 | Versioned Terms & Conditions accepted at signup (F-06) | Owner, iteration 12 |
| DEC-42 | Appeals: 7-day window, evidence pack, mode-normalised rubric, second reviewer, ledger entry (F-07) | Owner asked Claude to design, iteration 12 |
| DEC-43 | AI policy per graded item (off by default; trainer may allow); usage logged in the college report (F-08) | Owner, iteration 12 |
| DEC-44 | Accommodations opt-in at profile creation or via admin escalation (F-09) | Owner, iteration 12 |
| DEC-45 | English only (F-10); iOS only as a home-screen web app, no native iOS (F-14) | Owner, iteration 12 |
| DEC-46 | Hub's own CA for HTTPS; network kit guidance; design target 200 students per class hub (F-11, F-12) | Owner, iteration 12 |
| DEC-47 | "Add to my clock app" alarms via Android `ACTION_SET_ALARM`, alongside app notifications (F-16) | Owner, iteration 12 |
| DEC-48 | Colab notebook variants as the no-cost lab path (not a remote VM; Colab terms) (F-18) | Owner, iteration 12 |
| DEC-49 | No licence field: uploads tagged with uploader name; catalog is import-first, MCP generation optional (F-29, F-31) | Owner, iteration 12 |
| DEC-50 | Build both 18+ and minor profiles; lawyer review deferred until after dry runs, before the first paid college (F-36, F-37) | Owner, iteration 12 |
| DEC-51 | Secret scanning is a switch (on by default, turning off is logged); disk-encryption check is opt-in (F-39, F-41) | Owner, iteration 12 |
| DEC-52 | 200-student load test is a 1b acceptance gate; health digest on the hosted site; "no cloud" switch kept; all other F-rows' defaults locked (F-42, F-44, F-46) | Owner, iteration 12 |
| DEC-53 | Stack: TypeScript; plain-TS core; Hono + Zod server; React + Vite PWA, Capacitor in 1b; CouchDB/PouchDB sync; ts-fsrs; trimmed Excalidraw fork; n8n; every version pinned (replaces DEC-13) | Owner on the review, iteration 13 |
| DEC-54 | One codebase, deployment profiles cloud / hub / hybrid; data replicates between any of them | Owner asked for both; Claude designed, iteration 13 |
| DEC-55 | Per-learner databases; Turso not used (watch item) | Owner unsure; Claude, iteration 13 |
| DEC-56 | Borrow Frappe LMS's data model and certificates; ERPNext + Frappe HR for HR, expenses, invoices in phase 2 | Owner, iteration 13 |
| DEC-57 | Commons cut to the Shift's simulated channel; class chat on WhatsApp or similar | Owner, iteration 13 |
| DEC-58 | Board: plain background while drawing, notebook look only in PDF export; one-way live broadcast; hard fork trimmed with a performance budget | Owner + Claude, iteration 13 |
| DEC-59 | Google Meet: "start class on Meet" link in phase 1; Meet add-on later; Google Forms export optional | Owner, iteration 13 |
| DEC-60 | GitHub organisation primary, automated by a GitHub App; students create their own accounts (GitHub terms); AI personas are GitHub Apps; Forgejo offline sidegrade (replaces DEC-23) | Owner + Claude, iteration 13 |
| DEC-61 | No paid lab VM: hub containers, students' own Codespaces, Colab notebooks, optional Oracle free VM | Owner, iteration 13 |
| DEC-62 | GitHub Projects for sprints; Shift engine for ITSM practice; optional Jira week on the free plan | Owner + Claude, iteration 13 |
| DEC-63 | Coach (personal OS) is a separate app; integrates data via Health Connect, calendar, imports and launcher tiles | Owner, iteration 13 |
| DEC-64 | ~~Superseded by DEC-67~~ Build target 1a is the pilot slice, run with one real batch with a measurement plan before 1b | Owner unsure; Claude, iteration 13 |
| DEC-65 | Real-browser user-journey scripts (screenshots, video, throttled phone) are a hard gate | Owner, iteration 13 |
| DEC-66 | Trainer prep packs and mastery gates in generated content; passkey/Google login via join QR; embargoed encrypted content released in class; export/import zip; college-format reports; free observability; release channels; AI-resilient assessment | Owner, iteration 13 |
| DEC-67 | No pilot: build full 1a + 1b, run a live batch, note issues, then v2 (replaces DEC-64) | Owner, iteration 14 |
| DEC-68 | Feature picks from FEATURE-IDEAS.md: all accepted except C-2 (pending) and C-15 (Jira, off by default, phase 2); designs in that file's "Owner's picks" section | Owner, iteration 14 |
| DEC-17 | Admin trainer management inspired by Spark, with masked identity data and QR check-in option | Owner, iteration 7 |

## 17. Real-world changes the plan must absorb (iteration 11)

### 17.1 The syllabus is only given verbally

**Program from conversation** (admin):

1. The admin picks *New program → From a conversation*.
2. They speak or type what the coordinator said ("8 days, Azure cloud, AZ-204 level, they want a
   capstone"). Phone speech-to-text or the connected AI turns it into a draft topic list. Without
   AI, the admin builds the topic list from catalog chips (skills, days, hours).
3. The draft is matched to the catalog as usual (§6.1). Missing days are generated via MCP + skill
   template + gate.
4. **Confirmation loop:** the app produces a one-page syllabus PDF and sends it to the coordinator
   ("please confirm or correct by <date>"). The program's syllabus status is shown as
   **verbal → sent → confirmed**.
5. Teaching may start while the status is "verbal" or "sent", but graded items are pinned only from
   the version the coordinator confirmed. If they never confirm, the PDF that was sent is the record,
   which protects you in disputes.

### 17.2 The class changes mid-cohort

Every change is a **change request** in the cohort's change log: who asked (college, trainer,
admin), why, when, and what it affects.

| Change | What happens |
|---|---|
| **Schedule** (date, time, venue) | Sessions move. Every learner's and trainer's timeline re-plans and shows the re-plan diff (M-3), with a notification. A new venue gets a new site QR |
| **Content: topic added, removed or swapped** | A new **minor program release** (v1 → v1.1). Lessons update with a "changed" banner (F-34). Cards from removed topics are **suspended, not deleted**. Already-pinned graded items stay pinned unless the admin explicitly re-pins them (logged; affected learners notified) |
| **Graded-item change** (e.g. capstone scope cut) | Needs admin approval. Learners who already sat it keep their result; the rest get the new version. The report says which version each learner took |
| **Trainer change** | A substitute or new trainer is assigned (F-01). The teleprompter, board pages and batch board move with the batch, not with the person |
| **Pace change** ("finish two days early") | The planner compresses the remaining days. It proposes which lessons become self-study and which stay in class; the admin accepts. Learner plans re-plan accordingly |

### 17.3 Multiple classes per cohort

**Data model:** Program (syllabus) → **Cohort** (one college intake, e.g. "Riverside Sem 5, Aug
2026") → **Classes / sections** (A, B, a lab group, a different track such as Sem 3 vs Sem 5) →
Sessions.

- Each class has its own schedule, trainer, room/site QR and, optionally, its own track.
- A learner belongs to one cohort and one or more classes.
- A trainer can run several classes. Their timeline flags clashes and travel time between sites.
- **Commons:** one cohort channel plus one channel per class.
- **Graded items are seeded per class by default.** Sections sitting at different times get
  different papers and Shift seeds, so answers can't be passed from Section A to Section B. The
  admin can choose one seed per cohort instead.
- **Reports** roll up by class, then by cohort, for the coordinator.

### 17.4 Distributing the app through Google Play (owner has a developer account)

- **Build:** the companion app (Capacitor build of the same Svelte app, DEC-13) is published on
  Google Play under the owner's developer account. A signed APK for sideloading stays as a
  sidegrade (P-13).
- **First run asks one question with four answers:**
  1. **Use on this phone only:** personal Coach, no hub; phone-only mode; backups to R2/Drive.
  2. **Join a class:** scan the pairing QR or enter the join code (class hub or cloud hub).
  3. **Connect to a hosted hub:** enter a URL or scan its QR (the owner's cloud hub, or a college's).
  4. **Set up a hub on my computer:** a phone can't install software on a PC, so the app shows a
     link and QR to the hub download (§4.5), offers to share or email it, then waits to pair when
     the computer's setup page shows its QR.

  Any of these can be added later from Settings, and a phone can pair with several hubs.
- **Play Store obligations to verify before release** (not checked here):
  - the **Data safety** form must declare finance/health-type data (money and food trackers);
  - target API level requirements;
  - permission policies: camera (QR), notifications, **exact alarms** (avoid; F-16);
  - a privacy policy URL (F-37);
  - an age rating / children's policy (F-36).
- **iOS** is not covered by a Play Store app (F-14).

### 17.5 Handwriting recognition: tested (DEC-35)

Tested on the owner's real whiteboard page; full results in
[`experiments/handwriting/RESULTS.md`](../experiments/handwriting/RESULTS.md).

| Method | Clean page (out of 22 checkpoints) |
|---|---|
| Sonnet-class vision model | 21–22 |
| Haiku-class | 11–15 (misreads code) |
| Tesseract OCR (no AI) | **0** |

- A shape behind the writing, or a translucent shape over it, did not hurt the strong model.
- An opaque shape hides text. No model invented the hidden text, but one run misread nearby lines.
- **Conclusion:** handwriting → text **requires the connected AI (MCP) with a strong vision model.**
  The board will:
  1. pass typed text, stamps, tables and Mermaid to Markdown directly, with no recognition;
  2. send only the freehand strokes (shapes removed, strokes under shapes restored), per section, to
     the AI;
  3. offer recognition only above a model floor;
  4. always require trainer review.
- **Untested:** mouse-written strokes; stroke-based (on-device) recognition (OQ-15).

### 17.6 Failure questions

A reviewing agent produced **46 further failure scenarios**, each with a suggested default
([`FAILURE-QUESTIONS.md`](FAILURE-QUESTIONS.md)). **SPEC.md waits for the owner's answers**,
starting with the top 10 (OQ-16).

## 18. Owner's answers to the failure questions (iteration 12)

All 46 rows of [`FAILURE-QUESTIONS.md`](FAILURE-QUESTIONS.md) are answered. 22 take the suggested
default as written; 24 were changed or extended. The full designs (substitute and AI-delivered
sessions, catch-up gate, dropout switch, hosted/hub split, appeals, AI policy for graded work,
network kit, clock-app alarms, Colab labs, load test) are in that file's "Owner decisions" section,
sections A to J. Summary of what changes in this plan:

| Area | Change | DEC |
|---|---|---|
| Roles (§5, §6) | New **substitute** role; **AI-delivered session** when no human substitute exists | DEC-36 |
| Learner flow (§7) | **Catch-up gate** for late joiners and missed days | DEC-37 |
| Admin/trainer (§5, §6) | "Mark as dropped" switch; appeals inbox; per-item AI policy in the college report | DEC-38, 42, 43 |
| Architecture (§4.3) | **Hosted site** (small records) + **hubs** (content); class size target **200** | DEC-39, 46 |
| Privacy/security (§11) | PIN on Coach only; T&C at signup; both age profiles; secret scan and disk-encryption as switches | DEC-40, 41, 50, 51 |
| Devices (§4.3) | iOS = web app only; English only; clock-app alarms | DEC-45, 47 |
| Labs (M-32) | **Colab notebook variant** of light labs; heavy labs stay on the hub | DEC-48 |
| Content (§6.1) | Import-first catalog; uploads tagged with uploader name | DEC-49 |
| Operations | 200-student load test as a gate; health digest on the hosted site | DEC-52 |

### 18.1 Network kit (owner asked how and how much)

| Class size | Kit | Approximate cost (INFERRED from web search, Oct 2026; check before buying) |
|---|---|---|
| ≤ 30 | Laptop hotspot or a pocket travel router | ₹0 – about ₹3,000 |
| 30 – 60 | One business access point (TP-Link Omada EAP610 class) + a home router for DHCP | about ₹10,000 |
| ≈ 200 | 3–4 such access points, 8-port PoE switch, small router, cables | about ₹40,000 – ₹55,000 (switch/router/cables ASSUMED) |

Setup steps (fixed laptop IP on Ethernet, one network name, client isolation off, no login page)
are in FAILURE-QUESTIONS.md section G. The hub installer gains a **network check**.

### 18.2 Limits found while answering

- **Colab** cannot be used as a remote lab VM: its free tier disallows SSH and remote-access tools,
  and no tier allows hosting web services (Colab terms, checked Oct 2026). Labs therefore run *as
  notebooks inside Colab*. Whether Azurite and Azure CLI run in a current Colab runtime is
  unverified.
- **Colab as the load-test gate** works only against the cloud hub (it cannot reach a LAN hub);
  the primary load generator is a second laptop on the class network.
- **Exact alarms** in our own app stay out (denied by default on Android 13+); the clock-app hand-off
  avoids that permission, but our app cannot edit or delete those alarms afterwards.

### 18.3 A second opinion is waiting (OQ-17)

At the owner's request an independent agent reviewed the plan from a different angle
([`ALT-DESIGN-REVIEW.md`](ALT-DESIGN-REVIEW.md)). Its top proposals conflict with several locked
decisions (local-first P-1, Effect/Svelte DEC-13, Forgejo primary, one app with Coach inside).
**SPEC.md waits for the owner's decision on OQ-17.**

## 19. Decisions on the second-opinion review (iteration 13)

The owner answered [`ALT-DESIGN-REVIEW.md`](ALT-DESIGN-REVIEW.md) section by section (OQ-17).
Where the owner said "not sure" or "confirm it yourself", Claude researched it and decided; those
rows are marked **(Claude)** and the owner can still overrule them. Facts from web search in
October 2026 are INFERRED unless marked verified.

**Two things found while checking change earlier decisions:**

- **GitHub Classroom has shut down.** Sign-ups stopped in May 2026, and the service was
  decommissioned on 28 August 2026. GitHub accounts, organisations and repos are unaffected. A
  free open-source replacement, *Classroom 50*, was announced in July 2026 (not evaluated). The
  plan therefore does its own "repo per student from a template" through the GitHub API.
- **PocketBase cannot replicate between servers.** It is single-node by design (community sync
  add-ons exist but are early). Hub and cloud versions that share data (owner's 3.0) need
  replication, so the borrowed sync layer is the **CouchDB protocol** instead (§19.3).

### 19.1 Borrow or build (review §1)

| Row | Owner's answer | Decision |
|---|---|---|
| 1.1 Org, batches, certificates | Borrow from Frappe LMS where needed | Borrow Frappe LMS's **data model** (course → chapter → lesson, batch, certificate, quiz) and certificate templates. Frappe LMS is AGPL-3.0; copying code is fine as long as this repo stays open source under a compatible licence (owner is not selling) |
| 1.2 Cards | ts-fsrs | **ts-fsrs** replaces SM-2; `.apkg` export kept |
| 1.3 Chat | Only the Shift chat in the service; real chat on WhatsApp etc. | **Commons (M-11) is cut** to the simulated channel inside the Shift. Class chat lives in WhatsApp or similar; the app only sends deep links into it |
| 1.4 Board | Notebook look only in the PDF; plain colour background while drawing; trim for speed | Drawing canvas uses Excalidraw's background colour picker; the ruled-notebook look is applied **only when exporting the PDF**. Trimmed hard fork (§19.5) |
| 1.5 Live board sharing | Claude to decide | **(Claude)** The PDF/pages after class is the primary. Live follow-along is a **one-way broadcast** from the trainer's board to students over the hub's existing connection (trainer → students only; students annotate their own copy). No `excalidraw-room` server needed. It needs HTTPS (`crypto.subtle`), which the hub's own certificate authority provides (F-11) |
| 1.6 Video | A built-in Google Meet plugin | Phase 1: **"Start class on Meet"** creates a Meet link and posts it to the class. Later: a **Meet add-on** (Google's Meet add-ons SDK, npm `@googleworkspace/meet-addons`, side panel + main stage) that shows the board, quiz or teleprompter inside Meet. Whether add-ons work for free personal Google accounts is unverified |
| 1.7 Forge | GitHub org, but automate the account and setup work | See §19.2 |
| 1.8 Labs | No money | **No paid VM.** Free lab paths in order: (1) Docker/Podman on the hub, (2) **GitHub Codespaces** on each student's *personal* account (120 free core-hours a month; 180 for verified students). Codespaces opened from an organisation's classroom repos bill the organisation, so students open them from their own copy. (3) Colab notebook variants (DEC-48), (4) one **Oracle Cloud Always Free** VM for a small shared lab. Oracle halved its free Arm allowance to 2 cores and 12 GB from 15 June 2026, without announcing it, so the plan does not depend on it |
| 1.9 Tickets/sprints | Link issues and projects to sprints and other corporate exposure; does GitHub cover it? | GitHub Projects covers sprints (iteration fields), story points (custom fields), sub-issues, organisation-wide issue types, board and roadmap views, and burn-up charts. It does **not** cover ITSM (incidents, SLAs, on-call, change approval). The **Shift engine provides that**. Optional "Jira week" on Jira's free plan (up to 10 users per site, so one site per team) for students headed to Jira shops. Full list of corporate practices: FEATURE-IDEAS.md §C |
| 1.10 Sync | Borrow | Borrow, but **CouchDB/PouchDB instead of PocketBase** (§19.3) |
| 1.11 Live quiz | Integrate eduplay, restyled; can Google Forms be automated? | eduplay is integrated as the live-quiz module and restyled. **Google Forms export** is optional (§19.4) |
| 1.12 Payroll, invoices | Borrow ERPNext | **ERPNext (+ Frappe HR)** for HR, expenses and invoices, in phase 2, run in Docker only when needed. It is heavy (Python, MariaDB, Redis) and GPL-3.0. The LMS only exports delivery reports to it |
| 1.13 Automations | n8n | **n8n** replaces Node-RED (free self-hosted for your own use; reselling or hosting it for others needs a paid licence) |
| 1.14 Conversion | Same | MarkItDown, unchanged |
| 1.15 Personal OS | Integrate somehow, or run apps in the browser? | See §19.7 |

### 19.2 GitHub organisation with automation (1.7)

- **Students create their own GitHub accounts; nothing can create them automatically.** GitHub's
  terms require a human to create each account and forbid accounts registered by bots or other
  automated methods. Browser automation that signs students up would break the terms and risk
  the whole organisation. Each person may also own only **one** free machine account.
- **Everything after sign-up is automated** by a **GitHub App** installed on the organisation:
  1. the student taps "Connect GitHub" (sign in with GitHub) in the app, so it learns their
     username;
  2. the app invites them to the organisation and their team;
  3. it creates their repo from the day's template, sets branch protection, creates the
     project board with iterations, and adds starter issues;
  4. it removes access at batch end (or archives).
- **AI teammates (Ravi, Fatima) are GitHub Apps, not user accounts.** Each persona is its own App
  (shown as `ravi-bot[bot]`) that opens branches and PRs with short-lived installation tokens.
  This avoids the one-machine-account limit and expires tokens at batch end (F-40). *Verify:*
  that App-authored PRs look right in the students' review flow.
- Forgejo stays as the **offline sidegrade** (no internet at the site); the same steps run against
  its API.

### 19.3 Two deployment versions that share data (3.0, 3.2, 3.3, 3.4)

The owner wants both the **cloud-first** and the **local-first (hub)** designs built, wants to
choose between them, and wants them to share data.

- **One codebase, three deployment profiles**, chosen in the installer and switchable later:
  - **Cloud**: the PWA talks to the cloud server; offline cache plus outbox on the phone.
  - **Hub**: the PWA talks to the LAN hub; works with no internet.
  - **Hybrid** (DEC-39): small records to the cloud, content on hubs.
- **Why the CouchDB protocol makes this possible:** every node (phone, hub, cloud) holds databases
  that replicate both ways with any other node, with no leader. A class can start on the hub,
  move to the cloud, and come back without an export/import step. PouchDB runs in the browser and
  in Node (so the hub stays a single Node install); CouchDB runs on the cloud VM.
- **Per-learner database** (review 3.3): each learner's Coach data is its own database, encrypted
  with their key. Export is "copy the database"; deletion is "destroy the key" (F-24).
  **Turso is not needed.** Turso Sync's local-first push/pull is attractive, but it syncs to Turso
  Cloud, which conflicts with the hub and "no cloud" modes. It stays a watch item.
- **Risk:** PouchDB is maintained but slow-moving (9.0 in June 2024; Apache incubator since).
  Mitigation: versions pinned (3.2), with the sync layer behind an adapter interface plus
  contract tests, so it can be swapped.
- **PWA first for both profiles** (3.4). The Capacitor shell comes in 1b only for what a PWA
  cannot do: clock-app alarms (F-16), reliable notifications, and on-device models.
- **The build experiment** (§14) can now compare cloud and hub builds of the same SPEC.

### 19.4 Google Forms (1.11): what can be automated, and how to set it up

- The **Forms API** can create a form, switch it to quiz mode, add questions with point values,
  answer keys and feedback, and read responses. Choice and short-answer questions grade
  automatically.
- **Catch:** forms created through the API after 31 January 2026 are **unpublished by default**,
  so the app must publish them explicitly.
- **Use:** "Send this quiz as a Google Form" for colleges that require Forms, with responses
  pulled back into the grade ledger. eduplay stays the primary live quiz.
- **One-time setup (free):**
  1. In Google Cloud Console, create a project and enable the **Google Forms API** and
     **Google Drive API**.
  2. Configure the OAuth consent screen as *External*, in *Testing* mode, and add your own Gmail
     as a test user.
  3. Create an OAuth client (type *Desktop* or *Web*).
  4. Paste the client ID into the hub's Google settings and sign in once.
  5. Scopes requested: `forms.body` (create and edit) and `forms.responses.readonly` (read
     answers).
  6. *Simplest alternative:* an **Apps Script** using `FormApp`, run from your Google account, with
     no Cloud project needed. The hub can generate that script for you.

### 19.5 The board: trimmed hard fork (1.4, 6.3)

- Excalidraw 0.18 is copied once into `vendor/board/` as a **hard fork**: renamed, never updated
  from upstream, MIT notice kept.
- **Removed:** every language except English (F-10), the AI/text-to-diagram features that call
  external services, collaboration UI, and unused export formats. **Loaded on demand:** Mermaid
  import and the handwriting export.
- **Performance budget**, enforced by the journey gate (§19.6): the board opens in under 3 s on
  a throttled low-end Android profile (4× CPU slowdown, slow-4G network). Exact numbers become
  AC rows.

### 19.6 Hard gate: real browser user journeys (6.1)

- Every feature ships with **user-journey scripts** (`journeys/*.mjs`, Playwright on Chromium):
  "student scans join QR → passes catch-up gate → answers quiz", and so on.
- Each run records **a screenshot per step, a video and a trace**. It runs on desktop and on an
  emulated low-end phone (small viewport, CPU throttling, slow network).
- **A failing journey fails the gate.** No flag skips it (consistent with tins-kit's gate rule),
  and the report lists which steps passed and failed, with screenshots.
- The review's other build advice is adopted too:
  - frozen interface files written before a weak model starts a task;
  - golden tests from package5;
  - property tests for ledgers, scheduler and merge;
  - vertical-slice tasks;
  - a visible smoke subset of the hidden suite;
  - Sonnet for stateful parts (sync, timers, crypto) and Haiku for pure functions and screens.
- **Carry back to tins-kit:** the journey gate (screenshots, video, throttled phone profile) is
  a candidate tins-kit feature, measured in the build experiment.

### 19.7 Personal OS as a separate app (1.15, 7.14)

- **Running other phone apps inside a browser is not viable here.** It is technically possible
  (Waydroid or redroid run Android in a Linux container; ws-scrcpy streams a phone screen to a
  browser), but it needs a Linux server per user stream, costs money, is laggy on campus networks,
  and conflicts with many apps' terms. Wayland itself is a Linux display protocol, not a way to run
  apps in a browser.
- **What achieves "everything controlled from one app" instead:**
  - **Coach becomes a separate app** (same codebase, separate build and Play listing), so the
    college product carries no money, food or relationship data (DPDP, minors: F-36, F-38).
  - **Integrate data, not apps.** The phone's **Health Connect** gives food, steps and sleep from
    whatever apps the student already uses, with their permission per data type. The calendar
    comes from the phone's calendar. Money comes from a CSV or bank-statement import or the
    share sheet.
  - **Launcher tiles** deep-link into the student's existing apps (open the banking app, open the
    diet app), and the Coach shows the summaries it read.
  - The learning plan (the learning part of §7.0) stays in the LMS. Coach reads it so study
    blocks appear in the day timeline. One account links both apps.

### 19.8 Pilot, pedagogy, purpose and missing pieces (review §2, §4, §5, §7)

| Row | Owner's answer | Decision |
|---|---|---|
| 2.0 4-week pilot | Not sure | **(Claude)** Build target **1a is the pilot slice**: import + gate, daily quiz + cards, teleprompter, one Shift, trainer grid, attendance. Run it with one real batch before 1b. Pre/post and delayed retests are defined before the batch (7.1). This costs nothing extra because 1a was already the core |
| 3.6 Real-domain HTTPS on LAN | Not sure but okay | **Sidegrade** to the hub's own certificate authority (which stays primary because it works fully offline). Free route: a DuckDNS subdomain pointed at the hub's LAN IP, with a Let's Encrypt certificate by DNS-01 obtained while online. Limits: phones must resolve the name (offline sites need a local DNS entry on the router), and some routers block private-IP DNS answers |
| 4 Pedagogy | Put it into the content generated by the skill template; assume the trainer must self-learn first | Each generated day gains a **trainer prep pack**: prerequisites, a 45-minute self-study path, worked → faded examples, top misconceptions, "questions students will ask" with answers, and a private mastery check for the trainer. Student content gains **mastery gates** per skill (re-check after remediation, "not yet" rather than fail), faded examples in labs, interleaved card decks after week 1, peer-instruction quiz blocks (vote → discuss → re-vote), a **daily minimum path** (40 minutes), and a delayed retest 3–4 weeks after the course. Story mode off by default; no leaderboards (personal bests and team views instead) |
| 5 Business | Not selling; this is to make my life easier | Business sections dropped. The success metric becomes **trainer hours saved per week** (measured) alongside learning gains |
| 7.1 Measurement plan | Agree | Added: pre/post test, delayed retest, card adherence, Shift improvement, trainer time saved, support messages per student |
| 7.2 Sign-up and login | QR code? | **Yes:** the join QR (F-35 one-time code) → create a **passkey** on the phone (free, no SMS) or "Sign in with Google". No SMS OTP (it costs money). Recovery: 24-word key (F-20) or a trainer-approved reset (F-45) |
| 7.4 College-format reports | Add | Attendance sheet, completion report, CO-PO attainment export, PDF on the college letterhead (brand pack, F-46) |
| 7.5 Observability | Add | Free only: error capture to the hub's own log plus the daily health digest (F-44) pushed via a free push service; no paid error tracker |
| 7.6 Release management | Add | Staging profile, release channels (F-43), rollback, migration tests |
| 7.8 Low bandwidth | Preload when online and release during class | **Embargoed content:** each day's bundle downloads in advance whenever there is internet, **encrypted**. The day's key is released at class start (in the rotating attendance QR or by the hub/cloud at the scheduled time), so content opens offline exactly on time. Text-first lessons, compressed images, no video by default |
| 7.9 No subject-matter expert | I am alone | Replace the SME with: runnable checks (every code block runs in the lab container, F-27); a **second-model cross-check** of facts against the sources the generator cited; the trainer's own mastery check (row 4); learners' "report error" button |
| 7.10 AI-resilient assessment | Agree | Oral viva questions generated from the student's own repo; live Shift explanation; capstone defence |
| 7.11 Trainer scale-out | Hopefully capable | Kept minimal: the substitute handover pack (DEC-36) doubles as onboarding for any future trainer |
| 7.12 Data portability | Agree, but how? | **"Export everything"** (admin) and **"Export my data"** (student) produce one zip: `manifest.json` with checksums; CSV for rosters, attendance and grades (column layout modelled on the OneRoster CSV standard); Markdown for content and notes; JSON for events and ledgers; `.excalidraw` + PDF for boards; `.apkg` for cards; git bundles for repos; attachments. An **import** tool rebuilds a hub from the zip, and the restore test (F-25) uses the same format |
| 7.13 Cloud VM | Agree (with 1.8: no money) | Free options only (§19.1 row 1.8) |
| 7.14 Separate the Coach | Yes | §19.7 |

### 19.9 What this removes or moves

- **Cut:** M-11 Commons as a chat product (only the Shift channel remains); SM-2; Effect v4; Svelte;
  Node-RED; the "hub on every student laptop" idea is now **optional** (students use Codespaces,
  Colab or the class hub instead).
- **Moved out of the LMS:** Coach trackers (money, food, relationships) → separate Coach app.
- **Moved to phase 2:** payroll, expenses and invoices via ERPNext; the Meet add-on.
- **New:** GitHub App automation, deployment profiles, embargoed content, trainer prep packs,
  journey gate, export/import, passkeys, Google Forms export.

### 19.10 More features (owner: "I want to know what other features I could add")

The review deliberately listed alternatives, not new features. A separate list of **feature
ideas**, grouped by who they help and sized, is in [`FEATURE-IDEAS.md`](FEATURE-IDEAS.md) for the
owner to pick from (OQ-19).

## 20. Follow-up decisions (iteration 14)

| Topic | Owner's answer | Decision |
|---|---|---|
| Board sharing (1.5) | Board goes to the **projector**; Google Meet streams it to phones as an option | Laptop → projector is the primary. "Stream to phones" is an option through the Meet link (DEC-59). The one-way phone broadcast from §19.1 is **dropped** |
| Pilot (2.0) | No pilot: build everything, run it live, note issues, then v2 | **DEC-64 is replaced by DEC-67:** build the full 1a + 1b, run a live batch, record notes, then v2. Modules stay separate, so v2 can change any one of them alone |
| Sync | CouchDB | Confirmed (DEC-53/54) |
| HTTPS sidegrade | Free DuckDNS + Let's Encrypt, in a container? | Yes: a small **`acme.sh` container** (it supports DuckDNS's TXT records for the DNS-01 check) renews the certificate while online and hands it to the hub. Without Docker, `acme.sh` also runs as a plain shell script. The hub's own CA stays primary |
| Jira (1.9, C-15) | No Jira now; maybe later once the owner learns it | Jira is an **optional switch, off by default**, in phase 2. Everything else uses free GitHub features |
| Practice forge (1.9) | A simulated "bootleg" run before the real GitHub, for what GitHub does and doesn't do | See 20.1 |
| Google Forms (1.11) | Just an extra option for trainer and admin | An option in the trainer and admin menus, off until someone connects a Google account |

### 20.1 Practice forge, then real GitHub

Every forge exercise runs **twice**: first on the practice forge, then on real GitHub.

- **Practice forge = Forgejo on the hub, plus the app's own sprint and ITSM screens.**
  - Forgejo's pull requests, reviews, issues and Actions-compatible CI look and behave much like
    GitHub's, so the skills carry over.
  - Forgejo's project boards have no iterations or custom fields, so sprints, story points,
    burn-up charts, stand-ups, estimation and retros (C-1 to C-3) run in the app.
  - Things GitHub doesn't do at all (incidents, on-call, change approval, SLAs) also run in the
    app (the Shift engine), on both passes.
- **Real GitHub pass:** the same exercise against the class's GitHub organisation, set up by the
  GitHub App (§19.2).

### 20.2 Students without a GitHub account

- Automation needs only the student's **GitHub username**. Once they have one, the GitHub App does
  everything else (invite, team, repos, branch protection, project board).
- **No account yet:** the student works on the practice forge, which needs no GitHub account
  because the hub creates their Forgejo login. The app then walks them through GitHub sign-up
  (about 5 minutes, part of the Day −1 setup check, F-45) and moves their practice repos to GitHub
  once they link the account.
- **Never get an account** (refuses, or GitHub is blocked at the college): they stay on the practice
  forge for the whole course. Grading is the same, and the report notes "practice forge only".
- What cannot be automated: creating the account itself (GitHub's terms, §19.2), and the email
  verification step.

### 20.3 Coach in Waydroid: can it sync with the phone?

- **Our own Coach app does not need Waydroid.** It is a PWA, so it already runs in any browser,
  desktop or phone. Every copy of it (phone, browser, Waydroid) is just another device that
  **syncs through CouchDB replication**, like any other.
- **Waydroid is only useful for other people's Android apps** (a diet app, a banking app) shown on
  a computer. Those apps sync with the phone only through **their own** accounts (e.g. logging in
  to the same diet app on both). Our app can't sync their data directly; it reads their data on the
  phone through Health Connect.
- **Limits to know before trying:**
  - Waydroid needs a **Linux** computer running a Wayland desktop session, with the kernel's
    "binder" modules.
  - It does not run on Windows laptops or on phones.
  - Apps that check Play Integrity (most **banking apps**) typically refuse to run in it.
  - Streaming it to a browser adds noVNC or ws-scrcpy and a server per user.
- **Decision:** a small, scored **Waydroid experiment** like the handwriting test, before anything is
  built on it:
  1. our APK plus one diet app in Waydroid on a Linux laptop;
  2. streamed to a phone browser;
  3. measure setup steps, RAM, latency, and which apps run.

  The owner decides on the results (OQ-20).

### 20.4 Content released in step with the teleprompter (7.8)

- Each day's bundle is split into **sections that match the teleprompter script** (warm-up,
  concept 1, demo, lab, quiz…), each encrypted with its own key.
- **Live release:** when the trainer's teleprompter moves to a section, the hub pushes that
  section's key to the class, so notes and labs appear on students' phones exactly when the
  trainer reaches them.
- **Fallback when the hub can't reach a phone:** each section also unlocks at its **scheduled time**
  (the class start plus the script's planned timings). The trainer can release everything with one
  tap, and the rotating attendance QR carries the keys released so far.
- **Graded material is never released by the clock alone**; it needs the hub or the trainer's tap
  (fairness, F-17).
- Late joiners and absentees get everything through the catch-up gate (DEC-37).

### 20.5 Students who don't want to be on any hub (7.12)

Three levels, the student's choice:

1. **Cloud only:** no hub at all. They sync with the cloud profile (DEC-54).
2. **Phone only:** their data lives only on their phone, backed up to a target **they** pick (their
   own Google Drive, USB or R2). Course content arrives as downloadable bundles (link or QR).
3. **File exchange (no server at all):** submissions and attendance confirmations are exported as
   small signed files, which the student shares with the trainer by WhatsApp or USB. The trainer's
   app imports them.

Whichever they choose, **"Export my data"** gives them the portable zip (§19.8) at any time. The
college still needs a minimum record (attendance, grades), which reaches the trainer by one of
the three routes; nothing else leaves their phone.

## Changelog

- **v13**:
  - Added §20: projector + optional Meet streaming; full build instead of a pilot (DEC-67); acme.sh container for DuckDNS certificates; practice forge then GitHub; students without GitHub accounts; Waydroid limits and an experiment (OQ-20); teleprompter-paced content release; no-hub options for students.
  - FEATURE-IDEAS.md: owner's picks recorded with designs (DEC-68).

- **v12**:
  - Added §19: the owner's decisions on the second-opinion review. New stack (React + Vite PWA, Hono + Zod, CouchDB/PouchDB sync, ts-fsrs, trimmed Excalidraw fork, n8n); cloud/hub/hybrid deployment profiles sharing data; GitHub App automation; free lab paths; Coach split into a separate app; journey gate; export/import; embargoed content; trainer prep packs.
  - Found: GitHub Classroom shut down (Aug 2026); PocketBase cannot replicate; Oracle's free tier was halved (June 2026); Forms API forms are unpublished by default.
  - DEC-53 to DEC-66; OQ-17, OQ-18 resolved; new OQ-19 (pick features).

- **v11**:
  - Recorded the owner's answers to all 46 failure questions (§18, DEC-36 to DEC-52); designs in
    FAILURE-QUESTIONS.md sections A to J.
  - Network kit for 200 students; Colab notebook labs; clock-app alarms; appeals design.
  - Added ALT-DESIGN-REVIEW.md (independent second opinion); OQ-16 resolved; new OQ-17, OQ-18.

- **v10**:
  - Added §17: verbal syllabus, mid-cohort changes, multiple classes per cohort (cohort → classes
    data model, per-class seeds), Google Play distribution with a 4-way first-run choice,
    handwriting test results (DEC-35).
  - Added FAILURE-QUESTIONS.md (46 scenarios); OQ-16.

- **v9**:
  - Added P-13 to P-15 (degradation, switches, backup) and §4.4 degradation matrix.
  - Added §4.5 hub installation (incl. students' computers).
  - Rewrote §6.4 Notebook board: pages, sidebar, tables, drag-in Mermaid/images, quick-class
    mode, handwriting → Markdown.
  - Added M-35, M-36; M-27 moved to 1b; DEC-29 to DEC-33.
  - OQ-9, OQ-13, OQ-14 resolved; new OQ-15.
  - Verified facts: R2 free tier is **10 GB** (not 5); Azurite and Functions Core Tools run
    without Docker via npm; mermaid-to-excalidraw exists (MIT).

- **v8**:
  - Added §4.3 storage/hosting/devices; modules M-32 to M-34; DEC-20 to DEC-28.
  - OQ-12 resolved; new OQ-13 (phase-1 split), OQ-14 (one app vs several).
  - SIMULATED-RUN v2 adds Part H (planned but not exercised) and Part I (one app recommended).

- **v7**:
  - Added `SIMULATED-RUN.md` (input for OQ-1).
  - Resources 24, 25, 27 verified from the owner's links, with licences (classroom-analytics is
    GPL-3.0; TCH-Github_Evaluator has no LICENSE file); collect-homework added.
  - OQ-3, OQ-8 and OQ-11 resolved; OQ-9 recommendation; new OQ-12 (Azure emulators).
  - DEC-18, DEC-19.

- **v6**:
  - Added §4.2 stack (DEC-13), §5.1 trainer management from Spark (DEC-17), §6.5 multi-language
    traces (DEC-14), §6.6 algorithm visualizers (DEC-15).
  - Completed §7.0 coaching framework: stages 0 and 5, predicted options, Light/Standard/Intense
    plan cards, friction targets (DEC-16).
  - Added modules M-30 and M-31; resources U9, V1–V4, Python Tutor, Svelte, Effect.
  - OQ-2, OQ-4 and OQ-7 resolved; new OQ-8 to OQ-11. Admin steps A-13 to A-17, trainer steps T-22
    to T-26.

- **v5**:
  - Added §6.4 Notebook board (modified Excalidraw matching the owner's PDF, QR sharing).
  - Added §6.5 Trace viewer (pyviz_tutor).
  - Added §7.0 coaching framework.
  - Rewrote §6.1 around the skill template v1.2 and package5, with the file-mapping table.
  - Added MarkItDown (verified on real files), modules M-25 to M-29, resources U4–U8, P-11, P-12,
    DEC-8 to DEC-12, OQ-7; OQ-2 and OQ-4 reworded.
  - Trainer step IDs renumbered (T-1 to T-21).

- **v4**: consolidated v1–v3 plus research. Added:
  - DEC-1 and DEC-2;
  - Laya, needle-rs and Treelab;
  - verified/searched/name-only status for every resource;
  - the module list with phases;
  - the privacy data classes.
- **v3**: three role workflows; Shift; Commons; exam-forge as the assessment backbone.
- **v2**: 8-hour learning arc; resource table; System 1 / System 2; offline-first; backup.
- **v1**: personal OS coach; trackers; trainer view; knowledge graph; MCP.
