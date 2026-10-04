---
id: ms-10.03
title: Health digest and morning checklist
module: 10
est_minutes: 35
prereqs: [ms-01.01]
objectives: 3
new_terms: 4
skills: [health-monitoring, offline-first, async-iteration]
source_refs: [{ path: packages/adapters/src/health.ts, commit: c6653dd7722af186c248f1a0287b482b06e3bd4a }]
next: end
---

# MS 10.3 — Health digest and morning checklist
*Building health checks into the adapter layer*

## Prerequisites

- Async/await and Promise-based patterns in TypeScript
- How systems detect and report issues (like disk space, network connectivity)
- Time arithmetic and understanding of milliseconds/hours

## You already understand this

- A backup is only useful if it's recent; older backups cannot restore fresh data
- A system should tell you what's wrong, not just that something is wrong
- Some checks require network (like reaching a service), others don't (like checking local disk space)

## The detective question

**Problem:** Users need to know if their Coach system is healthy: are backups working, is sync keeping up, and have critical checks passed? They also need a quick morning checklist of system readiness that works both online and offline. When offline, online checks should still show their last-known values instead of failing completely.

**Options considered:**
1. Run all checks every time, wait for all results, and fail if any online check can't complete while offline.
2. Separate checks into offline (always run) and online (run only when connected), returning null for skipped online checks.
3. Cache all check results indefinitely and never recompute them unless forced.

**Choice:** Option 2. Run offline checks first, then online checks if connectivity allows. Return explicit null for skipped online checks while preserving their `lastKnownAt` timestamp from the previous run.

**Why:** Offline-first design respects network reality: users may be in areas with poor connectivity. Running offline checks immediately provides useful information. When a check is skipped due to offline mode, null clearly signals "not checked now" vs "checked and failed". The `lastKnownAt` preserves helpful history without false optimism.

## Learning objectives

1. Design a health digest function that marks backups as stale after 48 hours.
2. Build a morning checklist that prioritizes offline checks and handles missing connectivity.
3. Use async iteration to run checks sequentially and preserve their execution order.

## Conceptual understanding

**Health digest:** A backup is `stale` if it has never succeeded (lastSuccessAt is null) or if `now - lastSuccessAt > 48 hours`. The digest lists each backup's staleness alongside other health signals (sync lag, failed checks) and returns "red" status if any backup is stale.

**Morning checklist:** Checks are sorted by kind (offline first). Each check's `run()` function is awaited in order. When offline, online checks are included in results but their `ok` and `ranAt` fields are set to null, preserving `lastKnownAt` for display to the user.

**48-hour threshold:** This is the staleness boundary. Why 48 hours? A 24-hour full backup plus a 24-hour rolling window means you never lose more than a day's worth of data. At 48 hours you're beginning to accumulate risk.

## Walkthrough of the real code

The health digest computes staleness for each backup:

```ts packages/adapters/src/health.ts
function isBackupStale(now: number, lastSuccessAt: number | null): boolean {
  // A backup is stale if it has never succeeded (null) or is older than 48 hours
  if (lastSuccessAt === null) {
    return true;
  }
  return now - lastSuccessAt > STALENESS_THRESHOLD_MS;
}
```

The main digest function maps backups to their result objects and checks if any are stale:

```ts packages/adapters/src/health.ts
export async function healthDigest(input: HealthDigestInput): Promise<HealthDigestResult> {
  const { now, backups, syncLagMs, checks } = input;

  // Process backups and check staleness
  const backupResults: BackupResult[] = backups.map((backup) => ({
    target: backup.target,
    lastSuccessAt: backup.lastSuccessAt,
    stale: isBackupStale(now, backup.lastSuccessAt),
  }));

  // Check if any backup is stale
  const hasStaleBackup = backupResults.some((b) => b.stale);

  // Get failed checks
  const failedChecks = checks.filter((c) => !c.ok).map((c) => c.id);

  return {
    status: hasStaleBackup || failedChecks.length > 0 ? 'red' : 'green',
    backups: backupResults,
    syncLagMs,
    failedChecks,
  };
}
```

The morning checklist separates checks by kind and runs them in order:

