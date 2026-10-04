# Failure questions to answer before SPEC.md (iteration 11, answered in iteration 12)

These 46 scenarios were found by a separate reviewing agent. It read PLAN v9 and SIMULATED-RUN v3,
and skipped everything already covered there (§4.4, Part J) or answered in PLAN v10 §17.

**How to answer:** for each row, reply "accept" (the suggested default becomes a locked SPEC row),
"change: …", or "defer". Rows marked *verify* rest on laws or platform behaviour that must be
checked before they become D-rows; neither Claude nor the reviewer verified them.

**Status:** all 46 answered by the owner in iteration 12. The answers and the resulting designs
are in [Owner decisions](#owner-decisions-iteration-12) at the end; PLAN v11 §18 carries them
into the plan as DEC-36 to DEC-52.

**Top 10 to answer first:** F-11, F-36, F-37, F-35, F-17, F-08, F-01, F-42, F-18, F-24 (reasons at
the end).

## 1. People and process

| ID | Scenario | Why it matters | Question for you | Suggested default | Sev |
|---|---|---|---|---|---|
| F-01 | You are ill on Day 4, and the class hub, Forgejo bots and prepared board pages are all on your laptop at home | One person down takes people, data and infrastructure down; the class can't run | Is there a substitute-trainer role, and must the class hub run without your laptop? | Add a "substitute" role scoped to one batch: teleprompter, board and attendance, but no grading sign-off. Any batch can start on the cloud hub or a second laptop from the latest backup | High |
| F-02 | A student joins on Day 3 and misses Days 0–2 (cards, labs, pulse-wall PR); graded items are pinned | The card backlog floods them, the progress grid shows red, and completion rules block the certificate | How are late joiners handled for missed graded items and the card backlog? | Missed graded items show as "excused / not attempted" (trainer can waive); backlog cards are spread over 7 days, at most 30 a day | Med |
| F-03 | A student drops out mid-sprint while holding tickets; a real team is short one person | Teammates are blocked; bots keep opening PRs on a dead repo | What happens to a dropout's tickets, repo and seat? | Archive the repo read-only, return their tickets to the backlog, offer the seat to an AI persona (DEC-2 mixed team) | Med |
| F-04 | A friend scans the taped site QR for an absent student, or a photo of it is forwarded on WhatsApp | Proxy attendance is common; the college's attendance report becomes unreliable | Is the site QR an anti-proxy control, or only a convenience? | The site QR **rotates** (a code on the hub screen that changes every 30–60 s). The printed QR becomes a fallback marked "unverified", and the trainer confirms by headcount | High |
| F-05 | Two siblings share a phone, or a student does a Shift on a friend's phone | Personal money and food data is visible to whoever holds the phone (P-5); graded work is credited to the wrong person | Must the Coach space have an app lock? | PIN or biometric lock on the Coach space; graded attempts need a fresh PIN entry; several accounts per device are allowed, in separate encrypted stores | High |
| F-06 | A parent or the college HOD asks for a student's grades, attendance or integrity log | You must decide on the spot who may see what; if the student is 18+, disclosing may breach their privacy | Who besides the trainer may see class records, and with what consent? | The coordinator sees batch-level attendance and completion only; per-student data goes to the student; parents only for under-18s or with the student's consent toggle | Med |
| F-07 | A student disputes a graded Shift score: their run used recorded responses while a peer's used live Azure, or a Laya rubric suggestion was confirmed without being read | Fairness complaints, college escalation | Is there a formal appeal path, and are mixed-mode runs comparable? | An appeal button creates an approval-inbox item with a 7-day deadline; the corrections ledger keeps the original. A graded step run in a different mode is flagged and scored with its own rubric row | Med |
| F-08 | A student's own MCP-connected AI solves graded Shift tickets or capstone work through the tool layer | P-2 stops the AI acting without approval, but here the student is the approver, so the graded work is the AI's | What does the AI policy allow during graded work? | Graded Shifts and exams switch the learner's AI policy to "off"; tool calls during a graded window are refused and logged as integrity events (P-8) | High |
| F-09 | A student is colour-blind, uses a screen reader, or needs extra time; red/green trace tables and timed SLAs exclude them | Exclusion, possible complaints | Do you support per-learner accommodations? | Per-learner accommodation record (extra-time multiplier on SLA and exam timers, high-contrast pen set); pen colours get labels, not only hue | Med |
| F-10 | Students are more comfortable in Telugu, Hindi or Tamil; content and coach UI are English only | Weaker students disengage; coaching chips get misread | Is multilingual support in scope for phase 1? | Phase 1: English content, but UI strings externalised so they can be translated; coach chips get one extra language later | Low |

## 2. Devices and connectivity

| ID | Scenario | Why it matters | Question for you | Suggested default | Sev |
|---|---|---|---|---|---|
| F-11 | The LAN hub serves plain `http://192.168.x.x`. Browsers allow service workers, app install, `crypto.subtle` and WebGPU only on secure (HTTPS) connections (*verify* per API); Android may block plain HTTP in apps (*verify* for Capacitor) | Offline mode, encrypted backups and Laya in the browser could fail on the LAN hub | How does the LAN hub get HTTPS with no internet? | The hub creates its own certificate authority at setup; the companion app trusts it through the pairing QR (which carries the certificate fingerprint); laptops use `localhost` or install it; add to M-35 tests | High |
| F-12 | College Wi-Fi isolates devices from each other or has a login page, so phones can't reach the laptop and local discovery fails | Pairing, sync, live quiz and board follow-along fail even though "the internet works" | What is the fallback network on hostile campus Wi-Fi? | The trainer laptop's hotspot or a ₹1,500 travel router is the primary; the cloud hub is the sidegrade; the QR carries the hub's IP and port instead of relying on discovery | High |
| F-13 | The laptop gets a new IP address the next day, so the address in every phone's pairing is stale | Phones silently stop syncing | How do phones find the hub after an IP change? | Pairing stores a hub ID and key, not an IP; phones try the last IP, then a broadcast, then the day's site or board QR, which carries the current address | Med |
| F-14 | A student has an iPhone; only an Android app exists | iOS may clear a web app's storage after disuse, and web notifications need an installed home-screen app (*verify* current iOS rules); local-first data could disappear | Is iOS supported in phase 1, and how? | iOS uses the web app from the home screen in "sync-required" mode (personal data always mirrored to a hub) with a clear warning; native iOS in phase 2 | High |
| F-15 | A ₹8k Android phone (3 GB RAM, old WebView, 1 GB free) opens Excalidraw plus on-device AI models | Crashes, failed writes when storage is full, possible store corruption | What is the minimum supported device? | Minimum Android 9, 3 GB RAM, 500 MB free; on-device AI models only on opt-in after a device check; low storage switches the app to read-only with a banner | Med |
| F-16 | Xiaomi, Oppo and Vivo battery savers kill the app; Android 13+ needs notification permission; exact alarms are restricted on newer Android (*verify*) | Reminders arrive late or never, so blocks get wrongly marked "missed" | Must notifications be exact, and how do you onboard permissions? | A "make reminders reliable" onboarding step with per-brand guides; reminders may be up to ±5 min late; a block is "missed" only after the user answers, never because no notification fired | Med |
| F-17 | A student changes the phone's clock (or it's simply wrong) while offline, stretching an exam or SLA timer or reordering edits | Timer cheating, unfair Shift scores, sync conflicts resolved the wrong way | Which clock is trusted for graded timers and sync order? | Graded timers use a monotonic clock plus a hub-signed start/end time when online; offline graded attempts are flagged; sync ordering uses logical clocks, not wall time; times shown in IST from the program's timezone | High |
| F-18 | Students have no laptop at home, or only a college lab PC with deep-freeze software and no admin rights | Personal-hub mode, labs and hands-on Shift work are impossible for much of the class | What is the lab path for phone-only learners? | A **cloud lab** option (browser terminal into a container on the class or cloud hub); lab PCs run the hub single-file without installing; phone-only learners get the reasoning-check variant of labs | High |
| F-19 | A student logs in on a shared lab PC and leaves without logging out | The next student can see their personal space and act as them | Do shared PCs need a kiosk or session mode? | Sessions on unpaired computers expire after 30 min idle; the Coach space is never shown on unpaired browsers; a "public computer" checkbox at login | Med |

