# Simulated run — one syllabus, one college, one student, one capstone

Purpose: let the owner decide the phase-1 scope (PLAN.md OQ-1) by watching one realistic run end to
end, and seeing which modules actually get used. Companion to `PLAN.md` (v7); IDs (M-n, T-n, A-n,
DEC-n) refer to it.

**Everything here is simulated, except:**

- the course content: the owner's real **package5**, track `sem5_azure_cloud`: Day 0 + 8 days ×
  6 h, capstone *InvoiceFlow*;
- the syllabus: the real `University Training Sem 5 Syllabus.xlsx`;
- the problems marked **[real]**: found in those files.

**Cast:**

- **You** are both admin and trainer, as today.
- **Kavya** is the only student enrolled from *Riverside Institute of Technology* (a fictional
  college), 5th semester.
- **Mr Rao** is the college's placement coordinator (fictional).
- AI teammates appear as **Ravi (AI, tech lead)** and **Fatima (AI, QA)**, always labelled.

---

## Part A — The admin receives a syllabus (you, as admin)

### A1. Monday, week −2: the request

Mr Rao emails `University Training Sem 5 Syllabus.xlsx`: "We need a trainer for the Sem 5 Azure
cloud elective, 8 days, starting in two weeks. One student has registered so far."

### A2. Upload and convert (M-25)

1. Admin → *Programs* → *New from syllabus* → drop the `.xlsx`.
2. The hub runs **MarkItDown** and shows the Markdown side by side with the original. One sheet per
   track (AWS, Azure…).
3. The **cleanup pass** removes the `NaN` cells left by merged rows **[real]: the raw conversion of
   this file is full of them**, and turns the table into a topic list:
   *Day 1 Overview of ML concepts → subtopics…*
4. You tick the sheet you need: **Azure Cloud** (it lives in the same workbook).

### A3. Match to existing content (M-26, M-6)

1. The topic list is matched against the **content catalog**. Best match: package5 track
   `sem5_azure_cloud`, 9 of 9 days covered, with per-day confidence. Nothing needs generating
   from scratch.
2. **The content gate runs on the package before you can publish it.** It flags **[real]** that
   `COURSE-MAP.md` disagrees with the day folders:

   | Day | COURSE-MAP | Day README |
   |---|---|---|
   | 2 | Foundry + Bicep | Computer Vision Solutions |
   | 3 | Building AI agents | NLP + Knowledge Mining |
   | 7 | CI/CD for AI | Capstone InvoiceFlow |
   | 8 | Capstone | AZ-204 Exam Cram |

3. You choose **"day folders are the truth"**. The gate regenerates the program schedule from the
   folders, records the decision in the program's change log, and passes.

   *(This is exactly the class of drift the gate exists for. Without it, the student's timeline
   would have told her Day 7 is CI/CD while the class did the capstone.)*

### A4. Program, site, trainer, batch (M-1, minimal M-30)

1. **Program:** "Sem 5 Azure Cloud Engineer (AZ-204 aligned)", built from the gated package,
   **pinned as release v1** (P-7).
2. **Site:** Riverside Institute, address, check-in method **QR code** (you print the site's QR
   code once and tape it to the lab door).
3. **Trainer:** search trainers by skill ("Bicep", "Functions", "Cosmos DB"). Only one result:
   **you**. Assign yourself. *(Minimal trainer management, as you asked: profile with skills,
   assignment, schedule. Payroll, expenses and invoices stay out for now; OQ-8.)*
4. **Batch:** "Riverside Sem 5 Cloud — Batch 1". 9 sessions (Day 0 + Days 1–8), 6 h each,
   Mon–Fri 09:30–15:30, starting week 0.
5. **Syllabus rules:**
   - Shifts: practice on Days 5–6; **graded on Day 7** (the capstone Shift). This is DEC-1, with you
     as the admin setting it.
   - Day 8 practice exam: graded; seeded and pinned.
6. **Commons policy** (DEC-2): one real channel is required, `#batch1` (you + Kavya). The team
   channel is **simulated**: with one student there is no team, so Ravi and Fatima (AI) fill it.
7. **AI policy:** System 1 on (on-device) + System 2 allowed (Kavya may connect her own AI over
   MCP).
8. You send the **join code + QR code** to Mr Rao for Kavya.

**Admin time spent: about 25 minutes**, most of it reading the gate's mismatch report.

---

## Part B — Trainer preparation (you, as trainer), week −1

