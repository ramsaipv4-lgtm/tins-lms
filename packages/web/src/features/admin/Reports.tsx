// AC-165: attendance sheet and completion report in the brand pack's layout (PDF and CSV), CO-PO attainment export.
import { useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import { ClassPicker, Msg, useLoad, type ClassRow } from './common.tsx';
import { Pdf, csv, download } from './pdf.ts';

interface Report {
  org: any; program: string; cohort: string; className: string; passMark: number; generatedAt: number;
  days: { index: number; date: string }[]; learners: { personId: string; name: string; rollNumber: string; status: string }[];
  attendance: Record<string, Record<string, { present: boolean; verified: boolean }>>;
  results: Record<string, { attempts: number; best: number | null; passed: boolean }>;
  attainment: { co: string; po: string; attempts: number; attained: number; pct: number }[];
}

export default function Reports() {
  const classes = useLoad<{ classes: ClassRow[] }>('/api/admin/classes');
  const [cid, setCid] = useState('');
  useEffect(() => { if (!cid && classes.data?.classes.length) setCid(classes.data.classes[0].id); }, [classes.data]);
  const rep = useLoad<Report>(cid ? `/api/admin/reports/${cid.split(':')[1]}` : null);
  const r = rep.data;
  const mark = (id: string, i: number) => { const a = r?.attendance[id]?.[i]; return a ? (a.verified ? 'P' : 'p') : '-'; };
  const pct = (id: string) => { const n = r?.days.length || 1; return Math.round(((r?.days.filter((d) => r.attendance[id]?.[d.index]).length ?? 0) / n) * 100); };
  const sub = () => `${r!.program} / ${r!.cohort} / ${r!.className}`;

  const attendanceRows = () => r!.learners.map((l) => [l.name, l.rollNumber || '-', ...r!.days.map((d) => mark(l.personId, d.index)), `${pct(l.personId)}%`]);
  const attendanceHead = () => [t('admin.reports.col.name'), t('admin.reports.col.roll'), ...r!.days.map((d) => `D${d.index + 1}`), t('admin.reports.col.pct')];
  const completionRows = () => r!.learners.map((l) => {
    const res = r!.results[l.personId];
    const done = pct(l.personId) >= 75 && !!res?.passed;
    return [l.name, `${pct(l.personId)}%`, res?.best === null || !res ? '-' : String(res.best), done ? t('admin.reports.completed') : t('admin.reports.notYet')];
  });
  const completionHead = () => [t('admin.reports.col.name'), t('admin.reports.col.attendance'), t('admin.reports.col.best'), t('admin.reports.col.status')];

  const pdfOf = (title: string, head: string[], rows: string[][], file: string) => {
    const p = new Pdf(r!.org, title, sub());
    p.table(head, rows, head.length > 5 ? [150, 70, ...head.slice(2).map(() => (595 - 96 - 220) / (head.length - 2))] : undefined);
    p.gap(); p.line(t('admin.reports.legend'), 9);
    download(file, p.build(), 'application/pdf');
  };
  const csvOf = (head: string[], rows: string[][], file: string) => download(file, csv([head, ...rows]), 'text/csv');

  const items: { key: string; run: () => void }[] = r ? [
    { key: 'attendancePdf', run: () => pdfOf(t('admin.reports.attendanceTitle'), attendanceHead(), attendanceRows(), 'attendance-sheet.pdf') },
    { key: 'attendanceCsv', run: () => csvOf(attendanceHead(), attendanceRows(), 'attendance-sheet.csv') },
    { key: 'completionPdf', run: () => pdfOf(t('admin.reports.completionTitle'), completionHead(), completionRows(), 'completion-report.pdf') },
    { key: 'completionCsv', run: () => csvOf(completionHead(), completionRows(), 'completion-report.csv') },
    { key: 'copo', run: () => csvOf(['CO', 'PO', t('admin.reports.col.attempts'), t('admin.reports.col.attained'), t('admin.reports.col.attainmentPct')], r.attainment.map((a) => [a.co, a.po, String(a.attempts), String(a.attained), `${a.pct}`]), 'co-po-attainment.csv') },
  ] : [];

  return (
    <section aria-labelledby="rep-h">
      <h1 id="rep-h">{t('admin.reports.title')}</h1>
      <p className="help">{t('admin.reports.intro')}</p>
      {classes.data && <ClassPicker classes={classes.data.classes} value={cid} onChange={setCid} label={t('admin.reports.class')} />}
      <Msg error={classes.error || rep.error} />
      <ul className="plain" style={{ listStyle: 'none', padding: 0 }}>
        {items.map((i) => <li key={i.key} style={{ margin: '8px 0' }}><button type="button" onClick={i.run}>{t(`admin.reports.${i.key}`)}</button></li>)}
      </ul>
    </section>
  );
}
