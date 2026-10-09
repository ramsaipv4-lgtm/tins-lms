// Shared screens of every game (SPEC §13.3 "Shared screens", §13.11 test ids): title and how to play, the running scene,
// the pause menu, the lesson card, results, and the on-screen action buttons. They read a Session; they hold no game rules.
import { useState, type PointerEvent as RPointerEvent, type KeyboardEvent as RKeyboardEvent } from 'react';
import type { Session } from '../../../../games/src/engine/session.ts';
import type { ActionSpec, GameState, LessonCard } from '../../../../games/src/engine/types.ts';
import { t } from '../../strings/index.ts';

export const LOOKS = ['block', 'round', 'robot', 'fox'];
export const COLORS = ['teal', 'red', 'gold', 'violet'];
export interface AvatarDraft { look: string; color: string; nameTag: string }

const known = (key: string): string => t(key); // data keys that may be missing in en.json render as the key itself

export function ActionButtons({ session, draft, onPress }: { session: Session; draft: AvatarDraft; onPress: () => void }) {
  const press = (b: ReturnType<Session['buttons']>[number]) => { session.act(b.action, b.action === 'avatar' ? draft : b.arg); onPress(); };
  const down = (b: ReturnType<Session['buttons']>[number]) => { session.setHeld(b.action, true); session.act(b.action, b.arg); };
  const up = (held: ActionSpec) => { session.setHeld(held.action, false); session.act(held.releaseAction ?? held.action, held.releaseArg); };
  return (
    <div className="games-controls" role="group" aria-label={t('games.controls')}>
      {session.buttons().map((b) => {
        const held = b.held;
        const common = {
          type: 'button' as const, 'data-testid': b.testId,
          onMouseDown: (e: { preventDefault(): void }) => e.preventDefault(), // keep keyboard focus where it was, so game keys keep working
        };
        if (held) {
          return (
            <button {...common} key={b.testId}
              onPointerDown={(e: RPointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); down(b); }}
              onPointerUp={() => up(held)} onPointerCancel={() => up(held)}
              onKeyDown={(e: RKeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); down(b); } }}
              onKeyUp={(e: RKeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); up(held); } }}>
              {known(b.label)}
            </button>
          );
        }
        return <button {...common} key={b.testId} onClick={() => press(b)}>{known(b.label)}</button>;
      })}
    </div>
  );
}

