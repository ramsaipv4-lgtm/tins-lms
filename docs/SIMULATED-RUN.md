# Simulated run (v3) — one syllabus, one college, one student, one capstone

Purpose: let the owner decide the phase-1 scope (PLAN.md OQ-1) by watching one realistic run end to
end. **v2 applies the owner's corrections from iteration 9** (marked ✎). Companion to `PLAN.md` (v8);
IDs (M-n, T-n, A-n, DEC-n) refer to it.

**Everything here is simulated, except:**

- the course content: the owner's real **package5**, track `sem5_azure_cloud`: Day 0 + 8 days ×
  6 h, capstone *InvoiceFlow*;
- the syllabus: the real `University Training Sem 5 Syllabus.xlsx`;
- the problems marked **[real]**: found in those files.

**Cast:**

- **You**: admin and trainer.
- **Kavya**: the only student, from *Riverside Institute of Technology* (fictional), 5th semester.
- **Mr Rao**: the college's placement coordinator (fictional).
- **Ravi (AI, tech lead)** and **Fatima (AI, QA)**: always labelled as AI.

**Where things run in this run:**

| Thing | Runs on |
|---|---|
| **Hub** | Your laptop on the college Wi-Fi (works without internet), syncing to a cloud copy when online |
| **Your phone** | Companion app in *trainer mode*: teleprompter and check-in scanner |
| **Kavya's phone** | Companion app in *learner mode*, with its own local store, so it works fully offline |
| **Self-hosted Forgejo** (✎ V5) | Next to the hub, for her lab repo and the AI teammates' pull requests |
| **Lab containers** (✎ B7) | Docker or Podman on the hub, including **Azurite** |

---

## Part A — The admin receives a syllabus (you, as admin)

### A1. Monday, week −2: the request

Mr Rao emails `University Training Sem 5 Syllabus.xlsx`: "We need a trainer for the Sem 5 Azure
cloud elective, 8 days, starting in two weeks. One student has registered so far."

### A2. Upload and convert (M-25) ✎

1. Admin → *Programs* → *New from syllabus* → drop the `.xlsx`. The hub runs **MarkItDown** and
   shows the Markdown beside the original. **[real]: the raw output of this file is full of `NaN`
   cells from merged rows.**
2. ✎ **Cleanup through your connected AI.** The website asks the AI you connected over MCP (Claude
   Code, or another harness) to clean the table. The AI returns a **proposed cleanup as a diff**:
   - `NaN` rows removed;
   - merged "Day N" cells filled down;
   - subtopics nested under their day.
3. You accept it (or edit, then accept); nothing changes until you do (P-2).
4. **If no AI is connected,** the built-in rule-based cleanup does the same job, less smartly
   (P-3).
5. You tick the sheet you need: **Azure Cloud**.

### A3. Match against the content catalog, or generate what is missing (M-26, M-6) ✎

**Where the catalog lives (✎):**

- **Text content** (Markdown, question banks, scenario packs, about 90% of package5 by file count)
  goes in a **git repository on the self-hosted Forgejo**. That gives history, review and pinned
  releases.
- **Large files** (slide decks, videos, PDFs) go to **pluggable file storage**. The default adapter
  is **Google Drive** as you suggested; alternatives are any S3-compatible store (a self-hosted
  MinIO/Garage box, or a cloud bucket).

Why not Drive for everything: Drive is not versioned the way exam pinning needs (P-7). It also has
quotas (15 GB free, then paid plans) and API rate limits, so "never run out" still means paying for
a plan or adding a second store. See PLAN §4.3.

**What happens:**

1. The cleaned topic list is matched against the catalog. Best match: package5
   `sem5_azure_cloud`, 9 of 9 days covered, with per-day confidence.
2. ✎ **If a day were missing,** the website asks your connected AI (over MCP) to **generate it
   with the skill template**: the 7 artifacts, 3 companion files and student guide, plus the new
   **Shift scenario pack** (✎ B6). The output lands in the catalog as a draft and must pass the
   content gate like everything else.
