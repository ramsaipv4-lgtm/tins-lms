// Trainer: appeals inbox with the evidence pack; uphold with a corrected score or reject (AC-88).
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useLoad, fraction } from './lib.ts';

interface Appeal {
  attemptId: string; name: string; state: string; learnerReason: string; itemId: string | null; score: number | null; max: number | null;
  evidence: { seed: string | null; mode: string | null; events: unknown[]; rubricRows: unknown[]; unreadConfirmations: number };
}

function AppealCard({ a, onChange }: { a: Appeal; onChange: () => void }) {
  const [pending, setPending] = useState(false);
  const [score, setScore] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const hid = `ap-${a.attemptId}`;
  const decidable = a.state === 'open' || a.state === 'escalated';

  async function decide(kind: 'uphold' | 'reject', correctedScore?: number) {
    setMsg(null);
    try {
      const body: any = a.state === 'escalated' ? { kind: 'decide-final', outcome: kind } : { kind };
      if (correctedScore !== undefined) body.correctedScore = correctedScore;
      await api(`/api/classroom/appeals/${encodeURIComponent(a.attemptId)}/decide`, { body });
      setMsg(t('classroom.appeals.decided')); setPending(false); setScore(''); onChange();
    } catch { setMsg(t('classroom.error')); }
  }

  function confirm() {
    const n = Number(score);
    if (score.trim() === '' || !Number.isFinite(n)) { setMsg(t('classroom.appeals.needScore')); return; }
    if (n < 0 || (a.max !== null && n > a.max)) { setMsg(t('classroom.appeals.scoreRange', { max: a.max ?? 0 })); return; }
    void decide('uphold', n);
  }

  return (
    <article aria-labelledby={hid} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, margin: '12px 0' }}>
      <h2 id={hid} style={{ fontSize: '1.1rem', margin: 0 }}><span translate="no">{a.name}</span> <span translate="no">{a.itemId}</span></h2>
      <p>{t('classroom.appeals.score', { score: a.score ?? '?', max: a.max ?? '?' })}</p>
      <p role="status">{t('classroom.appeal.status', { state: t(`classroom.appeal.state.${a.state}`) })}</p>
      <p><strong>{t('classroom.appeals.learnerSays')}:</strong> <span translate="no">{a.learnerReason}</span></p>
      <div data-testid="appeal-evidence">
        <h3 style={{ fontSize: '1rem' }}>{t('classroom.appeals.evidence')}</h3>
        <ul>
          <li translate="no">{t('classroom.appeals.seed', { seed: a.evidence.seed ?? '-' })}</li>
          <li>{t('classroom.appeals.mode', { mode: a.evidence.mode ?? '-' })}</li>
          <li>{t('classroom.appeals.events', { n: a.evidence.events.length })}</li>
          <li>{t('classroom.appeals.rubric', { n: a.evidence.rubricRows.length })}</li>
          <li>{t('classroom.appeals.unread', { n: a.evidence.unreadConfirmations })}</li>
        </ul>
      </div>
      {decidable && (
        <div>
          <div className="field">
            <label htmlFor={`${hid}-score`}>{t('classroom.appeals.correctedScore')}</label>
            <input id={`${hid}-score`} type="number" inputMode="decimal" min={0} max={a.max ?? undefined} step="any" value={score} onChange={(e) => setScore(e.target.value)} />
          </div>
          <div className="row">
            <button type="button" onClick={() => { if (score.trim() === '') { setPending(true); setMsg(t('classroom.appeals.needScore')); } else confirm(); }}>{t('classroom.appeals.uphold')}</button>
            <button type="button" onClick={() => void decide('reject')}>{t('classroom.appeals.reject')}</button>
            {pending && <button type="button" onClick={confirm}>{t('classroom.appeals.confirm')}</button>}
          </div>
        </div>
      )}
      {msg && <p role="status">{msg}</p>}
    </article>
  );
}

export default function TAppeals() {
  const { data, error, reload } = useLoad<{ appeals: Appeal[] }>('/api/classroom/appeals', 4000);
  return (
    <section aria-labelledby="ta-h">
      <h1 id="ta-h">{t('classroom.appeals.title')}</h1>
      <p className="help">{t('classroom.appeals.intro')}</p>
      {error && !data && <p className="err" role="alert">{t('classroom.error')}</p>}
      {!data && !error && <p role="status">{t('classroom.loading')}</p>}
      {data && data.appeals.length === 0 && <p>{t('classroom.appeals.none')}</p>}
      {data?.appeals.map((a) => <AppealCard key={a.attemptId} a={a} onChange={() => void reload()} />)}
    </section>
  );
}
