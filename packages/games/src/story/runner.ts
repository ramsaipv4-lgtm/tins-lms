// The scene player (SPEC §13.3 "Scene state and timing", §13.5 Beat). Pure state machine: no DOM, no timers.
// The engine moves its scene clock with advance(ms) and draws what onBeat announces.
// - A `say` beat waits for `next`; it never advances by itself. With autoAdvance on it advances after holdMs
//   (default story.sayNominalMs) of scene time.
// - move / camera / wait / shake / fade take their `ms`; sfx / music / spawn take no time; `avatar` waits for the avatar action.
// - `skip` ends the scene at once; the end (natural or skipped) calls onEnd, which is where the seen flag is set.
import type { Beat, Scene, SceneInfo } from '../engine/types.ts';

export const BEAT_TYPES = ['say', 'move', 'camera', 'wait', 'sfx', 'music', 'shake', 'spawn', 'fade', 'avatar'] as const;

export interface RunnerOptions {
  sayNominalMs: number;
  autoAdvance?: () => boolean;
  onBeat?: (beat: Beat, index: number, sceneId: string) => void;
  onEnd?: (sceneId: string, how: 'end' | 'skip') => void;
  onAvatar?: (arg: { look: string; color: string; nameTag: string }) => void;
}

export interface SceneRunner {
  start(sceneId: string, scene: Scene): boolean;
  active(): boolean;
  info(): SceneInfo | null;
  beat(): Beat | null;
  advance(ms: number): void;
  next(): boolean;
  skip(): boolean;
  avatar(arg: unknown): boolean;
}

const EPS = 1e-6; // scene time arrives in 1/60 s slices; float error must not leave a beat one slice short
const WAITS_FOR_ACTION = new Set(['say', 'avatar']);

export function beatMs(b: Beat): number {
  switch (b.t) {
    case 'move': case 'camera': case 'wait': case 'shake': case 'fade': return Math.max(0, Number(b.ms) || 0);
    default: return 0;
  }
}

export function createSceneRunner(opts: RunnerOptions): SceneRunner {
  let id: string | null = null;
  let beats: Beat[] = [];
  let index = 0;
  let left = 0;       // ms left of a timed beat
  let heldFor = 0;    // scene ms spent on a say (autoAdvance)

  const cur = (): Beat | null => (id !== null ? beats[index] ?? null : null);

  function finish(how: 'end' | 'skip'): void {
    const done = id;
    id = null; beats = []; index = 0; left = 0; heldFor = 0;
    if (done !== null) opts.onEnd?.(done, how);
  }

  // Begin the beat at `i`, then run through every beat that takes no time and has nothing to wait for.
  function enter(i: number, spare: number): void {
    index = i;
    for (;;) {
      if (id === null) return;
      const b = beats[index];
      if (!b) { finish('end'); return; }
      opts.onBeat?.(b, index, id);
      if (id === null) return; // a handler may have skipped the scene
      heldFor = 0;
      if (WAITS_FOR_ACTION.has(b.t)) {
        // spare scene time counts toward an autoAdvance say
        if (b.t === 'say') { heldFor = spare; spare = 0; if (autoDue(b)) { index++; continue; } }
        return;
      }
      const ms = beatMs(b);
      if (spare >= ms - EPS) { spare = Math.max(0, spare - ms); index++; continue; }
      left = ms - spare; spare = 0;
      return;
    }
  }

  function autoDue(b: Beat): boolean {
    if (b.t !== 'say' || !opts.autoAdvance?.()) return false;
    return heldFor >= (b.holdMs ?? opts.sayNominalMs) - EPS;
  }

  return {
    start(sceneId, scene) {
      id = sceneId; beats = scene.beats ?? []; index = 0; left = 0; heldFor = 0;
      enter(0, 0);
      return true;
    },
    active: () => id !== null,
    info() {
      const b = cur();
      if (id === null) return null;
      return { id, beat: index, line: b && b.t === 'say' ? b.key : null };
    },
    beat: cur,
    advance(ms) {
      if (id === null || !(ms > 0)) return;
      const b = cur();
      if (!b) return;
      if (b.t === 'say') {
        if (!opts.autoAdvance?.()) return;
        heldFor += ms;
        const hold = b.holdMs ?? opts.sayNominalMs;
        if (heldFor >= hold - EPS) enter(index + 1, Math.max(0, heldFor - hold));
        return;
      }
      if (b.t === 'avatar') return;
      if (ms >= left - EPS) enter(index + 1, Math.max(0, ms - left));
      else left -= ms;
    },
    next() {
      const b = cur();
      if (!b || b.t === 'avatar') return false;
      enter(index + 1, 0); // finishing a timed beat early is allowed: the tap moves the scene on
      return true;
    },
    skip() {
      if (id === null) return false;
      finish('skip');
      return true;
    },
    avatar(arg) {
      const b = cur();
      if (!b || b.t !== 'avatar') return false;
      const a = arg as { look?: unknown; color?: unknown; nameTag?: unknown } | null;
      if (!a || typeof a !== 'object') return false;
      opts.onAvatar?.({ look: String(a.look ?? 'block'), color: String(a.color ?? 'teal'), nameTag: String(a.nameTag ?? '') });
      enter(index + 1, 0);
      return true;
    },
  };
}