3. **The content gate** runs on the package. It flags **[real]** that `COURSE-MAP.md` disagrees
   with the day folders for this track:

   | Day | COURSE-MAP | Day README |
   |---|---|---|
   | 2 | Foundry + Bicep | Computer Vision Solutions |
   | 3 | Building AI agents | NLP + Knowledge Mining |
   | 7 | CI/CD for AI | Capstone InvoiceFlow |
   | 8 | Capstone | AZ-204 Exam Cram |

4. You choose "day folders are the truth"; the gate regenerates the schedule, logs the decision and
   passes.

### A4. Program, site, trainer, batch (M-1, minimal M-30) ✎

1. **Program:** "Sem 5 Azure Cloud Engineer (AZ-204 aligned)", **pinned as release v1** (P-7).
2. **Site:** Riverside Institute. ✎ Check-in is **scanned with the companion app**. Two QR codes
   exist:
   - **Pairing QR** (once per device): shown by the website or hub. Scanning it in the companion
     app links that phone to your account and to this hub (laptop on the LAN, or the cloud copy).
     After pairing, the phone syncs with the hub whenever it can reach it, and keeps working
     offline in between.
   - **Site QR** (each visit): printed once and taped to the lab door. Scanning it records a
     check-in on the phone; the phone syncs it later if it is offline.
3. **Trainer:** search by skill ("Bicep", "Functions", "Cosmos DB") → only **you** → assign.
   Minimal trainer management only (DEC-18).
4. **Batch:** "Riverside Sem 5 Cloud — Batch 1". 9 sessions, 6 h each, Mon–Fri 09:30–15:30.
5. **Syllabus rules:** practice Shifts on Days 5–6; **graded capstone Shift on Day 7** (DEC-1); a
   graded, seeded, pinned practice exam on Day 8.
6. **Commons:** one required channel `#batch1` (you + Kavya); the team channel is simulated (Ravi,
   Fatima).
7. **AI policy:** System 1 on; System 2 allowed (Kavya may connect her own AI).
8. Send the join code to Mr Rao for Kavya.

**Admin time: about 25 minutes**, most of it reviewing the AI's cleanup diff and the gate's report.

---

## Part B — Trainer preparation (you), week −1

| Step | What you do | Module |
|---|---|---|
| B1 | Open the **skill map** generated from the package | M-6 |
| B2 | Skim the Day 0–1 **teleprompter scripts** on your phone (§D0 below) | M-26 |
| B3 | Prepare Day 1 **Notebook board** pages from `whiteboard_day01.md` | M-27 |
| B4 | Kavya's **lab repo** is created on Forgejo from the package's `lab-repo/` template; the bot accounts for Ravi and Fatima are added as collaborators | M-17, Forgejo |
| B5 | Day 0 Git warm-up: the **pulse wall** repo is mirrored to Forgejo, so the fork → PR → merge exercise works on the college Wi-Fi without GitHub | open-source-pulse-wall |
| B6 ✎ | The **Shift scenario pack** is **generated by the skill template** together with the rest of the day's content (new artifact: `shift_pack_dayNN/`: seeded ticket schedule, requester scripts, auto-checks), and it passed the same content gate. You only review it. It is viewable in both the companion app and the desktop | M-10, M-26 |
| B7 ✎ | **Labs run in containers** (Docker or Podman): one container image per day from the package's `lab/` files, plus **Azurite** (Blob on 10000, Queue on 10001, Table on 10002), the Cosmos DB emulator and Functions Core Tools. Auto-checks run inside the same containers | new M-32 |

**Gap 1 (still open):** Azurite does not emulate Azure Files or Data Lake. Document Intelligence has
no offline emulator, so that step uses recorded sample responses offline and the real service
online. Not verified here: that the Cosmos emulator container runs well on the classroom laptop.

---

## Part C — Kavya's onboarding (Day 0, 09:30) ✎

