# Feature ideas (iteration 13)

The owner asked for **features that could be added**, not alternatives. This list is ideas only:
none is in the plan until the owner picks it (OQ-19). Every idea respects the decisions so far:
no paid services, solo operator, phone-first students, AI proposes and people decide.

**How to read it:**

- **Effort:** S (a day or two of build), M (about a week), L (several weeks).
- **Phase:** suggested build target (1a pilot, 1b, 2), if picked.
- **Borrow:** an existing free tool or API that does most of the work.
- IDs (A-1, B-1, …) are for replying: "take A-2, B-6, C-1; drop G-*".

## A. Make the trainer's life easier (the owner's main goal)

| ID | Idea | Why it helps | Effort | Phase | Borrow |
|---|---|---|---|---|---|
| A-1 | **Wrap-up button**: one tap at class end publishes the board PDF, the quick-learn and the day's cards, closes attendance, and drafts the delivery report | Removes the 20–30 minute after-class routine | S | 1a | — |
| A-2 | **Absentee nudge**: after attendance closes, drafts a WhatsApp message per absent student with their catch-up gate link (`wa.me` click-to-chat links, no API) | Late joiners get on track without you chasing them | S | 1a | WhatsApp click-to-chat |
| A-3 | **At-risk digest** every Friday: who is behind (missed gates, overdue cards, no commits, low Shift scores), with a suggested message for each | You see trouble in week 2, not week 8 | M | 1b | — |
| A-4 | **Mistake clustering**: groups 40 lab or quiz submissions into a handful of "same mistake" clusters; you comment once per cluster | Grading time drops sharply on large classes | M | 1b | AI over MCP; rule-based fallback by test failures |
| A-5 | **Doubt queue**: students post questions during class (anonymous option, upvotes); you answer the top ones at the break | Shy students ask; you answer each question once | S | 1a | eduplay's live connection |
| A-6 | **Auto-FAQ**: repeated doubts across days and batches become an FAQ page and cards | Next batch asks fewer of the same questions | S | 1b | — |
| A-7 | **Voice notes after class**: "Arjun struggled with loops" becomes a note on the student's profile | Capture observations in 10 seconds while walking out | S | 1b | Android's built-in speech recognition |
| A-8 | **Plan vs actual**: marks what was really covered and re-flows the remaining days, with a change notice to the college (the §17.2 change log) | Slipping one topic no longer breaks the whole schedule | M | 1b | — |
| A-9 | **Rehearsal mode** for the teleprompter: timed run-through that shows where you ran long | Fits each class into its slot | S | 1b | Mistake-first demo script skill (already yours) |
| A-10 | **Teach-back to an AI "student"**: you explain a topic, and a simulated beginner asks naive questions and says what was unclear | Fits "the trainer self-learns first"; finds gaps before class | S | 1b | AI over MCP |
| A-11 | **Trainer's own card deck** for every topic you teach, generated from the trainer prep pack | You keep facts fresh across batches | S | 1a | ts-fsrs (already chosen) |
| A-12 | **Calendar sync**: class schedule, embargo releases and deadlines go into Google Calendar for you and the students | Fewer "what time is class" messages | S | 1b | Google Calendar API (free) |
| A-13 | **Morning checklist** at 08:30 on class days: hub up, backup fresh, content released, projector QR ready, weather or holiday warnings | Catches problems before students arrive | S | 1a | Health digest (F-44) |

## B. Help students learn (evidence-backed first)

| ID | Idea | Why it helps | Effort | Phase | Borrow |
|---|---|---|---|---|---|
| B-1 | **Exit ticket**: one question at class end ("what is still unclear?"); answers seed the next day's warm-up | Formative feedback loop; cheap | S | 1a | — |
| B-2 | **Error notebook**: every wrong answer is saved with the correction and reviewed before exams | Learning from errors; ready-made revision list | S | 1a | — |
| B-3 | **Explain-it-back**: student records a 60-second voice explanation; AI gives feedback on gaps | Self-explanation (strong evidence) | M | 1b | AI over MCP; speech-to-text on the phone |
| B-4 | **Pair-programming rotation** with a driver/navigator timer | Peer learning, a real workplace practice | S | 1b | — |
| B-5 | **Peer code review practice**: review a classmate's PR with a checklist; graded on review quality | Reading code is half the job | M | 1b | GitHub PR reviews |
| B-6 | **Mock interviews**: an AI interviewer asks from the syllabus and the student's own repos; technical and HR rounds; scored with a rubric | Placement readiness, which colleges care about | M | 2 | AI over MCP |
| B-7 | **Portfolio site builder**: their repos, Shift badges and certificates published as a free GitHub Pages site | Something to show employers on day one | S | 1b | GitHub Pages (free) |
| B-8 | **Evidence-linked resume bullets**: drafts bullets from work actually done (merged PRs, Shift incidents solved), each linked to proof | Honest resumes that interviewers can verify | S | 2 | — |
| B-9 | **Certification tracker**: maps the track to exam objectives (e.g. AZ-900 for the Azure track) with practice sets and deadlines | Clear external goal; reuses exam-forge | M | 2 | exam-forge |
| B-10 | **Audio quick-learn**: each day's quick-learn as text-to-speech audio for the commute, downloaded with the embargoed bundle | Study time without a screen or data | S | 1b | Phone's built-in text-to-speech |
| B-11 | **Study groups** formed from complementary strengths (one strong in a topic paired with one weak), rotated weekly | Peer teaching; less load on you | S | 1b | — |
| B-12 | **"Not yet" mastery map**: a per-skill map showing mastered / not yet / not started, with the next remediation step | Makes the mastery gates visible and motivating | S | 1a | — |

