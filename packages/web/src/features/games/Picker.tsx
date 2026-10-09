// /learn/games/<gameId>: the pack and level picker.
import { useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import { Link } from '../../app/router.tsx';
import { loadArcade, type ArcadeView } from './api.ts';
import Unavailable from './Unavailable.tsx';
import './games.css';

export default function Picker({ params }: { params: Record<string, string> }) {
  const [data, setData] = useState<ArcadeView | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { loadArcade().then(setData).catch(() => setError(true)); }, []);
  if (error) return <p role="alert">{t('games.error')}</p>;
  if (!data) return <p role="status">{t('app.loading')}</p>;
  const tile = data.arcadeOn ? data.tiles.find((x) => x.gameId === params.gameId) : undefined;
  if (!tile) return <Unavailable />;
  return (
    <section aria-labelledby="gp-h" data-testid="game-picker">
      <h1 id="gp-h">{t(`games.name.${tile.gameId}`)}</h1>
      <p><Link to="/learn/games">{t('games.back')}</Link></p>
      <ul className="games-packs">
        {tile.packs.map((p) => (
          <li key={p.id} data-testid={`game-pack-${p.id}`}>
            <h2 translate="no">{p.title}</h2>
            <ul className="games-levels">
              {p.levels.map((l) => (
                <li key={l.id}>
                  {l.locked
                    ? <span data-testid={`game-level-${l.id}`} data-locked="true" aria-disabled="true"><span translate="no">{l.title}</span> ({t('games.locked')})</span>
                    : <Link to={`/learn/games/${tile.gameId}/${p.id}/${l.id}`} data-testid={`game-level-${l.id}`}><span translate="no">{l.title}</span></Link>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
