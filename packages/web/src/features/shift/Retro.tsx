// Retro board (AC-87): items in two columns; any item becomes a ticket.
import { useState, type FormEvent } from 'react';
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type Item = { id: string; text: string; column: 'well' | 'improve'; ticketId: string | null };

export default function Retro() {
  const { data, reload } = usePoll<Item[]>('/api/rituals/retro', 3000);
  const [text, setText] = useState('');
  const [column, setColumn] = useState('well');
  const { error, run } = useAction();
  const add = (e: FormEvent) => { e.preventDefault(); if (!text.trim()) return; void run(async () => { await api('/api/rituals/retro', { method: 'POST', body: { text, column } }); setText(''); await reload(); }); };
  const makeTicket = () => { if (!text.trim()) return; void run(async () => { const it: any = await api('/api/rituals/retro', { method: 'POST', body: { text, column } }); await api(`/api/rituals/retro/${encodeURIComponent(it.id)}/ticket`, { method: 'POST', body: {} }); setText(''); await reload(); }); };
  return (
    <section aria-labelledby="rt-h">
      <h1 id="rt-h">{t('shift.retro.title')}</h1>
      <form onSubmit={add} className="sh-form">
        <div className="field"><label htmlFor="rt-t">{t('shift.retro.item')}</label><input id="rt-t" value={text} onChange={(e) => setText(e.target.value)} /></div>
        <div className="field"><label htmlFor="rt-c">{t('shift.retro.column')}</label>
          <select id="rt-c" value={column} onChange={(e) => setColumn(e.target.value)}>
            <option value="well">{t('shift.retro.well')}</option><option value="improve">{t('shift.retro.improve')}</option>
          </select></div>
        <div className="row">
          <button type="submit">{t('shift.retro.add')}</button>
          <button type="button" onClick={makeTicket}>{t('shift.retro.ticket')}</button>
        </div>
      </form>
      <ul className="sh-list">
        {(data ?? []).map((i) => (
          <li key={i.id} className="sh-card">
            <span className="chip">{t(`shift.retro.${i.column}`)}</span> <span translate="no">{i.text}</span>
            {i.ticketId
              ? <p role="status" className="sh-ok">{t('shift.retro.made')}</p>
              : <div><button type="button" onClick={() => run(async () => { await api(`/api/rituals/retro/${encodeURIComponent(i.id)}/ticket`, { method: 'POST', body: {} }); await reload(); })}>{t('shift.retro.itemTicket')}</button></div>}
          </li>
        ))}
      </ul>
      <ErrorNote error={error} />
    </section>
  );
}
