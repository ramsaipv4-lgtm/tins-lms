// Trainer: class roster with the drop switch; the confirmation lists the dropPlan actions (AC-152).
import { useEffect, useRef, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useLoad } from './lib.ts';

interface Row { personId: string; name: string; state: string; team: string | null }
interface Plan {
  plan: { unassignTickets: string[]; reassignReviews: string[]; removeFromTeam: string | null };
  tickets: { id: string; title: string }[]; reviews: { id: string; title: string }[];
}

export default function TRoster() {
  const { data, error, reload } = useLoad<{ learners: Row[] }>('/api/classroom/roster', 4000);
  const [target, setTarget] = useState<{ row: Row; plan: Plan } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<Record<string, { id: string; text: string }[]>>({});
  const dialog = useRef<HTMLDivElement>(null);

  // Trainer notes (attend group's routes) show under each learner, as on the attendance roster.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const ctx = await api<{ classId: string }>('/api/attend/context');
        const n = await api<{ notes: { id: string; personId: string; text: string }[] }>(`/api/classes/${ctx.classId}/notes`);
        const by: Record<string, { id: string; text: string }[]> = {};
        for (const x of n.notes) (by[x.personId] ??= []).push(x);
        if (live) setNotes(by);
      } catch { /* notes are optional here */ }
    })();
    return () => { live = false; };
  }, [data]);

  useEffect(() => { if (target) dialog.current?.focus(); }, [target]);

  async function ask(row: Row) {
    setMsg(null);
    try { setTarget({ row, plan: await api<Plan>(`/api/classroom/drop-plan?personId=${encodeURIComponent(row.personId)}`) }); }
    catch { setMsg(t('classroom.error')); }
  }
  async function run(path: string, row: Row) {
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ restoredTeam?: string | null }>(path, { body: { personId: row.personId } });
      setTarget(null); await reload();
      if (path.endsWith('/undrop')) setMsg(t('classroom.roster.restored', { name: row.name, team: r.restoredTeam ?? '-' }));
    }
    catch { setMsg(t('classroom.error')); } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="tr-h">
      <h1 id="tr-h">{t('classroom.roster.title')}</h1>
      <p className="help">{t('classroom.roster.intro')}</p>
      {error && !data && <p className="err" role="alert">{t('classroom.error')}</p>}
      {data && data.learners.length === 0 && <p>{t('classroom.roster.none')}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {data?.learners.map((r) => (
          <li key={r.personId} data-testid={`roster-${r.personId}`} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '8px 0' }}>
            <span translate="no">{r.name}</span>
            <span>{t(`classroom.state.${r.state}`)}</span>
            {r.team && <span>{t('classroom.roster.team', { team: r.team })}</span>}
            {r.state === 'dropped'
              ? <button type="button" onClick={() => void run('/api/classroom/undrop', r)}>{t('classroom.drop.undo')}</button>
              : <button type="button" onClick={() => void ask(r)}>{t('classroom.drop.button')}</button>}
            {notes[r.personId]?.length ? (
              <div data-testid="learner-notes" style={{ flexBasis: '100%' }}>
                <strong>{t('classroom.roster.notes')}</strong>
                <ul>{notes[r.personId].map((n) => <li key={n.id}>{n.text}</li>)}</ul>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {msg && <p role="status">{msg}</p>}
      {target && (
        <div data-testid="drop-confirm" role="dialog" aria-modal="false" aria-labelledby="drop-h" tabIndex={-1} ref={dialog}
          style={{ border: '2px solid var(--line)', borderRadius: 8, padding: 16, margin: '16px 0' }}>
          <h2 id="drop-h" style={{ fontSize: '1.1rem', marginTop: 0 }}>{t('classroom.drop.title', { name: target.row.name })}</h2>
          <p>{t('classroom.drop.intro')}</p>
          <ul>
            {target.plan.tickets.map((x) => <li key={x.id}>{t('classroom.drop.unassign', { title: x.title })}</li>)}
            {target.plan.reviews.map((x) => <li key={x.id}>{t('classroom.drop.reassign', { title: x.title })}</li>)}
            {target.plan.plan.removeFromTeam && <li>{t('classroom.drop.team', { team: target.plan.plan.removeFromTeam })}</li>}
            <li>{t('classroom.drop.repos')}</li>
            <li>{t('classroom.drop.bots')}</li>
            <li>{t('classroom.drop.leave')}</li>
          </ul>
          <p className="help">{t('classroom.drop.undoNote')}</p>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => void run('/api/classroom/drop', target.row)}>{t('classroom.drop.confirm')}</button>
            <button type="button" onClick={() => setTarget(null)}>{t('classroom.drop.cancel')}</button>
          </div>
        </div>
      )}
    </section>
  );
}
