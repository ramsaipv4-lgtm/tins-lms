// Ticket backlog (AC-87 retro tickets, AC-164 C-5): every ticket needs acceptance criteria.
import { useState, type FormEvent } from 'react';
import { t } from '../../strings/index.ts';
import { ApiError } from '../../app/api.ts';
import { ErrorNote, api, errText, usePoll } from './lib.tsx';

type Tk = { id: string; title: string; status: string; points: number | null; acceptance: string };

export default function Tickets() {
  const { data, reload } = usePoll<Tk[]>('/api/corp/tickets', 4000);
  const [f, setF] = useState({ title: '', acceptance: '' });
  const [err, setErr] = useState<string | null>(null);
  const [acErr, setAcErr] = useState(false);
  const [open, setOpen] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr(null); setAcErr(false);
    try { await api('/api/corp/tickets', { method: 'POST', body: f }); setF({ title: '', acceptance: '' }); await reload(); }
    catch (x) { if (x instanceof ApiError && x.fields.acceptance) setAcErr(true); else setErr(errText(x)); }
  };
  return (
    <section aria-labelledby="tk-h">
      <h1 id="tk-h">{t('shift.tickets.title')}</h1>
      <ul className="sh-list">
        {(data ?? []).map((x) => (
          <li key={x.id} className="sh-card"><strong translate="no">{x.title}</strong> <span className="chip">{x.status}</span>
            <p>{t('shift.tickets.ac')} <span translate="no">{x.acceptance || t('shift.tickets.noAc')}</span></p></li>
        ))}
      </ul>
      {!open && <button type="button" onClick={() => setOpen(true)}>{t('shift.tickets.newBtn')}</button>}
      {open && <form onSubmit={submit} className="sh-form" noValidate>
        <div className="field"><label htmlFor="tk-t">{t('shift.tickets.fieldTitle')}</label><input id="tk-t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="field"><label htmlFor="tk-a">{t('shift.tickets.fieldAc')}</label>
          <textarea id="tk-a" rows={3} value={f.acceptance} onChange={(e) => setF({ ...f, acceptance: e.target.value })} aria-describedby={acErr ? 'tk-a-err' : undefined} aria-invalid={acErr} />
          {acErr && <p id="tk-a-err" role="alert" className="err">{t('shift.err.required')}</p>}</div>
        <button type="submit">{t('shift.tickets.create')}</button>
        <ErrorNote error={err} />
      </form>}
    </section>
  );
}
