// Server clock. Core functions take time as an argument; routes pass clock.now().
// /__test/clock freezes it at a given instant; set(null) returns to real time.
export type Clock = { now(): number; set(ms: number | null): void };

export function createClock(): Clock {
  let fixed: number | null = null;
  return {
    now: () => (fixed ?? Date.now()),
    set: (ms) => { fixed = ms; },
  };
}
