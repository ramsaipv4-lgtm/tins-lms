// Trainer: class feature switches that belong to this group (pair programming, AC-161).
import { useEffect, useRef, useState } from 'react';
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

export default function ClassSettings() {
  const { data, reload } = usePoll<{ pairProgramming: boolean }>('/api/shift/context', 3000);
  const { error, run } = useAction();
  const [on, setOn] = useState(false);
  const saving = useRef(false);
  // A poll answer that left the server before our save must not undo the click (integration I-12).
  useEffect(() => { if (data && !saving.current) setOn(data.pairProgramming); }, [data?.pairProgramming]);
  // No checkbox until the real state is known: a click on a placeholder "off" would be reverted by the first load.
  if (!data) return <section aria-labelledby="cs-h"><h1 id="cs-h">{t('shift.settings.title')}</h1><p role="status">{t('app.loading')}</p></section>;
  return (
    <section aria-labelledby="cs-h">
      <h1 id="cs-h">{t('shift.settings.title')}</h1>
      <div className="field check">
        <input id="cs-pair" type="checkbox" checked={on}
          onChange={(e) => { const v = e.target.checked; setOn(v); saving.current = true; void run(async () => { try { await api('/api/shift/settings', { method: 'POST', body: { pairProgramming: v } }); } finally { saving.current = false; } await reload(); }); }} />
        <label htmlFor="cs-pair">{t('shift.settings.pair')}</label>
      </div>
      <p className="help">{t('shift.settings.pairHelp')}</p>
      <ErrorNote error={error} />
    </section>
  );
}
