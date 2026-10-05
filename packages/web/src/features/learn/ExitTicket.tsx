// Exit ticket (AC-92, B-1), learner side: pick pre-generated choices and add words of your own.
import { useEffect, useState, type FormEvent } from 'react';
import { t } from '../../strings/index.ts';
import { api } from '../../app/api.ts';
import { choiceLabel, type TicketData } from './ticket.ts';

export default function ExitTicket() {
  const [data, setData] = useState<TicketData | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api<TicketData>('/api/learn/exit-ticket').then((d) => { setData(d); setSent(d.submitted); }).catch(() => setError(true)); }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try { await api('/api/learn/exit-ticket', { body: { choiceIds: picked, text } }); setSent(true); }
    catch { setError(true); }
    setBusy(false);
  }

  if (error) return <p role="alert">{t('learn.error')}</p>;
  if (!data) return <p role="status">{t('learn.loading')}</p>;
  return (
    <section aria-labelledby="xt-h">
      <h1 id="xt-h">{t('learn.exit.title')}</h1>
      {sent ? (
        <>
          <p role="status">{t('learn.exit.thanks')}</p>
          <button type="button" onClick={() => setSent(false)}>{t('learn.exit.again')}</button>
        </>
      ) : (
        <form onSubmit={submit}>
          <fieldset>
            <legend>{t('learn.exit.intro')}</legend>
            {data.choices.map((c) => (
              <div className="field check" key={c.id}>
                <input id={`xt-${c.id}`} type="checkbox" checked={picked.includes(c.id)}
                  onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))} />
                <label htmlFor={`xt-${c.id}`}>{choiceLabel(c)}</label>
              </div>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="xt-text">{t('learn.exit.field')}</label>
            <textarea id="xt-text" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <button type="submit" disabled={busy}>{t('learn.exit.submit')}</button>
        </form>
      )}
    </section>
  );
}
