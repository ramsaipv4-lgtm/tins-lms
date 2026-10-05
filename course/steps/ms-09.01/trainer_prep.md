# Trainer prep — Performance budgets and the 200-learner load test CLI

## Before you start (prerequisites)
Run the hub in test mode (`LMS_TEST_MODE=1 LMS_TLS=off`) and have the CLI command ready.

## 45-minute self-study path
Read the lesson, run the unit tests with `node --test packages/cli/test/*.test.mjs`, then run the CLI against your own local hub.

## Worked example → faded example
Worked: the `assertLocalTarget` guard. Faded: add a phase that also reads each learner's own record, and decide how it affects `lostWrites`.

## Top misconceptions
- "Average latency is the budget." The budget is a share of requests under a limit.
- "A 2xx means it was stored."
- "Loopback hosts are only 127.0.0.1." `localhost` and `::1` count too.

## Questions students will ask (with answers)
- *Can I point it at staging?* No: the guard refuses it and staging has no `/__test/*`.
- *Why are the budgets (AC-100, AC-102) here?* They are measured on the web build; the entry chunk is about 58 KB gzipped.

## Your mastery check (private)
Explain, without notes, why a failed request must stay in the timing sample.
