// /learn/games: the arcade (SPEC §13.3 Routes). One tile per available game with a released pack; the learner's own last
// score and stars; XP and coins; "Story so far". The prologue plays on the first visit.
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import { ApiError } from '../../app/api.ts';
import { Link } from '../../app/router.tsx';
import { flushOutbox, loadArcade, storyOff, type ArcadeView } from './api.ts';
import Stage from './Stage.tsx';
import { sceneTitle as sceneName } from './Screens.tsx';
import Unavailable from './Unavailable.tsx';
import './games.css';

export default function Arcade() {
  const [data, setData] = useState<ArcadeView | null>(null);
  const [error, setError] = useState(false);
  const [replay, setReplay] = useState<string | null>(null);
  const [skipPrologue, setSkipPrologue] = useState(false);

  const load = useCallback(async () => {
    try { await flushOutbox(); setData(await loadArcade()); setError(false); } catch (e) { if (!(e instanceof ApiError && e.status === 404)) setError(true); else setData(null); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  if (error) return <p role="alert">{t('games.error')}</p>;
  if (!data) return <p role="status">{t('app.loading')}</p>;
  if (!data.arcadeOn) return <Unavailable />;

  if (replay) return <Stage kind="prologue" player={data.player} sceneId={replay} onDone={() => { setReplay(null); void load(); }} />;
  if (!data.player.seen.prologue && !skipPrologue && !storyOff()) {
    return <Stage kind="prologue" player={data.player} onDone={() => { setSkipPrologue(true); void load(); }} />;
  }

  const seen = data.scenes;
  return (
    <section aria-labelledby="ga-h" data-testid="arcade">
      <h1 id="ga-h">{t('games.nav')}</h1>
      <p className="games-wallet">
        <span>{t('games.xp')}</span> <strong data-testid="player-xp">{data.player.xp}</strong>{' '}
        <span>{t('games.coins')}</span> <strong data-testid="player-coins">{data.player.coins}</strong>
      </p>
      {data.tiles.length === 0 && <p>{t('games.none')}</p>}
      <ul className="games-tiles">
        {data.tiles.map((tile) => (
          <li key={tile.gameId}>
            <Link to={`/learn/games/${tile.gameId}`} data-testid={`game-tile-${tile.gameId}`}
              {...(tile.lastScore !== undefined ? { 'data-last-score': String(tile.lastScore), 'data-stars': String(tile.stars ?? 0) } : {})}>
              <strong>{t(`games.name.${tile.gameId}`)}</strong>
              <span className="help">{t(`games.teaches.${tile.gameId}`)}</span>
              {tile.lastScore !== undefined && <span>{t('games.tile.last', { score: tile.lastScore, stars: tile.stars ?? 0 })}</span>}
            </Link>
          </li>
        ))}
      </ul>
      <section aria-labelledby="ga-story">
        <h2 id="ga-story">{t('games.story.so_far')}</h2>
        <ul data-testid="story-replay">
          {seen.length === 0 && !data.player.seen.prologue && <li>{t('games.story.none')}</li>}
          {[...new Set([...(data.player.seen.prologue ? ['prologue'] : []), ...seen])].map((id) => (
            <li key={id} data-testid={`story-replay-${id}`}>
              <span>{sceneName(id)}</span>{' '}
              <button type="button" data-testid={`act-replay-${id}`} aria-label={t('games.replay.scene', { name: sceneName(id) })} onClick={() => setReplay(id)}>{t('games.act.replay')}</button>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
