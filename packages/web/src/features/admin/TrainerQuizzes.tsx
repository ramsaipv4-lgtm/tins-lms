// AC-169: quizzes of the class's package. "Export to Google Forms" is shown only while googleForms is on.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { ClassPicker, Msg, errText, useLoad, type ClassRow } from './common.tsx';

export default function TrainerQuizzes() {
  const classes = useLoad<{ classes: ClassRow[] }>('/api/staff/classes');
  const [cid, setCid] = useState('');
  useEffect(() => { if (!cid && classes.data?.classes.length) setCid(classes.data.classes[0].id); }, [classes.data]);
  const q = useLoad<{ quizzes: { index: number; title: string; questions: number }[] }>(cid ? `/api/staff/classes/${cid.split(':')[1]}/quizzes` : null);
  const sw = useLoad<{ switches: Record<string, boolean> }>(cid ? `/api/switches?classId=${encodeURIComponent(cid)}` : null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function exportForm(quizIndex: number) {
    setError(null); setStatus(null);
    try { const r = await api<{ responderUri: string }>('/api/google/forms-export', { body: { classId: cid, quizIndex } }); setStatus(t('admin.google.exported', { url: r.responderUri })); }
    catch (e) { setError(errText(e)); }
  }
  return (
    <section aria-labelledby="tq-h">
      <h1 id="tq-h">{t('admin.tquiz.title')}</h1>
      {classes.data && <ClassPicker classes={classes.data.classes} value={cid} onChange={setCid} label={t('admin.reports.class')} />}
      <Msg error={error || classes.error || q.error} status={status} />
      {q.data && q.data.quizzes.length === 0 && <p>{t('admin.tquiz.none')}</p>}
      <ul>
        {q.data?.quizzes.map((z) => (
          <li key={z.index} style={{ margin: '8px 0' }}>
            <span translate="no">{z.title}</span> {t('admin.tquiz.count', { n: z.questions })}{' '}
            {sw.data?.switches.googleForms && <button type="button" onClick={() => void exportForm(z.index)}>{t('admin.google.exportForms')}</button>}
          </li>
        ))}
      </ul>
    </section>
  );
}
