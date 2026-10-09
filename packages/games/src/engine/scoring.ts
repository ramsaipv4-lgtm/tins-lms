// Stars, score, XP and coins (SPEC §13.3 "Stars, scores and mistakes", §13.6 "Earnings"). Pure functions of the Tuning table.
import type { Tuning } from '../tuning.ts';
import type { Mistake } from './types.ts';

/** 0 to 3, Knowledge only. 3: every socket answered, no mistake. 2: every socket answered, at most starsTwoMaxMistakes. 1: at least one socket correct. 0: none. */
export function knowledgeStars(socketsTotal: number, socketsCorrect: number, mistakes: number, tuning: Tuning): 0 | 1 | 2 | 3 {
  if (socketsCorrect <= 0) return 0;
  const all = socketsCorrect >= socketsTotal;
  if (all && mistakes === 0) return 3;
  if (all && mistakes <= tuning['common.starsTwoMaxMistakes']) return 2;
  return 1;
}

/** score = skill + knowledgePoints x sockets answered correctly. */
export function scoreOf(skill: number, socketsCorrect: number, tuning: Tuning): number {
  return skill + tuning['common.knowledgePoints'] * socketsCorrect;
}

/** xp = round(skill / xpSkillDivisor) + xpPerStar x knowledgeStars. */
export function xpOf(skill: number, stars: number, tuning: Tuning): number {
  return Math.round(skill / tuning['common.xpSkillDivisor']) + tuning['common.xpPerStar'] * stars;
}

/** coins = coinsPerStar x knowledgeStars + floor(skill / coinsSkillDivisor) + golden-critter coins. */
export function coinsOf(skill: number, stars: number, goldenCoins: number, tuning: Tuning): number {
  return tuning['common.coinsPerStar'] * stars + Math.floor(skill / tuning['common.coinsSkillDivisor']) + goldenCoins;
}

/** One mastery check per concept played: 1 - mistakes on that concept / sockets of that concept answered (clamped to 0..1). */
export function masteryChecks(socketsByConcept: Record<string, number>, mistakes: readonly Mistake[]): { skill: string; score: number }[] {
  const concepts = new Set<string>([...Object.keys(socketsByConcept), ...mistakes.map((m) => m.concept)]);
  return [...concepts].sort().map((skill) => {
    const wrong = mistakes.filter((m) => m.concept === skill).length;
    const answered = Math.max(socketsByConcept[skill] ?? 0, 1);
    return { skill, score: Math.min(1, Math.max(0, 1 - wrong / answered)) };
  });
}
