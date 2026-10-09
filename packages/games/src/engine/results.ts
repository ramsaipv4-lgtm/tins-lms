// Finishing a round (SPEC §13.3 "Finishing a round", §13.6, D-47, D-60, D-56): one gameResult in the learner's personal
// database; one card and one errorNote per Knowledge mistake (upserted by id, so a repeated mistake does not duplicate);
// one mastery check per concept played; the player caches recomputed. Action misses create nothing.
// The store is anything shaped like the hub's ctx.store: get(db, id), put(db, doc), list(db, prefix).
import type { Tuning } from '../tuning.ts';
import type { Pack, RoundResult } from './types.ts';
import { coinsOf, knowledgeStars, masteryChecks, scoreOf, xpOf } from './scoring.ts';
import { emptyPlayer, normalizePlayer, playerId, withCaches, type PlayerDoc } from './player.ts';

export interface DocStore {
  get(db: string, id: string): Promise<any | null>;
  put(db: string, doc: any): Promise<any>;
  list(db: string, prefix?: string): Promise<any[]>;
}

export interface GameResultDoc {
  type: 'gameResult'; id: string; schema: number; updatedAt: number; updatedBy: string;
  personId: string; classId: string; gameId: string; packId: string; levelId: string;
  score: number; stars: number; skill: number; knowledgeStars: number; outcome: 'won' | 'lost';
  xp: number; coins: number; claimed: number; assisted: number;
  mistakes: { itemId: string; concept: string }[]; assist: boolean; durationMs: number; at: number; seed: number;
}

export const personDb = (personKey: string): string => `person-${personKey}`;
export const cardId = (gameId: string, packId: string, itemId: string): string => `card:game-${gameId}-${packId}-${itemId}`;
export const errorNoteId = (gameId: string, packId: string, itemId: string): string => `errorNote:game-${gameId}-${packId}-${itemId}`;
export const gameResultId = (gameId: string, packId: string, levelId: string, at: number): string => `gameResult:${gameId}-${packId}-${levelId}-${at}`;
export const masteryCheckId = (resultKey: string, concept: string): string => `masteryCheck:${resultKey}:${concept}`;

/** The numbers of a result, computed from what the game reported (§13.3, §13.6). */
export function scoreRound(r: RoundResult, tuning: Tuning) {
  const knowledge = knowledgeStars(r.socketsTotal, r.socketsCorrect, r.mistakes.length, tuning);
  const skill = Math.max(0, Math.round(r.skill));
  return {
    skill, knowledgeStars: knowledge, stars: knowledge,
    score: scoreOf(skill, r.socketsCorrect, tuning),
    xp: xpOf(skill, knowledge, tuning),
    coins: coinsOf(skill, knowledge, r.goldenCoins ?? 0, tuning),
  };
}

export interface RecordInput {
  personKey: string; classKey: string; pack: Pack; levelId: string; result: RoundResult;
  assist: boolean; seed: number; now: number; schema: number; tuning: Tuning;
  /** Optional idempotency key from the client: sending the same round twice (an offline retry) writes it once. */
  clientKey?: string;
}

/** Write one finished round. Returns the stored gameResult and the updated player. */
export async function recordRound(store: DocStore, input: RecordInput): Promise<{ gameResult: GameResultDoc; player: PlayerDoc }> {
  const { personKey, classKey, pack, levelId, result, now, schema } = input;
  const db = personDb(personKey);
  const by = personKey;
  const n = scoreRound(result, input.tuning);
  let key = input.clientKey ? `gameResult:${pack.game}-${pack.id}-${levelId}-${input.clientKey}` : gameResultId(pack.game, pack.id, levelId, now);
  if (!input.clientKey) for (let k = 2; await store.get(db, key); k++) key = `${gameResultId(pack.game, pack.id, levelId, now)}-${k}`; // two rounds in one millisecond (a frozen test clock) stay two results
  const gameResult: GameResultDoc = {
    type: 'gameResult', id: key, schema, updatedAt: now, updatedBy: by,
    personId: `person:${personKey}`, classId: `class:${classKey}`, gameId: pack.game, packId: pack.id, levelId,
    score: n.score, stars: n.stars, skill: n.skill, knowledgeStars: n.knowledgeStars, outcome: result.outcome,
    xp: n.xp, coins: n.coins, claimed: result.claimed ?? 0, assisted: result.assisted ?? 0,
    mistakes: result.mistakes.map((m) => ({ itemId: m.itemId, concept: m.concept })),
    assist: !!input.assist, durationMs: Math.round(result.durationMs), at: now, seed: input.seed,
  };
  await store.put(db, gameResult);

  // Knowledge mistakes only: a card and an error note each (D-60).
  for (const m of result.mistakes) {
    const text = m.question ?? m.itemId;
    const cid = cardId(pack.game, pack.id, m.itemId);
    const prev = await store.get(db, cid);
    const fsrs = prev?.fsrs
      ? { ...prev.fsrs, due: Math.min(Number(prev.fsrs.due) || now, now) } // repeated mistake: due now, review history kept
      : { difficulty: 0, due: now, elapsed_days: 0, lapses: 0, last_review: null, learning_steps: 0, reps: 0, scheduled_days: 0, stability: 0, state: 0 };
    await store.put(db, {
      type: 'card', id: cid, schema, deck: 'games', front: text, back: m.correct ?? m.why ?? '', concept: m.concept,
      sourceRef: `${key}#${m.itemId}`, fsrs, updatedAt: now, updatedBy: by,
    });
    await store.put(db, {
      type: 'errorNote', id: errorNoteId(pack.game, pack.id, m.itemId), schema, dayIndex: pack.day, subtopic: m.concept,
      question: text, given: m.given ?? '', correct: m.correct ?? m.why ?? '', updatedAt: now, updatedBy: by,
    });
  }

  // One mastery check per concept played (§4.4).
  for (const c of masteryChecks(result.socketsByConcept, result.mistakes)) {
    await store.put(db, {
      type: 'masteryCheck', id: masteryCheckId(key, c.skill), schema, skill: c.skill, score: c.score, at: now,
      mode: 'game', gameId: pack.game, packId: pack.id, updatedAt: now, updatedBy: by,
    });
  }

  const player = await refreshPlayer(store, personKey, now, schema);
  return { gameResult, player };
}

export async function loadResults(store: DocStore, personKey: string): Promise<GameResultDoc[]> {
  return (await store.list(personDb(personKey), 'gameResult:')) as GameResultDoc[];
}

/** Load (or create) the player, recompute its caches from the results and purchases, and save it when anything changed. */
export async function refreshPlayer(store: DocStore, personKey: string, now: number, schema: number, by: string = personKey): Promise<PlayerDoc> {
  const db = personDb(personKey);
  const existing = await store.get(db, playerId(personKey));
  const base = existing ? normalizePlayer(existing, personKey, now, schema) : emptyPlayer(personKey, now, schema);
  const results = await loadResults(store, personKey);
  const next = withCaches(base, results);
  if (!existing || next !== base) {
    const saved = await store.put(db, { ...next, updatedAt: now, updatedBy: by });
    return normalizePlayer(saved, personKey, now, schema);
  }
  return base;
}

/** The learner's own last score and stars per game (latest `at`), for the arcade tile. */
export function lastByGame(results: readonly GameResultDoc[]): Record<string, { score: number; stars: number }> {
  const best: Record<string, GameResultDoc> = {};
  for (const r of results) if (!best[r.gameId] || r.at >= best[r.gameId].at) best[r.gameId] = r;
  return Object.fromEntries(Object.entries(best).map(([g, r]) => [g, { score: r.score, stars: r.stars }]));
}
