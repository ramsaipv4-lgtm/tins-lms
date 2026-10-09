// The game session: statuses, the launch order, common actions, scenes, the clock, the round and the test-hook surface
// (SPEC §13.3). It has no DOM of its own: the host (host.ts / the web screens) draws the overlays and feeds it keys,
// and a game module draws the canvas. Unit tests drive it directly with a fake module.
import { TUNING, type Tuning } from '../tuning.ts';
import { createSceneRunner, type SceneRunner } from '../story/runner.ts';
import type {
  ActionSpec, GameContext, GameInstance, GameModule, GameState, GameStats, Input, LessonCard, Pack, PackLevel, Quality, Scene,
  Sfx, Status, StoryApi, PlayerApi, RoundResult, Round,
} from './types.ts';
import { createClock, type ClockControl } from './clock.ts';
import { createRound } from './round.ts';
import { streamRng } from './seed.ts';
import { scoreRound } from './results.ts';
import { commonValid, isCommon, specValid, type CommonAction, type View } from './actions.ts';
import { createFrameStats, type FrameStats } from './stats.ts';
import { loadSnek } from './snek.ts';
import type { PlayerDoc, PlayerPatch } from './player.ts';

export interface PlayerStore {
  doc(): PlayerDoc;
  patch(patch: PlayerPatch): void;
}

export interface FinishPayload { result: RoundResult; assist: boolean; seed: number; levelId: string; clientKey: string }
export interface ResultsView {
  outcome: 'won' | 'lost'; score: number; stars: number; skill: number; knowledgeStars: number; xp: number; coins: number;
  assisted: number; assist: boolean;
  mistakes: { itemId: string; concept: string; question?: string; given?: string; correct?: string; why?: string }[];
  saved: 'pending' | 'saved' | 'queued';
}

export interface SessionOptions {
  module: GameModule;
  pack: Pack; levelId: string; seed: number;
  el: HTMLElement;
  storyOn: boolean;
  /** Scene by id (`<gameId>.intro`, `prologue`, ...); null when there is none. */
  scenes: (sceneId: string) => Scene | null;
  player: PlayerStore;
  strings: (key: string, vars?: Record<string, string | number>) => string;
  isLastLevel: boolean;
  /** Persist a finished round (gameResult, cards, mastery). May reject (offline): the view then says 'queued'. */
  persist: (payload: FinishPayload) => Promise<unknown>;
  onQuit: () => void;
  onChange?: () => void;
  audio?: Sfx; quality?: Quality; tuning?: Tuning;
  /** Prologue mode: no title screen; the scene (default `prologue`) plays at once and onDone runs when it ends or is skipped. */
  prologue?: { onDone: () => void; sceneId?: string };
  /** `?clock=manual`: the clock moves only through advance(ms) and a frame is drawn after each action and advance. */
  manual?: boolean;
  /** Monotonic ms (performance.now). */
  now?: () => number;
  raf?: (cb: (ts: number) => void) => number;
  caf?: (id: number) => void;
  heapMB?: () => number | null;
}

const silent: Sfx = { play() {}, music() {}, setMuted() {}, muted: () => true };
const defaultQuality: Quality = { tier: 'medium', pixelRatio: 1, shadows: false };

export interface Session {
  readonly id: string;
  readonly clock: ClockControl;
  readonly ctx: GameContext;
  readonly instance: GameInstance;
  state(): GameState;
  act(action: string, arg?: unknown): boolean;
  advance(ms: number): GameState;
  stats(): GameStats;
  destroy(): void;
  destroyed(): boolean;
  // for the host / screens
  view(): View;
  overlay(): 'menu' | 'lesson' | null;
  lessonCards(): LessonCard[];
  scene(): { id: string; beat: number; line: string | null; beatDef: unknown } | null;
  results(): ResultsView | null;
  specs(): readonly ActionSpec[];
  /** Every action valid right now, with the button test id it needs: [{ testId: 'act-next', action: 'next', arg: undefined }]. */
  buttons(): { testId: string; action: string; arg?: unknown; label: string; held?: ActionSpec }[];
  seenScenes(): string[];
  setHidden(hidden: boolean): void;
  /** Start the real-time loop (requestAnimationFrame). No-op with a manual clock. */
  startLoop(): void;
  version(): number;
  subscribe(fn: () => void): () => void;
  readonly manual: boolean;
  /** The host reports a held action going down or up (key or pointer); games read it with ctx.input.held(). */
  setHeld(action: string, down: boolean): void;
}

