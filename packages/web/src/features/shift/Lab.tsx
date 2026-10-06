// Lab with pair programming (AC-161, B-4): paired names and a 15-minute swap timer when the switch is on.
import { t } from '../../strings/index.ts';
import { ErrorNote, api, mmss, useAction, usePoll } from './lib.tsx';

type Ctx = { pairProgramming: boolean };
type Pair = { members: string[]; driver: string; navigator: string; leftMs: number; swapMs: number };

function PairPanel() {
  const { data, reload } = usePoll<Pair>('/api/shift/pair', 1000);
  const { error, run } = useAction();
  if (!data) return <p role="status">{t('app.loading')}</p>;
  return (
    <div data-testid="pair-panel">
      <p>{t('shift.lab.pair')} <strong translate="no">{data.members.join(' + ')}</strong></p>
      <p>{t('shift.lab.roles', { driver: data.driver, navigator: data.navigator })}</p>
      <p data-testid="pair-timer" aria-live="off">{t('shift.lab.swapIn')} <span className="sh-timer">{mmss(data.leftMs)}</span> {t('shift.lab.of', { min: Math.round(data.swapMs / 60000) })}
        {data.leftMs === 0 && <> <span className="chip">{t('shift.lab.swapNow')}</span></>}</p>
      <button type="button" onClick={() => run(async () => { await api('/api/shift/pair/swap', { method: 'POST', body: {} }); await reload(); })}>{t('shift.lab.swap')}</button>
      <ErrorNote error={error} />
    </div>
  );
}

export default function Lab() {
  const { data } = usePoll<Ctx>('/api/shift/context', 3000);
  return (
    <section aria-labelledby="lb-h">
      <h1 id="lb-h">{t('shift.lab.title')}</h1>
      {data && (data.pairProgramming ? <PairPanel /> : <p>{t('shift.lab.off')}</p>)}
    </section>
  );
}
