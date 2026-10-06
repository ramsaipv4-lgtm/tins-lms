# Final project: evidence-linked resume bullets (v2)

**Source:** `docs/FEATURE-IDEAS.md`, idea **B-8**, "Evidence-linked resume bullets" (phase 2). SPEC §0 lists "resume bullets (B-8)" under "Not in v1", so nothing in the v1 code builds it. **Size:** the idea is rated S (a day or two). Allow six to ten hours with a journal.

**Honest note.** The rows below are written by the course editor as a proposal in the SPEC's own style. They are not part of the v1 SPEC and no acceptance test for them exists. You write the tests. That is the point of the project: derive behaviour from a written specification, then prove it.

## The idea

From the owner's note in FEATURE-IDEAS: bullets are drafted from work a learner actually did (merged pull requests, Shift incidents solved), each linked to proof, so interviewers can verify them. All bullets live in the **portfolio**; the resume takes only the top **3 to 5**, chosen by the student. The decision rule D-31 applies: rules propose, the person decides.

## Your job

Follow the course's method end to end:

1. **SPEC first.** Add the decisions and rows below to your copy of `SPEC.md` (AGENTS.md rule 2), including the new switch key in the §4.27 table and AC-49's exact list. Each AC row must name its test file.
2. **One task at a time.** Open a tins-kit session per task with its paths declared: core, then server, then web.
3. **Write tests first.** Unit tests in `packages/core/test` and `packages/server/test`; a journey in the style of the v1 journeys, using only the UI contract below.
4. **Keep a journal** (decision, every mistake with exact failing output, how found, proof) and write one course step for each task.
5. **Gate.** Run one gate at a time. Claim a row only after the gate has shown it green.

## Decisions (add to SPEC §1)

| ID | Decision |
|---|---|
| D-V2-1 | Bullets are drafted by fixed rules, with no AI call, so the feature works offline (P-16, D-32). The text is the same for the same evidence. |
| D-V2-2 | Evidence kinds are `merged-pr`, `shift-incident` and `certificate`. Team badges are not evidence: v1 shows them at team level only (AC-168), and a resume must not turn them into an individual claim. |
| D-V2-3 | A bullet with no proof link does not exist. Evidence without a proof URL produces no bullet. |
| D-V2-4 | Switch `resumeBullets`, default **off**, hidden when off (§4.27 pattern). A minor profile never sees it (D-33). |
| D-V2-5 | The student chooses 3 to 5 bullets for the resume. Nothing is saved until the student confirms (the P-16 rule used by screenshot import). |

## Core (`packages/core/src/resume.ts`)

```ts
type Evidence = { id: string; kind: 'merged-pr' | 'shift-incident' | 'certificate'; title: string; at: number; proofUrl: string; skills: string[] }
type Bullet = { id: string; evidenceId: string; text: string; proofUrl: string }
draftBullets(evidence: readonly Evidence[]): Bullet[]
chooseForResume(bullets: readonly Bullet[], chosenIds: readonly string[]):
  { ok: true; bullets: Bullet[] } | { ok: false; reason: 'too-few' | 'too-many' | 'unknown-bullet' }
renderResumeMarkdown(bullets: readonly Bullet[]): string
```

Rules:

