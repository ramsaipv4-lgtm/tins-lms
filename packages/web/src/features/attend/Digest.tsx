// Trainer: Friday at-risk digest with prefilled messages (A-3) (AC-160).
import { t } from '../../strings/index.ts';
import { waLinkSafe } from './wa.ts';
import { useAttendCtx, useData } from './lib.ts';

export default function Digest() {
  const { ctx } = useAttendCtx();
  const { data, error } = useData<{ learners: any[] }>(ctx ? `/api/classes/${ctx.classId}/digest` : null, [ctx?.classId]);
  if (error) return <p role="alert">{t('attend.error')}</p>;
  return (
    <section aria-labelledby="dg-h">
      <h1 id="dg-h">{t('attend.digest.title')}</h1>
      <ul data-testid="digest">
        {(data?.learners ?? []).map((l) => {
          const text = t('attend.digest.message', { name: l.name });
          const href = waLinkSafe(l.phone, text);
          return (
            <li key={l.personId} data-testid={`digest-${l.personId}`} data-level={l.level}>
              <span translate="no">{l.name}</span>{' '}
              <strong>{t(`attend.level.${l.level}`)}</strong>
              {l.reasons.length > 0 && <span>{': ' + l.reasons.map((r: string) => t(`attend.reason.${r.replace(/\s+/g, '_')}`)).join(', ')}</span>}
              {' '}
              {href ? <a data-testid={`wa-${l.personId}`} href={href} target="_blank" rel="noreferrer">{t('attend.abs.send', { name: l.name })}</a> : <span>{t('attend.abs.noPhone')}</span>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
