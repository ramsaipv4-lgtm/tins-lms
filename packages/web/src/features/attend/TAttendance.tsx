// Trainer: rotating attendance code, printed fallback and the roster (AC-82).
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useAttendCtx, usePoll } from './lib.ts';

export default function TAttendance() {
  const { ctx, error } = useAttendCtx();
  const [code, setCode] = useState<{ code: string; secondsLeft: number } | null>(null);
  const [printed, setPrinted] = useState<string | null>(null);
  const [roster, setRoster] = useState<any | null>(null);
  const id = ctx?.classId;

  usePoll(async () => {
    if (!id) return;
    try { setCode(await api(`/api/classes/${id}/attendance-code`)); } catch { /* retry next tick */ }
  }, 5000, [id]);
  usePoll(async () => {
    if (!id) return;
    try { setRoster(await api(`/api/classes/${id}/roster`)); } catch { /* retry */ }
  }, 3000, [id]);

  if (error) return <p role="alert">{t('attend.error')}</p>;
  if (!ctx) return <p role="status">{t('app.loading')}</p>;
  return (
    <section aria-labelledby="ta-h">
      <h1 id="ta-h">{t('attend.t.title', { day: ctx.day })}</h1>
      <p>{t('attend.t.codeHelp')}</p>
      <p className="code" style={{ fontSize: '2.5rem', letterSpacing: '0.2em', fontWeight: 700 }} data-testid="attendance-code" aria-label={t('attend.t.codeLabel')}>{code?.code ?? ''}</p>
      <p role="status">{code ? t('attend.t.secondsLeft', { n: code.secondsLeft }) : t('app.loading')}</p>
      <p>
        <button type="button" onClick={async () => {
          try { const r = await api<{ code: string }>(`/api/classes/${id}/printed-code?day=${ctx.day}`); setPrinted(r.code); } catch { setPrinted(null); }
        }}>{t('attend.t.showPrinted')}</button>{' '}
        {printed && <strong data-testid="printed-code">{t('attend.t.printedIs', { code: printed })}</strong>}
      </p>
      <h2>{t('attend.t.roster')}</h2>
      <Roster rows={roster?.learners ?? []} />
    </section>
  );
}

export function Roster({ rows, notes }: { rows: any[]; notes?: Record<string, any[]> }) {
  return (
    <ul>
      {rows.map((r) => (
        <li key={r.personId} data-testid={`roster-${r.personId}`}>
          <span translate="no">{r.name}</span>{' '}
          <span>{t(`attend.state.${r.state}`)}</span>
          {notes?.[r.personId]?.length ? (
            <div data-testid="learner-notes">
              <strong>{t('attend.notes.heading')}</strong>
              <ul>{notes[r.personId].map((n) => <li key={n.id}>{n.text}</li>)}</ul>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