```ts packages/adapters/src/health.ts
export async function runMorningChecklist(input: MorningChecklistInput): Promise<HealthCheckResult[]> {
  const { now, online, checks } = input;

  // Separate offline and online checks
  const offlineChecks = checks.filter((c) => c.kind === 'offline');
  const onlineChecks = checks.filter((c) => c.kind === 'online');

  // Run offline checks first
  const offlineResults: HealthCheckResult[] = [];
  for (const check of offlineChecks) {
    const ok = await check.run();
    offlineResults.push({
      id: check.id,
      kind: check.kind,
      ok,
      ranAt: now,
      lastKnownAt: check.lastKnownAt,
    });
  }

  // Run online checks if online
  const onlineResults: HealthCheckResult[] = [];
  if (online) {
    for (const check of onlineChecks) {
      const ok = await check.run();
      onlineResults.push({
        id: check.id,
        kind: check.kind,
        ok,
        ranAt: now,
        lastKnownAt: check.lastKnownAt,
      });
    }
  } else {
    // When offline, don't run online checks but include them with null values
    for (const check of onlineChecks) {
      onlineResults.push({
        id: check.id,
        kind: check.kind,
        ok: null,
        ranAt: null,
        lastKnownAt: check.lastKnownAt,
      });
    }
  }

  // Return offline checks first, then online checks
  return [...offlineResults, ...onlineResults];
}
```

Note the explicit loop structure: we don't use `Promise.all()` because we want to preserve the order and run checks sequentially.

## Your turn: faulty first

No mistakes to learn from in this implementation—it passed all tests on the first try. But here's what a common mistake would look like:

```ts
// ❌ WRONG: this loses the offline-first ordering
const results = await Promise.all([
  ...checks.map(async (c) => ({ ...c, ok: await c.run(), ranAt: now }))
]);
```

Why it's wrong: `Promise.all()` runs everything concurrently, which breaks the offline-first guarantee. If an offline check is slow, it might start after an online check. The sequential loop ensures offline checks always run (and complete) first.

## Technical glossary

- **Staleness**: A backup is stale when it's older than the safety threshold (48 hours) or has never completed.
- **Online mode**: The system has network connectivity and can reach external services.
- **Offline mode**: The system cannot reach external services; online checks are skipped.
- **Last-known time**: The timestamp from the most recent successful run of a check.
- **Health digest**: A summary of system status including backup age, sync lag, and failed checks.

## Common questions

1. **What if a backup never completed?** It's considered stale from the start. The digest tells you immediately that you have no fallback.
2. **Why null instead of false for skipped online checks?** Because `false` means "we checked and it failed", while `null` means "we didn't check". These are different states the UI should display differently (maybe with a clock icon for "last known at X").
3. **What if an offline check throws an error?** The test harness shows `run()` returning a promise. If it throws, the checklist should catch that and return `ok: false` (or the calling code can wrap the run function to do so).

## Reinforcement activity

Implement a third function `summarizeHealth` that takes the digest result and the checklist result, and returns a single string suitable for a status bar:
- "System OK" if status is green
- "Backup at risk (age: 25 h)" if the oldest backup is stale
- "Offline, sync OK 2 h ago" if offline but the last sync ran recently
- "⚠️ Multiple issues" if there are both backup and check failures

Write it as a pure function. Test it with the real output from `healthDigest` and `runMorningChecklist`.

## Check yourself

1. If a backup succeeded 47 hours ago and `now` is exactly 48 hours later, is it stale? <details>No. Stale is `>` 48 hours, not `≥`. At exactly 48 hours it's still safe.</details>

2. You're running the morning checklist offline. A disk check fails. What are the values in the result?
   <details>`ok: false`, `ranAt: NOW`, `lastKnownAt: (whatever it was before)` — offline checks always run.</details>

3. You're running online. Five checks run: 3 offline, 2 online. In what order do they appear in the result array?
   <details>All 3 offline checks first (in their original order), then both online checks. Not sorted by result, not by check id—strictly offline-first.</details>

## Quick reference

**Constants:** 
- 48-hour staleness threshold = 172,800,000 milliseconds

**Input shapes:**
- `healthDigest({ now, backups: [{ target, lastSuccessAt }], syncLagMs, checks: [{ id, ok }] })`
- `runMorningChecklist({ now, online, checks: [{ id, kind, run, lastKnownAt? }] })`

**Key design patterns:**
- Pure functions (time passed in, no side effects except calling run functions)
- Explicit null for skipped states (not omitted or false)
- Sequential loops for ordering guarantees

## Connection to the bigger picture

The health digest is the system's heartbeat. Trainers need to see at a glance that backups are working and sync is keeping pace. The morning checklist is a daily ritual: before training starts, run the offline checks (quick, local) to catch configuration problems, then the online checks if you're connected. Both functions live in the adapters layer because they bridge between core logic (pure decision-making) and infrastructure (which may vary by deployment profile: phone, hub, cloud, or hybrid).

## Next

End of this step.
