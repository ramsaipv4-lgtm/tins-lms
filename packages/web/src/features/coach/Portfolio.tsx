// Portfolio (B-7, AC-162): build a site from the hub's template and preview it in the app.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import './coach.css';

interface Status { built: boolean; version?: number; counts?: { repos: number; badges: number; certificates: number }; url?: string }

export default function Portfolio() {
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => { api<Status>('/api/coach/portfolio').then(setS).catch(() => setS({ built: false })); }, []);
  async function build() {
    setBusy(true); setError(false);
    try { const r = await api<Status>('/api/coach/portfolio', { method: 'POST', body: {} }); setS({ ...r, built: true }); } catch { setError(true); } finally { setBusy(false); }
  }
  return (
    <section aria-labelledby="pf-h">
      <h1 id="pf-h">{t('coach.portfolio.title')}</h1>
      <p className="help">{t('coach.portfolio.intro')}</p>
      <button type="button" disabled={busy || !s} onClick={() => void build()}>{t('coach.portfolio.build')}</button>
      {error && <p role="alert" className="err">{t('app.error')}</p>}
      {s?.built && (
        <div>
          <p role="status">{t('coach.portfolio.built', { v: s.version ?? 1, repos: s.counts?.repos ?? 0, badges: s.counts?.badges ?? 0, certs: s.counts?.certificates ?? 0 })}</p>
          <iframe data-testid="portfolio-preview" className="coach-preview" title={t('coach.portfolio.preview')} sandbox="" src={`${s.url}?v=${s.version ?? 1}`} />
        </div>
      )}
    </section>
  );
}
