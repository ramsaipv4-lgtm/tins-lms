// Trainer: roster with attendance state and trainer notes (AC-159).
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useAttendCtx, usePoll } from './lib.ts';
import { Roster } from './TAttendance.tsx';

export default function RosterPage() {
  const { ctx, error } = useAttendCtx();
  const [roster, setRoster] = useState<any | null>(null);
  const [notes, setNotes] = useState<Record<string, any[]>>({});
  const id = ctx?.classId;
  usePoll(async () => {
    if (!id) return;
    try {
      setRoster(await api(`/api/classes/${id}/roster`));
      const n = await api<{ notes: any[] }>(`/api/classes/${id}/notes`);
      const by: Record<string, any[]> = {};
      for (const x of n.notes) (by[x.personId] ??= []).push(x);
      setNotes(by);
    } catch { /* retry */ }
  }, 4000, [id]);
  if (error) return <p role="alert">{t('attend.error')}</p>;
  if (!ctx) return <p role="status">{t('app.loading')}</p>;
  return (
    <section aria-labelledby="ro-h">
      <h1 id="ro-h">{t('attend.roster.title')}</h1>
      <Roster rows={roster?.learners ?? []} notes={notes} />
    </section>
  );
}
