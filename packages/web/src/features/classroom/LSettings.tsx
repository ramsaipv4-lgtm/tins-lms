// Learner: request an accommodation (extra time) and see its status (AC-153).
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useLoad } from './lib.ts';

interface Mine { requests: { id: string; timeMultiplier: number; status: string }[]; approved: number | null }

export default function LSettings() {
  const { data, error, reload } = useLoad<Mine>('/api/classroom/accommodations', 5000);
  const [open, setOpen] = useState(false);
  const [mult, setMult] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const n = Number(mult);
    if (!reason.trim() || !Number.isFinite(n) || n < 1 || n > 3) { setMsg(t('classroom.acc.invalid')); return; }
    setBusy(true); setMsg(null);
    try {
      await api('/api/classroom/accommodations', { body: { timeMultiplier: n, reason: reason.trim() } });
      setOpen(false); setMult(''); setReason(''); setMsg(t('classroom.acc.sent')); await reload();
    } catch { setMsg(t('classroom.error')); } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="ls-h">
      <h1 id="ls-h">{t('classroom.acc.title')}</h1>
      <p className="help">{t('classroom.acc.intro')}</p>
      {data?.approved ? <p role="status">{t('classroom.acc.approvedNow', { n: data.approved })}</p> : null}
      {!open ? (
        <button type="button" onClick={() => { setOpen(true); setMsg(null); }}>{t('classroom.acc.request')}</button>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <div className="field">
            <label htmlFor="acc-mult">{t('classroom.acc.multiplier')}</label>
            <input id="acc-mult" type="number" inputMode="decimal" min={1} max={3} step="any" value={mult} onChange={(e) => setMult(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="acc-reason">{t('classroom.acc.reason')}</label>
            <textarea id="acc-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="row">
            <button type="submit" disabled={busy}>{t('classroom.acc.submit')}</button>
            <button type="button" onClick={() => setOpen(false)}>{t('classroom.acc.cancel')}</button>
          </div>
        </form>
      )}
      {msg && <p role="status">{msg}</p>}
      {error && !data && <p className="err" role="alert">{t('classroom.error')}</p>}
      {data && data.requests.length > 0 && (
        <div>
          <h2 style={{ fontSize: '1.1rem' }}>{t('classroom.acc.mine')}</h2>
          <ul>{data.requests.map((r) => <li key={r.id}>{t('classroom.acc.row', { n: r.timeMultiplier, status: t(`classroom.acc.status.${r.status}`) })}</li>)}</ul>
        </div>
      )}
    </section>
  );
}
