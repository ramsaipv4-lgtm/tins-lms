// AC-165: anonymous weekly feedback. Learners write, trainers and coordinators read (no names stored).
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { useSession } from '../../app/session.tsx';
import { t } from '../../strings/index.ts';
import { ClassPicker, Msg, errText, useLoad, type ClassRow } from './common.tsx';

export function LearnerFeedback() {
  const classes = useLoad<{ classes: { id: string; name: string }[] }>('/api/me/classes');
  const [cid, setCid] = useState('');
  const [text, setText] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (!cid && classes.data?.classes.length) setCid(classes.data.classes[0].id); }, [classes.data]);
  async function send() {
    setError(null); setStatus(null);
    try { await api('/api/feedback', { body: { classId: cid, text } }); setText(''); setStatus(t('admin.feedback.thanks')); }
    catch (e) { setError(errText(e)); }
  }
  return (
    <section aria-labelledby="fb-h">
      <h1 id="fb-h">{t('admin.feedback.title')}</h1>
      <p className="help">{t('admin.feedback.anon')}</p>
      <div className="field">
        <label htmlFor="fb-text">{t('admin.feedback.field')}</label>
        <textarea id="fb-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <button type="button" onClick={() => void send()} disabled={!text.trim() || !cid}>{t('admin.feedback.submit')}</button>
      <Msg error={error || classes.error} status={status} />
    </section>
  );
}

export default function TrainerFeedback() {
  const classes = useLoad<{ classes: ClassRow[] }>('/api/staff/classes');
  const [cid, setCid] = useState('');
  useEffect(() => { if (!cid && classes.data?.classes.length) setCid(classes.data.classes[0].id); }, [classes.data]);
  const fb = useLoad<{ weeks: { week: string; texts: string[] }[] }>(cid ? `/api/classes/${cid.split(':')[1]}/feedback` : null);
  return (
    <section aria-labelledby="tfb-h">
      <h1 id="tfb-h">{t('admin.feedback.trainerTitle')}</h1>
      {classes.data && <ClassPicker classes={classes.data.classes} value={cid} onChange={setCid} label={t('admin.reports.class')} />}
      <Msg error={classes.error || fb.error} />
      {fb.data && fb.data.weeks.length === 0 && <p>{t('admin.feedback.none')}</p>}
      {fb.data?.weeks.map((w) => (
        <div key={w.week}><h2><span translate="no">{w.week}</span></h2><ul>{w.texts.map((x, i) => <li key={i} translate="no">{x}</li>)}</ul></div>
      ))}
    </section>
  );
}