## 3. Data and sync

| ID | Scenario | Why it matters | Question for you | Suggested default | Sev |
|---|---|---|---|---|---|
| F-20 | A student forgets the backup passphrase, then loses the phone | P-15 promises restore, but P-4 means nobody can decrypt; months of data are lost | Is there any recovery mechanism? | A printable 24-word recovery key at setup, plus optional escrow on a trusted device of their own (their laptop); never on any server | High |
| F-21 | A phone was offline for 5 weeks on app v1.0; the hub is now v1.4 with a changed data format | Old changes fail or apply wrongly; a week of work could be lost on reconnect | What is the compatibility promise between app and hub versions? | Changes are versioned; the hub accepts and upgrades the previous 2 versions; anything older is blocked from syncing with "update the app first", never wiped | High |
| F-22 | The same record is edited on the phone, personal hub and class hub while disconnected (e.g. trainer feedback and student ticket status) | "Latest wins" silently drops one side's change | Which fields need manual conflict resolution? | Profile fields: latest wins. Ticket status, plan versions and board annotations: merged, with a visible conflict badge. Class-owned fields can be written only by the class hub | Med |
| F-23 | A student reinstalls, skips restore and signs up again with another email: two half-accounts | Wrong progress grid, duplicate repos, certificate to the wrong account | Can admins merge accounts? | An admin merge tool (recorded in the ledger; both IDs kept as aliases); joining a batch with a roll number or phone already enrolled warns "already enrolled" | Med |
| F-24 | A student asks for deletion, but grades, money and attempts are append-only ledgers, and backups sit in R2 and git | P-10 conflicts with the right to erasure (DPDP, *verify* scope); git history and old backups keep the data | How is deletion done on append-only and git-backed data? | **Crypto-shredding**: each user's data is encrypted with a per-user key, and deletion destroys the key. Class records are pseudonymised; backups expire after N days; learner repos are deleted, not rewritten | High |
| F-25 | A restore brings back the class database, but Forgejo repos or Drive files are from a different day | Grades point at commits that don't exist; boards miss assets. The restore looks fine but isn't | What must "restore tested" prove? | One backup manifest with checksums for every store (database, Forgejo, file storage); a restore checks it and lists mismatches before going live | Med |
| F-26 | Nobody defines how long chats, integrity logs, board copies and lab containers are kept after a batch | Storage and privacy exposure grow without limit; free tiers fill up | What are the default retention periods? | Integrity logs: 180 days after results. Commons: 1 year. Containers: deleted at batch end. Grades and certificates: kept indefinitely, pseudonymised after 3 years. Admin may shorten, never lengthen | Med |