| Step | What you do | Module |
|---|---|---|
| B1 | Open the **skill map** generated from the package: Azure basics → AI services → Bicep → security → multi-region → capstone; each node lists its tasks | M-6 |
| B2 | Read Day 0–1 **teleprompter scripts** (from `instructor_script.md`): `[SAY]`/`[DO]` lines, running clock, cross-question callouts | M-26 |
| B3 | Prepare **Notebook board** pages for Day 1 from `whiteboard_day01.md`: ruled paper, 16:9 pages, the "four-portal tour" diagram roughed in | M-27 |
| B4 | Create Kavya's **lab repo** from the package's `lab-repo/` template. One student, so one repo; the same command would create 40 | M-17 (RepoBee-style) |
| B5 | Add the **Git warm-up** for Day 0: the class forks the *pulse wall* repo and opens a PR adding her profile card (fork → branch → commit → PR → review → merge in one session) | open-source-pulse-wall |
| B6 | Write one **Shift scenario pack** from the capstone: *"InvoiceFlow on-call"*: 5 seeded tickets (duplicate invoice, a blob trigger not firing, a Cosmos throttling alert, a Key Vault access denial, a customer asking where her invoice is) | M-10 |
| B7 | Check the **lab environment**: see *Gap 1* below | — |

**Gap 1 [design]: emulators.** floci emulates **AWS**, but this track is **Azure**. For offline
practice, the hub needs the Azure equivalents:

- **Azurite** (Blob, Queue, Table);
- the **Cosmos DB emulator**;
- **Functions Core Tools** running locally;
- **Document Intelligence** has no simple offline emulator, so that step uses recorded sample
  responses offline and the real service online.

The real deployment (Day 7 evening onward) needs an Azure subscription; the plan assumes the
*Azure for Students* credit. **Not verified here:** whether each emulator runs on the classroom
laptop.

---

## Part C — Kavya's onboarding (Day 0, 09:30)

She scans the join code. The coaching framework (§7.0) runs in low-friction mode:

| Stage | What appears | What she does |
|---|---|---|
| 0 Context | Domain cards | Taps *Career / Learning* and *Money* |
| 1 Goals | 4 predicted goals for "Sem 5 cloud elective" | Taps "Pass the course with a capstone I can show in interviews" and edits a predicted money goal to "Save ₹2,000/month from pocket money" |
| 2 Constraints | Day strip + sliders + pitfall chips | Drags college hours 09:30–15:30, a commute of 50 min each way, self-study 1 h/day; ticks pitfalls "I start late on assignments" and "phone in bed" |
| 3 Pathway | Light / Standard / Intense cards | Picks **Standard**: 6 h/week self-study, review daily, capstone prep from Day 5 |
| 4 Plan | "Adopted: 1 h/day self-study after 19:00; added a 22:30 phone-down block" | **Save and start → Plan v1** |
| — | Placement test (sectioned, from the readiness assessment) | 12 min; strong on programming, weak on networking: the arc adds a networking primer card set |

**Measured (simulated): 4 min 50 s, 21 taps, 1 typed sentence**, within the OQ-11 targets. Diet,
fitness and relationship questions were answered "ask me later".

Her phone now shows tonight's plan: commute audio (Day 1 summary), a 19:00 self-study block (Day 1
`quicklearn`), a 21:30 Anki block (12 cards), and a 22:30 phone-down block.

---

## Part D — Delivery, day by day

### Day 0 — triage primer (you + Kavya, in the lab)

**You:**

- Teleprompter on the laptop; Notebook board on the projector.
- "Share" puts a **QR code** on screen; Kavya scans it and follows the board live on her phone.
- Check-in: you scan the site QR code at the door (no GPS, no photo).

**Kavya:**

