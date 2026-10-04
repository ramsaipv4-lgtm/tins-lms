// Mastery map (SPEC §4.4)

export interface MasteryCheck {
  skill: string;
  score: number;
  at: number;
}

export function masteryMap(checks: readonly MasteryCheck[]): Record<string, 'mastered' | 'not-yet'> {
  // Group checks by skill
  const skillChecks: Record<string, MasteryCheck[]> = {};
  for (const check of checks) {
    if (!skillChecks[check.skill]) {
      skillChecks[check.skill] = [];
    }
    skillChecks[check.skill].push(check);
  }

  // Determine mastery for each skill
  const result: Record<string, 'mastered' | 'not-yet'> = {};
  for (const skill in skillChecks) {
    const skillCheckList = skillChecks[skill];
    // Sort by timestamp, most recent last
    skillCheckList.sort((a, b) => a.at - b.at);

    if (skillCheckList.length < 2) {
      // A skill with only one check is not-yet
      result[skill] = 'not-yet';
    } else {
      // Get the two most recent checks
      const latest = skillCheckList[skillCheckList.length - 1];
      const secondLatest = skillCheckList[skillCheckList.length - 2];

      // Check if both are >= 0.8 and at least 24h apart
      const minScoreOk = latest.score >= 0.8 && secondLatest.score >= 0.8;
      const twentyFourHoursInMs = 24 * 60 * 60 * 1000;
      const timeOk = latest.at - secondLatest.at >= twentyFourHoursInMs;

      if (minScoreOk && timeOk) {
        result[skill] = 'mastered';
      } else {
        result[skill] = 'not-yet';
      }
    }
  }

  return result;
}
