---
id: ms-09.01
title: Performance budgets and the 200-learner load test CLI
module: 9
est_minutes: 40
prereqs: [ms-01.01]
objectives: 3
new_terms: 6
skills: [load-testing, percentiles, test-mode-hubs]
source_refs: [{ path: packages/cli/src/loadtest.ts, commit: 5099bad50419a4f7e9d6ab828e8257c18b8852fa }, { path: packages/cli/src/stats.ts, commit: 5099bad50419a4f7e9d6ab828e8257c18b8852fa }]
next: ms-10.01
---

# MS 9.1 — Performance budgets and the 200-learner load test CLI
*Step 36 of 41*

## Prerequisites

- `fetch` and `Promise.all` in TypeScript
- What an HTTP cookie is
- The hub's `/__test/login` route (SPEC §5.9)

## You already understand this

- A restaurant on a busy night is judged by how long most tables wait, not by the one table that waited longest or shortest.
- A cloakroom attendant who hands back 199 of 200 coats has lost a coat, however fast the line moved.

## The detective question

**Problem:** SPEC AC-103 wants a command that makes 200 simulated learners sign in, mark attendance, answer a live quiz and sync, and says whether 95% of requests finished within a second and no write was lost. It must never hit a real host.

**Options considered:**
1. Write a separate load script per phase and eyeball the logs.
2. Add a load-test library such as autocannon.
3. Write one small CLI on built-in `fetch` that times every request, runs each phase for all learners at once and counts the documents the hub kept.

**Choice:** Option 3, with a guard that accepts loopback targets only.

**Why:** SPEC §1.1 allows no new dependency. One summary line (Appendix B) is what the suite parses. Counting stored documents afterwards is the only honest way to say "no write lost": an acknowledged write that is missing is a loss.

## Learning objectives

1. Time every request, including failures, and compute a percentage-within-limit and a percentile.
2. Run a phase for all learners at once and measure its window.
3. Verify durability by reading back, not by trusting acknowledgements.

## Conceptual understanding

The app shell budget (AC-100, AC-102) is about what the browser downloads: the entry chunk is about 58 KB gzipped and feature screens are lazy chunks, far under the 300 KB limit. The load test is about the hub.

The CLI logs in as a trainer, creates a class and 200 enrolments through the replication endpoint, then runs four phases: sign in, attendance, quiz answers, sync. A failed or thrown request is recorded as `Infinity`, so it can only lower the percentage.

## Walkthrough of the real code

The guard: `/__test/login` exists only on a test hub, so the tool refuses any other host.

```ts packages/cli/src/loadtest.ts
/** The load test refuses anything but a loopback target: it logs in through /__test/*, which only a test hub has. */
export function assertLocalTarget(target: string): URL {
  let u: URL;
  try { u = new URL(target); } catch { throw new Error(`invalid --target: ${target}`); }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) {
    throw new Error(`refusing non-local target ${u.hostname}: the load test only runs against a local hub in test mode`);
  }
  return u;
}
```

The percentile is nearest-rank, so p95 is a real observed time.

```ts packages/cli/src/stats.ts
/** Nearest-rank percentile of a list of numbers; 0 for an empty list. */
export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1];
}
```

Each phase runs every learner through a small pool, so at most 40 requests are in flight and each is timed from the moment it is sent.

```ts packages/cli/src/loadtest.ts
  // 1. Sign in.
  await eachLearner(learners, (l) => call(l, '/__test/login', 'POST', { personId: l.name, roles: ['learner'] }));

  // 2. Attendance with the rotating code.
  const code = await call(staff, `/api/classes/${classKey}/attendance-code`, 'GET');
  await eachLearner(learners, (l) => call(l, `/api/classes/${classKey}/attendance`, 'POST', { code: code.json?.code }));
```

## Your turn: faulty first

One real mistake from the build journal (M1). I ran `node .tins/kit/bin/kit.mjs gate` in a foreground shell with a 120 s limit. The output was:

```text
Command did not complete within its 120s timeout and was moved to the background
```

Find the cause before reading the fix: the gate runs every claimed row's acceptance checks on a machine shared with other builders, so it can take minutes. The fix is to start long commands in the background and wait on their output file with an `until` loop, never a bare `sleep` (a `sleep 60` was itself refused by the shell: "Blocked: sleep 60 followed by ...", M2).

## Technical glossary

- **Budget**: a number the build must stay under.
- **Loopback**: an address (127.0.0.1) that reaches only your own machine.
- **p95**: the time that 95% of requests beat.
- **Nearest rank**: percentile method that returns a value from the sample.
- **Lost write**: an acknowledged write that is missing afterwards.
- **Quiz window**: time from first answer sent to last answer received.

## Common questions

**Why count `Infinity`?** A request that failed must make the percentage worse, not vanish.

**Why not use the quiz's own server route?** The hub has none; answers are attempts (`POST /api/classes/:id/attempts`, mode `live`).

## Reinforcement activity

Predict the summary if the hub silently drops every sync write but still answers 201. Then run the unit test that does exactly this.

## Check yourself

1. Why does the CLI refuse `https://example.com`?
<details>It logs in through `/__test/login`, which exists only on a test hub, and must never be pointed at an external host.</details>

2. A run has 190 of 200 requests under 1 s. What is within1sPct and does it pass on that alone?
<details>95.0, which meets the 95% limit; the other conditions (200 answers, 10 s window, zero lost writes) must hold too.</details>

3. How does the tool know a write was lost?
<details>It lists the documents in the class database afterwards and compares counts per learner.</details>

## Quick reference

`node packages/cli/src/main.ts loadtest --learners 200 --target http://127.0.0.1:PORT`; last stdout line is the JSON summary; exit 0 means pass.

## Connection to the bigger picture

AC-100 and AC-102 protect the phone experience; AC-103 protects the classroom moment when everyone answers at once.

## Next

Before you continue, do [Checkpoint 5](../../checkpoints/checkpoint-5/checkpoint.md).

Next: [MS 10.1 — GitHub App and Forgejo adapters, push-check hook](../ms-10.01/lesson.md).
