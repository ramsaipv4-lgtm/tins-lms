// Trainer: delivery reports (draft after wrap-up) (AC-89).
import { t } from '../../strings/index.ts';
import { useAttendCtx, useData } from './lib.ts';

export default function Reports() {
  const { ctx } = useAttendCtx();
  const { data, error } = useData<{ reports: any[] }>(ctx ? `/api/classes/${ctx.classId}/reports` : null, [ctx?.classId]);
  if (error) return <p role="alert">{t('attend.error')}</p>;
  return (
    <section aria-labelledby="rp-h">
      <h1 id="rp-h">{t('attend.reports.title')}</h1>
      {data && !data.reports.length && <p>{t('attend.reports.none')}</p>}
      <ul>
        {(data?.reports ?? []).map((r) => (
          <li key={r.id} data-testid={`report-day-${r.dayIndex}`} data-state={r.status}>
            {t('attend.reports.item', { day: r.dayIndex, status: t(`attend.reports.${r.status}`), present: r.present, enrolled: r.enrolled })}
            {' '}<span translate="no">{r.taughtByName}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
