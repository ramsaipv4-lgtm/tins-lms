// Team badges and the merged-PR celebration wall (G-2, G-3, AC-168): team-level only, never an individual ranking.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import './coach.css';

interface Team { teamId: string; badges: { name: string; at: number }[]; mergedPrs: number }
interface Wall { badgesOn: boolean; wallOn: boolean; teams: Team[] }

export default function Wall() {
  const [w, setW] = useState<Wall | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { api<Wall>('/api/coach/wall').then(setW).catch(() => setError(true)); }, []);
  if (error) return <p role="alert">{t('app.error')}</p>;
  if (!w) return <p role="status">{t('app.loading')}</p>;
  if (!w.badgesOn && !w.wallOn) return <section aria-labelledby="wall-h"><h1 id="wall-h">{t('coach.wall.title')}</h1><p role="status">{t('coach.wall.off')}</p></section>;
  return (
    <section aria-labelledby="wall-h">
      <h1 id="wall-h">{t('coach.wall.title')}</h1>
      <p className="help">{t('coach.wall.teamOnly')}</p>
      <ul className="coach-wall" data-testid="celebration-wall">
        {w.teams.map((tm) => (
          <li key={tm.teamId} data-testid={`wall-team-${tm.teamId}`}>
            <h2><span translate="no">{tm.teamId}</span></h2>
            {w.badgesOn && (tm.badges.length
              ? <ul aria-label={t('coach.wall.badges')}>{tm.badges.map((b, i) => <li key={i}><span translate="no">{b.name}</span></li>)}</ul>
              : <p>{t('coach.wall.noBadges')}</p>)}
            {w.wallOn && <p>{t('coach.wall.merged', { n: tm.mergedPrs })}</p>}
          </li>
        ))}
        {w.teams.length === 0 && <li>{t('coach.wall.none')}</li>}
      </ul>
    </section>
  );
}
