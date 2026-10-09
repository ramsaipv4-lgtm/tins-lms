// The game registry (SPEC §13.3, D-57): game modules load lazily, one chunk each, named `game-<gameId>` by vite.config.ts.
// Games live in packages/games/src/games/<gameId>/index.ts and export `default` (a GameModule) or `game`.
// Nothing here imports a game statically, so no game chunk is requested until a learner opens a game.
import type { GameModule } from './types.ts';

type Loader = () => Promise<Record<string, unknown>>;
const injected = new Map<string, Loader>();
let discovered: Record<string, Loader> | null = null;

/** Register a loader by hand (tests, or a game that is not under src/games). */
export function registerGame(id: string, loader: Loader): void { injected.set(id, loader); }

function discover(): Record<string, Loader> {
  if (discovered) return discovered;
  const found: Record<string, Loader> = {};
  try {
    // Vite replaces this call with a map of lazy imports (empty while no game exists); Node has no import.meta.glob.
    const mods = import.meta.glob('../games/*/index.ts') as Record<string, Loader>;
    for (const [path, load] of Object.entries(mods)) {
      const id = /games\/([^/]+)\/index\.ts$/.exec(path)?.[1];
      if (id) found[id] = load;
    }
  } catch { /* not running under Vite */ }
  discovered = found;
  return found;
}

export function knownGames(): string[] { return [...new Set([...Object.keys(discover()), ...injected.keys()])].sort(); }
export function hasGame(id: string): boolean { return injected.has(id) || id in discover(); }

export async function loadGame(id: string): Promise<GameModule> {
  const load = injected.get(id) ?? discover()[id];
  if (!load) throw new Error(`no game module "${id}"`);
  const m = await load();
  const mod = (m.default ?? m.game) as GameModule | undefined;
  if (!mod || typeof mod.mount !== 'function') throw new Error(`game "${id}" does not export a GameModule`);
  return mod;
}
