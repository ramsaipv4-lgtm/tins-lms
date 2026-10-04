// Retention (SPEC §4.31)

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_MS = 365 * DAY_MS;

export function retentionDue(
  docs: readonly { id: string; type: string; createdAt: number; batchEndedAt: number | null; resultsAt: number | null }[],
  now: number
): { delete: string[]; pseudonymise: string[] } {
  const deleteIds: string[] = [];
  const pseudonymiseIds: string[] = [];

  for (const doc of docs) {
    const { id, type, createdAt, batchEndedAt, resultsAt } = doc;

    if (type === 'integrity') {
      // Delete 180 days after resultsAt
      if (resultsAt !== null && now >= resultsAt + 180 * DAY_MS) {
        deleteIds.push(id);
      }
    } else if (type === 'chat') {
      // Delete 1 year after createdAt
      if (now >= createdAt + YEAR_MS) {
        deleteIds.push(id);
      }
    } else if (type === 'container') {
      // Delete at batchEndedAt
      if (batchEndedAt !== null && now >= batchEndedAt) {
        deleteIds.push(id);
      }
    } else if (type === 'grade' || type === 'certificate') {
      // Pseudonymise 3 years after batchEndedAt, never delete
      if (batchEndedAt !== null && now >= batchEndedAt + 3 * YEAR_MS) {
        pseudonymiseIds.push(id);
      }
    }
  }

  return { delete: deleteIds, pseudonymise: pseudonymiseIds };
}