She installs the companion app and scans the **pairing QR** on the projector. Her phone is now
linked to the batch, and from here on it works offline.

| Stage | What appears | What she does |
|---|---|---|
| 0 Context | Domain cards, **Career / Learning pre-selected because she joined via a course** | Adds *Money* |
| 1 Goals ✎ | **A default goal derived from the syllabus**: "Complete the Sem 5 Azure Cloud elective and ship the InvoiceFlow capstone (AZ-204 aligned) by <end date>". The pre-filled wording adapts to her stage-0 choices | ✎ **Taps "Use this"**, or customises it (she adds "…that I can show in interviews") |
| 2 Constraints ✎ | Day strip pre-filled with the **batch timetable**; commute and self-study defaults | ✎ **"Accept defaults"** in one tap; she changes only the commute to 50 min |
| 3 Pathway | Light / Standard / Intense, with **Standard pre-selected** | Accepts |
| 4 Plan | Summary of adopted choices | **Save and start → Plan v1** |
| — | Placement test (readiness assessment) | 12 min |

**Simulated: about 2 min 40 s, 9 taps, 0 typed sentences** using defaults (targets: ≤ 5 min, ≤ 25
taps, ≤ 2 sentences). Customising everything stays within target.

---

## Part D — Delivery, day by day

### Day 0 — triage primer ✎

**Your phone: the teleprompter (✎ D0)**

- **Launch** today's script from the phone. Options:
  - **pacing mode**: running clock vs. auto-scroll;
  - **speed** (words per minute, adjustable while running);
  - **text size**;
  - **mirror** (for a glass prompter).
- **Pause anywhere** (tap), and **jump between sections** from a section list, e.g. *00:00
  Welcome → 00:12 Az CLI check → …*.
- **Summary view** for any section: 3–5 bullet points with the key idea, the mistake you planned to
  show, and the likely cross-question, so you can **improvise** instead of reading.
- **Behind schedule:** the phone shows how far behind you are and which later sections are marked
  optional.

**Your laptop: the screen (✎)**

- The laptop shows the **Notebook board** on the projector.
- When you tap *Share*, a **QR code appears on the board**. Kavya scans it with the companion app,
  and **that is the moment the board is added to her account**: it appears under Day 0 in her
  content, linked to the skill node.
- She can follow live and annotate her own copy.

**In class:**

- Azure CLI and container check (the Day 0 lab image runs on the hub).
- **Pulse wall warm-up** on Forgejo: she forks, adds her profile JSON, opens a PR; you review on the
  projector; her card lights up. Ravi (AI) opens a second PR so she can practise reviewing (how
  this works: Day 4 box below).
- You check in by scanning the site QR with your phone.

**After class:** the prefilled delivery report (6 h, 1/1 attendance); you add one remark.

### Days 1–3 — Azure AI services ✎

**In class:** your teleprompter plus the board; the board QR adds each day's pages to her account.
The live PIN quiz is *Kavya vs. ghost score*.

**After class, at home (✎ D1–3):**

1. **Quick learn + the 8-question diagnostic** (moved to after class): reading the 10-minute
   summary, then answering the diagnostic, both scheduled into her evening block.
2. **Default Anki cards are created automatically** from the day's `::card` facts, recall
   exercises and missed diagnostic questions (about 15–25 cards per day).
3. ✎ **Describe-a-card:** she types "a card about the difference between system-assigned and
   user-assigned managed identity".
   - *With her own AI connected:* it drafts the card (front, back, tags), she accepts or edits.
   - *Without AI:* she gets a two-field form (front, back) pre-filled with her sentence.
4. Board exercises (3 per day) on her own copy; lab in the day's container image; live-coding
   replay (the Python Function opens in the **trace viewer**); memory recall.

**Coach:** Day 2 she misses the 19:00 block → "Did it happen?" → "No" → the re-plan diff moves it to
07:30 and keeps the week total.

