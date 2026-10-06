// Trainer: class feature switches that belong to this group (pair programming, AC-161).
import { useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

export default function ClassSettings() {
  const { data, reload } = usePoll<{ pairProgramming: boolean }>('/api/shift/context', 3000);
  const { error, run } = useAction();
  const [on, setOn] = useState(false);
  useEffect(() => { if (data) setOn(data.pairProgramming); }, [data?.pairProgramming]);
  return (
    <section aria-labelledby="cs-h">
      <h1 id="cs-h">{t('shift.settings.title')}</h1>
      <div className="field check">
        <input id="cs-pair" type="checkbox" checked={on}
          onChange={(e) => { const v = e.target.checked; setOn(v); void run(async () => { await api('/api/shift/settings', { method: 'POST', body: { pairProgramming: v } }); await reload(); }); }} />
        <label htmlFor="cs-pair">{t('shift.settings.pair')}</label>
      </div>
      <p className="help">{t('shift.settings.pairHelp')}</p>
      <ErrorNote error={error} />
    </section>
  );
}
