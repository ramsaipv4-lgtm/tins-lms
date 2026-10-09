// Frame statistics for __game.stats() (SPEC §13.3 GameStats): frame times over the last 20 s of rendered frames.
import type { GameStats, Quality } from './types.ts';

export const WINDOW_MS = 20000;
export const MIN_FRAMES = 30;

export interface FrameStats {
  /** Record one rendered frame: `now` is a monotonic ms timestamp (performance.now()). */
  frame(now: number): void;
  /** Forget the previous frame time (after an idle gap) so the gap is not counted as a long frame. */
  gap(): void;
  snapshot(quality: Quality, heapMB: number | null): GameStats;
}

function percentile(sorted: number[], p: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[i];
}

export function createFrameStats(): FrameStats {
  let frames = 0;
  let last: number | null = null;
  const times: { at: number; dt: number }[] = [];
  return {
    frame(now) {
      frames++;
      if (last !== null && now > last) {
        times.push({ at: now, dt: now - last });
        while (times.length && now - times[0].at > WINDOW_MS) times.shift();
      }
      last = now;
    },
    gap() { last = null; },
    snapshot(quality, heapMB) {
      const enough = times.length >= MIN_FRAMES;
      const sorted = times.map((x) => x.dt).sort((a, b) => a - b);
      const p50 = enough ? percentile(sorted, 0.5) : null;
      return {
        frames, fps50: p50 ? Math.round((1000 / p50) * 10) / 10 : null, frameP50: p50 === null ? null : Math.round(p50 * 100) / 100,
        frameP95: enough ? Math.round(percentile(sorted, 0.95) * 100) / 100 : null,
        drawCalls: null, triangles: null, textures: null, heapMB, tier: quality.tier, pixelRatio: quality.pixelRatio, shadows: quality.shadows,
      };
    },
  };
}
