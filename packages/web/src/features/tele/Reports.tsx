// /teach/delivery-reports (AC-150): who taught each day (trainer, substitute or AI-delivered).
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useClass } from './lib.tsx';

interface Row { dayIndex: number; date: string | null; taughtBy: string; mode: string; handoverRead: boolean | null; queuedQuestions: number }

export default function Reports() {
  const { cls, ready } = useClass();
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => { if (cls) api<{ reports: Row[] }>(`/api/tele/classes/${cls.id}/reports`).then((r) => setRows(r.reports)).catch(() => setRows([])); }, [cls?.id]);
  if (!ready) return <p role="status">{t('app.loading')}</p>;
  if (!cls) return <p role="status">{t('tele.noClass')}</p>;
  return (
    <>
      <h1>{t('tele.rep.title')}</h1>
      <table data-testid="delivery-reports">
        <thead><tr><th scope="col">{t('tele.rep.day')}</th><th scope="col">{t('tele.rep.date')}</th><th scope="col">{t('tele.rep.taught')}</th><th scope="col">{t('tele.rep.notes')}</th></tr></thead>
        <tbody>
          {(rows ?? []).map((r) => (
            <tr key={r.dayIndex} data-day={r.dayIndex}>
              <td>{t('tele.rep.dayN', { n: r.dayIndex })}</td><td>{r.date ?? ''}</td>
              <td translate="no">{r.taughtBy}</td>
              <td>{r.mode === 'substitute' ? t(r.handoverRead ? 'tele.rep.read' : 'tele.rep.unread') : r.mode === 'AI-delivered' ? t('tele.rep.queued', { n: r.queuedQuestions }) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