## 4. Content and AI

| ID | Scenario | Why it matters | Question for you | Suggested default | Sev |
|---|---|---|---|---|---|
| F-27 | AI-generated content has wrong CLI flags, a retired service or a wrong exam fact, yet passes the 8-point gate (which checks form, not truth) | Students learn wrong facts; embarrassment in class; poor exam prep | Does generated content need a human accuracy sign-off? | The gate adds "every CLI/code block runs in the lab container", plus a per-day human "reviewed by" stamp before learners see it; learners get a "report error" button | High |
| F-28 | The gate fails at 23:00 (a dead link, or a link check that can't run offline) for a 09:30 class | A strict gate blocks the class, so the trainer bypasses the system | Can the gate be overridden? | A logged waiver per check (admin types a reason; expires in 7 days). Link checks are warnings when offline. Graded items (exam banks, graded Shift packs) can never be waived | High |
| F-29 | A trainer uploads publisher slides, a paid course PDF or Microsoft Learn text, and AI-derived content from it is shared | Copyright exposure, especially if packages go to other colleges (licences vary, *verify* Microsoft Learn terms) | Do imported sources need a licence tag? | Each upload is tagged own / licensed / third-party-internal-only; third-party items can't be exported beyond the batch; generation records its sources | Med |
| F-30 | An uploaded syllabus, a student README or a chat post contains hidden instructions ("ignore previous… post to everyone…") that the trainer's AI then reads | Prompt injection through MCP tools: mass posts, ticket changes, data leaks; "Accept" becomes automatic from approval fatigue | What may an AI do while reading others' content? | Others' content is treated as data. While reading it, the AI gets read-only tools; bulk or outward-facing actions (posting to more than one person, grade edits) always need a separate confirmation with a diff | High |
| F-31 | Generating 9 days × 11 files plus Shift packs on the trainer's own AI key costs far more than expected, or a retry loop runs overnight | A surprise bill; quotas run out on the morning of class | Is there a spend cap per generation job? | A pre-run estimate (tokens and ₹) and a hard cap per job (default ₹500); generation resumes per day; at most 2 retries | Med |
| F-32 | The model the skill template was tuned on is retired; Batch 2's generated content differs in style and structure | Batches stop being consistent; the gate may start failing | Is content regenerated per batch or reused? | Reuse the pinned catalog release; regenerate only missing or changed days; record the model ID in each generated file's metadata | Low |
| F-33 | Mid-cohort, the Azure CLI, Bicep, Azurite or a base image updates, and Day 6 labs behave differently from Day 2 | Labs that worked yesterday fail; graded checks become unfair | Are lab toolchains pinned per cohort? | Pin container images and npm tools to exact versions per batch release (extends P-7); upgrade only between batches or by a logged admin decision | High |
| F-34 | "Study material is always the latest" (P-7): a mid-cohort fix changes lesson text after students annotated it | Annotations land on the wrong lines; cards point at changed facts | Do learners see live updates mid-batch? | Lessons update with a "changed since you read it" banner; annotations stay tied to the version they were made on ("view old"); cards from a changed fact are flagged for review | Low |

## 5. Security and legal

| ID | Scenario | Why it matters | Question for you | Suggested default | Sev |
|---|---|---|---|---|---|
| F-35 | The pairing QR on the projector is photographed and reused later or by someone outside the room | Account takeover, or a stranger's device joins and pulls class data | What is the lifetime and scope of a pairing QR? | One-time codes per device, valid 5 minutes, tied to a join code or pending invite; the first scan claims it; every pairing shows under "my devices" with revoke | High |
| F-36 | Some learners are under 18. India's DPDP Act 2023 requires verifiable parental consent and restricts tracking and behavioural monitoring of children (*verify* scope and the Rules' commencement dates) | Integrity logs, the camera tier, coach nudges and money/food tracking could be non-compliant for minors | Do you accept under-18 learners in phase 1? | Ask date of birth at signup; under-18 accounts get a minor profile (parental consent captured, Coach trackers off, camera tier off, integrity log limited to exam events), **or** restrict phase 1 to 18+ | High |
| F-37 | In a college deployment it's unclear whether you or the college is legally responsible for the data ("data fiduciary"); there is no privacy notice, consent record or grievance contact (DPDP, *verify*) | Legal exposure if the college or a student complains; a college's legal team may block the rollout | Who is responsible, and do you need a standard data-processing agreement with colleges? | You act as processor for class data under a one-page agreement template; learners control their personal Coach data (it's local-first); ship a privacy notice, an in-app consent log and a grievance email; get one lawyer review | High |
| F-38 | Food/calorie and money logs are health and financial data, treated as sensitive under the older IT Act rules (*verify* how this interacts with DPDP) | A breach of a hub or backup is much more serious | Must Coach data ever reach a hub, or only the phone and encrypted backups? | Coach data is end-to-end encrypted even on the personal hub (the hub stores only ciphertext), never on the class hub, and excluded from any admin "export all" | Med |
| F-39 | Students commit Azure keys or connection strings to lab repos, which mirror to GitHub (the §4.4 sidegrade) and could become public | Leaked keys get abused (e.g. crypto-mining), the student's subscription is drained, the college is embarrassed | Is secret scanning mandatory before pushes and mirrors? | Secret scan on push in Forgejo; GitHub mirrors are always private; a hit blocks the push and shows a "rotate this key" lesson (reuses the scripted review of Ravi's hard-coded secret) | High |
| F-40 | An AI bot account (Ravi) with write access force-pushes or merges to the student's main branch, or acts in another student's repo | Graded history is corrupted; contribution scores become wrong | Exactly what permissions do bots get? | Per-repo tokens that can only create branches and open PRs; main is protected (no merge, no force-push); tokens expire at batch end | Med |
| F-41 | The trainer laptop (class hub, Forgejo, all student data, R2 keys) is stolen on a bus or train | A whole-cohort data breach, possibly notifiable under DPDP (*verify*) | Is full-disk encryption plus an encrypted hub database required? | The capability check refuses class-hub mode unless the OS reports full-disk encryption (BitLocker/FileVault) or the admin records a waiver; the cloud copy can revoke the laptop's keys in one tap | High |

