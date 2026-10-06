// Trainer: start the leaked-key drill and watch teams work through it (AC-164, C-12).
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type D = { started: boolean; total: number; teams: { team: string; done: number }[] };

export default function TeachDrills() {
  const { data, reload } = usePoll<D>('/api/corp/drill/overview', 3000);
  const { error, run } = useAction();
  return (
    <section aria-labelledby="td-h" data-testid="drills">
      <h1 id="td-h">{t('shift.nav.drills')}</h1>
      <p className="help">{t('shift.drill.trainerIntro')}</p>
      {data?.started
        ? <p role="status" className="sh-ok">{t('shift.drill.running')}</p>
        : <button type="button" onClick={() => run(async () => { await api('/api/corp/drill/start', { method: 'POST', body: {} }); await reload(); })}>{t('shift.drill.start')}</button>}
      <ul className="sh-list">{(data?.teams ?? []).map((x) => <li key={x.team}><span translate="no">{x.team}</span>: {t('shift.drill.progress', { done: x.done, total: data!.total })}</li>)}</ul>
      <ErrorNote error={error} />
    </section>
  );
}
