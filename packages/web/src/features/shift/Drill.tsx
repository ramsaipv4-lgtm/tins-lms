// Leaked-key drill (AC-164, C-12): revoke, rotate, scrub history, report - in order.
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type D = { started: boolean; steps: string[]; done: string[]; complete: boolean };

export default function Drill() {
  const { data, reload } = usePoll<D>('/api/corp/drill', 3000);
  const { error, run } = useAction();
  return (
    <section aria-labelledby="kd-h" data-testid="key-drill" data-state={data?.complete ? 'done' : 'todo'}>
      <h1 id="kd-h">{t('shift.drill.title')}</h1>
      <p className="help">{t('shift.drill.intro')}</p>
      {data && !data.started && <p role="status">{t('shift.drill.notStarted')}</p>}
      {data?.started && <ol>
        {(data?.steps ?? []).map((s) => {
          const done = data!.done.includes(s);
          return (
            <li key={s}>
              {t(`shift.drill.${s}`)} {done ? <span className="sh-ok">{t('shift.drill.done')}</span>
                : <button type="button" onClick={() => run(async () => { await api('/api/corp/drill', { method: 'POST', body: { step: s } }); await reload(); })}>{t('shift.drill.mark', { step: t(`shift.drill.${s}`) })}</button>}
            </li>
          );
        })}
      </ol>}
      {data?.complete && <p role="status" className="sh-ok">{t('shift.drill.complete')}</p>}
      <ErrorNote error={error} />
    </section>
  );
}