## 6. Operations

| ID | Scenario | Why it matters | Question for you | Suggested default | Sev |
|---|---|---|---|---|---|
| F-42 | The cohort grows from 1 to 60: 60 emulator containers on one laptop, 60 phones on one access point (consumer routers often cap around 30–50 devices, *verify*), 60 live-quiz connections | The one-student run hides the real ceiling; the first big class melts down | What class size does one laptop hub support? | Shared emulator instances per class with per-student namespaces; a load test at 60 as an acceptance row; above about 30 students, recommend the cloud hub or a second access point | High |
| F-43 | A hub bug fix is installed mid-batch, and the update breaks something on Day 5 at 09:15 | Class is down with no rollback, and you are the only support | When can the hub update, and how do you roll back? | Updates blocked during scheduled class windows; the previous version and a database snapshot are kept before every update; one-command rollback; a slow "stable" update channel for class hubs | High |
| F-44 | Backups to R2 have been failing silently for 3 weeks (expired token, quota), or the cloud hub is down, and nobody knows | Backup exists on paper only; you find out at the moment of restore | How are you alerted, as a solo operator? | A daily health digest to your phone or email: last successful backup per target, sync lag per learner, failed checks; red if any backup is older than 48 h | High |
| F-45 | Sixty first-time users install, pair, grant permissions and forget passwords, and all of it reaches your WhatsApp the night before Day 0 | Your support load becomes the limit on growth | What self-service support exists, and is there a pre-Day-0 setup session? | A "Day −1 setup check" in the app (pairing, notifications, storage, version) that reports green/red to the trainer; password reset through the trainer's approval inbox; an FAQ page served by the hub | Med |
| F-46 | College B wants its own logo, certificate wording, attendance report format, and "no cloud, data stays on campus" | Hard-coded branding or a cloud assumption blocks a second customer | Are per-college branding and on-campus-only mode in scope? | A per-program brand pack (logo, colours, certificate and report templates) stored as data; a "no cloud" site switch (cloud hub disabled; backups only to a college target or USB) | Med |

