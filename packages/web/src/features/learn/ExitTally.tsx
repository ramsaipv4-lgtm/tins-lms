// Exit ticket tally (AC-92), trainer side: how many learners picked each choice today.
import { useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import { api } from '../../app/api.ts';
import { choiceLabel, type TicketData } from './ticket.ts';

export default function ExitTally() {
  const [data, setData] = useState<TicketData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () => { api<TicketData>('/api/learn/exit-ticket').then((d) => { if (live) setData(d); }).catch(() => { if (live) setError(true); }); };
    load();
    const id = setInterval(load, 3000);
    return () => { live = false; clearInterval(id); };
  }, []);
  if (error) return <p role="alert">{t('learn.error')}</p>;
  if (!data) return <p role="status">{t('learn.loading')}</p>;
  return (
    <section aria-labelledby="xl-h">
      <h1 id="xl-h">{t('learn.exit.tallyTitle', { n: data.day })}</h1>
      <p>{t('learn.exit.tallyIntro', { n: data.total })}</p>
      <ul data-testid="exit-tally" aria-label={t('learn.exit.tally')}>
        {data.choices.map((c) => <li key={c.id}>{choiceLabel(c)}: {c.count}</li>)}
      </ul>
      <h2>{t('learn.exit.comments')}</h2>
      {data.comments.length ? <ul>{data.comments.map((c, i) => <li key={i} translate="no">{c}</li>)}</ul> : <p>{t('learn.exit.noComments')}</p>}
    </section>
  );
}
