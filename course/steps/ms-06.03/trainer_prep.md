# Trainer prep — Packages, gate on upload, sealed sections

## Before you start (prerequisites)
Know ms-06.01 (ctx, store) and the release functions in core.

## 45-minute self-study path
Read the lesson, run the three tests in `packages/server/test/content.test.mjs`, then do the faulty-first exercise.

## Worked example → faded example
Worked: normalizePaths on `./a/b`. Faded: learners predict the output for a wrapped archive.

## Top misconceptions
- Sealing at read time is enough.
- A time fallback applies to graded sections.
- A hidden failure needs more guesses rather than observation.

## Questions students will ask (with answers)
- Why 409 not 400? The request is valid but conflicts with the package state.

## Your mastery check (private)
Explain how a learner gets a section key and why a graded section stays sealed past its planned time.
