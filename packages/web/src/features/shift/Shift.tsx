// Shift board (AC-86) and the corporate incident page (AC-164): tickets arrive over server time, SLA board, score screen.
import { useRef, useState } from 'react';
import { t } from '../../strings/index.ts';
import { ErrorNote, api, mmss, useAction, usePoll } from './lib.tsx';

type Ticket = { id: string; title: string; detail: string | null; priority: string; kind: string; status: string; msLeft: number; acked: boolean };
type View = {
  status: 'none' | 'running' | 'finished'; hasPack?: boolean; mode?: string; elapsedMs?: number; limitMs?: number; tickets?: Ticket[];
  score?: { score: number; max: number; pct: number; modeFlag: boolean; rows: { id: string; earned: number }[] };
};

function Row({ tk, reload }: { tk: Ticket; reload: () => Promise<void> }) {
  const [answer, setAnswer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const { error, run } = useAction();
  const open = tk.status === 'waiting' || tk.status === 'acked';
  const fire = (kind: 'ack' | 'resolve') => run(async () => {
    const typed = inputRef.current?.value ?? answer;
    if (kind === 'resolve' && !typed.trim()) { setNote(t('shift.shift.empty')); return; }
    const r: any = await api('/api/shift/events', { method: 'POST', body: { kind, ticketId: tk.id, answer: kind === 'resolve' ? typed : undefined } });
    setNote(kind === 'resolve' && !r.accepted ? t('shift.shift.wrong') : null);
    if (kind === 'resolve' && r.accepted) setAnswer('');
    await reload();
  });
  return (
    <li className="sh-card" data-testid={`sla-${tk.id}`} data-status={tk.status}>
      <h3>{tk.title} <span className="sh-prio">{tk.priority.toUpperCase()}</span></h3>
      {tk.detail && <p translate="no">{tk.detail}</p>}
      <p>
        <span>{t(`shift.status.${tk.status}`)}</span>
        {open && <> · {t('shift.shift.slaLeft')} <span className="sh-timer">{mmss(tk.msLeft)}</span></>}
      </p>
      {open && !tk.acked && <button type="button" onClick={() => fire('ack')}>{t('shift.shift.ack')}</button>}
      {open && (
        <div className="field">
          <label htmlFor={`ans-${tk.id}`}>{t('shift.shift.answer')}</label>
          <input id={`ans-${tk.id}`} ref={inputRef} value={answer} onChange={(e) => setAnswer(e.target.value)} />
          <div><button type="button" onClick={() => fire('resolve')}>{t('shift.shift.resolve')}</button></div>
        </div>
      )}
      {note && <p role="status">{note}</p>}
      <ErrorNote error={error} />
    </li>
  );
}

export default function Shift() {
  const { data, reload } = usePoll<View>('/api/shift/state', 1000);
  const { error, run } = useAction();
  if (!data) return <p role="status">{t('app.loading')}</p>;

  if (data.status === 'none') {
    return (
      <section aria-labelledby="sh-h">
        <h1 id="sh-h">{t('shift.shift.title')}</h1>
        {data.hasPack === false ? <p>{t('shift.shift.nopack')}</p> : <p className="help">{t('shift.shift.intro')}</p>}
        {data.limitMs !== undefined && <p data-testid="shift-timer">{t('shift.shift.limit', { min: Math.round(data.limitMs / 60000) })}</p>}
        <button type="button" data-testid="shift-start" disabled={data.hasPack === false}
          onClick={() => run(async () => { await api('/api/shift/start', { method: 'POST', body: {} }); await reload(); })}>{t('shift.shift.start')}</button>
        <ErrorNote error={error} />
      </section>
    );
  }

  if (data.status === 'finished' && data.score) {
    const s = data.score;
    return (
      <section aria-labelledby="sh-h" data-testid="shift-score">
        <h1 id="sh-h">{t('shift.score.title')}</h1>
        <p>{t('shift.score.mode', { mode: t(`shift.mode.${data.mode}`) })}{s.modeFlag && <> · <span className="chip">{t('shift.score.flag')}</span></>}</p>
        <p>{t('shift.score.total', { score: s.score, max: s.max, pct: s.pct })}</p>
        <ul className="sh-list">
          {s.rows.map((r) => <li key={r.id} data-testid={`score-row-${r.id}`}>{t('shift.score.row', { id: r.id, earned: r.earned })}</li>)}
        </ul>
        <button type="button" onClick={() => run(async () => { await api('/api/shift/start', { method: 'POST', body: {} }); await reload(); })}>{t('shift.score.again')}</button>
        <ErrorNote error={error} />
      </section>
    );
  }

  const tickets = data.tickets ?? [];
  const incidentId = tickets.find((x) => x.priority === 'p1')?.id;
  return (
    <section aria-labelledby="sh-h">
      <h1 id="sh-h">{t('shift.shift.title')}</h1>
      <p data-testid="shift-timer">
        {t('shift.shift.limit', { min: Math.round((data.limitMs ?? 0) / 60000) })} · {t('shift.shift.left')} <span className="sh-timer">{mmss((data.limitMs ?? 0) - (data.elapsedMs ?? 0))}</span>
      </p>
      {tickets.length === 0 && <p role="status">{t('shift.shift.waiting')}</p>}
      <ul className="sh-list" aria-label={t('shift.shift.board')}>
        {tickets.map((tk) => tk.id === incidentId ? (
          <li key={tk.id} style={{ listStyle: 'none' }}>
            <section className="sh-incident" data-testid="incident-page" aria-labelledby="inc-h">
              <h2 id="inc-h">{t('shift.shift.incident')}</h2>
              <p className="help">{t('shift.shift.incidentHelp')}</p>
              <ul className="sh-list"><Row tk={tk} reload={reload} /></ul>
            </section>
          </li>
        ) : <Row key={tk.id} tk={tk} reload={reload} />)}
      </ul>
      <button type="button" onClick={() => run(async () => { await api('/api/shift/finish', { method: 'POST', body: {} }); await reload(); })}>{t('shift.shift.end')}</button>
      <ErrorNote error={error} />
    </section>
  );
}
