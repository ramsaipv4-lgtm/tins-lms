// Lazy access to Snek (SPEC §13.4) for games and renderers: ctx.snek(). The interpreter is its own chunk named `snek` (D-57)
// and loads only when a game asks for it. Until packages/games/src/lang exists (task g-1) this resolves to null.
import type { SnekApi } from '../check/snek.ts';

let cached: Promise<SnekApi | null> | null = null;

export function loadSnek(): Promise<SnekApi | null> {
  cached ??= (async () => {
    try {
      // Under Vite this call becomes a map of lazy imports (empty while lang does not exist); Node has no import.meta.glob.
      const mods = import.meta.glob('../lang/index.ts') as Record<string, () => Promise<any>>;
      const load = Object.values(mods)[0];
      const m = load ? await load() : null;
      return m && typeof m.compile === 'function' ? (m as SnekApi) : null;
    } catch {
      try {
        const m: any = await import(/* @vite-ignore */ new URL('../lang/index.ts', import.meta.url).href);
        return typeof m.compile === 'function' ? (m as SnekApi) : null;
      } catch { return null; }
    }
  })();
  return cached;
}
