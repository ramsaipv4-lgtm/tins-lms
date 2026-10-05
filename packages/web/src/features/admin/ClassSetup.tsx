// AC-80: create program, cohort and class, upload the package, read the gate report, publish, see the schedule.
import { useState, type FormEvent } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { tarPack } from '../../../../core/src/export.ts';
import { Msg, errText } from './common.tsx';

interface Check { id: string; pass: boolean; waived: boolean; detail: string }
interface Uploaded { id: string; status: string; checks: Check[] }
interface Sched { name: string; schedule: { index: number; date: string; start: string; end: string; sections: { id: string; title: string }[] }[] }

export default function ClassSetup() {
  const [form, setForm] = useState({ program: '', cohort: '', className: '', startDate: '' });
  const [created, setCreated] = useState<{ classId: string } | null>(null);
  const [pkg, setPkg] = useState<Uploaded | null>(null);
  const [sched, setSched] = useState<Sched | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function create(e: FormEvent) {
    e.preventDefault(); setError(null); setBusy(true);
    try { setCreated(await api('/api/admin/setup-class', { body: form })); }
    catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }

  async function upload(files: FileList | null) {
    if (!files || !files.length || !created) return;
    setError(null); setBusy(true); setPkg(null);
    try {
      let bytes: Uint8Array;
      if (files.length === 1) bytes = new Uint8Array(await files[0].arrayBuffer());
      else {
        const entries = [];
        for (const f of Array.from(files)) entries.push({ path: (f as any).webkitRelativePath || f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
        bytes = tarPack(entries);
      }
      const res = await fetch(`/api/packages?classId=${encodeURIComponent(created.classId)}`, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/x-tar' }, body: bytes as BodyInit });
      if (!res.ok) throw new Error(String(res.status));
      setPkg(await res.json());
    } catch { setError(t('admin.setup.uploadFailed')); } finally { setBusy(false); }
  }

  async function publish() {
    if (!created || !pkg) return;
    setError(null); setBusy(true);
    try {
      await api(`/api/admin/classes/${created.classId.split(':')[1]}/fit-schedule`, { body: { packageId: pkg.id } });
      await api(`/api/packages/${pkg.id}/publish?classId=${encodeURIComponent(created.classId)}`, { body: { classId: created.classId } });
      setSched(await api(`/api/staff/classes/${created.classId.split(':')[1]}/schedule`));
    } catch (err) { setError(errText(err)); } finally { setBusy(false); }
  }

  const ok = pkg ? pkg.checks.every((c) => c.pass || c.waived) : false;
  return (
    <section aria-labelledby="setup-h">
      <h1 id="setup-h">{t('admin.setup.title')}</h1>
      <p className="help">{t('admin.setup.intro')}</p>
      <form onSubmit={create}>
        <div className="field"><label htmlFor="su-program">{t('admin.setup.program')}</label><input id="su-program" required value={form.program} onChange={set('program')} disabled={!!created} /></div>
        <div className="field"><label htmlFor="su-cohort">{t('admin.setup.cohort')}</label><input id="su-cohort" required value={form.cohort} onChange={set('cohort')} disabled={!!created} /></div>
        <div className="field"><label htmlFor="su-class">{t('admin.setup.className')}</label><input id="su-class" required value={form.className} onChange={set('className')} disabled={!!created} /></div>
        <div className="field"><label htmlFor="su-start">{t('admin.setup.startDate')}</label><input id="su-start" type="date" required value={form.startDate} onChange={set('startDate')} disabled={!!created} /></div>
        <button type="submit" data-testid="create-class" disabled={busy || !!created}>{t('admin.setup.create')}</button>
      </form>
      <Msg error={error} status={created && !pkg ? t('admin.setup.created') : null} />
      {created && !sched && (
        <div>
          <h2>{t('admin.setup.packageHeading')}</h2>
          <div className="field">
            <label htmlFor="su-package">{t('admin.setup.packageFile')}</label>
            <input id="su-package" type="file" multiple onChange={(e) => void upload(e.target.files)} />
          </div>
        </div>
      )}
      {pkg && (
        <div data-testid="gate-report" role="region" aria-labelledby="gate-h">
          <h2 id="gate-h">{t('admin.gate.title')}</h2>
          <p role="status">{ok ? t('admin.gate.allPass') : t('admin.gate.someFail')}</p>
          <ul className="checks">
            {pkg.checks.map((c) => {
              const state = c.waived ? 'waived' : c.pass ? 'pass' : 'fail';
              return (
                <li key={c.id} data-testid={`gate-check-${c.id}`} data-state={state} className={state === 'fail' ? 'fail' : 'pass'}>
                  <strong>{t(`admin.gate.state.${state}`)}</strong> <span translate="no">{c.id}</span> <span translate="no">{c.detail}</span>
                </li>
              );
            })}
          </ul>
          {!sched && <button type="button" onClick={() => void publish()} disabled={!ok || busy}>{t('admin.setup.publish')}</button>}
        </div>
      )}
      {sched && (
        <div data-testid="class-schedule" role="region" aria-labelledby="sched-h">
          <h2 id="sched-h">{t('admin.setup.scheduleHeading', { name: sched.name })}</h2>
          <p role="status">{t('admin.setup.published')}</p>
          <ol>
            {sched.schedule.map((d) => (
              <li key={d.index} data-testid={`schedule-day-${d.index}`}>
                {t('admin.schedule.day', { n: d.index + 1, date: d.date, start: d.start, end: d.end })}
                {d.sections.length > 0 && <> {t('admin.schedule.sections', { n: d.sections.length })}</>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
