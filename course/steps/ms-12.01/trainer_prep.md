# Trainer prep — The last two rows

## Before you start (prerequisites)

Know React effects, the Coach PIN record and where the Shift limit is computed (`limitFor` in `shift.ts`).

## 45-minute self-study path

Read the journal first (10 min), the five excerpts (15 min), then redo the two faulty-first questions without the hints (20 min).

## Worked example → faded example

Worked: the timer in the not-started state. Faded: the same for the score screen (the reinforcement activity).

## Top misconceptions

- "Slow" is the only reason a journey times out.
- Waiting longer fixes a race.
- The client should compute the limit.

## Questions students will ask (with answers)

1. Is the placeholder PIN record a stored document? It is the PIN record; no learner data, entries still save only on Confirm.
2. Why not IndexedDB for the OCR data? Writing about 5 MB on a slow phone costs more than the HTTP cache saves.

## Your mastery check (private)

Explain, without notes, why the desktop failure alternated and what one write order removes it.
