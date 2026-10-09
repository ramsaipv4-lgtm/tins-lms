// Seeded randomness for games (SPEC §4.1, D-51). Without `?seed=` the seed is seedFor(class.seedSalt, 'game:<gameId>:<packId>:<levelId>').
import { createRng, seedFor } from '../../../core/src/rng.ts';

export function gameSeedKey(gameId: string, packId: string, levelId: string): string {
  return `game:${gameId}:${packId}:${levelId}`;
}

/** The default numeric seed of a level in a class. */
export function defaultSeed(seedSalt: string, gameId: string, packId: string, levelId: string): number {
  const hex = seedFor(seedSalt, gameSeedKey(gameId, packId, levelId));
  const n = parseInt(hex, 16);
  return Number.isFinite(n) ? n : 0;
}

/** `?seed=<int>` wins when it is a valid integer; otherwise the default. */
export function resolveSeed(query: string | null | undefined, fallback: number): number {
  if (query != null && /^-?\d+$/.test(query.trim())) return Number(query);
  return fallback;
}

/** A named random stream: the same seed and stream always give the same sequence; different streams are independent. */
export function streamRng(seed: number, stream = 'main'): () => number {
  return createRng(`${seed}:${stream}`);
}
