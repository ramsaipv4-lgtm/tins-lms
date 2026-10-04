# Course Format Evaluation: IncubOS "Detective Method" vs Skill Template v1.2

**Date:** 2026-10-04 · **For:** the solo trainer (career-shifting beginners, Indian colleges) · **Related:** PLAN.md §6.1, §19.8 row 4, §21

**Labels.** **VERIFIED** = I checked the files with a script or by reading them. **INFERRED** = my judgement from evidence. **ASSUMED** = taken as given, not checked.

**Method.** I ran Python scripts over both inputs. They are in `scratchpad/eval/`: `audit.py` (README drift, sections, word counts, numbering), `answers.py` (answer keys), `roadmap.py` (plan vs actual), `chain.py` (Next links), `pkg5.py` (package completeness). I did not change any input file. I had no web access, so the accuracy checks are INFERRED.

---

## Verdict in one paragraph

IncubOS is strong **case-based reading**. It is weak **course engineering**. Its prose, analogies, decision stories and instructor talking points are good. But the README has drifted badly from the files. None of the six assessments exist. There are no answer keys and no retrieval practice. The "Next" chain skips five steps. Two technical claims I checked are wrong. The skill template has the opposite profile. It has gates, recall, a teleprompter format and machine-mappable files. But it has no case-study spine, and its own sample package also has gaps. **Recommendation:** add a "case-study" package variant to the skill template. Give it a manifest and new gate checks. Then fix IncubOS before you import it. Do not import it as-is.

---

## A. Quality audit of IncubOS

### A1. README vs actual files: heavy drift (VERIFIED)

| Check | Result |
|---|---|
| Files in folder | 61 (51 micro-steps, 1 appendix, syllabus, strategy, README, 2 `.txt`, 4 `.pptx`) |
| Files named in README | 60 (54 content + 6 assessments) |
| Named in README but missing | **46** (40 micro-step names + all 6 assessments) |
| Present but not in README | **46** (40 micro-steps under other names, `37b` (MS 11.4), the appendix, 4 `.pptx`) |
| README entries that match a real file | Only 14 (syllabus, strategy, MS 0.1–2.4, two `.txt`) |
| Status column | 52 rows say "⏳ Pending" and the footer says "AWAITING CONFIRMATION TO BEGIN MS 0.1". All content is in fact written. |

The README is a frozen plan, not a file map. From MS 3.1 onward the course was re-scoped. My script compared the roadmap in `01-strategy-planning.md` with the real titles. 9 of 53 match. About 12 are renamed but cover the same topic. About 30 cover a different topic (INFERRED from the titles). Examples: the roadmap's MS 4.1 "AuthN vs AuthZ" became "The Five Roles". MS 6.4 "State Machines" became "Cron and Job Routes". MS 5.5 is in the roadmap but no file exists. Some promised topics never appear: a search for "mass-assignment" and "root-span" finds 0 files (VERIFIED). Both were headline "real bug" stories in the syllabus.

### A2. Checkpoints and assessments (VERIFIED)

All six files are missing. That is `checkpoint-1` to `checkpoint-5` plus `final-project-k8s-readiness-report.md`. No file name contains "checkpoint" or "final". The syllabus describes the assessments, but none were written. So the course has **no graded item at all**.

### A3. Section consistency (VERIFIED)

There are 12 required sections. **20 of 51** micro-steps have all of them (ignoring the Detective-question heading). The course changed template part-way. MS 0.1–5.3 use "Conceptual Understanding + Practical Demonstration". Most later files use "Part 1…Part N" or topic headings instead. So the content may exist, but not under the standard heading.

Key: DQ = "Core Detective Question" heading · CU = Conceptual Understanding · PD = Practical Demonstration · CBP = Connection to the Bigger Picture · others as named.

| MS | File | Missing sections |
|---|---|---|
| 0.1, 0.2, 1.2, 1.4 | 02, 03, 05, 07 | DQ (the question is in the prose, not a labelled block) |
| 5.4, 6.3, 6.4, 7.1, 7.2, 7.3, 8.1 | 20, 23–28 | PD |
| 9.1, 10.1, 10.2, 11.1, 11.2, 11.3 | 30, 33–37 | PD |
| 12.1, 12.2, 13.1 | 38, 39, 41 | PD |
| 8.2, 9.2, 9.3, 11.4, 12.3 | 29, 31, 32, 37b, 40 | CU, PD |
| 13.2, 13.3, 14.1, 14.2 | 42, 43, 45, 46 | CU, PD |
| 13.4, 14.3 | 44, 47 | CU, PD, CBP |
| 3.3, 3.4, 10.3, 12.4 | 48–51 | CU, PD, CBP |
| Appendix A | 53 | PD, Glossary, Common Q, Reinforcement, Quick Ref, CBP, Talking Points |

