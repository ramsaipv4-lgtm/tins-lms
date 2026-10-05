// Learner: today's page after the trainer's wrap-up: board PDF, quick-learn, cards due (AC-89).
import { t } from '../../strings/index.ts';
import { useAttendCtx, useData, usePoll } from './lib.ts';
import { useState } from 'react';
import { api } from '../../app/api.ts';

export default function LToday({ embedded = false }: { embedded?: boolean } = {}) {
  const { ctx, error } = useAttendCtx();
  const [d, setD] = useState<any | null>(null);
  usePoll(async () => {
    if (!ctx) return;
    try { setD(await api(`/api/classes/${ctx.classId}/today?day=${ctx.day}`)); } catch { /* retry */ }
  }, 3000, [ctx?.classId]);
  void useData;
  if (error) return <p role="alert">{t('attend.error')}</p>;
  if (!ctx) return <p role="status">{t('app.loading')}</p>;
  return (
    <section aria-labelledby="lt-h">
      {embedded ? <h2 id="lt-h">{t('attend.today.title', { day: ctx.day })}</h2> : <h1 id="lt-h">{t('attend.today.title', { day: ctx.day })}</h1>}
      <p data-testid="cards-due-count">{t('attend.today.cardsDue', { n: d?.cardsDue ?? 0 })}</p>
      {d?.wrapup ? (
        <ul>
          <li><a href={d.wrapup.boardPdf} target="_blank" rel="noreferrer">{t('attend.today.boardPdf', { day: ctx.day })}</a></li>
          <li><a href={d.wrapup.quickLearn} target="_blank" rel="noreferrer">{t('attend.today.quickLearn')}</a></li>
        </ul>
      ) : <p>{t('attend.today.notYet')}</p>}
    </section>
  );
}
