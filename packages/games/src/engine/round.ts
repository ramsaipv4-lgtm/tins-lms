// Round accounting: Skill and Knowledge are kept apart (D-60). A game reports into this object; the engine reads the
// state and the final RoundResult from it. Only Knowledge mistakes go into `mistakes`; an action miss never does.
import type { Tuning } from '../tuning.ts';
import type { MistakeDetail, Round, RoundResult } from './types.ts';
import { knowledgeStars, scoreOf } from './scoring.ts';

export function createRound(tuning: Tuning, socketsTotal = 0): Round {
  let skill = 0;
  let misses = 0;
  let total = socketsTotal;
  let golden = 0;
  let claimed = 0;
  let assisted = 0;
  const correct = new Map<string, string>(); // socketId -> concept
  const assistedSockets = new Set<string>();
  const mistakes: MistakeDetail[] = [];

  const stars = () => knowledgeStars(total, correct.size, mistakes.length, tuning);
  const byConcept = (): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const c of correct.values()) out[c] = (out[c] ?? 0) + 1;
    return out;
  };

  return {
    addSkill(points) { skill = Math.max(0, skill + points); },
    socketCorrect(id, concept) { if (!assistedSockets.has(id)) correct.set(id, concept); },
    socketAssisted(id) { if (!correct.has(id)) assistedSockets.add(id); },
    knowledgeMistake(m) { mistakes.push({ ...m }); },
    actionMiss(n = 1) { misses += n; },
    addGoldenCoins(n) { golden += n; },
    setSocketsTotal(n) { total = n; },
    setClaimed(n) { claimed = n; },
    addAssisted(n = 1) { assisted += n; },
    snapshot() {
      return {
        score: scoreOf(skill, correct.size, tuning), skill, knowledgeStars: stars(), knowledgeMistakes: mistakes.length,
        actionMisses: misses, socketsCorrect: correct.size, socketsTotal: total, assisted, claimed,
      };
    },
    result(outcome, durationMs): RoundResult {
      const r: RoundResult = {
        outcome, skill, socketsTotal: total, socketsCorrect: correct.size, socketsByConcept: byConcept(),
        mistakes: mistakes.map((m) => ({ ...m })), durationMs: Math.round(durationMs),
      };
      if (claimed) r.claimed = claimed;
      if (assisted) r.assisted = assisted;
      if (golden) r.goldenCoins = golden;
      return r;
    },
  };
}
