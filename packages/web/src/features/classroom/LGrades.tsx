// Learner: published grades with score history and the appeal form (AC-88).
import { useState } from 'react';
import { api, ApiError } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useLoad, fraction } from './lib.ts';

interface Grade {
  attemptId: string; itemId: string; score: number; max: number | null;
  history: { score: number; at: number; corrects: number | null }[];
  appeal: { state: string } | null;
}

function GradeCard({ g, onChange }: { g: Grade; onChange: () => void }) {
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hid = `gr-${g.attemptId}`;

  async function submit() {
    if (!reason.trim()) { setMsg(t('classroom.appeal.reasonRequired')); return; }
    setBusy(true); setMsg(null);
    try {
      await api('/api/classroom/appeals', { body: { attemptId: g.attemptId, reason: reason.trim() } });
      setReason(''); onChange();
    } catch (e) {
      const f = e instanceof ApiError ? e.fields.attemptId : '';
      setMsg(f === 'window-closed' ? t('classroom.appeal.windowClosed') : f === 'already-appealed' ? t('classroom.appeal.already') : t('classroom.error'));
    } finally { setBusy(false); }
  }

  return (
    <article aria-labelledby={hid} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, margin: '12px 0' }}>
      <h2 id={hid} translate="no" style={{ fontSize: '1.1rem', margin: 0 }}>{g.itemId}</h2>
      <p><strong>{t('classroom.grades.current')}:</strong> {fraction(g.score, g.max)}</p>
      <div data-testid="score-history">
        <h3 style={{ fontSize: '1rem' }}>{t('classroom.grades.history')}</h3>
        <ol>
          {g.history.map((h, i) => (
            <li key={i}>{fraction(h.score, g.max)} ({h.corrects === null ? t('classroom.grades.original') : t('classroom.grades.corrected')})</li>
          ))}
        </ol>
      </div>
      {g.appeal ? (
        <p role="status">{t('classroom.appeal.status', { state: t(`classroom.appeal.state.${g.appeal.state}`) })}</p>
      ) : (
        <div>
          <div className="field">
            <label htmlFor={`${hid}-reason`}>{t('classroom.appeal.reason')}</label>
            <textarea id={`${hid}-reason`} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            <span className="help">{t('classroom.appeal.reasonHelp')}</span>
          </div>
          <button type="button" data-testid="appeal-open" disabled={busy} onClick={() => void submit()}>{t('classroom.appeal.submit')}</button>
          {msg && <p className="err" role="alert">{msg}</p>}
        </div>
      )}
    </article>
  );
}

export default function LGrades() {
  const { data, error, reload } = useLoad<{ grades: Grade[] }>('/api/classroom/grades', 4000);
  return (
    <section aria-labelledby="lg-h">
      <h1 id="lg-h">{t('classroom.grades.title')}</h1>
      <p className="help">{t('classroom.grades.intro')}</p>
      {error && !data && <p className="err" role="alert">{t('classroom.error')}</p>}
      {!data && !error && <p role="status">{t('classroom.loading')}</p>}
      {data && data.grades.length === 0 && <p>{t('classroom.grades.none')}</p>}
      {data?.grades.map((g) => <GradeCard key={g.attemptId} g={g} onChange={() => void reload()} />)}
    </section>
  );
}
