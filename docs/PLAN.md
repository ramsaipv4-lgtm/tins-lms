# Coach LMS — Plan v7 (consolidated)

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

### 4.2 Technology stack (DEC-13, chosen by Claude at the owner's request)

| Layer | Choice | Why | Checked |
|---|---|---|---|
| Language | **TypeScript** everywhere | One language for phone, browser, hub and tests | Node 22.22 runs `.ts` files directly (no build step for core tests): verified |
| Core logic (planner, scheduler, ledgers, Shift engine, exam assembly, graph) | **Plain TypeScript pure functions, zero runtime dependencies**, tested with `node --test` | Keeps the TINS gate honest; easiest for weaker models to build correctly; runs identically on phone, browser and hub | — |
| Hub and pipelines (server, sync, import and convert pipeline, MCP server, payroll runs) | **Effect v4** (`effect@rc`, version pinned exactly) | Typed errors, schema validation, retries, and the detailed error messages the owner asked for. The core `effect` package has no external dependencies | `4.0.0-rc.118` is on npm: verified. RC since 12 Aug 2026, no broad breaking changes planned (search) |
| UI | **Svelte 5 + SvelteKit** (static adapter), installable offline web app via `@vite-pwa/sveltekit` | Small bundles for 2021-era phones; explicit state (runes) suits offline-first | `svelte` 5.57.1 on npm: verified |
| Notebook board | **Excalidraw 0.18 (MIT, React)**, loaded only on the board page | The only React in the app, kept separate | 0.18.1, MIT: verified |
| Native companion app | **Capacitor** shell around the same Svelte app (Android first). System 1 runs as WebAssembly inside it (needle-rs, laya-ts); a Cactus native plugin comes later for speed | One codebase for web and phone | Not verified here |
| Hub storage | **SQLite via built-in `node:sqlite`**; ledgers stay append-only | No database server to install | Works on Node 22.22 (prints an "experimental" warning): verified |
| Content converter | **Microsoft MarkItDown** as a Python sidecar on the hub | The npm package named `markitdown` is a different, proprietary package and must not be used | Verified (npm metadata; Python MarkItDown run on package5) |
| Tests | `node --test` for core + the hidden acceptance suite; **Playwright** for UI flows | Both work offline; Chromium is available in the build environment | — |

Every dependency above becomes a locked D-row in `SPEC.md`; the tins-kit gate rejects any
dependency not named in one.

**Risk.** Models know Effect v3 better than v4 (v4 renamed core APIs, e.g. `Context.Tag` became
`Context.Service`). Mitigation: Effect is confined to the hub and pipelines, the version is pinned,
and a short v4 API crib ships as a tins-kit pattern.

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

The reference is the owner's whiteboard PDF: four 3840×2160 (16:9) pages of handwriting on ruled
notebook paper, in several pen colours. Each page follows the same teaching layout: *problem →
Example → Known → Assumption → Observation → Answer (code) → TRACE TABLE*.

| Change to Excalidraw | Detail |
|---|---|
| **Paper** | Ruled-notebook background (light grey with horizontal rules) instead of a blank canvas |
| **Pages** | Fixed 16:9 pages (3840×2160) as frames; page strip; next/previous page; export **multi-page PDF** matching the reference |
| **Pens** | Palette taken from the reference: black, red, orange, green, blue, purple. Pressure-sensitive strokes (Wacom / stylus) |
| **Teaching stamps** | One-tap section labels: *Problem, Example, Known, Assumption, Observation, Answer/Solution* |
| **Trace table** | Insert a green grid with named columns (e.g. Row (i), Column (j), Condition, Output); add rows while explaining |
| **Share by QR** | "Share" shows a QR code with the hub address + board id. Scanning it opens the board on a phone: **follow live** during class, or open the pages afterwards. It works on the classroom LAN with no internet. View-only by default; the trainer can allow learners to annotate their own copy |
| **Into the LMS** | Saved boards attach to the day's skill node, appear in every enrolled learner's "related" panel, and are linked from `whiteboard_dayNN.md` exercises |
| **Learner use** | Learners do the package's whiteboard exercises on the same board; recall exercises of type *diagram* are drawn here |

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
| M-8 | Anki: decks; basic, reversed and cloze cards; SM-2 scheduler; Anki text import/export; due reviews become timeline blocks | 1 (`.apkg` 2) |
| M-9 | Tickets and sprints (board, points, assignment) | 1 |
| M-10 | **Shift engine**: seeded scenarios, SLA timers, scoring, grading mode (DEC-1) | 1 (mock checks), 2 (floci checks) |
| M-11 | **Commons**: channels, threads, hub, scripted AI personas (DEC-2) | 1 |
| M-12 | Knowledge graph (tags + text similarity; Needle embeddings later) and node-graph visual | 1 (visual 2) |
| M-13 | MCP server exposing the tool layer | 1 |
| M-14 | Tool and decision interfaces with rule-based implementations (Needle and Laya plug in later) | 1 |
| M-15 | Offline web app shell, sync, encrypted backup to a private repo | 1 (backup 2) |
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
| M-27 | **Notebook board**: modified Excalidraw (ruled paper, 16:9 pages, pen palette, stamps, trace-table tool, PDF export, QR share, live follow) | 2 (needs Excalidraw as a dependency; see OQ-4) |
| M-28 | **Trace viewer**: one trace format; Python and JavaScript (phase 2), Java, C and C++ (phase 3); offline libraries; predict-then-reveal; send to board | 2–3 |
| M-29 | **Coaching framework engine**: stages 0–5, enforced halts, predicted options (rule tables), Light/Standard/Intense plan cards, versioned plans, friction targets | 1 |
| M-30 | **Trainer management** (Spark-inspired): profiles, compliance review (masked data), sites with QR or GPS check-in, schedules, delivery reports, expenses, payroll runs, quotations and invoices, approvals inbox, audit | 2 (proposed) |
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
| OQ-9 | Check-in default. **Claude's recommendation:** site QR code (no GPS, no photo). It is enough while you are the only trainer, and GPS/photo can be enabled per site later if you hire trainers | Accept or change |
| OQ-10 | Licences of Galles' visualizations, dsa-visualizer and Python Tutor backends must be checked before reusing any code; until then they are inspiration only | Accept |
| OQ-11 | ~~Friction targets~~ **Accepted** (≤ 5 min, ≤ 25 taps, ≤ 2 sentences) | — |
| OQ-12 | Azure track emulators (Azurite, Cosmos DB emulator, Functions Core Tools) on the hub: add as a phase-1.5 item? (floci covers AWS only) | Choose |
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
| DEC-13 | Stack: TypeScript; plain-TS core with zero dependencies; Effect v4 for hub and pipelines; Svelte 5 / SvelteKit offline web app; Excalidraw only on the board; Capacitor companion; node:sqlite; MarkItDown sidecar | Owner delegated to Claude, iteration 7 |
| DEC-14 | Trace viewer covers Python, JavaScript, Java, C and C++ | Owner, iteration 7 |
| DEC-15 | Algorithm visualizers inspired by Galles, VisuAlgo, DSA Visualizer, visualizedsa, Treelab | Owner, iteration 7 |
| DEC-16 | Coaching framework completed: stages 0 and 5, predicted options, plan cards, friction targets | Owner asked; Claude proposed, iteration 7 |
| DEC-18 | Trainer management stays minimal in phase 1 | Owner, iteration 8 |
| DEC-19 | Onboarding friction targets accepted | Owner, iteration 8 |
| DEC-17 | Admin trainer management inspired by Spark, with masked identity data and QR check-in option | Owner, iteration 7 |

## Changelog

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
