// Engine types (SPEC §13.3). Pure types: no DOM, no Node. Games import these and nothing else from the engine at build time.
import type { Tuning } from '../tuning.ts';

export type { Tuning };

// ---- packs (§13.5) ----
export interface LessonCard { concept: string; text: string; code?: string }
export interface PackLevel { id: string; title: string; lesson: LessonCard[]; [field: string]: unknown }
export interface Pack {
  game: string; id: string; title: string; day: number; concepts: string[]; language: string; levels: PackLevel[];
  [field: string]: unknown;
}

// ---- story (§13.5) ----
export type Beat =
  | { t: 'say'; who: string; key: string; holdMs?: number }
  | { t: 'move'; target: string; to: number[]; ms: number }
  | { t: 'camera'; to: number[]; ms: number }
  | { t: 'wait'; ms: number }
  | { t: 'sfx'; name: string }
  | { t: 'music'; name: string }
  | { t: 'shake'; ms: number; power: number }
  | { t: 'spawn'; what: string; at: number[] }
  | { t: 'fade'; to: 'in' | 'out'; ms: number }
  | { t: 'avatar' };
export interface Scene { beats: Beat[] }
export interface StoryFile {
  gameId: string; front: { nameKey: string }; cast: { id: string; nameKey: string }[]; scenes: Record<string, Scene>;
}
export interface Universe { cast: { id: string; nameKey: string }[]; scenes: Record<string, Scene> }

// ---- statuses, state and the test hooks (§13.3) ----
export type Status = 'story' | 'title' | 'playing' | 'paused' | 'won' | 'lost';
export interface SceneInfo { id: string; beat: number; line: string | null }
export interface GameState {
  status: Status;
  score: number; lives: number | null; stage: number;
  levelId: string; clockMs: number; assist: boolean;
  skill: number; knowledgeMistakes: number; actionMisses: number;
  extra: { scene: SceneInfo | null; [field: string]: unknown };
}
export interface GameStats {
  frames: number;
  fps50: number | null; frameP50: number | null; frameP95: number | null;
  drawCalls: number | null; triangles: number | null; textures: number | null;
  heapMB: number | null; tier: 'low' | 'medium' | 'high'; pixelRatio: number; shadows: boolean;
}
export interface TestGame {
  id: string;
  state(): GameState;
  act(action: string, arg?: unknown): boolean;
  advance(ms: number): GameState;
  stats(): GameStats;
}

// ---- actions (§13.3 "Common actions and keys", §13.7 per-game tables) ----
// A game lists its own actions in `GameModule.actions`; the engine turns them into keys and `act-<name>` buttons.
export interface ActionSpec {
  action: string;                  // the name passed to act(): 'left', 'strike', 'charge' ...
  label: string;                   // strings key of the button text
  keys?: string[];                 // KeyboardEvent.key values ('ArrowLeft', 'a', ' ', 'Shift'); letters match case-insensitively
  arg?: unknown;                   // fixed argument sent by the key and the button (e.g. { dx: -1, dy: 0 })
  keyAsArg?: boolean;              // the pressed key itself is the argument ('1'..'9' for strike)
  button?: string;                 // suffix of the button test id: 'nudge-left' gives act-nudge-left. Default: the action name
  held?: boolean;                  // key down / pointer down sends (action, arg); up sends the release below
  releaseAction?: string;          // action sent on release (default: the same action)
  releaseArg?: unknown;            // argument sent on release (run: 0, breathe: false)
  validIn?: Status[];              // statuses where it is valid (default: ['playing'])
  hidden?: boolean;                // no button (test-only or pointer-only actions)
}

