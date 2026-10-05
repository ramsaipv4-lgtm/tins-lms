// Admin: approve accommodation requests; the learner's timers then use the extended limit (AC-153).
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useLoad } from './lib.ts';

interface Req { id: string; name: string; timeMultiplier: number; reason: string; status: string }

export default function AAccommodations() {
  const { data, error, reload } = useLoad<{ requests: Req[] }>('/api/admin/classroom/accommodations', 4000);
  async function approve(id: string) {
    try { await api(`/api/admin/classroom/accommodations/${encodeURIComponent(id)}/approve`, { method: 'POST' }); } catch { /* shown by reload */ }
    await reload();
  }
  return (
    <section aria-labelledby="aa-h">
      <h1 id="aa-h">{t('classroom.acc.admin.title')}</h1>
      <p className="help">{t('classroom.acc.admin.intro')}</p>
      {error && !data && <p className="err" role="alert">{t('classroom.error')}</p>}
      {data && data.requests.length === 0 && <p>{t('classroom.acc.admin.none')}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {data?.requests.map((r) => (
          <li key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 12, margin: '8px 0' }}>
            <p style={{ margin: '0 0 8px' }}><span translate="no">{t('classroom.acc.admin.row', { name: r.name, n: r.timeMultiplier, reason: r.reason })}</span></p>
            {r.status === 'pending'
              ? <button type="button" onClick={() => void approve(r.id)}>{t('classroom.acc.admin.approve')}</button>
              : <span>{t(`classroom.acc.status.${r.status}`)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
