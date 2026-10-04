// At-risk digest (SPEC §4.20)

export function atRisk(s: {
  lockedMissedDays: number;
  overdueCards: number;
  daysSinceCommit: number | null;
  lastShiftScorePct: number | null;
}): {
  level: 'ok' | 'watch' | 'risk';
  reasons: string[];
} {
  const reasons: string[] = [];
  let points = 0;

  // Check locked missed days >= 1
  if (s.lockedMissedDays >= 1) {
    reasons.push('locked missed days');
    points++;
  }

  // Check overdue cards >= 50
  if (s.overdueCards >= 50) {
    reasons.push('overdue cards');
    points++;
  }

  // Check days since commit >= 5
  if (s.daysSinceCommit !== null && s.daysSinceCommit >= 5) {
    reasons.push('days since commit');
    points++;
  }

  // Check last shift score < 50%
  if (s.lastShiftScorePct !== null && s.lastShiftScorePct < 50) {
    reasons.push('last shift score');
    points++;
  }

  // Determine level
  let level: 'ok' | 'watch' | 'risk';
  if (points === 0) {
    level = 'ok';
  } else if (points === 1) {
    level = 'watch';
  } else {
    level = 'risk';
  }

  return { level, reasons };
}
