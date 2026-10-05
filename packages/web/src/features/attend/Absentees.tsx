// Trainer: absentee list with prefilled WhatsApp links and "Copy all" (A-2) (AC-90).
import { useState } from 'react';
import { t } from '../../strings/index.ts';
import { copyAll } from '../../../../core/src/messages.ts';
import { waLinkSafe, copyText } from './wa.ts';
import { useAttendCtx, useData } from './lib.ts';

export default function Absentees() {
  const { ctx } = useAttendCtx();
  const { data, error } = useData<{ day: number; className: string; absentees: any[] }>(ctx ? `/api/classes/${ctx.classId}/absentees?day=${ctx.day}` : null, [ctx?.classId]);
  const [copied, setCopied] = useState(false);
  if (error) return <p role="alert">{t('attend.error')}</p>;
  const rows = (data?.absentees ?? []).map((a) => {
    const text = t('attend.abs.message', { name: a.name, day: data!.day });
    return { ...a, text, href: waLinkSafe(a.phone, text) };
  });
  return (
    <section aria-labelledby="ab-h">
      <h1 id="ab-h">{t('attend.abs.title', { day: data?.day ?? ctx?.day ?? 0 })}</h1>
      {data && !rows.length && <p>{t('attend.abs.none')}</p>}
      <ul>
        {rows.map((r) => (
          <li key={r.personId}>
            <span translate="no">{r.name}</span>{' '}
            {r.href ? <a data-testid={`wa-${r.personId}`} href={r.href} target="_blank" rel="noreferrer">{t('attend.abs.send', { name: r.name })}</a>
              : <span>{t('attend.abs.noPhone')}</span>}
          </li>
        ))}
      </ul>
      {rows.length > 0 && (
        <p>
          <button type="button" data-testid="copy-all" onClick={async () => {
            await copyText(copyAll(rows.map((r) => ({ name: r.name, text: r.text }))));
            setCopied(true);
          }}>{t('attend.abs.copyAll')}</button>
          <span role="status">{copied ? ' ' + t('attend.abs.copied') : ''}</span>
        </p>
      )}
    </section>
  );
}
