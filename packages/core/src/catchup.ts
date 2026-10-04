// Catch-up gate (SPEC §4.3)

export interface CatchUpInput {
  dayIds: readonly string[];
  todayIndex: number;
  attended: readonly string[];
  bestScores: Record<string, number>;
  passMark?: number;
}

export interface CatchUpState {
  missed: string[];
  nextGate: string | null;
  unlocked: string[];
  selfStudyBlocked: boolean;
}

export function catchUpState(input: CatchUpInput): CatchUpState {
  const passMark = input.passMark ?? 6;
  const attendedSet = new Set(input.attended);

  // Find all missed days (days before today that were not attended)
  const missed: string[] = [];
  for (let i = 0; i < input.todayIndex; i++) {
    const dayId = input.dayIds[i];
    if (!attendedSet.has(dayId)) {
      missed.push(dayId);
    }
  }

  // Determine which missed days are unlocked
  // A missed day is unlocked when:
  // 1. Its best score >= pass mark
  // 2. All earlier missed days are unlocked
  const unlockedMissed = new Set<string>();
  for (const missedDayId of missed) {
    const score = input.bestScores[missedDayId] ?? 0;
    if (score >= passMark) {
      // Check if all earlier missed days are unlocked
      const missedIndex = missed.indexOf(missedDayId);
      let allEarlierUnlocked = true;
      for (let i = 0; i < missedIndex; i++) {
        if (!unlockedMissed.has(missed[i])) {
          allEarlierUnlocked = false;
          break;
        }
      }
      if (allEarlierUnlocked) {
        unlockedMissed.add(missedDayId);
      }
    }
  }

  // Find nextGate: first missed day not yet unlocked
  let nextGate: string | null = null;
  for (const missedDayId of missed) {
    if (!unlockedMissed.has(missedDayId)) {
      nextGate = missedDayId;
      break;
    }
  }

  // Build unlocked list: attended days + today + unlocked missed days
  const unlocked: string[] = [];
  for (let i = 0; i <= input.todayIndex; i++) {
    const dayId = input.dayIds[i];
    if (attendedSet.has(dayId) || i === input.todayIndex || unlockedMissed.has(dayId)) {
      unlocked.push(dayId);
    }
  }

  // selfStudyBlocked is true while any missed day is locked
  const selfStudyBlocked = missed.length > unlockedMissed.size;

  return {
    missed,
    nextGate,
    unlocked,
    selfStudyBlocked,
  };
}

export function gradedDueDate(gatePassedAt: number, extensionDays?: number): number {
  const days = extensionDays ?? 7;
  return gatePassedAt + days * 24 * 60 * 60 * 1000;
}
