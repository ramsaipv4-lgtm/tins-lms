// AC-154: verbal syllabus. Admin types topic notes, the app drafts a syllabus, a confirmation PDF is produced
// for the college and every confirmed change lands in the cohort change log with its date.
import { useEffect, useRef, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { Msg, errText, useLoad } from './common.tsx';
import { Pdf, download } from './pdf.ts';

interface Cohort { id: string; name: string; programName: string }
interface Draft { days: { day: number; topics: string[] }[]; topics: string[] }
interface Info { cohort: Cohort; program: { name: string }; org: any; syllabus: { notes: string; days: Draft['days']; version: number } | null; changeLog: { date: string; summary: string }[] }

export default function Syllabus() {
  const cohorts = useLoad<{ cohorts: Cohort[] }>('/api/admin/cohorts');
  const [cohortId, setCohortId] = useState('');
  const info = useLoad<Info>(cohortId ? `/api/syllabus?cohortId=${encodeURIComponent(cohortId)}` : null);
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<Info['changeLog']>([]);
  const touched = useRef(false); // once the person typed or saved, a late server answer must not overwrite their work

  useEffect(() => { if (!cohortId && cohorts.data?.cohorts.length) setCohortId(cohorts.data.cohorts[0].id); }, [cohorts.data]);
  useEffect(() => {
    if (!info.data || touched.current) return;
    setLog(info.data.changeLog);
    if (info.data.syllabus) { setNotes(info.data.syllabus.notes); setDraft({ days: info.data.syllabus.days, topics: info.data.syllabus.days.flatMap((d) => d.topics) }); }
    else { setNotes(''); setDraft(null); }
  }, [info.data]);

  async function makeDraft() {
    setError(null); setStatus(null);
    try { setDraft(await api('/api/syllabus/draft', { body: { notes } })); } catch (e) { setError(errText(e)); }
  }
  async function save() {
    setError(null); setStatus(null);
    try {
      const r = await api<{ version: number; changeLog: Info['changeLog'] }>('/api/syllabus', { body: { cohortId, notes } });
      touched.current = true; setLog(r.changeLog); setStatus(t('admin.syllabus.saved', { version: r.version }));
    } catch (e) { setError(errText(e)); }
  }
  function pdf() {
    if (!draft || !info.data) return;
    const p = new Pdf(info.data.org, t('admin.syllabus.pdfTitle'), `${info.data.program.name} - ${info.data.cohort.name}`);
    p.line(t('admin.syllabus.pdfIntro'));
    p.gap();
    draft.days.forEach((d) => { p.line(t('admin.syllabus.day', { n: d.day }), 12, true); d.topics.forEach((x) => p.line(`- ${x}`)); p.gap(4); });
    if (log.length) { p.gap(); p.line(t('admin.syllabus.logHeading'), 12, true); log.forEach((l) => p.line(`${l.date}: ${l.summary}`)); }
    download('syllabus-confirmation.pdf', p.build(), 'application/pdf');
  }

  return (
    <section aria-labelledby="syl-h">
      <h1 id="syl-h">{t('admin.syllabus.title')}</h1>
      <p className="help">{t('admin.syllabus.intro')}</p>
      <div className="field">
        <label htmlFor="syl-cohort">{t('admin.syllabus.cohort')}</label>
        <select id="syl-cohort" value={cohortId} onChange={(e) => { touched.current = false; setCohortId(e.target.value); }}>
          {(cohorts.data?.cohorts ?? []).map((c) => <option key={c.id} value={c.id} translate="no">{c.programName} / {c.name}</option>)}
        </select>
      </div>
      <div className="field">
        <label htmlFor="syl-notes">{t('admin.syllabus.notes')}</label>
        <textarea id="syl-notes" rows={8} value={notes} onChange={(e) => { touched.current = true; setNotes(e.target.value); }} />
      </div>
      <div className="row">
        <button type="button" onClick={() => void makeDraft()} disabled={!notes.trim()}>{t('admin.syllabus.draft')}</button>
        <button type="button" onClick={pdf} disabled={!draft}>{t('admin.syllabus.pdf')}</button>
        <button type="button" onClick={() => void save()} disabled={!draft || !cohortId}>{t('admin.syllabus.save')}</button>
      </div>
      <Msg error={error || cohorts.error || info.error} status={status} />
      {draft && (
        <div data-testid="syllabus-draft" role="region" aria-labelledby="sd-h">
          <h2 id="sd-h">{t('admin.syllabus.draftHeading')}</h2>
          {draft.days.map((d) => (
            <div key={d.day}><h3>{t('admin.syllabus.day', { n: d.day })}</h3><ul>{d.topics.map((x, i) => <li key={i} translate="no">{x}</li>)}</ul></div>
          ))}
        </div>
      )}
      <div data-testid="change-log" role="region" aria-labelledby="cl-h">
        <h2 id="cl-h">{t('admin.syllabus.logHeading')}</h2>
        {log.length === 0 ? <p>{t('admin.syllabus.logEmpty')}</p> : (
          <ul>{log.map((l, i) => <li key={i}><time dateTime={l.date}>{l.date}</time> <span translate="no">{l.summary}</span></li>)}</ul>
        )}
      </div>
    </section>
  );
}
