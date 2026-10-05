// Learner: enter the rotating (or printed) attendance code (AC-82).
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useAttendCtx } from './lib.ts';

export default function LAttendance() {
  const { ctx, error } = useAttendCtx();
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'present' | 'invalid' | 'closed' | 'fail'>('idle');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ctx) return;
    if (ctx.closed) { setState('closed'); return; }
    try {
      await api('/api/attend/mark', { method: 'POST', body: { code: code.trim() } });
      setState('present');
    } catch (err) {
      setState(err instanceof ApiError && err.status === 400 ? 'invalid' : err.status === 409 ? 'closed' : 'fail');
    }
  }
  if (error) return <p role="alert">{t('attend.error')}</p>;
  if (!ctx) return <p role="status">{t('app.loading')}</p>;
  return (
    <section aria-labelledby="la-h">
      <h1 id="la-h">{t('attend.l.title', { day: ctx.day })}</h1>
      {ctx.closed && <p role="status">{t('attend.l.closed')}</p>}
      <form onSubmit={submit}>
        <label htmlFor="att-code">{t('attend.l.codeLabel')}</label>{' '}
        <input id="att-code" data-testid="attendance-input" inputMode="numeric" autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} />{' '}
        <button type="submit">{t('attend.l.submit')}</button>
      </form>
      <p role="status" aria-live="polite">
        {state === 'present' && t('attend.l.present')}
        {state === 'invalid' && t('attend.l.invalid')}
        {state === 'closed' && t('attend.l.closed')}
        {state === 'fail' && t('attend.error')}
      </p>
    </section>
  );
}
