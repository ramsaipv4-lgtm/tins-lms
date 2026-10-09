// The game clock (SPEC §13.3 "Game clock", D-45, D-51, D-58). Fixed-step 60 Hz. It advances at 1x while playing and at
// `common.assistFactor` with assist on; it does not advance while paused, in 'story', on the title screen, after the
// round, or while the tab is hidden. In 'story' the scene clock runs instead (never scaled by assist).
// Every timing window in a game is measured in this clock, so a driver using `advance(ms)` gets the same outcome
// on every run and every CPU.
import type { GameClock } from './types.ts';

export const STEP_MS = 1000 / 60;
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

export type ClockMode = 'play' | 'story' | 'stopped';

export interface ClockControl extends GameClock {
  setMode(mode: ClockMode): void;
  mode(): ClockMode;
  setHidden(hidden: boolean): void;
  hidden(): boolean;
  setAssist(on: boolean): void;
  assist(): boolean;
  /** Run `ms` of driver time synchronously: whole fixed steps, then one short step for the remainder, so the clock moves by exactly ms x factor. */
  advance(ms: number): void;
  /** Real-time frame delta (requestAnimationFrame): whole fixed steps only, the remainder carries to the next frame. */
  tick(realMs: number): void;
  onScene(fn: (ms: number) => void): () => void; // the scene clock moved by ms (story mode)
  reset(): void;
}

export function createClock(opts: { assistFactor: number }): ClockControl {
  let mode: ClockMode = 'stopped';
  let hidden = false;
  let assist = false;
  let game = 0;
  let scene = 0;
  let carry = 0;
  const stepFns = new Set<(dt: number) => void>();
  const rawFns = new Set<(ms: number) => void>();
  const sceneFns = new Set<(ms: number) => void>();

  const factor = (): number => (assist ? opts.assistFactor : 1);

  function runStep(driverMs: number): void {
    if (mode === 'play') {
      const dt = driverMs * factor();
      game += dt;
      for (const fn of [...stepFns]) fn(dt);
    } else if (mode === 'story') {
      scene += driverMs;
      for (const fn of [...sceneFns]) fn(driverMs);
    }
  }

  return {
    stepMs: STEP_MS,
    now: () => round6(game),
    sceneNow: () => round6(scene),
    factor,
    onStep(fn) { stepFns.add(fn); return () => { stepFns.delete(fn); }; },
    onRaw(fn) { rawFns.add(fn); return () => { rawFns.delete(fn); }; },
    onScene(fn) { sceneFns.add(fn); return () => { sceneFns.delete(fn); }; },
    setMode(m) { mode = m; },
    mode: () => mode,
    setHidden(h) { hidden = h; },
    hidden: () => hidden,
    setAssist(on) { assist = !!on; },
    assist: () => assist,
    advance(ms) {
      if (!(ms > 0) || !Number.isFinite(ms)) return;
      for (const fn of [...rawFns]) fn(ms);
      if (hidden) return;
      let left = ms;
      while (left > 1e-9) {
        const d = Math.min(STEP_MS, left);
        left -= d;
        runStep(d);
      }
    },
    tick(realMs) {
      if (!(realMs > 0) || !Number.isFinite(realMs)) return;
      const ms = Math.min(realMs, 250); // a long gap (tab switch, debugger) is not replayed
      for (const fn of [...rawFns]) fn(ms);
      if (hidden) { carry = 0; return; }
      carry += ms;
      while (carry >= STEP_MS - 1e-9) { carry -= STEP_MS; runStep(STEP_MS); }
    },
    reset() { game = 0; scene = 0; carry = 0; },
  };
}
