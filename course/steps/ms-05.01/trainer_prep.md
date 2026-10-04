# Trainer prep — Package import and content gate

## Before you start (prerequisites)
Learners should know Markdown tables and fences, and have seen the script parser from the pacing step.

## 45-minute self-study path
1. Read the lesson (15 min).
2. Run `node --test packages/core/test/gate.test.mjs` (10 min).
3. Plant your own defect in the test fixture and see which check id fails (20 min).

## Worked example → faded example
Worked: G6, code fences without a language. Faded: write a check that every handout has a heading.

## Top misconceptions
- "A waiver is a pass." It is a flag on a failed check, with an expiry.
- "The layouts are different formats." They give the same day shape.

## Questions students will ask (with answers)
**Why not read real folders?** A map of strings runs in the browser and in tests alike.

## Your mastery check (private)
Explain why the day key uses the track folder and the number rather than the file's own directory.
