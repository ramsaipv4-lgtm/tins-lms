// /learn/mastery (AC-95): the mastery map from the core rule (D-22), computed on this device from the saved checks.
import { useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import * as phone from './phone.ts';
import { usePhone } from './ui.ts';

export default function Mastery() {
  const { bundle, ready } = usePhone();
  const [map, setMap] = useState<Record<string, 'mastered' | 'not-yet'> | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const [m, c] = await Promise.all([phone.mastery(), phone.contentDays()]);
        if (live) { setMap(m); setDays(Object.keys(c.diagnostics).map(Number).sort((a, b) => a - b)); setError(false); }
      } catch { if (live) setError(true); }
    };
    if (ready) void load();
    const off = phone.subscribe(() => { void load(); });
    return () => { live = false; off(); };
  }, [ready, bundle]);

  if (error) return <p role="alert">{t('files.mastery.error')}</p>;
  if (!ready || !map) return <p role="status">{t('app.loading')}</p>;
  const skills = [...new Set([...days.map((n) => `day-${n}`), ...Object.keys(map)])].sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)));
  return (
    <section aria-labelledby="fm-h">
      <h1 id="fm-h">{t('files.mastery.title')}</h1>
      <p className="help">{t('files.mastery.help')}</p>
      <ul data-testid="mastery-map" aria-label={t('files.mastery.title')} className="checks">
        {skills.length === 0 && <li>{t('files.mastery.none')}</li>}
        {skills.map((s) => {
          const state = map[s] ?? 'not-yet';
          return <li key={s} data-skill={s} data-state={state} className={state === 'mastered' ? 'pass' : 'fail'}>
            <strong>{t('files.mastery.day', { n: s.slice(4) })}</strong> {t(state === 'mastered' ? 'files.mastery.mastered' : 'files.mastery.notYet')}
          </li>;
        })}
      </ul>
    </section>
  );
}
