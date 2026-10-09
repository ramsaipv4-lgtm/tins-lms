// Loads and runs one game or the prologue in the browser. Imported only with import() from the screens, so the engine,
// the story player and the game chunk (all named in vite.config.ts, D-57) are not requested before a game opens.
import { createSession, type PlayerStore, type Session } from '../../../../games/src/engine/session.ts';
import { loadGame } from '../../../../games/src/engine/registry.ts';
import { createSfx, detectQuality } from '../../../../games/src/engine/audio.ts';
import { defaultSeed, resolveSeed } from '../../../../games/src/engine/seed.ts';
import { installTestGame, testFlags, testModeOn } from '../../../../games/src/engine/testhooks.ts';
import { normalizePlayer, patchPlayer, type PlayerDoc, type PlayerPatch } from '../../../../games/src/engine/player.ts';
import type { GameModule, Pack, Scene } from '../../../../games/src/engine/types.ts';
import { savePlayer, submitResult, type PlayerView } from './api.ts';
import { t } from '../../strings/index.ts';

const storyFiles = import.meta.glob('../../../../games/story/*.json', { import: 'default' }) as Record<string, () => Promise<any>>;

export interface StoryData { scenes: Record<string, Scene>; speakers: Record<string, string> }

/** universe.json plus the game's story file, with scene ids made whole (`intro` becomes `<gameId>.intro`). */
export async function loadStory(gameId: string | null): Promise<StoryData> {
  const out: StoryData = { scenes: {}, speakers: {} };
  const pick = (name: string) => Object.entries(storyFiles).find(([p]) => p.endsWith(`/${name}.json`))?.[1];
  const read = async (name: string) => { try { return await pick(name)?.(); } catch { return undefined; } };
  const uni = await read('universe');
  if (uni) {
    for (const c of uni.cast ?? []) out.speakers[c.id] = c.nameKey;
    Object.assign(out.scenes, uni.scenes ?? {});
  }
  if (gameId) {
    const g = await read(gameId);
    if (g) {
      for (const c of g.cast ?? []) out.speakers[c.id] = c.nameKey;
      for (const [name, scene] of Object.entries<Scene>(g.scenes ?? {})) out.scenes[`${gameId}.${name}`] = scene;
    }
  }
  return out;
}

export function viewToDoc(v: PlayerView): PlayerDoc {
  return normalizePlayer({ xp: v.xp, coins: v.coins, seen: v.seen, avatar: v.avatar ?? undefined, timingOffsetMs: v.timingOffsetMs, settings: v.settings, cosmetics: v.cosmetics, gear: v.gear } as any, 'me');
}

/** The player document on this device: changes show at once and go to the hub in order. */
export function playerStore(view: PlayerView): PlayerStore & { flush(): Promise<unknown> } {
  let doc = viewToDoc(view);
  let chain: Promise<unknown> = Promise.resolve();
  return {
    flush: () => chain,
    doc: () => doc,
    patch(p: PlayerPatch) {
      doc = patchPlayer(doc, p, Date.now(), 'me');
      chain = chain.then(() => savePlayer(p)).catch(() => { /* kept locally; the next change or visit sends it again */ });
    },
  };
}

const prologueModule: GameModule = {
  id: 'prologue',
  mount: () => ({ pause() {}, resume() {}, destroy() {}, act: () => false, state: () => ({}) }),
};
const prologuePack: Pack = { game: 'prologue', id: 'prologue', title: '', day: 0, concepts: [], language: 'en', levels: [{ id: 'prologue', title: '', lesson: [] }] };

export interface Launch {
  session: Session; speakers: Record<string, string>; dispose(): void; testMode: boolean;
}

export async function launchGame(a: {
  el: HTMLElement; gameId: string; pack: Pack; levelId: string; seedSalt: string; player: PlayerView; onQuit: () => void; autoStart?: boolean;
}): Promise<Launch> {
  const testMode = testModeOn();
  const flags = testFlags(location.search, testMode);
  const [mod, story] = await Promise.all([loadGame(a.gameId), loadStory(a.gameId)]);
  const seed = resolveSeed(flags.seed, defaultSeed(a.seedSalt, a.gameId, a.pack.id, a.levelId));
  const store = playerStore(a.player);
  const sfx = createSfx({ get: () => { try { return localStorage.getItem('lms-games-muted') === '1'; } catch { return false; } }, set: (m) => { try { localStorage.setItem('lms-games-muted', m ? '1' : '0'); } catch { /* ignore */ } } });
  const nav = navigator as any;
  const session = createSession({
    module: mod, pack: a.pack, levelId: a.levelId, seed, el: a.el, storyOn: !flags.storyOff, manual: flags.manual,
    scenes: (id) => story.scenes[id] ?? null, player: store, strings: (k, v) => t(k, v),
    isLastLevel: a.pack.levels[a.pack.levels.length - 1]?.id === a.levelId,
    persist: async (payload) => { const r = await submitResult({ gameId: a.gameId, packId: a.pack.id, ...payload }); return r; },
    onQuit: () => { void store.flush().then(a.onQuit); }, audio: sfx, quality: detectQuality({ hardwareConcurrency: nav.hardwareConcurrency, deviceMemory: nav.deviceMemory, devicePixelRatio: window.devicePixelRatio }),
    raf: (cb) => requestAnimationFrame(cb), caf: (id) => cancelAnimationFrame(id),
    heapMB: () => { const m = (performance as any).memory; return m ? Math.round((m.usedJSHeapSize / 1048576) * 10) / 10 : null; },
  });
  return finish(session, story, testMode, a.autoStart);
}

export async function launchPrologue(a: { el: HTMLElement; player: PlayerView; sceneId?: string; onDone: () => void }): Promise<Launch> {
  const testMode = testModeOn();
  const flags = testFlags(location.search, testMode);
  const story = await loadStory(a.sceneId?.includes('.') ? a.sceneId.split('.')[0] : null); // a replayed front scene needs its game's story file
  const store = playerStore(a.player);
  const session = createSession({
    module: prologueModule, pack: prologuePack, levelId: 'prologue', seed: 0, el: a.el, storyOn: !flags.storyOff, manual: flags.manual,
    scenes: (id) => story.scenes[id] ?? null, player: store, strings: (k, v) => t(k, v), isLastLevel: false,
    persist: async () => {}, onQuit: () => { void store.flush().then(a.onDone); }, prologue: { onDone: () => { void store.flush().then(a.onDone); }, sceneId: a.sceneId },
    audio: createSfx(), raf: (cb) => requestAnimationFrame(cb), caf: (id) => cancelAnimationFrame(id),
  });
  return finish(session, story, testMode);
}

function finish(session: Session, story: StoryData, testMode: boolean, autoStart?: boolean): Launch {
  const removeHook = installTestGame(window, session, testMode);
  const onVis = () => session.setHidden(document.hidden);
  document.addEventListener('visibilitychange', onVis);
  onVis();
  session.startLoop();
  if (autoStart && session.state().status === 'title') session.act('start');
  return {
    session, speakers: story.speakers, testMode,
    dispose() { document.removeEventListener('visibilitychange', onVis); removeHook(); session.destroy(); },
  };
}
export { type Session };