All 51 files have Prerequisites, Introduction, Learning Objectives, Glossary, Common Questions, Reinforcement, Quick Reference and Instructor Talking Points.

**Detective-block label drift (VERIFIED).** 45 files use `**Problem:**`. But the other three parts use about 10 different labels. Examples: "Approaches considered" (4 files), "Approach considered 1" (4), "Approach selected" (13), "Solution attempted" (3), "Why" (7), "Why selected" (3). A parser cannot rely on these labels.

**Promised "Vocabulary Bridge" (VERIFIED).** The strategy promises a "You Already Understand This" section in every micro-step that brings in a new concept. Only 3 of 51 files have one (3.3, 3.4, 12.4).

### A4. Load and timing (VERIFIED counts; INFERRED judgement)

| Measure | Value |
|---|---|
| Words per micro-step | median **4,548**; range 3,265–7,666 (MS 11.4) |
| Code lines per micro-step | median **310**; 15,427 in total |
| Glossary terms per micro-step | median 13, max 22; **656 in total** |
| Learning objectives per micro-step | median 9 (range 5–12) |
| Claimed time per step | 45–60 min up to 70–85 min; 45–58 h in total |
| Reading time at 150 wpm / 100 wpm | 26 h / 40 h in total, for the words alone |

The claimed times cover the reading itself. Prose at a beginner's pace (100 wpm) never goes over the stated maximum. But that leaves almost no time for about 300 lines of code, the activity, and the 13 new terms. **INFERRED:** a career-shifter will need 1.5–2× the stated time. Nine objectives and 13 terms per session is too much for novices. Two or three of each is the usual target. The course is written for a reader who already knows the basics. The syllabus says "Prerequisites: none". That is not true of the content as written.

### A5. Answers, retrieval, mastery (VERIFIED)

| Item | Found |
|---|---|
| Reinforcement activities with an answer key or success criteria | **0 of 51**. One file says "Solutions available on request". The README says the same. |
| Retrieval practice / flashcards / spaced cards | None. No file has a card deck or a recall section. |
| Mastery checks / quizzes | None. Common Questions (3–6 per file) are Q&A for reading, not for testing. |
| Checkpoints | 0 of 6 exist (A2) |

### A6. Numbering and Next links (VERIFIED)

- Every micro-step footer says "Micro-Step X of **55**". There are 51 micro-steps. The roadmap lists 53 entries, including the two marketing pieces. So "55" is wrong everywhere.
- **File order ≠ course order.** MS 3.3, 3.4, 10.3 and 12.4 are files `48`–`51`, after MS 14.3. MS 11.4 is `37b`. Anything that sorts by file name gets the wrong order.
- **Next chain:** following "Next" from 0.1 reaches **46 steps**. It never reaches **3.3, 3.4, 10.3, 11.4, 12.4** (or the appendix). The breaks: 3.2→4.1, 10.2→11.1, 11.3→12.1 and 12.3→13.1 each skip a step. 3.4→10.3 and 10.3→12.4 follow the order the files were written in. 12.4 has no Next.
- **Dangling and mismatched links:** 14.3 → "15.1 Course Conclusion and Reference Summary" does not exist. 1.1 → "Choosing a Framework" (the real title is "Choosing the Tooling Stack"). 14.1 → "Instrumented API Routes and the `durationMs` Pattern" (the real title is "…Cache Key Taxonomy").
- Module names drift: the syllabus says "Role-Based Access Control" and the file headers say "Authorisation".

### A7. Accuracy spot-check (INFERRED, no web access)

