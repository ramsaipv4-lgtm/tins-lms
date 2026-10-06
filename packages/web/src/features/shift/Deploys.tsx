// Change requests and deploys (AC-164, C-4): prod needs an approved change request.
import { useState, type FormEvent } from 'react';
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type CR = { id: string; summary: string; rollback: string; status: string; by: string; used: boolean };
type Dep = { id: string; environment: string; changeRequestId: string | null };

export default function Deploys() {
  const crs = usePoll<CR[]>('/api/corp/change-requests', 2000);
  const deps = usePoll<Dep[]>('/api/corp/deploys', 4000);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ summary: '', rollback: '' });
  const { error, run } = useAction();
  const approved = (crs.data ?? []).some((c) => c.status === 'approved' && !c.used);
  const submit = (e: FormEvent) => { e.preventDefault(); void run(async () => { await api('/api/corp/change-requests', { method: 'POST', body: f }); setF({ summary: '', rollback: '' }); setOpen(false); await crs.reload(); }); };
  const deploy = (environment: string) => run(async () => { await api('/api/corp/deploys', { method: 'POST', body: { environment } }); await Promise.all([crs.reload(), deps.reload()]); });
  return (
    <section aria-labelledby="dp-h">
      <h1 id="dp-h">{t('shift.deploy.title')}</h1>
      <div className="row">
        <button type="button" onClick={() => deploy('staging')}>{t('shift.deploy.staging')}</button>
        {/* Render the prod button only once the change requests have loaded: a button that is disabled only
            because data is still in flight reads as "no approved change request" (integration I-10). */}
        {crs.data == null
          ? <p role="status">{t('app.loading')}</p>
          : <button type="button" disabled={!approved} aria-describedby="dp-hint" onClick={() => deploy('prod')}>{t('shift.deploy.prod')}</button>}
      </div>
      <p id="dp-hint" className="help">{approved ? t('shift.deploy.ready') : t('shift.deploy.needCr')}</p>
      <ErrorNote error={error} />
      <h2>{t('shift.deploy.crs')}</h2>
      <ul className="sh-list">
        {(crs.data ?? []).map((c) => (
          <li key={c.id} className="sh-card" data-status={c.status === 'approved' ? 'resolved' : c.status === 'rejected' ? 'breached' : 'waiting'}>
            <strong translate="no">{c.summary}</strong> <span className="chip">{t(`shift.cr.${c.status}`)}</span>
            <p>{t('shift.deploy.rollbackLine')} <span translate="no">{c.rollback}</span></p>
          </li>
        ))}
      </ul>
      {!open && <button type="button" onClick={() => setOpen(true)}>{t('shift.deploy.new')}</button>}
      {open && (
        <form onSubmit={submit} className="sh-form">
          <div className="field"><label htmlFor="cr-s">{t('shift.deploy.summary')}</label><input id="cr-s" value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} required /></div>
          <div className="field"><label htmlFor="cr-r">{t('shift.deploy.rollback')}</label><input id="cr-r" value={f.rollback} onChange={(e) => setF({ ...f, rollback: e.target.value })} required /></div>
          <button type="submit">{t('shift.deploy.submit')}</button>
        </form>
      )}
      <h2>{t('shift.deploy.history')}</h2>
      <ul className="sh-list">{(deps.data ?? []).map((d) => <li key={d.id}>{t('shift.deploy.did', { env: d.environment })}</li>)}</ul>
    </section>
  );
}
