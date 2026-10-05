// Learner: trainer comments on lab results.
import { t } from '../../strings/index.ts';
import { useAttendCtx, useData } from './lib.ts';

export default function LFeedback() {
  const { ctx } = useAttendCtx();
  const { data, error } = useData<{ feedback: any[] }>(ctx ? `/api/classes/${ctx.classId}/my-lab-feedback` : null, [ctx?.classId]);
  if (error) return <p role="alert">{t('attend.error')}</p>;
  return (
    <section aria-labelledby="lf-h">
      <h1 id="lf-h">{t('attend.lf.title')}</h1>
      {data && !data.feedback.length && <p>{t('attend.lf.none')}</p>}
      <ul data-testid="lab-feedback">
        {(data?.feedback ?? []).map((f) => (
          <li key={f.id}>
            <p>{f.text}</p>
            {f.failing.length > 0 && <p>{t('attend.labs.failing', { checks: f.failing.join(', ') })}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