| # | Claim (file) | Judgement |
|---|---|---|
| 1 | "ENABLE + FORCE: `incubos` (table owner) → subject to RLS" (MS 5.3, line ~212). The same file says `incubos` is a superuser (line 115). | **Wrong.** In PostgreSQL, superusers always bypass RLS. FORCE only affects table owners who are not superusers. This is the very "superuser bypass bug" the syllabus promised to teach, and the file teaches it backwards. High risk for a security lesson. |
| 2 | "With legacy `docker build`, intermediate layers from earlier stages can persist in the image" (MS 12.4) | **Wrong.** In a multi-stage build the final image holds only the final stage's layers, with either builder. Earlier stages may stay in the local build cache, not in the pushed image. The "practical rule" (use `.dockerignore`) is still right. |
| 3 | "Default function timeout: 10 s Hobby, 60 s Pro" on Vercel (MS 10.1) | **Probably out of date.** Vercel's defaults changed with Fluid compute. This is a time-sensitive claim with no date and no source. |
| 4 | `jose` works on the Edge Runtime (Web Crypto). `jsonwebtoken` needs Node `crypto`. (MS 3.1) | **Correct.** |
| 5 | Why RS256 was chosen: MS 3.1 says the Edge Runtime "cannot safely use symmetric secrets". MS 3.3 says it was for external verifiers (ERPNext). | **Misleading and inconsistent.** HMAC works fine on Edge through Web Crypto. The two files give different reasons. The MS 3.3 reason is the sound one. |

Two wrong claims out of five is a high rate for content that will go in front of beginners. Section 7.9 in PLAN.md ("no SME") makes this worse, because no one else will catch these errors.

---

## B. Side-by-side comparison

| Dimension | IncubOS (Detective Method) | Skill template v1.2 (day package) |
|---|---|---|
| **Purpose** | Explain one real codebase's decisions | Turn a university syllabus into day-by-day teaching kits |
| **Audience** | Stated as complete beginners. Written for people with some background (A4). | College semesters plus a cert overlay. Both the instructor and the student. |
| **Unit** | Micro-step (~4.5k words, 1 file) | Day (7 artifacts + 3 companions + student guide; about 11 files) |
| **Spine** | Problem → options → choice → why (case-based learning) | Syllabus topic order plus cert domains |
| **Worked examples** | Strong: real code, read line by line | `deepdive.md` + runnable `lab/` |
| **Faulty-first / productive failure** | Partly. Real bugs are told as stories, but the learner never makes the mistake. | Explicit: `faulty-first-instructions`, mistake-first teleprompter, bug at ~18:00 in live coding |
| **Retrieval practice** | None | `memory_recall_dayNN.md` (5 closed-book tasks) and the `quicklearn` 8-question diagnostic |
| **Spacing / interleaving** | None | Student guide mentions both. No scheduled deck in the files. |
| **Instructor support** | Talking points (~300 words, rich discussion prompts). Not timed. | Word-for-word `[SAY]/[DO]` script, running clock, cross-question callouts, recovery appendix |
| **Assessment** | Planned (6), none delivered | Quick quizzes, recall tasks, mock exam. Answer keys are uneven. |
| **Validation gate** | None. The README has not changed since planning. | 8-point gate (voice, pacing, fun, code, links, diagrams, companions, Say/Do) |
| **Machine-readability** | Low. No front matter. File order is wrong. Heading and label drift. | Medium–high. Fixed file names per `dayN/`. PLAN §6.1 maps each one. |
| **Known gaps** | See section A | (VERIFIED) In pkg5, 21 of 36 track-days miss at least one core artifact. Companion files sit in the track root (v1.1 layout), not in `dayN/` as v1.2 requires. SKILL.md has two different "8-point" lists (Step 7 and §7). |

**INFERRED summary.** IncubOS does the *why* well. That means elaboration, real decisions and expert reasoning, and these build transfer. The template does the *remember and do* well. That means retrieval, mistakes made on purpose, and a script for class. Neither one does spaced practice or mastery gating yet. PLAN §19.8 row 4 asks for both.

---

## C. Should the IncubOS format join the skill template? Yes, as a variant.

Add a **`strategy: case-study`** package variant. Do not replace the day format. Use it when the source is a codebase (or a project), not a syllabus. The §21 rebuild course is the first real use.

### C1. Proposed layout

