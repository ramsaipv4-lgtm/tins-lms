// Stand-up bot (AC-87): three answers, a team summary with blocked answers highlighted.
import { useState, type FormEvent } from 'react';
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type Entry = { id: string; name: string; yesterday: string; today: string; blockers: string; blocked: boolean };

export function Summary({ data }: { data: Entry[] | null }) {
  return (
    <>
      <h2>{t('shift.standup.summary')}</h2>
      <div data-testid="standup-summary" data-blocked={String(!!data?.some((x) => x.blocked))}>
        {data && data.length === 0 && <p>{t('shift.standup.none')}</p>}
        <ul className="sh-list">
          {(data ?? []).map((e) => (
            <li key={e.id} className="sh-card sh-blocked" data-blocked={String(e.blocked)}>
              <strong translate="no">{e.name}</strong>
              <p>{t('shift.standup.didY')} <span translate="no">{e.yesterday}</span></p>
              <p>{t('shift.standup.doT')} <span translate="no">{e.today}</span></p>
              <p>{t('shift.standup.blk')} {e.blocked ? <mark translate="no">{e.blockers}</mark> : <span translate="no">{e.blockers || t('shift.standup.noBlk')}</span>}
                {e.blocked && <> <span className="chip">{t('shift.standup.blockedFlag')}</span></>}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default function Standup() {
  const { data, reload } = usePoll<Entry[]>('/api/rituals/standup', 3000);
  const [f, setF] = useState({ yesterday: '', today: '', blockers: '' });
  const { error, run } = useAction();
  const submit = (e: FormEvent) => { e.preventDefault(); void run(async () => { await api('/api/rituals/standup', { method: 'POST', body: f }); setF({ yesterday: '', today: '', blockers: '' }); await reload(); }); };
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <section aria-labelledby="su-h">
      <h1 id="su-h">{t('shift.standup.title')}</h1>
      <form onSubmit={submit} className="sh-form">
        <div className="field"><label htmlFor="su-y">{t('shift.standup.yesterday')}</label><input id="su-y" value={f.yesterday} onChange={set('yesterday')} /></div>
        <div className="field"><label htmlFor="su-t">{t('shift.standup.today')}</label><input id="su-t" value={f.today} onChange={set('today')} /></div>
        <div className="field"><label htmlFor="su-b">{t('shift.standup.blockers')}</label><input id="su-b" value={f.blockers} onChange={set('blockers')} /></div>
        <button type="submit">{t('shift.standup.post')}</button>
        <ErrorNote error={error} />
      </form>
      <Summary data={data} />
    </section>
  );
}