## Top 10 to answer first

1. **F-11** HTTPS on the LAN hub. A plain-HTTP hub may silently break offline mode, encryption and
   pairing; this shapes the architecture.
2. **F-36** Allowing minors changes consent, monitoring, the camera tier and the Coach trackers.
3. **F-37** Who is legally responsible for the data, and what agreement a college will sign.
4. **F-35** QR replay is an account-takeover path on Day 0.
5. **F-17** Device clocks underpin graded timers and sync order (P-6 fairness).
6. **F-08** The AI policy during graded work decides whether grades mean anything.
7. **F-01** You and your laptop are a single point of failure.
8. **F-42** The real class-size ceiling sets the hub hardware and network design.
9. **F-18** Phone-only and no-admin-PC learners may be the majority, but labs assume a desktop.
10. **F-24** Deletion vs append-only ledgers needs crypto-shredding designed in from the start.

## Owner decisions (iteration 12)

"Default" means the suggested default in the table above becomes a locked SPEC row as written.
Where the owner changed or extended a row, the design Claude derived from the answer follows.
Each design is a proposal until SPEC.md locks it.

| ID | Owner's answer | Becomes |
|---|---|---|
| F-01 | Change: add a substitute role. A human substitute needs knowledge transfer; in self-learn mode the AI runs the session on the trainer's behalf | Substitute role + handover pack + AI-delivered session (A below) |
| F-02 | Change: missed classes unlock through a gate (read quick-learn, pass the 8 questions); clear the backlog day by day, then continue | Catch-up gate (B below) |
| F-03 | Default, triggered by a switch if possible | "Mark as dropped" switch (C below) |
| F-04 | Change: attendance and other necessary records live on the hosted site; teaching content stays on the hubs, so cloud storage is not exhausted and several cohorts fit | Split storage (D below) |
| F-05 | Default for the Coach space, but course content must never be behind a PIN | PIN/biometric only on Coach and on graded attempts |
| F-06 | Change: users accept Terms & Conditions to use the service | T&C acceptance at signup, versioned and logged; the default visibility rules stay as the content of the T&C |
| F-07 | Default; Claude to design the solution | Appeals design (E below) |
| F-08 | Change: AI may be allowed during graded work at the trainer's discretion; its use is logged in the report submitted to the college | AI policy per graded item (F below) |
| F-09 | Change: accommodations are opt-in at profile creation, or the student escalates to the admin who enables them | Accommodation record with two entry paths |
| F-10 | Not supported | English only; UI strings still externalised (cheap, keeps the door open) |
| F-11 | Default (hub's own certificate authority). Owner is considering buying a router for colleges without internet | Default + network kit guidance (G below) |
| F-12 | Default, but design for about **200 students at a time** | Network kit sized for 200 (G below); load target in F-42 |
| F-13 | Default | Locked as written |
| F-14 | Change: iOS not supported natively; maybe a PWA only | iOS = home-screen web app in sync-required mode; no native iOS app planned |
| F-15 | Default | Locked as written |
| F-16 | Default, plus a companion alarm or alarms created in the phone's own clock app if possible | Alarm hand-off (H below) |
| F-17 | Default | Locked as written |
| F-18 | Change: use Google Colab's VMs so labs cost the owner nothing | Colab notebook labs (I below) |
| F-19 to F-28 | Default | Locked as written |
| F-29 | Change: no licence field; uploads are tagged with the trainer's or admin's name | Uploader tag (name, date); generation still records its sources |
| F-30 | Default | Locked as written |
| F-31 | Change (owner unsure): trainers will mostly make their own content elsewhere and add it to the catalog, not generate it through the service's MCP | Import-first catalog; MCP generation optional, keeps the spend cap when used |
| F-32 to F-35 | Default | Locked as written |
| F-36 | Default: build **both** the 18+ path and the minor profile | Date of birth at signup; minor profile as in the table |
| F-37 | Default, but the lawyer review is deferred until a few dry runs or live runs are done | Template agreement, privacy notice, consent log and grievance email ship; legal review is a gate before the first paid college |
| F-38 | Default | Locked as written |
| F-39 | Change: secret scanning can be switched on or off | Feature switch (P-14), **on by default**; turning it off is logged; GitHub mirrors stay private regardless |
| F-40 | Default | Locked as written |
| F-41 | Change: not required; optionally enabled by the account holder | Disk-encryption check is an opt-in switch; the one-tap remote key revoke stays |
| F-42 | Change: stress test it, maybe with Google Colab as the gate; if it fails, lower the class size or optimise | Load test at 200 (J below) |
| F-43 | Default | Locked as written |
| F-44 | Default, and the report could live on the hosted site | Health digest page on the hosted site plus the daily push/email |
| F-45 | Default | Locked as written |
| F-46 | Default; owner unsure about "no cloud" but keeps it | Brand pack + "no cloud" switch, as written |

### A. Substitute trainer and AI-delivered sessions (F-01)

- **Substitute role**, scoped to one class and a date range, granted by the admin or the trainer.
  Can run the teleprompter, board and attendance; cannot sign off grades or change the syllabus.
- **Handover pack**, generated with one tap ("I can't take Day 4"):
  - the day's teleprompter script, board pages and quick-learn;
  - where the class is (last day covered, open tickets, students flagged at risk);
  - the hub's address and a one-time substitute pairing QR;
  - the trainer's own notes for that day.
  The substitute marks it "read"; the report records who taught.
- **Self-learn mode** (no human substitute): the class runs as an **AI-delivered session**:
  - the teleprompter script is played as a narrated lesson (text plus optional text-to-speech),
    section by section, with the board pages shown in order;
  - the live quiz runs automatically at the scripted points;
  - questions from students go to the class's AI with the day's content only, and anything it
    cannot answer from that content is queued for the trainer;
  - the delivery report marks the day **"AI-delivered"**, so the college sees it.
- **Hub independence:** any class can start from the latest backup on the cloud hub or a second
  laptop (F-01 default), so the substitute does not need the trainer's laptop.

### B. Catch-up gate for late joiners and missed classes (F-02)

1. Every missed day is **locked** until caught up; days are unlocked **in order**.
2. To unlock a missed day the student reads its quick-learn, then takes that day's **8-question
   diagnostic** (the same one from D1–3). Pass mark: 6 of 8 (trainer can change it). A failed attempt
   shows what was wrong; the retry uses a different seed.
3. Passing unlocks that day's full resources (notes, labs, board pages, recordings) and the next
   missed day's gate.
4. **Live classes stay open.** A behind student can still attend today's class; the new day's
   *self-study* material unlocks once the backlog is cleared.
5. Graded items from missed days: due with an extended deadline (default 7 days after the gate is
   passed); the trainer can still waive them ("excused").
6. Card backlog: spread over 7 days, at most 30 a day (F-02 default).
7. The trainer sees "catching up: day 2 of 3" in the progress grid instead of red.

### C. "Mark as dropped" switch (F-03)

One switch on the student's row (trainer or admin), with a confirmation that lists what will
happen. It then, automatically:

- returns their tickets to the backlog and reassigns review requests;
- stops bots from opening PRs on their repos; archives the repos read-only;
- offers the team seat to an AI persona (DEC-2 mixed team), if the trainer accepts;
- removes them from live quizzes and the attendance roll from that date;
- writes a ledger entry. **Switching it off restores everything** except reassigned tickets, which
  stay where they are.

### D. Hosted site for records, hubs for content (F-04)

- **Hosted site** (cloud, small): accounts, enrolment, attendance, grades, the college report,
  health digests, appeals. These are small rows, so many cohorts fit in a free tier.
- **Hubs** (trainer laptop, class hub or personal hub): lesson content, board pages, labs, repos,
  media. Large files never go to the hosted site; backups go to R2/Drive/USB as in P-15.
- **Attendance** is written to the hosted site when online, or queued on the hub and synced later.
- **Anti-proxy (not answered directly, so kept as proposed):** the site QR rotates every 30–60 s
  on the hub screen; the printed QR is a fallback marked "unverified". *Owner to confirm.*

### E. Appeals (F-07)

1. **Appeal button** on any graded result, open for 7 days after results are published. The student
   writes what they think is wrong (one paragraph).
2. The appeal arrives in the trainer's approval inbox with an **evidence pack**: the seed, the mode
   (live/recorded/emulated), every event and timestamp, the rubric rows, who confirmed each AI
   suggestion and whether it was opened before confirming.
3. **Mode-normalised rubric:** a graded step run in a different mode is scored on that mode's own
   rubric row, and the result view shows "run in recorded mode" next to the score.
4. **Unread confirmations:** if a rubric suggestion was confirmed without being opened, the appeal is
   upheld for a re-mark automatically.
5. **Second reviewer:** if the student is not satisfied, the appeal escalates to the admin (or a
   second trainer). Their decision is final.
6. **Ledger:** the original score is kept; the corrected score is a new ledger entry citing the
   appeal. Deadline for the trainer: 7 days, then it escalates by itself.

### F. AI during graded work (F-08)

- Each graded item has an **AI policy**: `off` (default), `allowed`, or `allowed with limits`
  (e.g. explain only, no tool calls into the repo).
- The trainer chooses per item; the choice is shown to the student before they start.
- When allowed, every AI call during the graded window is logged (count, tool used, time).
- The **college report** gets a column per graded item: AI policy and usage summary
  ("AI allowed; used 14 times").

### G. Network kit for a college without internet (F-11, F-12)

The hub needs no internet; it needs a local network that every phone can join and that does not
isolate devices from each other. Prices are from web search in October 2026 (INFERRED); check them
before buying.

| Class size | Kit | Approximate cost |
|---|---|---|
| Up to about 30 | The laptop's own hotspot, or a pocket travel router (e.g. GL.iNet Mango class) | ₹0 to about ₹3,000 |
| 30 to 60 | One business access point (e.g. TP-Link Omada EAP610, rated 250+ clients) plus any home router for DHCP | about ₹8,000 + ₹2,000 |
| About 200 | 3 to 4 access points of the EAP610 class (spread across the room), an 8-port PoE switch, a small router for DHCP, cables | about ₹40,000 to ₹55,000 (switch, router and cable prices ASSUMED) |

Why 3–4 access points for 200 even though one is "rated 250+": rated client counts are maximums;
for live quizzes and board follow-along, plan for about 50–70 active phones per access point
(ASSUMED rule of thumb; confirmed or corrected by the F-42 load test).

Setup, once:

1. Router: set a fixed LAN range (e.g. `10.42.0.0/22`, room for about 1,000 devices) and DHCP.
2. Access points: one network name for the class, **client isolation off**, no login page.
3. Laptop: plugged into the switch by Ethernet, with a **fixed IP** (e.g. `10.42.0.2`); the hub
   setup creates its certificate authority (F-11) for that address.
4. The day's QR carries the hub's address and certificate fingerprint (F-13).

The hub installer gets a "network check" that tells the trainer whether phones can reach the hub,
and whether the network isolates devices.

### H. Alarms in the phone's own clock app (F-16)

- **Option 1 (default for reminders):** the app's own notifications, with the per-brand battery
  guide.
- **Option 2 (new, for blocks the student cares about most):** "Add to my clock app". The app asks
  Android's default clock app to create a repeating alarm (Android's `ACTION_SET_ALARM` intent with
  hour, minutes, label and days; needs the normal `SET_ALARM` permission, no exact-alarm
  permission). The clock app rings even if our app is killed.
  - The student can create several at once ("all Tue/Thu class alarms") with one confirmation.
  - Our app cannot later edit or delete those alarms; it shows a list of what it created so the
    student can remove them in the clock app.