```
<course>/
├── manifest.json            ← single source of truth: ordered steps, ids, files, status, est_minutes, prereqs, checkpoint_after
├── README.md                ← GENERATED from manifest (never hand-edited)
├── 00-syllabus.md
├── 01-strategy.md
├── modules/
│   └── m03-authentication/
│       ├── ms-03.01-how-authentication-works/
│       │   ├── lesson.md            ← sections below
│       │   ├── talking_points.md    ← or instructor_script.md in Say/Do form
│       │   ├── recall.md            ← 5 closed-book tasks + 8–10 Q/A cards
│       │   ├── activity_key.md      ← answers/rubric, trainer-only
│       │   └── trainer_prep.md      ← §19.8 prep pack
│       └── checkpoint-1/
│           ├── checkpoint.md
│           └── rubric.md
├── final-project/
├── appendix/
│   ├── A-post-ship-fixes.md
│   └── B-decision-log.md
└── marketing/ (.txt + .pptx)
```

Step ids in folder names use zero-padded `module.step`. Then sorting by name gives course order, and "37b"-style inserts cannot happen.

### C2. Section template for `lesson.md`

```markdown
---
id: ms-03.01
title: How Authentication Works
module: 3
est_minutes: 60          # gate: words/100 + code_lines/8 + activity <= est
prereqs: [ms-02.04]
objectives: 3            # max 4
new_terms: 6             # max 8
source_refs: [{path: src/lib/auth.ts, commit: abc1234}]
next: ms-03.02           # gate: must equal manifest order
---
# MS 3.1 — How Authentication Works
## Prerequisites
## You Already Understand This        (vocabulary bridge, 1 paragraph)
## The Detective Question
**Problem:** …  **Options considered:** …  **Choice:** …  **Why:** …   (fixed labels)
## Learning Objectives
## Conceptual Understanding           (analogy → IncubOS → code; 3 layers)
## Walkthrough of the Real Code       (worked example)
## Your Turn: Faulty First            (learner runs the broken version, then fixes it; faded steps)
## Technical Glossary
## Common Questions
## Reinforcement Activity             (key in activity_key.md)
## Check Yourself                     (3–5 retrieval questions; answers folded)
## Quick Reference
## Connection to the Bigger Picture
## Next
```

### C3. What moves in each direction

| From IncubOS → day format | From template → case-study format |
|---|---|
| Detective block at the top of `deepdive.md` | `recall.md` / `memory_recall` (retrieval) |
| Glossary + Common Questions in `deepdive.md` | Answer keys and `quicklearn` diagnostic |
| "Connection to the Bigger Picture" close | Say/Do teleprompter, made from the talking points |
| Talking-point "ask the class" prompts as `⚠️ LIKELY CROSS-Q` | Faulty-first "Your Turn" block |
| Post-ship-fixes appendix (real bugs), very good for faulty-first labs | Runnable `lab/` + code check |
| Real `source_refs` to code | 8-point gate, currency/drift flags |

### C4. New gate checks (extend the 8-point gate to 14 for this variant)

| # | Check | How |
|---|---|---|
| 9 | **Manifest ↔ files** | Every manifest entry exists. Every content file is in the manifest. README is regenerated, and the diff must be empty. |
| 10 | **Sections present** | Required headings by regex. Detective labels exactly `Problem/Options considered/Choice/Why`. |
| 11 | **Chain** | `next` equals manifest order. Walking from step 1 reaches every step. No dangling ids. "X of N" equals the count. |
| 12 | **Load budget** | Words/100 + code/8 + activity ≤ `est_minutes`. Objectives ≤ 4. New terms ≤ 8. |
| 13 | **Assessment complete** | Every activity has a key. Every `checkpoint_after` has `checkpoint.md` + `rubric.md`. Each step has ≥ 3 recall items. |
| 14 | **Code fidelity** | Every excerpt with a `source_ref` matches the repo at that commit (as PLAN §21 already plans). A second-model fact check covers claims without a reference (PLAN §19.8 row 7.9). |

Fix the template's own inconsistency at the same time. SKILL.md Step 7 and §7 list two different sets of "8 points". Pick one set and make it match `validation-checklist.md`.

---

## D. Can IncubOS be imported into the LMS as-is?

**No (INFERRED, from the VERIFIED findings).** An import would get the wrong order (file-name sort), five orphan steps, no graded items, no cards, no answer keys, and two wrong security/devops claims. Its talking points are not in Say/Do form, so the teleprompter view and the section-by-section release (§20.4) have nothing to key on. It fails PLAN §6.1's own gate: it has no labs, no diagrams, no companions and no Say/Do script.