### Day 4 — Bicep modules: sprint with AI teammates ✎

You create "Sprint 1: InvoiceFlow infrastructure" with 4 tickets; assignees: Kavya, Ravi (AI),
Fatima (AI).

**✎ How an AI teammate "posts a PR".** Ravi and Fatima are **bot accounts on the self-hosted
Forgejo** (on GitHub it would be a GitHub App or bot user). There are two modes:

| Mode | How the PR gets made | When |
|---|---|---|
| **Scripted** (no AI needed) | The Shift/sprint pack contains a **prepared branch**: correct code plus one deliberate, documented flaw for her to catch in review. The hub pushes it as the bot account and opens the PR through Forgejo's API. Comments are scripted too ("Can you check the soft-delete setting?") | Always available; deterministic, so it can be graded |
| **AI-driven** | The connected AI works through the hub's MCP tools (`create_branch`, `commit_files`, `open_pr`, `comment`). The hub performs the git operations as the bot account. The AI can only act inside the bot's repos and ticket scope; every action is logged and labelled "AI" | When the batch's AI policy allows System 2 |

**In this run:**

- Ravi's PR (scripted) for the Key Vault module has a hard-coded secret name. Kavya catches it in
  review and requests a change; Ravi's bot pushes the prepared fix.
- Fatima (scripted) files a bug when the auto-check on Kavya's storage module fails (missing
  soft-delete).

### Days 5–6 — practice Shifts

- **Day 5 practice Shift** (30 min), generated pack, running in the lab containers with Azurite:
  - Kavya fixes a Key Vault access-denied ticket within its SLA;
  - she misses the SLA on a throttling ticket;
  - postmortem via coaching-framework stages 2–4 → one action item.
- **Day 6:** the failover Shift; both SLAs met.
- Both Shifts are visible on her **phone and desktop** (✎ B6). On the phone: ticket list, timers,
  requester chat, status posts. Hands-on fixes need the desktop or laptop.

### Day 7 — capstone InvoiceFlow (graded)

1. **Plan:** coaching framework stages 0–4. The default goal comes from the syllabus (✎ C1), and
   she accepts the defaults with one change (✎ C2). Risks shown: Document Intelligence quota on
   student subscriptions, Power BI needs a work/school account, Logic Apps cost. She picks
   **Standard** (real Azure, local chart instead of Power BI).
2. **Capstone plan v1** → 6 tickets with acceptance checks.
3. **Build:** first in the lab containers (Azurite + Cosmos emulator + Functions Core Tools), with
   Ravi's scripted reviews. Then she deploys to her Azure for Students subscription with one
   `az deployment`.
4. **Graded capstone Shift** (45 min, seed 4471, pinned, integrity log observe-only). P1:
   duplicate invoices → idempotency key. Score: SLAs 4/5, checks 5/5, triage 5/5, communication
   3/4. Laya suggests postmortem scores; **you confirm**.

### Day 8 — AZ-204 exam cram

- Seeded practice exam (100 questions, 150 min).
- Integrity events noted, never accused.
- Placement retest: networking 35% → 78%.
- Certificate.

---

## Part E — How the capstone came together

| Day | Artefact |
|---|---|
| 0 | Fork + PR on the pulse wall (Forgejo) |
| 1–3 | AI-service labs in containers; 9 board pages added via QR; about 60 default cards + 4 described cards |
| 4 | Bicep modules via sprint; reviewed and corrected an AI teammate's PR |
| 5–6 | Two practice Shifts (generated packs), postmortem actions applied |
| 7 | Capstone plan v1 → 6 tickets → container build → real Azure deploy → graded Shift |
| 8 | Exam report + retest + certificate |

**Your final view:**

- the repo report (commit frequency, commit quality, branch strategy, documentation, contribution
  vs. AI bots, which are labelled);
- the capstone score;
- her portfolio page (endpoint, repo, board pages, Shift report).

---

## Part F — After the course

