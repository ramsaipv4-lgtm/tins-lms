// /teach/package-library (AC-157): every imported package with versions and rehearsal history.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { fmtDur } from './lib.tsx';

interface P { id: string; title: string; version: string; status: string; days: number; rehearsals: { id: string; dayIndex: number; at: number; behindSec: number }[] }

export default function Library() {
  const [list, setList] = useState<P[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => { api<{ packages: P[] }>('/api/tele/library').then((r) => setList(r.packages)).catch(() => setErr(true)); }, []);
  return (
    <>
      <h1>{t('tele.lib.title')}</h1>
      {err && <p role="alert" className="err">{t('tele.err.generic')}</p>}
      {!list && !err && <p role="status">{t('app.loading')}</p>}
      {list && (
        <section data-testid="package-library" aria-label={t('tele.lib.region')}>
          {list.length === 0 && <p>{t('tele.lib.empty')}</p>}
          <ul>
            {list.map((p) => (
              <li key={p.id}>
                <h2 translate="no">{p.title}</h2>
                <p>{t('tele.lib.meta', { v: p.version, status: p.status, days: p.days })}</p>
                <h3>{t('tele.lib.history')}</h3>
                {p.rehearsals.length ? (
                  <ul>{p.rehearsals.map((r) => <li key={r.id}>{t('tele.lib.rehearsal', { n: r.dayIndex, date: new Date(r.at).toISOString().slice(0, 10), t: fmtDur(r.behindSec), dir: t(r.behindSec > 0 ? 'tele.lib.behind' : 'tele.lib.ahead') })}</li>)}</ul>
                ) : <p>{t('tele.lib.noRehearsals')}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
