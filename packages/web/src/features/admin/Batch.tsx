// Coordinator read-only batch view (D-30): who attended how much. No controls change anything.
import { useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import { ClassPicker, Msg, useLoad, type ClassRow } from './common.tsx';

export default function Batch() {
  const classes = useLoad<{ classes: ClassRow[] }>('/api/staff/classes');
  const [cid, setCid] = useState('');
  useEffect(() => { if (!cid && classes.data?.classes.length) setCid(classes.data.classes[0].id); }, [classes.data]);
  const b = useLoad<{ className: string; cohort: string; program: string; rows: { personId: string; name: string; status: string; present: number; total: number }[] }>(cid ? `/api/batch/${cid.split(':')[1]}` : null);
  return (
    <section aria-labelledby="bt-h">
      <h1 id="bt-h">{t('admin.batch.title')}</h1>
      <p className="help">{t('admin.batch.readonly')}</p>
      {classes.data && <ClassPicker classes={classes.data.classes} value={cid} onChange={setCid} label={t('admin.reports.class')} />}
      <Msg error={classes.error || b.error} />
      {b.data && (
        <table data-testid="batch-view">
          <caption>{t('admin.batch.caption', { cohort: b.data.cohort })}</caption>
          <thead><tr><th scope="col">{t('admin.reports.col.name')}</th><th scope="col">{t('admin.reports.col.status')}</th><th scope="col">{t('admin.reports.col.attendance')}</th></tr></thead>
          <tbody>{b.data.rows.map((r) => (
            <tr key={r.personId}><td translate="no">{r.name}</td><td>{t(`admin.batch.status.${r.status}`)}</td><td>{r.present}/{r.total}</td></tr>
          ))}</tbody>
        </table>
      )}
    </section>
  );
}