- **Kavya:**
  - coach continues (money goal, Anki, next arc: AZ-204 exam in 6 weeks);
  - data on her phone + encrypted backup.
- **You:**
  - `collect-homework summary` over the Forgejo repos;
  - the delivery report to Mr Rao;
  - the package fix (COURSE-MAP) committed to the catalog repo for Batch 2.

---

## Part G — What this run used: input for OQ-1

| Module | Used? | Minimum this run needed | Proposed phase |
|---|---|---|---|
| M-1 Org, roles, accounts; **device pairing QR** ✎ | Yes | Admin/trainer/learner, join code, pairing | **1** |
| M-2/M-29 Coaching framework + onboarding (**syllabus-derived defaults, "accept defaults"** ✎) | Yes | Stages 0–5, defaults, cards | **1** |
| M-3 Planner, re-plan, reminders | Yes | Timeline, re-plan diff, local notifications | **1** |
| M-4 Trackers | Money only | Money ledger, tasks | **1** (food, quests 1.5) |
| M-5/M-25 Conversion + **AI cleanup via MCP with rule fallback** ✎ | Yes | XLSX → topics, diff review | **1** |
| M-26 Package import + content gate (+ **Shift packs from the skill template** ✎) | Yes; caught real drift | Mapping, gate | **1** |
| **Catalog storage: Forgejo repo + file-storage adapter (Drive default)** ✎ | Yes | Git catalog + Drive adapter | **1** (Drive), other adapters 2 |
| **Generate missing content via MCP** ✎ | Not needed in this run | Request → draft → gate | **1.5** |
| M-6 Skill map | Yes | From package | **1** |
| M-7 Study / drill / exam | Yes | Quick quiz (after class), drill, seeded exam | **1** |
| M-8 Anki (+ **default cards, describe-a-card** ✎) | Yes | Scheduler, auto cards, form/AI card | **1** |
| M-9 Tickets and sprints | Yes | Board, assignment, auto-checks | **1** |
| M-10 Shift engine (phone + desktop views ✎) | Yes | Seeded packs, SLA timers, modes | **1** |
| M-11 Commons + scripted AI personas | Yes | One real channel, scripted bots | **1** |
| **Forgejo + bot accounts (scripted PRs)** ✎ | Yes | Self-hosted forge, bot users, API PRs | **1** |
| **M-32 Lab containers (Docker/Podman) + Azurite + Cosmos emulator** ✎ | Yes | Per-day images, checks in containers | **1** |
| **Teleprompter on the trainer's phone** ✎ | Yes, daily | Launch, pacing, speed, pause, section jump, section summaries | **1** |
| M-27 Notebook board + **QR-adds-to-account** ✎ | Yes, daily | Board on laptop, QR share, ownership on scan | **1** (✎ promoted: the run depends on it daily) |
| M-12 Knowledge graph | Lightly | Related panel | 1.5 |
| M-13/M-14 MCP + tool/decision interfaces | Yes (cleanup ✎, cards ✎, optional AI PRs) | MCP server + rule implementations | **1** |
| M-15 Offline app + sync (phone runs its own store ✎) | Yes | Offline store on phone, hub sync (LAN or cloud) | **1** (backup 2) |
| M-16 Live PIN quiz | Yes (ghost) | Single-player ghost | 2 |
| M-17 Git analytics | Yes | Repo from template, stats, summary | 1.5 |
| M-28 Trace viewer | Once (Python) | Python only | 2 |
| M-30 Trainer mgmt (minimal) | Yes | Profile, site QR, schedule, delivery report | **1 (minimal)** |
| M-31 Visualizers | Once | One player | 2 |

**Phase-1 proposal after v2:** 21 items at their minimum form. The Notebook board moved into phase
1, because the corrected run depends on it every day. **Honest size warning:** this is about
**twice** the v7 proposal. For the model-build experiment, OQ-1 can be split into **1a**, the
testable core (accounts, coaching framework, planner, trackers, package import + gate, Anki, exam,
tickets, Shift engine, MCP interfaces), and **1b**, the integrations (Forgejo bots, containers,
board, teleprompter, pairing).

