// Item analysis (SPEC §4.21)

export function itemAnalysis(
  rows: readonly { personId: string; itemId: string; correct: boolean }[],
): { itemId: string; p: number; discrimination: number; flag: boolean }[] {
  // Group by itemId
  const itemData = new Map<string, { personId: string; correct: boolean }[]>();

  for (const row of rows) {
    if (!itemData.has(row.itemId)) {
      itemData.set(row.itemId, []);
    }
    itemData.get(row.itemId)!.push({ personId: row.personId, correct: row.correct });
  }

  // Calculate person scores
  const personScores = new Map<string, number>();

  for (const row of rows) {
    if (!personScores.has(row.personId)) {
      personScores.set(row.personId, 0);
    }
    if (row.correct) {
      personScores.set(row.personId, personScores.get(row.personId)! + 1);
    }
  }

  // Rank people by score
  const rankedPeople = Array.from(personScores.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([personId]) => personId);

  const totalPeople = rankedPeople.length;
  const groupSize = Math.max(1, Math.floor(totalPeople * 0.27));

  const topGroup = new Set(rankedPeople.slice(0, groupSize));
  const bottomGroup = new Set(rankedPeople.slice(totalPeople - groupSize));

  const results: { itemId: string; p: number; discrimination: number; flag: boolean }[] = [];

  for (const [itemId, responses] of itemData) {
    let totalCorrect = 0;
    let topCorrect = 0;
    let bottomCorrect = 0;
    let topCount = 0;
    let bottomCount = 0;

    for (const response of responses) {
      if (response.correct) {
        totalCorrect++;
      }

      if (topGroup.has(response.personId)) {
        topCount++;
        if (response.correct) {
          topCorrect++;
        }
      }

      if (bottomGroup.has(response.personId)) {
        bottomCount++;
        if (response.correct) {
          bottomCorrect++;
        }
      }
    }

    const p = totalCorrect / responses.length;
    const pTop = topCount > 0 ? topCorrect / topCount : 0;
    const pBottom = bottomCount > 0 ? bottomCorrect / bottomCount : 0;
    const discrimination = pTop - pBottom;

    const flag = p < 0.2 || p > 0.95 || discrimination < 0.2;

    results.push({ itemId, p, discrimination, flag });
  }

  return results;
}