// ---- the context a game gets (§13.3) ----
export interface GameClock {
  readonly stepMs: number;                 // 1000 / 60
  now(): number;                           // game time since start, ms (clockMs)
  sceneNow(): number;                      // scene time, ms
  onStep(fn: (dtGameMs: number) => void): () => void; // fixed-step update while playing; dt is in game ms (assist already applied)
  onRaw(fn: (driverMs: number) => void): () => void;  // every advance(), even when the game clock is stopped (calibration)
  factor(): number;                        // 1, or common.assistFactor with assist on
}
export interface Input {
  /** Subscribe to every action the engine accepts while playing (keys, buttons, act()). Returns an unsubscribe. */
  on(fn: (action: string, arg: unknown) => void): () => void;
  /** Is a held action currently down? */
  held(action: string): boolean;
}
export interface Sfx { play(name: string): void; music(name: string | null): void; setMuted(muted: boolean): void; muted(): boolean }
export interface Quality { tier: 'low' | 'medium' | 'high'; pixelRatio: number; shadows: boolean }
export interface Mistake { itemId: string; concept: string }
export interface MistakeDetail extends Mistake { question?: string; given?: string; correct?: string; why?: string }
export interface RoundResult {
  outcome: 'won' | 'lost';
  skill: number;
  socketsTotal: number;                    // sockets in the level
  socketsCorrect: number;                  // sockets answered correctly (assisted ones are not counted)
  socketsByConcept: Record<string, number>; // sockets answered correctly, per concept (mastery denominator)
  mistakes: MistakeDetail[];               // Knowledge mistakes only
  durationMs: number;
  claimed?: number;                        // sniper
  assisted?: number;                       // whack-a-bug
  goldenCoins?: number;
}
export interface Round {
  addSkill(points: number): void;          // negative points lower skill (never below 0)
  socketCorrect(socketId: string, concept: string): void;   // idempotent per socketId
  socketAssisted(socketId: string): void;                    // closed by an assisted hit: neither correct nor a mistake
  knowledgeMistake(m: MistakeDetail): void;
  actionMiss(n?: number): void;
  addGoldenCoins(n: number): void;
  setSocketsTotal(n: number): void;
  setClaimed(n: number): void;
  addAssisted(n?: number): void;
  snapshot(): { score: number; skill: number; knowledgeStars: number; knowledgeMistakes: number; actionMisses: number; socketsCorrect: number; socketsTotal: number; assisted: number; claimed: number };
  result(outcome: 'won' | 'lost', durationMs: number): RoundResult;
}
export interface StoryApi {
  /** Is a scene playing right now? */
  playing(): boolean;
  /** Start a scene by id (`<gameId>.<name>`); `onEnd` runs when it ends or is skipped. Returns false (and never calls onEnd) when story is off or the scene does not exist. */
  play(sceneId: string, onEnd?: () => void): boolean;
}
export interface PlayerApi {
  doc(): unknown;                           // the current player document
  timingOffsetMs(): number;
  setTimingOffsetMs(ms: number): void;      // saved to player.timingOffsetMs
}
export interface GameContext {
  pack: Pack; level: string; levelDef: PackLevel; seed: number;
  rng(stream?: string): () => number;      // seeded randomness (§4.1): the same seed and stream give the same sequence
  clock: GameClock;
  input: Input;
  audio: Sfx; quality: Quality; strings: (key: string, vars?: Record<string, string | number>) => string;
  story: StoryApi; player: PlayerApi; tuning: Tuning;
  round: Round;
  /** The Snek interpreter (§13.4), loaded on first use as its own chunk; null if it is not available in this build. */
  snek(): Promise<import('../check/snek.ts').SnekApi | null>;
  assist(): boolean;
  /** Open the lesson card overlay (status 'paused') with these cards; `continue` closes it. */
  lesson(cards: LessonCard[]): void;
  /** Report the end of the round: writes the gameResult and cards (D-47, D-60) and moves the status to won or lost. */
  finish(result: RoundResult): void;
}
export interface GameInstance {
  pause(): void; resume(): void; destroy(): void;
  /** Game-specific actions only (the engine handles the common ones). `start` is delivered here when the round begins. */
  act(action: string, arg?: unknown): boolean;
  /** Game part of the state; the engine fills in status, clockMs, assist, levelId, score, skill and the miss counts. */
  state(): { stage?: number; lives?: number | null; extra?: Record<string, unknown> } & Record<string, unknown>;
  /** Called once per frame when something may have moved; draw to the canvas. Optional (non-canvas games). */
  render?(): void;
}
export interface GameModule {
  id: string;
  actions?: ActionSpec[];
  mount(el: HTMLElement, ctx: GameContext): GameInstance;
}
