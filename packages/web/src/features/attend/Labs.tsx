// Trainer: lab results grouped by failing checks; one comment reaches every member (A-4) (AC-160).
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useAttendCtx, useData } from './lib.ts';

function Cluster({ classId, cl }: { classId: string; cl: any }) {
  const [text, setText] = useState('');
  const [msg, setMsg] = useState('');
  const id = `cl-${cl.index}`;
  return (
    <li data-testid={`cluster-${cl.index}`}>
      <h2>{cl.signature.length ? t('attend.labs.failing', { checks: cl.signature.join(', ') }) : t('attend.labs.allPass')}</h2>
      <p>{t('attend.labs.members', { n: cl.members.length })}{' '}<span translate="no">{cl.members.map((m: any) => m.name).join(', ')}</span></p>
      <form onSubmit={async (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        try {
          const r = await api<{ sent: number }>(`/api/classes/${classId}/lab-comments`, { method: 'POST', body: { attemptIds: cl.members.map((m: any) => m.attemptId), text } });
          setMsg(t('attend.labs.sent', { n: r.sent })); setText('');
        } catch { setMsg(t('attend.error')); }
      }}>
        <label htmlFor={id}>{t('attend.labs.comment')}</label>{' '}
        <input id={id} value={text} onChange={(e) => setText(e.target.value)} />{' '}
        <button type="submit">{t('attend.labs.send')}</button>
        <span role="status">{msg}</span>
      </form>
    </li>
  );
}

export default function Labs() {
  const { ctx } = useAttendCtx();
  const { data, error } = useData<{ clusters: any[] }>(ctx ? `/api/classes/${ctx.classId}/lab-clusters` : null, [ctx?.classId]);
  if (error) return <p role="alert">{t('attend.error')}</p>;
  return (
    <section aria-labelledby="lb-h">
      <h1 id="lb-h">{t('attend.labs.title')}</h1>
      <ul data-testid="lab-clusters">
        {(data?.clusters ?? []).map((cl) => <Cluster key={cl.index} classId={ctx!.classId} cl={cl} />)}
      </ul>
    </section>
  );
}