## C. Corporate exposure (owner's 1.9: "different types of corporate exposure")

GitHub covers issues, sub-issues, sprints, story points, boards and burn-up charts. These add the
rest of what a junior engineer meets in the first 6 months, mostly inside the Shift engine.

| ID | Practice | How it appears | Effort | Phase |
|---|---|---|---|---|
| C-1 | **Daily stand-up** | Async bot in the Shift channel asks the 3 questions; the AI "manager" follows up on blockers | S | 1b |
| C-2 | **Sprint planning + estimation poker** | Team estimates GitHub issues by voting; the app records spread and re-votes | S | 1b |
| C-3 | **Retrospective** | Start/stop/continue board after each sprint; action items become issues | S | 1b |
| C-4 | **On-call and incidents** | Pager-style alert during a Shift; acknowledge within the SLA; incident channel; blameless postmortem (already planned) | M | 1b |
| C-5 | **Change requests / approval board** | A "prod" deploy needs a change request that an AI or trainer approver reviews (risk, rollback plan) | S | 1b |
| C-6 | **Timesheets and status reports** | Weekly status email to an AI "client" persona, graded for clarity | S | 2 |
| C-7 | **Engineering hygiene** | PR templates, conventional commits, semantic version tags, required CI checks (GitHub Actions is free on public repos) | S | 1a |
| C-8 | **Writing good tickets** | User stories with acceptance criteria (Given/When/Then); graded | S | 1b |
| C-9 | **Docs culture** | Runbooks, architecture decision records, READMEs, each with a rubric | S | 1b |
| C-10 | **Escalation and client communication** | Scenario: an angry client email; write the reply; AI persona responds | S | 2 |
| C-11 | **Demo day** | Present the sprint to a "stakeholder" (trainer or AI) who asks questions | S | 1b |
| C-12 | **Security drills** | Leaked-key rotation drill (F-39), dependency alerts, least-privilege review | S | 1b |
| C-13 | **Handover** | A teammate "leaves"; write handover notes; another student must continue from them | S | 2 |
| C-14 | **1:1 and appraisal** | Self-appraisal writing with evidence links; AI manager gives feedback | S | 2 |
| C-15 | **Jira week** (optional) | One sprint on Jira's free plan (≤ 10 users per site) for students headed to Jira companies | S | 2 |

## D. Admin and college

| ID | Idea | Why | Effort | Phase |
|---|---|---|---|---|
| D-1 | **Certificate verification**: QR on every certificate opens a public "verify" page (static, free hosting) | Employers trust it; stops fake certificates | S | 1b |
| D-2 | **Anonymous weekly feedback** from students to the trainer (3 questions) | You improve while the batch is still running | S | 1a |
| D-3 | **Coordinator view**: read-only batch dashboard (attendance %, completion, at-risk count), per F-06 rules | Fewer report requests to you | S | 1b |
| D-4 | **Placement-readiness report** per student (skills mastered, projects, certifications, mock interview scores) | What colleges ask about most | M | 2 |
| D-5 | **Batch comparison** across batches (anonymised): which days work, which don't | Evidence for improving your course | M | 2 |

## E. Content pipeline (skill template)

| ID | Idea | Why | Effort | Phase |
|---|---|---|---|---|
| E-1 | **Item analysis**: from real answers, each question's difficulty and how well it separates strong and weak students; bad questions flagged | Better question banks every batch | S | 1b |
| E-2 | **Misconception mining**: frequent wrong answers update the trainer prep pack's "top misconceptions" | Content improves itself | S | 1b |
| E-3 | **Nightly freshness check**: re-runs every lab command in the container; flags deprecated CLI flags or retired services | Replaces the missing subject-matter expert for "is this still true" | M | 1b |
| E-4 | **Syllabus diff**: when a college changes its syllabus, shows exactly which days and questions change | Mid-cohort changes (§17.2) become a 5-minute task | S | 1b |
| E-5 | **Personal package library**: every package you build is versioned and reusable across colleges | Build a track once, teach it many times | S | 1a |

## F. Robustness

| ID | Idea | Why | Effort | Phase |
|---|---|---|---|---|
| F-1 | **Fire drill** before Day 0: deliberately turn the hub off mid-rehearsal and check the switch to the cloud profile | You know the fallback works before you need it | S | 1b |
| F-2 | **Lab-PC kiosk mode**: a locked-down browser session for shared college PCs (F-19) | Safe use of shared computers | S | 1b |
| F-3 | **Data-budget meter**: shows each student how much mobile data the app used and lets them choose "Wi-Fi only" downloads | Students on small data packs stay in | S | 1b |

## G. Engagement (weaker evidence; keep optional)

| ID | Idea | Note |
|---|---|---|
| G-1 | Heading Strike game (OQ-5) | Fun drill for one skill; off by default |
| G-2 | Team badges for Shift achievements | Team-level, not individual leaderboards (review §4) |
| G-3 | "Merged PR" celebration wall (team-level) | Visible progress |
| G-4 | Story mode (manhua) | Already planned; stays off by default |

## Claude's suggested picks

If the owner wants a short list: **A-1, A-2, A-5, A-13, B-1, B-2, B-12, C-7, D-2, E-5** fit the 1a
pilot, because each is small and saves time or produces evidence from day one. Then **A-3, A-4,
A-8, A-10, C-1 to C-5, D-1, E-1, E-3** for 1b. The rest can wait for phase 2.
