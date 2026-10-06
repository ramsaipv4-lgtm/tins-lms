// Trainer: approve or reject change requests (AC-164, C-4).
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type CR = { id: string; summary: string; rollback: string; status: string; by: string };

export default function Approvals() {
  const { data, reload } = usePoll<CR[]>('/api/corp/change-requests', 3000);
  const { error, run } = useAction();
  const decide = (id: string, approve: boolean) => run(async () => { await api(`/api/corp/change-requests/${encodeURIComponent(id)}/decide`, { method: 'POST', body: { approve } }); await reload(); });
  return (
    <section aria-labelledby="ap-h">
      <h1 id="ap-h">{t('shift.approve.title')}</h1>
      {data && data.length === 0 && <p>{t('shift.approve.none')}</p>}
      <ul className="sh-list">
        {(data ?? []).map((c) => (
          <li key={c.id} className="sh-card">
            <strong translate="no">{c.summary}</strong> <span className="chip">{t(`shift.cr.${c.status}`)}</span>
            <p>{t('shift.approve.by')} <span translate="no">{c.by}</span> · {t('shift.deploy.rollbackLine')} <span translate="no">{c.rollback}</span></p>
            {c.status === 'pending' && (
              <div className="row">
                <button type="button" onClick={() => decide(c.id, true)}>{t('shift.approve.approve')}</button>
                <button type="button" onClick={() => decide(c.id, false)}>{t('shift.approve.reject')}</button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <ErrorNote error={error} />
    </section>
  );
}