export function createSession(opts: SessionOptions): Session {
  const tuning = opts.tuning ?? TUNING;
  const gameId = opts.module.id;
  const levelDef: PackLevel | undefined = opts.pack.levels.find((l) => l.id === opts.levelId);
  if (!levelDef && !opts.prologue) throw new Error(`pack ${opts.pack.id} has no level ${opts.levelId}`);
  const level = levelDef ?? ({ id: opts.levelId, title: '', lesson: [] } as PackLevel);
  const specs = opts.module.actions ?? [];

  const clock = createClock({ assistFactor: tuning['common.assistFactor'] });
  const round: Round = createRound(tuning);
  const frames: FrameStats = createFrameStats();
  const quality = opts.quality ?? defaultQuality;
  const nowFn = opts.now ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));

  let status: Status = 'title';
  let overlay: 'menu' | 'lesson' | null = null;
  let resumeTo: 'playing' | 'story' | 'title' = 'playing';
  let cards: LessonCard[] = [];
  let destroyed = false;
  const manual = !!opts.manual;
  let finished: { view: ResultsView; finalStatus: 'won' | 'lost' } | null = null;
  let version = 0;
  let sceneAfter: (() => void) | null = null;
  const recent: string[] = [];
  const listeners = new Set<() => void>();
  const inputFns = new Set<(a: string, arg: unknown) => void>();
  const heldNow = new Set<string>();
  let assistUsed = false; // assist was on at any moment of play: recorded on the result, never punished
  let rafId: number | null = null;
  let lastTs: number | null = null;

  const emit = () => { version++; for (const fn of [...listeners]) fn(); opts.onChange?.(); invalidate(); };

  // ---- scenes ----
  const runner: SceneRunner = createSceneRunner({
    sayNominalMs: tuning['story.sayNominalMs'],
    autoAdvance: () => !!opts.player.doc().settings.autoAdvance,
    onBeat: (beat) => {
      if (beat.t === 'sfx') audio.play(beat.name);
      else if (beat.t === 'music') audio.music(beat.name);
    },
    onAvatar: (a) => opts.player.patch({ avatar: a }),
    onEnd: (sceneId) => {
      const seen: PlayerPatch['seen'] = { scenes: { [sceneId]: true } };
      if (sceneId === 'prologue') seen.prologue = true;
      else if (sceneId === `${gameId}.intro`) seen.intro = { [gameId]: true };
      opts.player.patch({ seen });
      if (!recent.includes(sceneId)) recent.push(sceneId);
      const after = sceneAfter; sceneAfter = null;
      after?.();
      emit();
    },
  });
  clock.onScene((ms) => runner.advance(ms));

  const audio: Sfx = opts.audio ?? silent;

  /** Play a scene: status 'story', clocks as §13.3 says, `after` runs when it ends or is skipped. */
  function playScene(sceneId: string, after: () => void): boolean {
    if (!opts.storyOn && !opts.prologue) return false;
    const scene = opts.scenes(sceneId);
    if (!scene) return false;
    status = 'story';
    overlay = null;
    clock.setMode('story');
    sceneAfter = () => { after(); };
    runner.start(sceneId, scene);
    return true;
  }
  const setPlayMode = () => {
    if (status === 'playing' && clock.assist()) assistUsed = true;
    clock.setMode(status === 'playing' ? 'play' : status === 'story' ? 'story' : 'stopped');
  };

  // ---- the game ----
  const storyApi: StoryApi = {
    playing: () => runner.active(),
    play(sceneId, onEnd) {
      return playScene(sceneId, () => { status = 'playing'; setPlayMode(); onEnd?.(); });
    },
  };
  const playerApi: PlayerApi = {
    doc: () => opts.player.doc(),
    timingOffsetMs: () => opts.player.doc().timingOffsetMs,
    setTimingOffsetMs: (ms) => opts.player.patch({ timingOffsetMs: ms }),
  };
  const input: Input = {
    on(fn) { inputFns.add(fn); return () => { inputFns.delete(fn); }; },
    held: (a) => heldNow.has(a),
  };
  const ctx: GameContext = {
    pack: opts.pack, level: opts.levelId, levelDef: level, seed: opts.seed,
    rng: (stream) => streamRng(opts.seed, stream),
    clock, input, audio, quality, strings: opts.strings, story: storyApi, player: playerApi, tuning, round,
    assist: () => clock.assist(),
    snek: loadSnek,
    lesson(list) {
      if (status !== 'playing') return;
      cards = list; status = 'paused'; overlay = 'lesson'; resumeTo = 'playing'; setPlayMode(); emit();
    },
    finish(result) { finish(result); },
  };
  const instance = opts.module.mount(opts.el, ctx);

  // ---- finishing ----
  function finish(result: RoundResult): void {
    if (finished || destroyed) return;
    const n = scoreRound(result, tuning);
    const view: ResultsView = {
      outcome: result.outcome, score: n.score, stars: n.stars, skill: n.skill, knowledgeStars: n.knowledgeStars, xp: n.xp, coins: n.coins,
      assisted: result.assisted ?? 0, assist: assistUsed, mistakes: result.mistakes.map((m) => ({ ...m })), saved: 'pending',
    };
    finished = { view, finalStatus: result.outcome };
    const settle = () => { status = result.outcome; overlay = null; setPlayMode(); emit(); };
    const clientKey = `${Math.floor(nowFn())}-${opts.seed}-${Math.floor(Math.random() * 1e9)}`;
    // The result is written first (§13.3 "Order of a launch"), then the chapter-end scene, then the results screen.
    opts.persist({ result, assist: assistUsed, seed: opts.seed, levelId: opts.levelId, clientKey })
      .then(() => { view.saved = 'saved'; emit(); }, () => { view.saved = 'queued'; emit(); });
    clock.setMode('stopped');
    status = result.outcome; overlay = null;
    if (result.outcome === 'won' && opts.isLastLevel && playScene(`${gameId}.chapter-end`, settle)) { emit(); return; }
    settle();
  }

  // ---- view and validity ----
  const seenScenes = (): string[] => {
    const keys = Object.keys(opts.player.doc().seen.scenes);
    return [...new Set([...keys, ...recent])];
  };
  function view(): View {
    return {
      status, overlay, avatarBeat: runner.beat()?.t === 'avatar', hasSeenScene: seenScenes().length > 0, storyOn: opts.storyOn,
    };
  }
  const current = () => runner.info();

  // ---- actions ----
  function common(action: CommonAction, arg: unknown): boolean {
    const v = view();
    if (!commonValid(action, v)) return false;
    switch (action) {
      case 'start': {
        status = 'playing'; overlay = null; setPlayMode();
        instance.act('start');
        emit(); return true;
      }
      case 'pause': {
        resumeTo = status === 'story' ? 'story' : 'playing';
        if (status === 'playing') instance.pause();
        status = 'paused'; overlay = 'menu'; clock.setMode('stopped'); emit(); return true;
      }
      case 'resume': {
        status = resumeTo === 'story' ? 'story' : resumeTo === 'title' ? 'title' : 'playing'; overlay = null; setPlayMode();
        if (status === 'playing') instance.resume();
        emit(); return true;
      }
      case 'continue': {
        status = 'playing'; overlay = null; cards = []; setPlayMode(); instance.resume(); emit(); return true;
      }
      case 'quit': { destroy(); opts.onQuit(); return true; }
      case 'assist': {
        const on = typeof arg === 'boolean' ? arg : !clock.assist();
        clock.setAssist(on); emit(); return true;
      }
      case 'next': { const ok = runner.next(); emit(); return ok; }
      case 'skip': { const ok = runner.skip(); emit(); return ok; }
      case 'replay': {
        const id = typeof arg === 'string' ? arg : recent[recent.length - 1] ?? seenScenes().pop();
        if (!id || !opts.scenes(id)) return false;
        const back = { status, overlay, resumeTo };
        const ok = playScene(id, () => { status = back.status; overlay = back.overlay; resumeTo = back.resumeTo; setPlayMode(); });
        emit(); return ok;
      }
      case 'avatar': { const ok = runner.avatar(arg); emit(); return ok; }
    }
  }

  function act(action: string, arg?: unknown): boolean {
    if (destroyed) return false;
    if (isCommon(action)) return common(action, arg);
    const spec = specs.find((s) => s.action === action);
    if (!spec) throw new Error(`unknown action "${action}"`);
    if (!specValid(spec, view())) return false;
    for (const fn of [...inputFns]) fn(action, arg);
    const did = instance.act(action, arg);
    if (did) { invalidate(); }
    emit();
    return !!did;
  }

  // ---- time ----
  function advance(ms: number): GameState {
    clock.advance(ms);
    renderNow();
    return state();
  }

  function state(): GameState {
    let g: any = {};
    try { g = instance.state() ?? {}; } catch { g = {}; }
    const snap = round.snapshot();
    const info = current();
    return {
      status, score: snap.score, lives: g.lives ?? null, stage: g.stage ?? 1, levelId: opts.levelId, clockMs: clock.now(), assist: clock.assist(),
      skill: snap.skill, knowledgeMistakes: snap.knowledgeMistakes, actionMisses: snap.actionMisses,
      extra: { ...(g.extra ?? {}), scene: info },
    };
  }

  // ---- frames ----
  function renderNow(): void {
    if (destroyed) return;
    try { instance.render?.(); } catch { /* a drawing fault must not stop the clock */ }
    frames.frame(nowFn());
  }
  function invalidate(): void {
    if (manual) { renderNow(); return; }
    if (rafId === null && opts.raf && !destroyed) rafId = opts.raf(frame);
  }
  function frame(ts: number): void {
    rafId = null;
    if (destroyed) return;
    const dt = lastTs === null ? 0 : ts - lastTs;
    lastTs = ts;
    if (!manual) clock.tick(dt);
    renderNow();
    if (status === 'playing' || status === 'story') { if (opts.raf) rafId = opts.raf(frame); } else { lastTs = null; frames.gap(); }
  }

  function destroy(): void {
    if (destroyed) return;
    destroyed = true;
    if (rafId !== null) { opts.caf?.(rafId); rafId = null; }
    try { instance.destroy(); } catch { /* ignore */ }
    listeners.clear(); inputFns.clear();
  }

  // ---- launch order (§13.3) ----
  if (opts.prologue) {
    status = 'story';
    playScene(opts.prologue.sceneId ?? 'prologue', () => { opts.prologue!.onDone(); });
    if (!runner.active() && status === 'story') opts.prologue.onDone(); // no prologue scene: nothing to wait for
  } else {
    const introSeen = !!opts.player.doc().seen.intro[gameId];
    status = 'title';
    if (!introSeen) playScene(`${gameId}.intro`, () => { status = 'title'; overlay = null; setPlayMode(); });
    setPlayMode();
  }
  renderNow();

  return {
    id: gameId, clock, ctx, instance, state, act, advance, stats: () => frames.snapshot(quality, opts.heapMB?.() ?? null),
    destroy, destroyed: () => destroyed, view, overlay: () => overlay, lessonCards: () => cards,
    scene: () => { const i = current(); return i ? { ...i, beatDef: runner.beat() } : null; },
    results: () => finished?.view ?? null,
    specs: () => specs, seenScenes,
    buttons() {
      const v = view();
      const out: { testId: string; action: string; arg?: unknown; label: string; held?: ActionSpec }[] = [];
      const add = (a: CommonAction, arg?: unknown, name = a) => out.push({ testId: `act-${name}`, action: a, ...(arg !== undefined ? { arg } : {}), label: `games.act.${a}` });
      for (const a of ['start', 'pause', 'resume', 'continue', 'next', 'skip', 'avatar', 'assist', 'quit', 'replay'] as CommonAction[]) {
        if (commonValid(a, v)) add(a);
      }
      for (const s of specs) if (!s.hidden && specValid(s, v)) {
        out.push({ testId: `act-${s.button ?? s.action}`, action: s.action, ...(s.arg !== undefined ? { arg: s.arg } : {}), label: s.label, ...(s.held ? { held: s } : {}) });
      }
      return out;
    },
    setHeld(a, down) { if (down) heldNow.add(a); else heldNow.delete(a); },
    setHidden(h) { clock.setHidden(h); if (!h) { lastTs = null; invalidate(); } },
    startLoop() { if (!manual) invalidate(); },
    version: () => version,
    subscribe(fn) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    manual,
  };
}
