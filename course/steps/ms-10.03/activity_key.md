# Activity key — Health digest and morning checklist (trainer only)

## Reinforcement activity: answer

**Task:** Implement a `summarizeHealth` function that takes the digest result and checklist result, and returns a single-line status string.

**Full solution:**

```ts
export function summarizeHealth(digest: HealthDigestResult, checklist: HealthCheckResult[]): string {
  if (digest.status === 'green') {
    return 'System OK';
  }

  const staleBackups = digest.backups.filter((b) => b.stale);
  const oldestStale = staleBackups.reduce((oldest, b) => {
    if (b.lastSuccessAt === null) return oldest;
    if (oldest.lastSuccessAt === null) return b;
    return b.lastSuccessAt < oldest.lastSuccessAt ? b : oldest;
  }, staleBackups[0]);

  if (staleBackups.length === 1 && digest.failedChecks.length === 0) {
    const ageMs = Date.now() - oldestStale.lastSuccessAt;
    const ageH = Math.round(ageMs / 3_600_000);
    return `Backup at risk (age: ${ageH} h)`;
  }

  const offlineCheck = checklist.find((c) => c.kind === 'offline' && !c.ok);
  if (offlineCheck && !digest.failedChecks.includes(offlineCheck.id)) {
    return `⚠️ ${offlineCheck.id} failed`;
  }

  const lastSyncCheck = checklist.find((c) => c.id.includes('sync') && c.ranAt);
  if (lastSyncCheck && !lastSyncCheck.ok && lastSyncCheck.lastKnownAt) {
    const syncAgeMs = Date.now() - lastSyncCheck.lastKnownAt;
    const syncAgeH = Math.round(syncAgeMs / 3_600_000);
    return `Offline, sync OK ${syncAgeH} h ago`;
  }

  return '⚠️ Multiple issues';
}
```

**Key points:**
- The function prioritizes issues: one stale backup gets its own message, multiple issues get flagged as "multiple".
- When offline, it looks for the last successful sync in `lastKnownAt` times.
- It calculates age in hours rounded to the nearest whole number (simpler UI).

**Common partial answers:**
- Returns hardcoded "OK" or "Error" without checking digest status: partial credit (they understood the pattern but not the logic).
- Ignores `lastKnownAt` values when offline: partial credit (they separated the cases but missed the history feature).
- Uses `Promise.all()` to run checks in parallel: partial credit if the pattern is right (they're thinking asynchronously) but they lose the offline-first guarantee.

## Marking guide

| Criterion | Full marks when | Common partial answer |
|---|---|---|
| Checks digest.status | Function returns 'System OK' only when status is 'green' | Returns 'OK' without checking, or checks only failedChecks |
| Staleness calculation | Computes age in hours from lastSuccessAt and returns it | Returns raw milliseconds or forgets null case |
| Offline mode | Uses lastKnownAt to show "sync OK X h ago" when offline | Ignores history; treats offline as pure red |
| Multiple issues | Returns a catch-all message when multiple problems exist | Returns the first problem only, or lists all of them without prioritizing |
| Pure function | Takes digest and checklist as arguments, returns string | Reads Date.now() directly (correct) or modifies input (incorrect) |