It *is* a good **source** once it has been normalised. An importer would need:

1. A **manifest builder** that orders steps by the `# Micro-Step X.Y` heading, not by file name. It should flag missing ids (5.5) and extra ones (11.4).
2. A **heading normaliser** with an alias table ("Part N" → Conceptual / Walkthrough; the 10 Detective label variants → 4 fields).
3. **Generators** for what is missing: cards, check-yourself questions, activity keys, checkpoints, and a Say/Do script made from the talking points. Each one goes through the gate.
4. A **fact-fix pass** with the two errors in A7 corrected first.

| IncubOS file / section | LMS concept |
|---|---|
| `00-syllabus.md` modules + objectives | Program, skill-map nodes |
| `01-strategy` roadmap | Schedule (after manifest fix) |
| Micro-step file | **Lesson page** (one per step) |
| Header block (Module, Estimated Time, Source files) | Lesson metadata, time budget |
| Prerequisites | Skill-map prerequisite edges |
| Introduction + Detective Question | Lesson hook. Also the **quick-learn** card ("the decision in 4 lines") |
| Learning Objectives | Skill tags. Mastery-gate targets. |
| Conceptual Understanding / Parts / Practical Demonstration | Lesson body. Code blocks go to the **trace viewer** where they can run. |
| Technical Glossary (656 terms) | **Cards** (term → definition), scheduled with interleaving after week 1 |
| Common Questions | Cards + the trainer's "questions students will ask" (prep pack) |
| Reinforcement Activity | **Practice task**. Graded only once a key or rubric exists. |
| Quick Reference | Printable handout |
| Connection to the Bigger Picture | Lesson close / next-step banner |
| Instructor Talking Points | **Teleprompter** notes. Turn into Say/Do, with discussion prompts as `⚠️ LIKELY CROSS-Q` and peer-instruction votes. |
| Checkpoints / final project (to be written) | **Graded items** (exam-forge), with rubric + viva questions |
| Appendix A (post-ship fixes) | Faulty-first labs + Shift scenarios |
| `.txt` / `.pptx` marketing | Resources (not learner content) |

---

## E. Top 10 recommendations (ranked)

1. **Fix the two wrong claims** (RLS + FORCE with a superuser; Docker intermediate layers). Add a dated source to time-sensitive claims (Vercel limits). Do this before anyone teaches from it. *(Effort: S)*
2. **Make a `manifest.json` the source of truth and generate the README from it.** Gate check 9 stops the 46/46 drift from coming back. *(S)*
3. **Rename files to course order (`ms-03.03-…`). Regenerate every "Next" and "X of N" from the manifest.** This restores the 5 unreachable steps (gate check 11). *(S)*
4. **Write the 6 missing assessments with rubrics, and answer keys for all 51 activities** (keys are trainer-only). Without these there is nothing to grade or check mastery against. *(M)*
5. **Add retrieval to every step:** 3–5 "Check yourself" items plus cards from the glossary and Common Questions. Interleave the cards after week 1 (§19.8). *(M, can be generated)*
6. **Add the `case-study` variant to the skill template** with the layout and section template in C1–C2, and gate checks 9–14. Use it for the §21 rebuild course from day one. *(M)*
7. **Cut the load for beginners:** at most 4 objectives and 8 new terms per step. Split steps over ~3,000 words. Make the "You Already Understand This" bridge required, as the strategy promised. *(M–L)*
8. **Turn the talking points into Say/Do scripts.** The discussion prompts are already good cross-questions and peer-instruction votes. This also gives §20.4 its release sections. *(M)*
9. **Add a learner-does-it faulty-first block** to each step. Use the real bugs in Appendix A and the "real finding" stories as labs. Right now they are only read as stories. *(M)*
10. **Clean up the skill template itself:** make the two "8-point" lists match, finish pkg5's missing day artifacts (21 of 36 track-days have gaps), and move companion files into `dayN/` as v1.2 says. That way the PLAN §6.1 importer gets a package that passes its own gate. *(S–M)*

---

*ASSUMED: the course folder and the pkg5 upload are the current versions. PLAN.md's description of the gate (§6.1 T-5) is the target behaviour. Reading-speed figures (100–150 wpm for technical prose, ~8 code lines/min) are rules of thumb, not measurements of this cohort.*
