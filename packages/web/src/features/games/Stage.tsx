// One running game, or the prologue / a replayed scene, in the browser (SPEC §13.3). Loads the engine on demand,
// wires keys, buttons and the test hooks, and shows the shared screens over the game's own canvas.
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { navigate } from '../../app/router.tsx';
import { t } from '../../strings/index.ts';
import { ApiError } from '../../app/api.ts';
import { loadPack, type PlayerView } from './api.ts';
import type { Launch } from './runtime.ts';
import { resolveKey } from '../../../../games/src/engine/actions.ts';
import type { ActionSpec } from '../../../../games/src/engine/types.ts';
import { ActionButtons, LessonCardView, PauseMenu, ResultsScreen, ScenePanel, TitleScreen, COLORS, LOOKS, type AvatarDraft } from './Screens.tsx';
import Unavailable from './Unavailable.tsx';
import './games.css';

export type StageProps =
  | { kind: 'game'; gameId: string; packId: string; levelId: string }
  | { kind: 'prologue'; player: PlayerView; sceneId?: string; onDone: () => void };

const none = () => () => {};

export default function Stage(props: StageProps) {
  const host = useRef<HTMLDivElement>(null);
  const [launch, setLaunch] = useState<Launch | null>(null);
  const [phase, setPhase] = useState<'loading' | 'unavailable' | 'error' | 'ready'>('loading');
  const [round, setRound] = useState(0);
  const [info, setInfo] = useState<{ gameId: string; packTitle: string; levelTitle: string; lessons: any[] }>({ gameId: '', packTitle: '', levelTitle: '', lessons: [] });
  const [draft, setDraft] = useState<AvatarDraft>({ look: LOOKS[0], color: COLORS[0], nameTag: '' });
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const key = props.kind === 'game' ? `${props.gameId}/${props.packId}/${props.levelId}` : `prologue/${props.sceneId ?? ''}`;

  useEffect(() => {
    let dead = false;
    let current: Launch | null = null;
    setPhase('loading'); setLaunch(null);
    (async () => {
      try {
        const rtLoad = import('./runtime.ts'); // the code and the pack load side by side
        if (props.kind === 'game') {
          const [pv, rt] = await Promise.all([loadPack(props.gameId, props.packId), rtLoad]);
          const lvl = pv.pack.levels.find((l: any) => l.id === props.levelId);
          if (!lvl || pv.levels.find((l) => l.id === props.levelId)?.locked) { if (!dead) setPhase('unavailable'); return; }
          if (dead) return;
          setInfo({ gameId: props.gameId, packTitle: pv.pack.title, levelTitle: lvl.title, lessons: lvl.lesson ?? [] });
          current = await rt.launchGame({
            el: host.current!, gameId: props.gameId, pack: pv.pack, levelId: props.levelId, seedSalt: pv.seedSalt, player: pv.player,
            onQuit: () => navigate('/learn/games'), autoStart: round > 0,
          });
        } else {
          const rt = await rtLoad;
          if (dead) return;
          current = await rt.launchPrologue({ el: host.current!, player: props.player, sceneId: props.sceneId, onDone: props.onDone });
        }
        if (dead) { current.dispose(); return; }
        setLaunch(current); setPhase('ready');
      } catch (e) {
        if (dead) return;
        setPhase(e instanceof ApiError && (e.status === 404 || e.status === 403) ? 'unavailable' : 'error');
      }
    })();
    return () => { dead = true; current?.dispose(); setLaunch(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, round]);

  // keyboard: every action has a key (SPEC §13.3); held actions act while the key is down
  useEffect(() => {
    if (!launch) return;
    const s = launch.session;
    const heldKeys = new Map<string, ActionSpec>();
    const release = (k: string) => {
      const spec = heldKeys.get(k);
      if (!spec) return;
      heldKeys.delete(k);
      s.setHeld(spec.action, false);
      s.act(spec.releaseAction ?? spec.action, spec.releaseArg);
    };
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || s.destroyed()) return;
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') && e.key !== 'Enter' && e.key !== 'Escape') return;
      if ((tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') && (e.key === 'Enter' || e.key === ' ')) return; // a focused control keeps its own key
      const v = s.view();
      if (v.avatarBeat && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault();
        const d = draftRef.current; const i = LOOKS.indexOf(d.look);
        setDraft({ ...d, look: LOOKS[(i + (e.key === 'ArrowRight' ? 1 : LOOKS.length - 1)) % LOOKS.length] });
        return;
      }
      const r = resolveKey(e.key, v, s.specs());
      if (!r) return;
      e.preventDefault();
      if (e.repeat) return;
      if (r.spec?.held) { heldKeys.set(e.key, r.spec); s.setHeld(r.action, true); }
      s.act(r.action, r.action === 'avatar' ? draftRef.current : r.arg);
    };
    const up = (e: KeyboardEvent) => release(e.key);
    const blur = () => { for (const k of [...heldKeys.keys()]) release(k); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur); };
  }, [launch]);

  const session = launch?.session ?? null;
  useSyncExternalStore(session ? session.subscribe : none, session ? session.version : () => 0);

  if (phase === 'unavailable') return <Unavailable />;
  if (phase === 'error') return <p role="alert">{t('games.error')}</p>;

  const state = session?.state();
  const gameId = info.gameId;
  return (
    <section className="games-stage" data-testid="game-stage" data-status={state?.status ?? 'loading'} aria-label={t('games.stage.label')}>
      {phase === 'loading' && <p role="status">{t('app.loading')}</p>}
      {props.kind === 'game' && phase === 'ready' && <h1>{t(`games.name.${gameId}`)}</h1>}
      <div className="games-frame">
        <div className="games-screen" ref={host} />
        {session && state && (
          <>
            {state.status === 'story' && <ScenePanel session={session} speakers={launch!.speakers} draft={draft} setDraft={setDraft} />}
            {state.status === 'title' && <TitleScreen session={session} gameId={gameId} levelTitle={info.levelTitle} packTitle={info.packTitle} />}
            {state.status === 'paused' && session.overlay() === 'menu' && <PauseMenu session={session} levelLessons={info.lessons} onRestart={() => setRound((n) => n + 1)} />}
            {state.status === 'paused' && session.overlay() === 'lesson' && <LessonCardView cards={session.lessonCards()} />}
            {(state.status === 'won' || state.status === 'lost') && <ResultsScreen session={session} gameId={gameId} onRetry={() => setRound((n) => n + 1)} />}
          </>
        )}
      </div>
      {session && <ActionButtons session={session} draft={draft} onPress={() => {}} />}
    </section>
  );
}
