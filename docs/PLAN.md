# Coach LMS — Plan v4 (consolidated)

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

All AI reaches the app through **one tool layer** (`get_plan`, `propose_plan_edit`, `add_expense`,
`log_meal`, `cards_due`, `review_card`, `assign_ticket`, `post_message`, `search_graph`, …) and
**one decision interface** (`choice`, `score`, `yes_no`).

Swapping rules for Needle or Laya changes no other code. Hidden tests run against the rule-based
implementations.

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

## 6. Trainer workflow (Meera)

### 6.1 Before the batch: authoring at speed

| Step | What happens | Resources |
|---|---|---|
| T-1 | Writes **one skill template** per skill (e.g. "Docker basics"): objectives, lesson outlines, `::card` facts, practice task, quiz seeds, optional story panels. | exam-forge authoring prompt (1), Elementari (10) |
| T-2 | The **generator** expands the template into: lessons and study notes (with *Minimum viable knowledge* and *Common traps* callouts), **Anki cards**, a **validated question bank**, a **Saturday lab**, ticket templates, a **Shift scenario stub**, and optional **manhua panels**. | exam-forge (1), Anki (6), manhua idea (28) |
| T-3 | **Imports** old material: MCQ-Mastery text format; eduplay JSON packs; **a photo of a printed paper**, read by OCR into draft questions she confirms. | MCQ-Mastery (4), eduplay (5), Google_Form_Builder (3) |
| T-4 | Places skills in the **skill map**. Each node holds small tasks, with prerequisite links (Git → Docker → Cloud → CI/CD). | Skill Circuits (16), Treelab-style visual |
| T-5 | Creates **one Git repo per learner** from a template. | RepoBee (26) |
| T-6 | Writes or adapts **Shift scenario packs**: seeded ticket schedules, requester scripts, auto-checks against floci. | floci (2), Plane (20) |

### 6.2 In class (Tue/Thu 20:00)

| Step | What happens | Resources |
|---|---|---|
| T-7 | **Live PIN quiz** on the projector; learners join from phones over local Wi-Fi. Game types: boss battle, debug derby, code sprint, cloze, match, slider estimation, poll. | eduplay (5) |
| T-8 | **Whiteboard / mind map** shared to the class channel; auto-linked into the learners' knowledge graph. | AFFiNE (17), PM-app whiteboard |
| T-9 | **Sprint planning** on the class board: tickets, story points, 1-week sprints. Optional **AI Scrum master** and AI teammates. | Plane (20), Taiga (21), PACA (22) |
| T-10 | Runs a **class Shift**: same seed for everyone, leaderboard at the end. Practice or graded per syllabus (DEC-1). | §7 |
| T-11 | **Electives** run as stations: IoT (Sucre4Stem kits), flow-based embedded (Flowboard), robots in simulation (ROSBLOCKS), AI literacy (RAISE Playground), tree algorithms (Treelab). | 9, 11, 12, 13, 15 |

### 6.3 After class

| Step | What happens | Resources |
|---|---|---|
| T-12 | **Progress grid** (learners × skills): lessons, drill and quiz %, card retention, lab checks, tickets, Shift results. | MCQ-Mastery (4), Skill Circuits (16) |
| T-13 | **Git signals** per learner repo: commit and line stats, contribution score on the capstone rubric, class **contribution wall** on the projector. | 24, 25, 27 (see §12 note) |
| T-14 | **Feedback timeline:** dated notes per learner on a photo roster; one-tap stock notes. | student-tracker upload |
| T-15 | **Grading.** Exams and graded Shifts are seeded and pinned, and carry an integrity log that never accuses. Laya *suggests* rubric scores for postmortems and short answers; **Meera confirms** (P-2). | exam-forge (1), Laya |
| T-16 | **Paper route** when the room has no devices: question PDF or Google Form export, then import the responses. | exam-forge (1), Google_Form_Builder (3) |
| T-17 | **Automations:** e.g. "no commits for 3 days → nudge the learner and list them for me". Node-RED flows with Laya deciding. | Node-RED (14), Laya |
| T-18 | **Video stand-ups:** learners post 60-second updates on tickets. | PM-app upload |

## 7. Learner workflow (Arjun)

### 7.1 Day 0

1. Sign-up, then a join code (links him to Meera's batch).
2. **Personal OS interview**: goals, why they matter, wake and sleep times, fixed commitments,
   commute, income and fixed costs, height, weight and activity, diet, social energy, weekly
   learning hours, biggest time-waster, coaching tone.
   The owner's "personal OS prompt" replaces these questions when supplied; it is content, not
   code.
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
| Morning lessons | 2 h (3 × 40 min) | Study notes, then **drill with commit-before-reveal** (exam-forge) |
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

## 12. Resource coverage: all 38 items placed

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
| 24 | classroom-analytics | **name only** | Commit stats per learner | M-17 | 2 |
| 25 | TCH-Github_Evaluator | **name only** | Contribution and rubric scoring | M-17, T-15 | 2 |
| 26 | RepoBee | known | One repo per learner from a template | T-5 | 2 |
| 27 | open-source-pulse-wall | **name only** | Class contribution wall | T-13, A-11 | 2 |
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
| + | Laya | verified (repo) | Decide/route/guard: choice, score, yes-no in 100+ languages; moderation; triage scoring | M-14, M-20, §8, §9 | 2 |

**Note on 24, 25, 27:** I could not find these repos by name. Similar tools exist (Git Reporter,
GitHub's Pulse view). Links from the owner would replace guesses (OQ-3).

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
| OQ-1 | Phase-1 size: all 15 phase-1 modules, or a smaller first cut? | **Deferred by owner until approval** |
| OQ-2 | The "personal OS prompt" text | Paste it, or accept the interview questions in §7.1 |
| OQ-3 | Links for classroom-analytics, TCH-Github_Evaluator, open-source-pulse-wall | Links |
| OQ-4 | Stack: zero-dependency web app (recommended for the experiment) vs React/Vite | Choose |
| OQ-5 | Should Heading Strike move into phase 1 as a small, testable game core? | Yes/no |
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

## Changelog

- **v4**: consolidated v1–v3 plus research. Added:
  - DEC-1 and DEC-2;
  - Laya, needle-rs and Treelab;
  - verified/searched/name-only status for every resource;
  - the module list with phases;
  - the privacy data classes.
- **v3**: three role workflows; Shift; Commons; exam-forge as the assessment backbone.
- **v2**: 8-hour learning arc; resource table; System 1 / System 2; offline-first; backup.
- **v1**: personal OS coach; trackers; trainer view; knowledge graph; MCP.