- `draftBullets` orders evidence newest first (`at` descending), ties by `id` ascending, and skips evidence whose `proofUrl` is empty. A bullet's `id` is `bullet:<evidence id>`.
- The text is `<Verb> <title>` followed by ` (<skills joined with ", ">)` when there are skills. The verb is `Merged` for `merged-pr`, `Resolved` for `shift-incident` and `Completed` for `certificate`.
- `chooseForResume` counts each distinct chosen id once, answers `unknown-bullet` for an id that is not in `bullets`, `too-few` below 3, `too-many` above 5, and otherwise returns the chosen bullets in the order of `bullets` (not the order of the choice).
- `renderResumeMarkdown` renders one list line per bullet, in the given order, with a final newline: a dash and a space, the text, a space, then the proof URL as a Markdown link labelled `proof` inside round brackets (the lines in the rubric's answer key show the exact shape). A `(` or `)` in a URL is percent-encoded as `%28` or `%29`, so the link cannot close early.
- No function reads a clock, a random value or the network (D-22).

## Server (`packages/server/src/routes/features/resume.ts`)

| Route | Behaviour |
|---|---|
| `GET /api/me/resume-evidence` | The signed-in learner's own evidence only: merged PRs and Shift incidents from their records, and their certificates. 404 when the switch is off or the person is a minor |
| `POST /api/me/resume` | Body `{ bulletIds }`. Runs `chooseForResume`; stores the chosen list on the learner's own record only after the request succeeds; answers 422 with the reason otherwise |
| `GET /api/me/resume.md` | The Markdown from `renderResumeMarkdown` for the stored choice |

## Acceptance rows (proposed)

| ID | Behaviour | Check |
|---|---|---|
| AC-201 | `draftBullets` orders newest first with ties by id, skips evidence with an empty proof URL, and gives the same output for the same input | `acceptance/core/resume.test.mjs` |
| AC-202 | The bullet text uses the verb for its kind, lists the skills only when there are some, and every bullet carries its proof URL | `acceptance/core/resume.test.mjs` |
| AC-203 | `chooseForResume` returns `too-few` for 2, `ok` for 3 to 5, `too-many` for 6, `unknown-bullet` for a foreign id, counts a repeated id once, and keeps the draft order | `acceptance/core/resume.test.mjs` |
| AC-204 | `renderResumeMarkdown` gives one list line per bullet in the shape shown in the rubric's answer key and encodes `(` and `)` in a URL | `acceptance/core/resume.test.mjs` |
| AC-205 | `GET /api/me/resume-evidence` returns only the caller's evidence; with the switch off or for a minor it returns 404 | `acceptance/api/resume.test.mjs` |
| AC-206 | `POST /api/me/resume` with 2 or 6 bullet ids returns 422 and stores nothing; with 3 stores them; the Markdown route returns exactly those bullets | `acceptance/api/resume.test.mjs` |
| AC-207 | **Journey: resume bullets.** With the switch on, the learner opens Resume from the nav, taps "Draft bullets", sees each bullet with its proof link, chooses three, sees the sixth refused, confirms, and downloads the Markdown. Nothing is stored before the confirm | `acceptance/journeys/resume.journey.mjs` |
| AC-208 | With the switch off, the Resume entry is not in the nav and the route answers 404 | `acceptance/journeys/resume.journey.mjs` |

## A journey (UI contract for AC-207)

Seed "resume" (you define it, in the style of SPEC Appendix E): learner `l1` has the four evidence items below and the switch is on.

| Test id | Meaning |
|---|---|
| `resume-bullet-<evidenceId>` | One drafted bullet with its proof link |
| `resume-choose-<evidenceId>` | The checkbox to choose it |
| `resume-count` | Text "3 of 5 chosen" style counter |
| `resume-confirm` | The confirm button; disabled until 3 to 5 are chosen |

Accessible names: learner nav `/resume/`; button `/draft bullets/`; button `/confirm|save/`; link `/download( resume)?( markdown)?/`. Remember the lessons of the course: one nav owner for the word "Resume" (run `scripts/navcheck.mjs` after adding the entry), and show "Loading" until the evidence arrives, so a fast click on the confirm button cannot see a placeholder state (integration I-10 and I-12).

## Sample data for your unit tests

Times are milliseconds. `e4` has no proof URL.

| id | kind | title | at | proofUrl | skills |
|---|---|---|---|---|---|
| e1 | merged-pr | Fix DNS TTL docs | 2000 | `https://git.example.test/org/repo/pull/12` | dns |
| e2 | shift-incident | Disk-full incident | 3000 | `https://hub.example.test/shift/7` | linux, monitoring |
| e3 | certificate | Azure fundamentals track | 2000 | `https://hub.example.test/verify/7KQ2M9X4TB1R` | none |
| e4 | merged-pr | Add retry | 1000 | (empty) | http |

The reference answers are in the [rubric](rubric.md). Do not open them until your own tests pass.

## Hand in

- The SPEC diff (decisions and rows).
- The code, with a green gate (`node .tins/kit/bin/kit.mjs gate`, final line quoted).
- A journal per task with at least one real failure and its exact output, and a course step for the core task in the course's five-file format.
- A short note: which course steps you reused, and which of the twelve integration items (Appendix A) your design avoided or hit.