---

## Part H — Planned but NOT in this simulated run (✎ owner asked)

Everything below is in PLAN.md but was not exercised by this one-student cloud run:

| Area | Not exercised | Why it didn't appear | Phase |
|---|---|---|---|
| Personal OS | **Food/calorie tracker**, **relationship micro-quests**, **"where did I keep it"** items | Kavya answered "ask me later" | 1.5 / 2 |
| Personal OS | **Encrypted backup to a private repo**, native push notifications | Not needed in 8 days | 2 |
| AI | **System 1 on device** (Needle via needle-rs/Cactus, Laya in the browser) beyond Laya rubric suggestions; **native companion with Cactus** | Rules were enough | 2 |
| AI | **UiPath via MCP**, **Node-RED automations** (trainer nudges, personal automations, automation tickets) | Not in this syllabus | 2 / 3 |
| Learning | **Story mode (manhua)**, **Heading Strike** game, e-Lecture mode | Optional presentation layers | 2 |
| Learning | **Multi-language traces** (JavaScript, Java, C, C++), most **visualizers**, graph/tree editor | Only one Python trace and one visualizer were needed | 2–3 |
| Learning | **Electives**: RAISE Playground, Treelab, Sucre4Stem, Flowboard, ROSBLOCKS, "build an MCP tool" | Not in this syllabus | 3 |
| Learning | **Placement-to-arc for personal goals** (fitness arc, money arc) | Cloud course only | 2 |
| Classroom | **Multiplayer live quiz**, real multi-member **Commons** channels and teams, mixed human/AI teams, class **leaderboards** | One student | 1.5 (works, but untested by this run) |
| Classroom | **Paper exam / Google Forms export**, **OCR import** of printed questions | Everyone had devices; content existed | 2 |
| Classroom | **Exam camera tier** (face presence) | Not enabled | 2 |
| Classroom | **Video stand-ups**, AFFiNE-style notes editor, mind maps | Not needed | 2 |
| Classroom | **Cloud labs on AWS (floci)** | Azure track used Azurite instead | 1.5 |
| Admin | **Payroll, expenses, quotations, invoices, compliance documents, approvals inbox, academy dashboard, assets with QR (homebox)**, certificates templates beyond default | DEC-18: minimal trainer management for now | 2 |
| Admin | **Multiple trainers**, trainer matching, multi-batch / multi-track programs, cohort pinning across batches (Batch 2 reuse) | Only you, one batch | 1.5 |
| Integrations | **GitHub/GitLab adapters** (instead of Forgejo), **S3/MinIO** storage adapters, PACA integration | Forgejo + Drive sufficed | 2 |
| Experiment | The tins-kit **model builds** (Haiku/Sonnet) and **carry-over measurement** | That happens after you approve the plan | after OQ-1 |

---

## Part I — One app or several? (✎ owner asked)

**Recommendation: one app, one account, with role-based spaces, and two shells.** Plus two
background services that are not "apps" to the user.

| What | Form | Who sees it |
|---|---|---|
| **Coach LMS app** | One codebase (Svelte), installed as the **companion app** on phones (Capacitor) and opened as the **website** on laptops | Everyone; the spaces shown depend on role |
| Spaces inside it | **Coach** (personal OS: plan, trackers, notes), **Learn** (courses, cards, Shifts, tickets), **Teach** (teleprompter, board, batch board, reports), **Admin** (programs, sites, trainers, catalog) | Coach + Learn: learners. Teach: trainers. Admin: admins. You see all four |
| **Hub** | A server process (laptop on LAN, or cloud) | Nobody "uses" it; it syncs, hosts classes, runs MCP |
| **Forgejo + lab containers** | Separate services next to the hub | Seen only through the app's links |

**Why one app:**

