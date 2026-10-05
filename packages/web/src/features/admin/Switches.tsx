// AC-169 and P-14: organisation-wide feature switches. Google opt-ins (calendar sync, Google Forms) are off by default.
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { Msg, errText, useLoad } from './common.tsx';

export default function Switches() {
  const d = useLoad<{ switches: Record<string, boolean> }>('/api/admin/switches');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, boolean>>({});
  async function toggle(name: string, on: boolean) {
    setError(null); setStatus(null); setLocal((l) => ({ ...l, [name]: on }));
    try { await api('/api/admin/switches', { method: 'PUT', body: { name, on } }); setStatus(t('admin.switches.saved')); d.reload(); }
    catch (e) { setError(errText(e)); setLocal((l) => { const n = { ...l }; delete n[name]; return n; }); }
  }
  return (
    <section aria-labelledby="sw-h">
      <h1 id="sw-h">{t('admin.switches.title')}</h1>
      <p className="help">{t('admin.switches.intro')}</p>
      <Msg error={error || d.error} status={status} />
      {d.data && Object.entries(d.data.switches).sort(([a], [b]) => a.localeCompare(b)).map(([name, on]) => (
        <div className="field check" key={name}>
          <input id={`sw-${name}`} type="checkbox" checked={local[name] ?? on} onChange={(e) => void toggle(name, e.target.checked)} />
          <label htmlFor={`sw-${name}`}>{t(`admin.switch.${name}`)}</label>
        </div>
      ))}
    </section>
  );
}
