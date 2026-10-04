// Health digest and morning checklist functions for Coach LMS v1
// SPEC §7: AC-117

const MS_PER_HOUR = 3_600_000;
const STALENESS_THRESHOLD_HOURS = 48;
const STALENESS_THRESHOLD_MS = STALENESS_THRESHOLD_HOURS * MS_PER_HOUR;

export interface BackupEntry {
  target: string;
  lastSuccessAt: number | null;
}

export interface HealthDigestInput {
  now: number;
  backups: BackupEntry[];
  syncLagMs: number;
  checks: Array<{ id: string; ok: boolean }>;
}

export interface BackupResult {
  target: string;
  lastSuccessAt: number | null;
  stale: boolean;
}

export interface HealthDigestResult {
  status: 'green' | 'red';
  backups: BackupResult[];
  syncLagMs: number;
  failedChecks: string[];
}

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

function isBackupStale(now: number, lastSuccessAt: number | null): boolean {
  // A backup is stale if it has never succeeded (null) or is older than 48 hours
  if (lastSuccessAt === null) {
    return true;
  }
  return now - lastSuccessAt > STALENESS_THRESHOLD_MS;
}

export interface HealthCheck {
  id: string;
  kind: 'offline' | 'online';
  run: () => Promise<boolean>;
  lastKnownAt?: number;
}

export interface HealthCheckResult {
  id: string;
  kind: 'offline' | 'online';
  ok: boolean | null;
  ranAt: number | null;
  lastKnownAt: number | undefined;
}

export interface MorningChecklistInput {
  now: number;
  online: boolean;
  checks: HealthCheck[];
}

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
