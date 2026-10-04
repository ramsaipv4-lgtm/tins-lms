// Seeded randomness (SPEC §4.1)
import { utf8Encode, hmacSha256, hexEncode } from './util.ts';

/**
 * Creates a seeded random number generator.
 * Returns a function that produces values in [0, 1).
 * Same seed produces identical sequences.
 */
export function createRng(seed: string): () => number {
  // Initialize the state from the seed using HMAC-SHA-256
  // We use a synchronous PRNG algorithm (xorshift32) with state derived from the seed

  // Convert seed string to a number for xorshift initialization
  let state: number = hashStringToNumber(seed);

  // Ensure state is not zero (xorshift32 requires non-zero state)
  if (state === 0) {
    state = 1;
  }

  return function(): number {
    // xorshift32 algorithm: simple, deterministic, and fast
    let x = state;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    state = x;

    // Convert to [0, 1)
    // Use unsigned right shift to ensure positive value
    return ((x >>> 0) % 1000000000) / 1000000000;
  };
}

/**
 * Generates a stable seed for a graded item within a class.
 * Same class + item always produces the same seed.
 * Different classes or items produce different seeds.
 */
export function seedFor(classSalt: string, itemId: string): string {
  // Combine class salt and item id to create a unique seed
  // Use a simple concatenation with separator to avoid collisions
  const combined = `${classSalt}:${itemId}`;
  return hashStringToString(combined);
}

/**
 * Fisher-Yates shuffle using the provided RNG.
 * Returns a new shuffled array without mutating the input.
 */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = Array.from(items);
  const n = result.length;

  // Fisher-Yates shuffle from the end
  for (let i = n - 1; i > 0; i--) {
    // Pick a random index from 0 to i (inclusive)
    const j = Math.floor(rng() * (i + 1));

    // Swap result[i] and result[j]
    const temp = result[i];
    result[i] = result[j];
    result[j] = temp;
  }

  return result;
}

// Helper: Convert a string to a deterministic number
function hashStringToNumber(str: string): number {
  // Simple hash function: use sum of character codes
  // This needs to be synchronous, so we can't use crypto
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// Helper: Convert a string to a deterministic string hash
function hashStringToString(str: string): string {
  // For deterministic hashing of strings, we'll use a simple hash
  // We can't use async crypto here, so use a synchronous approach
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to hex string
  return Math.abs(hash).toString(16).padStart(8, '0');
}