function ReplayList({ session, sceneName }: { session: Session; sceneName: (id: string) => string }) {
  const seen = session.seenScenes();
  return (
    <section aria-labelledby="gs-h">
      <h3 id="gs-h">{t('games.story.so_far')}</h3>
      <ul data-testid="story-replay">
        {seen.length === 0 && <li>{t('games.story.none')}</li>}
        {seen.map((id) => (
          <li key={id} data-testid={`story-replay-${id}`}>
            <span translate="no">{sceneName(id)}</span>{' '}
            <button type="button" data-testid={`act-replay-${id}`} aria-label={t('games.replay.scene', { name: sceneName(id) })} onClick={() => session.act('replay', id)}>{t('games.act.replay')}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
export const sceneTitle = (id: string): string => (id === 'prologue' ? t('games.story.prologue') : id.endsWith('.intro') ? t('games.story.intro', { game: t(`games.name.${id.split('.')[0]}`) }) : id.endsWith('.chapter-end') ? t('games.story.chapterEnd', { game: t(`games.name.${id.split('.')[0]}`) }) : id);

export function TitleScreen({ session, gameId, levelTitle, packTitle }: { session: Session; gameId: string; levelTitle: string; packTitle: string }) {
  const s = session.state();
  return (
    <div className="games-overlay" data-testid="game-title" role="region" aria-label={t('games.title.label')}>
      <h2>{t(`games.name.${gameId}`)}</h2>
      <p className="help">{t(`games.how.${gameId}`)}</p>
      <p><span translate="no">{packTitle}</span> / <span translate="no">{levelTitle}</span></p>
      <p>{s.assist ? t('games.assist.on') : t('games.assist.off')}</p>
      <ReplayList session={session} sceneName={sceneTitle} />
    </div>
  );
}

export function AvatarPanel({ draft, setDraft }: { draft: AvatarDraft; setDraft: (d: AvatarDraft) => void }) {
  return (
    <div data-testid="avatar-choice" className="games-avatar" role="group" aria-label={t('games.avatar.label')}>
      <fieldset>
        <legend>{t('games.avatar.look')}</legend>
        {LOOKS.map((l) => (
          <label key={l}><input type="radio" name="avatar-look" value={l} checked={draft.look === l} onChange={() => setDraft({ ...draft, look: l })} /> {t(`games.avatar.look.${l}`)}</label>
        ))}
      </fieldset>
      <label>{t('games.avatar.color')}{' '}
        <select value={draft.color} onChange={(e) => setDraft({ ...draft, color: e.target.value })}>
          {COLORS.map((c) => <option key={c} value={c}>{t(`games.avatar.color.${c}`)}</option>)}
        </select>
      </label>
      <label>{t('games.avatar.nameTag')}{' '}
        <input type="text" maxLength={24} value={draft.nameTag} onChange={(e) => setDraft({ ...draft, nameTag: e.target.value })} />
      </label>
      <p className="help">{t('games.avatar.help')}</p>
    </div>
  );
}

export function ScenePanel({ session, speakers, draft, setDraft }: { session: Session; speakers: Record<string, string>; draft: AvatarDraft; setDraft: (d: AvatarDraft) => void }) {
  const sc = session.scene();
  if (!sc) return null;
  const beat = sc.beatDef as { t?: string; who?: string } | null;
  const say = beat?.t === 'say';
  return (
    <div className="games-overlay games-scene" data-testid="story-scene" data-scene-id={sc.id} data-beat={beat?.t ?? ''} role="region" aria-label={t('games.story.scene')}>
      {say && beat?.who && <p className="games-speaker"><strong translate="no">{t(speakers[beat.who] ?? beat.who)}</strong></p>}
      {sc.line && <p data-testid="story-line" aria-live="polite">{t(sc.line)}</p>}
      {beat?.t === 'avatar' && <AvatarPanel draft={draft} setDraft={setDraft} />}
    </div>
  );
}

export function LessonCardView({ cards }: { cards: LessonCard[] }) {
  return (
    <div className="games-overlay" data-testid="lesson-card" role="dialog" aria-modal="false" aria-label={t('games.lesson.title')}>
      <h2>{t('games.lesson.title')}</h2>
      {cards.map((c, i) => (
        <article key={i} className="games-lesson">
          <p translate="no">{c.text}</p>
          {c.code && <pre translate="no"><code>{c.code}</code></pre>}
        </article>
      ))}
    </div>
  );
}

export function PauseMenu({ session, levelLessons, onRestart }: { session: Session; levelLessons: LessonCard[]; onRestart: () => void }) {
  const [, force] = useState(0);
  const q = session.ctx.quality;
  const a = session.ctx.audio;
  return (
    <div className="games-overlay" data-testid="pause-menu" role="dialog" aria-modal="false" aria-label={t('games.pause.title')}>
      <h2>{t('games.pause.title')}</h2>
      <p>{session.state().assist ? t('games.assist.on') : t('games.assist.off')}</p>
      <p><button type="button" data-testid="game-restart" onClick={onRestart}>{t('games.restart')}</button></p>
      <label><input type="checkbox" checked={!a.muted()} onChange={(e) => { a.setMuted(!e.target.checked); force((n) => n + 1); }} /> {t('games.sound')}</label>{' '}
      <label>{t('games.quality')}{' '}
        <select value={q.tier} onChange={(e) => { q.tier = e.target.value as typeof q.tier; q.shadows = q.tier === 'high'; force((n) => n + 1); }}>
          {(['low', 'medium', 'high'] as const).map((tier) => <option key={tier} value={tier}>{t(`games.quality.${tier}`)}</option>)}
        </select>
      </label>
      {levelLessons.length > 0 && (
        <section aria-labelledby="gp-l">
          <h3 id="gp-l">{t('games.pause.lessons')}</h3>
          <ul>{levelLessons.map((c, i) => <li key={i}><span translate="no">{c.text}</span></li>)}</ul>
        </section>
      )}
      <ReplayList session={session} sceneName={sceneTitle} />
    </div>
  );
}

export function ResultsScreen({ session, gameId, onRetry }: { session: Session; gameId: string; onRetry: () => void }) {
  const r = session.results();
  const s: GameState = session.state();
  if (!r) return null;
  if (r.saved === 'pending') return <div className="games-overlay" role="status">{t('games.results.saving')}</div>;
  return (
    <div className="games-overlay" data-testid="game-results" data-outcome={r.outcome} role="region" aria-label={t('games.results.title')}>
      <h2>{r.outcome === 'won' ? t('games.results.won') : t('games.results.lost')}</h2>
      <dl className="games-stats">
        <dt>{t('games.results.score')}</dt><dd data-testid="result-score">{r.score}</dd>
        <dt>{t('games.results.stars')}</dt><dd data-testid="result-stars" data-stars={r.stars}>{t('games.results.starsOf', { n: r.stars })}</dd>
        <dt>{t('games.results.skill')}</dt><dd data-testid="result-skill">{r.skill}</dd>
        <dt>{t('games.results.knowledge')}</dt><dd data-testid="result-knowledge" data-stars={r.knowledgeStars}>{t('games.results.knowledgeOf', { n: r.knowledgeStars, m: r.mistakes.length })}</dd>
        {gameId === 'whack-a-bug' && (<><dt>{t('games.results.assisted')}</dt><dd data-testid="result-assisted">{r.assisted}</dd></>)}
        <dt>{t('games.results.xp')}</dt><dd data-testid="result-xp">{r.xp}</dd>
        <dt>{t('games.results.coins')}</dt><dd data-testid="result-coins">{r.coins}</dd>
      </dl>
      {r.assist && <p>{t('games.results.assistNote')}</p>}
      {r.mistakes.length > 0 && <h3>{t('games.results.mistakes')}</h3>}
      <ol className="games-mistakes">
        {r.mistakes.map((m, i) => (
          <li key={i} data-testid={`result-mistake-${i + 1}`} data-concept={m.concept}>
            <strong translate="no">{m.question ?? m.itemId}</strong>
            {(m.correct || m.why) && <> {t('games.results.whatItDoes')} <span translate="no">{m.correct ?? m.why}</span></>}
            {' '}<em>{t('games.results.addedToCards')}</em>
          </li>
        ))}
      </ol>
      {r.saved === 'queued' && <p role="status">{t('games.results.queued')}</p>}
      <p><button type="button" data-testid="game-retry" onClick={onRetry}>{t('games.results.again')}</button> <span className="help">{s.status === 'won' ? t('games.results.wonHelp') : t('games.results.lostHelp')}</span></p>
    </div>
  );
}