1. **One identity:** your trainer schedule and your own coach plan are the same timeline.
2. **One sync engine and one offline store.**
3. **One set of notifications,** instead of several apps competing.
4. **Shared building blocks:** the board, Anki, the Shift viewer and the teleprompter are used
   across roles.
5. **One thing to install** at a college with weak Wi-Fi.

**What would justify splitting later:**

- **App-store and branding:** "Coach" as a personal product for people who never join a course, and
  "Academy" for institutions. The same codebase could still ship two builds with different spaces
  enabled.
- **A display-only kiosk build** for classroom screens (board + live quiz only).
- **Privacy positioning:** an institution may want the personal Coach space disabled entirely on
  managed devices; a build flag handles this.

**Privacy rule that makes one app safe (P-5):** the Coach space's data (money, food, plan,
relationships) is stored and synced **separately** from Learn/Teach data. Joining a batch never
grants the trainer or admin access to it.

---

## Part J — The same run when things go wrong (v3, owner's robustness request)

Each line is a realistic failure, what the system does (P-13, §4.4), and what you or Kavya notice.

| When | What goes wrong | What the system does | What you notice |
|---|---|---|---|
| Week −2 | The hub laptop has **no Docker or Podman** | The capability check marks containers red; labs switch to **native mode** (Azurite and Functions Core Tools from npm) | Health screen: "Labs: native (containers not found). Install Podman?" One tap installs it later |
| Week −2 | Python is missing, so **MarkItDown can't run** | Your connected AI converts the spreadsheet instead; the original stays attached | The diff review looks the same |
| Week −1 | The college says **"no certificates, just a completion report"** | Program switch: certificate off → completion report on | Day 8 produces the report, no certificate |
| Day 0 | **Forgejo won't start** after a laptop update | Forge sidegrade → **GitHub**: Kavya's repo and the bot accounts move there (GitHub App / bot user); the pulse-wall exercise uses the GitHub mirror | Health: "Forge: GitHub (Forgejo down)". Nothing else changes for Kavya |
| Day 0 | **No internet** at the college (and GitHub is the active forge) | Forge last resort → **bare git on the hub** over the LAN; PR review happens in the app's diff view | The Git warm-up still runs; PRs sync to GitHub when online |
| Day 2 | **You couldn't prepare** (a late evening) | You tap "I'm not prepared": **quick-class mode**. The board sidebar shows the day's Mermaid diagrams and images to drag in, plus section summaries; the teleprompter shows summaries only | You teach from the sidebar; the board still exports PDF + Markdown afterwards |
| Day 3 | The lab needs **Azure Files**, which Azurite doesn't cover | That step declares a sidegrade: run against her **Azure for Students** subscription; offline, the step becomes **recorded responses** | The lab page says "Step 4 runs on real Azure (Azurite has no Files emulation)" |
| Day 5 | **Kavya's phone is lost** | Her new phone pairs to her personal hub (on her laptop) or restores the **encrypted backup from R2** with her passphrase | She loses nothing since the last sync |
| Day 5 | Her AI connection **expires mid-Shift** | Requester replies drop back to **scripted** mode | The Shift continues; the report notes "scripted replies from 14:12" |
| Day 7 | **Document Intelligence quota** on her student subscription is exhausted | Capstone step falls back to **recorded responses** for extraction; everything else stays live | Capstone report marks that step "recorded", and the graded rubric allows it (declared in the pack) |
| Any | **Handwriting recognition** isn't available (no AI, no on-device ink) | Board exports PDF + images; Markdown has headings and tables from tools but the handwriting stays as images | "Text: 0 handwriting blocks recognised. Retry when AI is connected" |
| Any | The class hub laptop **dies** | Phones keep working offline (phone-only mode); the **cloud hub** or Kavya's personal hub takes over sync; the class hub restores from the backup when it is back | Nobody loses work |

**What this adds to phase 1:** the capability check, the Health screen, and an acceptance test per
fallback row (M-35); backup to R2 + local export with a tested restore (M-36).