- Azure CLI and Codespaces setup (the package's Day 0 checks).
- **Pulse wall warm-up:** she forks, adds her profile JSON, opens a PR. You review on the
  projector; the merge lights up her card on the wall.
- *With one student the wall has one card. Ravi (AI) "opens" a second PR so she can practise
  reviewing, clearly labelled as an AI PR.*

**After class:**

- The **class delivery report** is prefilled (6 h, attendance 1/1, quiz results, wall activity);
  you add one remark.
- Your own coach timeline marks tomorrow's prep block.

### Days 1–3 — Azure AI services (the 90-minute block, every day)

| Step | Kavya | System behaviour |
|---|---|---|
| Read | `quicklearn` + 8-question diagnostic | Diagnostic answers go to drill stats; misses become **Anki cards** |
| Board | 3 timed exercises from `whiteboard_dayNN.md` on her own copy of the board | Saved to the Day N skill node |
| Lab | Lab files in her repo (SDK calls, Bicep) | Commits appear on your **Git signals** view |
| Live coding | Replays your recorded session (an intentional bug at about 18:00); for the Python Function she opens the **trace viewer** | The trace can be sent to the board as a trace table |
| Recall | 5 closed-book exercises | Recite and Feynman answers become cards |

**In class:**

- A **live PIN quiz** with one player becomes *Kavya vs. ghost* (last cohort's anonymised scores,
  or a target score), so the game still works.
- **Day 2 visualizer moment:** you open the hashing visualizer to explain partition keys before
  Cosmos DB, and Kavya does "predict the next step" twice.

**Coach:**

- Day 2 she misses the 19:00 block. The app asks "Did it happen?" → "No".
- The **re-plan diff** moves it to 07:30 the next morning and keeps the week total.
- She logs ₹180 lunch, ₹40 chai; the money tracker shows ₹1,250 left for the week.

### Day 4 — Bicep modules (ticket work begins)

- You create a **sprint** in the batch board: "Sprint 1: InvoiceFlow infrastructure" with 4
  tickets from the capstone's ticket templates.
- Assignees: Kavya, **Ravi (AI)** and **Fatima (AI)**. One student means the team is mostly AI
  (PACA-style).
- Ravi "takes" the Key Vault module ticket and posts a draft PR. Kavya must **review it** and
  request one change. Fatima files a bug against Kavya's storage module when its auto-check fails
  (a missing soft-delete flag).

### Days 5–6 — security, multi-region; practice Shifts

**Day 5, 14:00: practice Shift, 30 min**, on emulators:

- 3 tickets arrive on the seeded schedule.
- Kavya fixes a Key Vault access-denied ticket (missing RBAC role) inside the SLA. Laya scores her
  triage "correct, P2".
- She misses the SLA on a throttling ticket.
- Practice mode, so there's no grade. The **postmortem** runs as coaching-framework stages 2–4 and
  produces one action: "check Cosmos RU/s alerts first".

**Day 6:** a second practice Shift with the failover scenario. She meets both SLAs.

### Day 7 — capstone InvoiceFlow (graded)

**Morning: plan the capstone with the coaching framework (stages 0–4):**

- **Stage 1:** predicted goal "Ship InvoiceFlow end-to-end: Blob upload → Document Intelligence →
  Logic Apps → Function validation → Cosmos → Power BI, all in Bicep". She confirms.
- **Stage 2 (risks):**
  - "Document Intelligence quota on student subscriptions" *(flagged as unknown: check before
    deploying)*;
  - "Power BI needs a work/school account";
  - "Logic Apps cost".
- **Stage 3:** Light (local + recorded Doc Intel responses) / Standard (real Azure, no Power BI;
  local chart instead) / Intense (everything). She picks **Standard**.
- **Stage 4:** **Capstone plan v1** saved. The app turns it into 6 tickets with acceptance checks,
  in the same format as a SPEC: numbered decisions + acceptance rows.

**Build:**

- Local first, on the emulators.
- **Ravi (AI)** reviews each PR, e.g. "the Function retries forever on a malformed invoice; add a
  dead-letter path".
- The app's auto-checks verify each ticket against the local environment.
- **Evening:** she deploys to her Azure for Students subscription with one `az deployment`
  command; the check runs against the real resources.

**Graded capstone Shift (45 min), syllabus-pinned:**

- Scenario "InvoiceFlow on-call", seed 4471, integrity log on (observe-only).
- P1 at minute 6: "duplicate invoices in Cosmos". She finds the missing idempotency key, fixes
  it, posts status in `#incident` (simulated).
- Score: SLAs 4/5, checks 5/5, triage 5/5, communication 3/4.
- **Postmortem:** Laya suggests rubric scores (e.g. "rollback plan mentioned: yes, 0.82"). **You
  confirm** two and lower one.

### Day 8 — AZ-204 exam cram

- Exam-forge mode: 100 questions, 150 min, 5 domains, seeded and pinned.
- Report shows the seed and the integrity events (one fullscreen exit, 4 s; noted, not accused).
- **Retest on the placement paper** shows the growth: networking 35% → 78%.

---

## Part E — How the capstone actually came together (the thread)

| Day | Artefact added to her repo / profile |
|---|---|
| 0 | Fork + PR to the pulse wall (Git workflow proven) |
| 1–3 | AI-service labs (SDK calls) + 3 whiteboards per day + about 60 Anki cards |
| 4 | Bicep modules (storage, Key Vault) via sprint tickets; reviewed an AI teammate's PR |
| 5–6 | Security hardening + DR; two practice Shifts with postmortem actions applied |
| 7 | Capstone plan v1 → 6 tickets → local build → real Azure deploy → graded Shift |
| 8 | Exam report + placement retest |

**Final evaluation (your view):**

- **Repo report** (TCH-Github_Evaluator-style weights): commit frequency, commit message quality,
  branch strategy, documentation; *individual contribution* compares her commits with the AI
  teammates' commits, which are labelled.
- **Capstone score** = Shift + checks + postmortem + repo report.
- **Certificate** issued.
- Her **portfolio page** lists the deployed endpoint, the repo, the board pages and the Shift
  report, ready for interviews (her stage-1 goal).

---

## Part F — After the course

- **Kavya:**
  - the coach keeps running (money goal, Anki review, next learning arc: "AZ-204 exam in 6
    weeks");
  - her data stays on her phone, plus an encrypted backup in her private repo.
- **You:**
  - `collect-homework summary` (one line per student repo) → archived;
  - the batch delivery report goes to Mr Rao;
  - the gate's package fix is kept for the next batch;
  - the pinned exam stays pinned for Batch 1.

---

## Part G — What this run used: input for OQ-1

| Module | Used in this run? | Minimum this run needed | Proposed phase |
|---|---|---|---|
| M-1 Org, roles, accounts | Yes | Admin, trainer, learner; join code | **1** |
| M-2/M-29 Coaching framework + onboarding | Yes, heavily | Stages 0–5, chips and cards, versioned plans | **1** |
| M-3 Planner, re-plan, reminders | Yes | Timeline, missed-block re-plan, local notifications | **1** |
| M-4 Trackers | Yes (money only) | Money ledger; tasks; food and quests can be "ask later" | **1** (money + tasks), food/quests 1.5 |
| M-5/M-25 Content conversion + cleanup | Yes | XLSX syllabus → topics | **1** |
| M-26 Package import + content gate | Yes, and it caught real drift | Mapping table + mismatch check | **1** |
| M-6 Skill template / skill map | Yes | Skill map from the package | **1** |
| M-7 Study / drill / exam | Yes | Quick quiz, drill, seeded exam, report | **1** |
| M-8 Anki | Yes | Cards from diagnostics and recall; scheduler | **1** |
| M-9 Tickets and sprints | Yes | Board, assignment, auto-checks | **1** |
| M-10 Shift engine | Yes | Seeded scenarios, SLA timers, practice/graded | **1** (mock checks) |
| M-11 Commons + AI personas | Yes | One real channel + scripted AI teammates | **1** (scripted) |
| M-12 Knowledge graph | Lightly | "Related" panel | 1.5 |
| M-13/M-14 MCP + tool/decision interfaces | Optional in this run | Interfaces + rule implementations | **1** (interfaces only) |
| M-15 Offline app, sync, backup | Yes | Offline web app; backup can wait | **1** (backup 2) |
| M-16 Live PIN quiz | Yes (vs. ghost) | Single-player ghost mode | 2 |
| M-17 Git analytics + per-student repos | Yes | Repo from template; commit stats; summary | 1.5 |
| M-18 Story mode / Heading Strike | No | — | 2 |
| M-19/M-20 Native app; Needle/Laya in browser | No (rules sufficed) | — | 2 |
| M-23 Paper / Google Forms export | No | — | 2 |
| M-27 Notebook board | Yes, every day | Board + QR follow; PDF export | 2 (heavy dependency) — **or 1.5 if you consider it essential** |
| M-28 Trace viewer | Once (Python Function) | Python only | 2 |
| M-30 Trainer management (minimal) | Yes | Profile with skills, site with QR check-in, schedule, delivery report | **1 (minimal)**; payroll/expenses/invoices 2 |
| M-31 Visualizers | Once (hashing) | One algorithm player | 2 |
| Azure emulators (Gap 1) | Yes | Azurite + Cosmos emulator + Functions Core Tools on the hub | New item, **1.5** |

**Reading of the table:** this run needed about 15 modules in a minimal form. Everything visual or
model-heavy (board, traces, visualizers, on-device AI) improved the experience but was not on the
critical path. The proposed **phase 1 = the 15 modules marked "1"**, each at its listed minimum.

## Problems this simulation surfaced

| # | Problem | Status |
|---|---|---|
| S-1 | **[real]** package5 `COURSE-MAP.md` disagrees with the day folders for the cloud track | Gate must check it; the owner should fix the package |
| S-2 | **[design]** floci is AWS-only; the Azure track needs Azurite, the Cosmos emulator and Functions Core Tools | New item; verify on the classroom laptop |
| S-3 | **[design]** one student breaks group mechanics (live quiz, wall, teams) | Ghost players and AI teammates, labelled |
| S-4 | **[unknown]** Document Intelligence and Power BI availability on student subscriptions | Check before Day 7; Light/Standard plans avoid them |
| S-5 | **[licence]** classroom-analytics is GPL-3.0: use its ideas, not its code. TCH-Github_Evaluator's README says MIT but the repo has no LICENSE file | Ask the author, or re-implement |
