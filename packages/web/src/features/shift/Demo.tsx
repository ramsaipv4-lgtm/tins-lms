// Demo day presentation slots (AC-164, C-9): one slot per team.
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type D = { team: string; mine: string | null; slots: { slot: string; team: string | null }[] };

export default function Demo() {
  const { data, reload } = usePoll<D>('/api/corp/demo', 3000);
  const { error, run } = useAction();
  return (
    <section aria-labelledby="dm-h" data-testid="demo-day">
      <h1 id="dm-h">{t('shift.demo.title')}</h1>
      <p role="status">{data?.mine ? t('shift.demo.mine', { slot: data.mine }) : t('shift.demo.none')}</p>
      <ul className="sh-list">
        {(data?.slots ?? []).map((s) => (
          <li key={s.slot} className="sh-card">
            <span className="sh-timer">{s.slot}</span> · {s.team ? <span translate="no">{s.team}</span> : t('shift.demo.free')}
            {(!s.team || s.team === data?.team) && s.team !== data?.team && <> <button type="button" onClick={() => run(async () => { await api('/api/corp/demo', { method: 'POST', body: { slot: s.slot } }); await reload(); })}>{t('shift.demo.book', { slot: s.slot })}</button></>}
          </li>
        ))}
      </ul>
      <ErrorNote error={error} />
    </section>
  );
}
