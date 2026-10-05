// AC-169: the trainer's class schedule. "Sync to calendar" is shown only while the calendarSync switch is on.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { ClassPicker, Msg, errText, useLoad, type ClassRow } from './common.tsx';

export default function TrainerSchedule() {
  const classes = useLoad<{ classes: ClassRow[] }>('/api/staff/classes');
  const [cid, setCid] = useState('');
  useEffect(() => { if (!cid && classes.data?.classes.length) setCid(classes.data.classes[0].id); }, [classes.data]);
  const key = cid ? cid.split(':')[1] : null;
  const s = useLoad<{ name: string; schedule: { index: number; date: string; start: string; end: string }[] }>(key ? `/api/staff/classes/${key}/schedule` : null);
  const sw = useLoad<{ switches: Record<string, boolean> }>(cid ? `/api/switches?classId=${encodeURIComponent(cid)}` : null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function sync() {
    setError(null); setStatus(null);
    try { const r = await api<{ synced: number }>('/api/google/calendar-sync', { body: { classId: cid } }); setStatus(t('admin.google.synced', { n: r.synced })); }
    catch (e) { setError(errText(e)); }
  }
  return (
    <section aria-labelledby="ts-h">
      <h1 id="ts-h">{t('admin.tschedule.title')}</h1>
      {classes.data && <ClassPicker classes={classes.data.classes} value={cid} onChange={setCid} label={t('admin.reports.class')} />}
      <Msg error={error || classes.error || s.error} status={status} />
      {s.data && <ol>{s.data.schedule.map((d) => <li key={d.index}>{t('admin.schedule.day', { n: d.index + 1, date: d.date, start: d.start, end: d.end })}</li>)}</ol>}
      {sw.data?.switches.calendarSync && <button type="button" onClick={() => void sync()}>{t('admin.google.syncCalendar')}</button>}
    </section>
  );
}