- Exact alarms inside our own app stay out: Android 13+ denies them by default and restricts the
  automatic permission to alarm and calendar apps (verified via web search, October 2026).
- iOS (PWA) has no equivalent; it gets web notifications only.

### I. Google Colab as the no-cost lab path (F-18)

- **What works:** a lab packaged as a **notebook** opened in Colab. The notebook installs its tools
  (e.g. Python packages, Azure CLI, Azurite through npm) and runs the steps in cells; the student's
  answers are checked by a grading cell that reports to the hub with a one-time token.
- **What does not (Colab's terms, checked October 2026):** the free tier disallows SSH, remote
  desktops and remote-access tools; no tier allows hosting web services or proxies. So Colab cannot
  be a remote VM that our browser terminal connects into, and it cannot host the hub.
- **Consequences:**
  - Each lab gets a "Colab" variant generated from the same lab source; the hub checks that the
    notebook still runs (part of the F-27 gate).
  - Long or container-heavy labs (Cosmos emulator, Docker) stay on the hub; Colab variants are for
    the lighter labs.
  - Sessions end when idle and resources are not guaranteed, so labs must be resumable cell by cell.
- *Verify before SPEC:* that Azurite and Azure CLI install and run inside a current Colab runtime.

### J. Load test for 200 students (F-42)

- **Target:** 200 simulated phones on one class hub: pairing, attendance, live quiz (200 answers
  within 10 s), board follow-along, sync. Pass if 95% of requests finish within 1 s and nothing is
  lost.
- **Load generator:** a script in the repo (Node, no dependencies) run from a second laptop on the
  same network. Colab can run the same script against the **cloud** hub only (it cannot reach a
  LAN hub). Whether sending test load from Colab is within its terms is not verified; the second
  laptop is the primary.
- **Gate:** the test is an acceptance row for 1b. If it fails, the hub reports the size it *did*
  sustain, the recommended class size is lowered to that, and the bottleneck is fixed.
- Containers are not part of the 200-student test: labs for 200 use Colab variants or shared
  emulators with per-student namespaces (F-42 default).
