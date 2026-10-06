# Rubric: Checkpoint 6

| # | Criterion | Points | Full marks when | Partial |
|---|---|---|---|---|
| 1 | AC-153 reasoning | 5 | Names the request flow, the admin approval and the Shift and exam timers; explains the missing-nav failure | Two of three flows |
| 2 | AC-94 reasoning | 5 | Hub-served OCR data, lazy import outside the shell budget, confirm-before-save; explains both b11-1 failures as observed, not guessed | One part missing |
| 3 | Full gate | 6 | Alone on the machine, final line and duration recorded, any run-only-in-full failure traced to a pattern in the strategy | Gate run but nothing recorded |
| 4 | Continuity | 4 | `CONTINUE.md` has the three facts and a fresh clone reproduces green, or the failure is reported honestly | Only the file checked |

14 of 20 is a pass.

## Answer key

**1. AC-153** (SPEC §4.26, §6.3, Appendix C and D; journals b7-7 and b11-2). A learner requests an accommodation at signup or later (the journey looks for `/settings|profile|accommodations?/` and a button `/request (an )?accommodation/`); an admin approves it (`/accommodations?|requests/`, button `/approve/`); then the learner's Shift and exam timers show the extended limit (`shift-timer`, nav `/shift/`). The core function clamps the multiplier to 1 to 3 (1.5 turns 60 minutes into 90). The journey stops at `no visible link/button/tab named /^(shift|the shift)$/i` when the Shift group (b7-6) is not merged, which is why b7-7 and b11-2 could not claim the row. Another trap found on the way: navcheck showed "Settings" (files group, order 2) sorting before "Accommodations" (classroom, order 9); the fix was order 1.5 for Accommodations (journal b11-2).

**2. AC-94** (SPEC D-11, D-32, §4.18; journals b7-8, b11-1, b11-2). The English OCR data is served by the hub (`/api/coach/ocr/*`), never a third-party CDN; the hub reads it from `LMS_TESSDATA_DIR` or `<data dir>/tessdata/eng.traineddata.gz`, and in b11-1 gained a fallback to the pinned `@tesseract.js-data/eng` package. `tesseract.js` is imported on first use only, to keep the shell under 300 KB (AC-102). The app shows extracted values and saves nothing until the learner confirms. In b11-1 the phone failure was `expected shot-confirm (OCR in the browser may take a while) to be visible`, passing in 35 to 48 s on some runs and failing at 60 s on others; a request log showed about 490 chunks fetched at start-up by the service worker precache before the OCR requests. b11-2 later cut the core precache from 252 entries and 8.2 MB to 83 entries and 0.67 MB. The desktop failure `no document may be saved before the learner confirms  1 !== 0` was not explained: b11-1 left it as an open question with a temporary log that showed only `coachMeta`, no `coachEntry`, in the failing run. Mark an answer that says "unexplained" correctly; mark invented causes down.

**3. Full gate.** No fixed answer. In the build, the whole acceptance suite took 29.5 minutes in item I-12 and the gate timeout had to be raised. A row that fails only in the full run is almost always one of the strategy's patterns (I-1 to I-12).

**4. Continuity** (SPEC AC-130, AC-131). `CONTINUE.md` in this project names the phase, what was merged, what is in progress, the next work and the check command `node .tins/kit/bin/kit.mjs gate`. A fresh clone plus `npm ci` plus the gate command must reproduce the last recorded green state. This course does not record that run; you do.
