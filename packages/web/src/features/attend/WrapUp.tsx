// Trainer: one-tap wrap-up (A-1) (AC-89).
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useAttendCtx } from './lib.ts';

export default function WrapUp() {
  const { ctx, error, reload } = useAttendCtx();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  if (error) return <p role="alert">{t('attend.error')}</p>;
  if (!ctx) return <p role="status">{t('app.loading')}</p>;
  async function go() {
    setBusy(true);
    try {
      await api(`/api/classes/${ctx!.classId}/wrap-up`, { method: 'POST', body: { day: ctx!.day } });
      setMsg(t('attend.wrap.done', { day: ctx!.day })); await reload();
    } catch { setMsg(t('attend.error')); }
    setBusy(false);
  }
  return (
    <section aria-labelledby="wu-h">
      <h1 id="wu-h">{t('attend.wrap.title', { day: ctx.day })}</h1>
      <p>{t('attend.wrap.help')}</p>
      <button type="button" data-testid="wrap-up" disabled={busy} onClick={go}>{t('attend.wrap.button')}</button>
      <p role="status">{ctx.closed && !msg ? t('attend.wrap.alreadyDone', { day: ctx.day }) : msg}</p>
    </section>
  );
}
