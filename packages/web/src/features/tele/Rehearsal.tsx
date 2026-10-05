// /teach/rehearsal (AC-158): run the teleprompter with pacing, then planned vs actual, then teach-back (AI on)
// or a self-check list (AI off), plus the freshness check of the day's lab commands.
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { pace } from '../../../../core/src/pace.ts';
import { Prompter, paceText, type TpEvent, type TpSection } from './Prompter.tsx';
import { DayPicker, fmtDur, useClass } from './lib.tsx';

interface Fresh { overall: string; results: { command: string; state: string }[] }
const CHECKS = ['tele.check.1', 'tele.check.2', 'tele.check.3', 'tele.check.4'];

export default function Rehearsal() {
  const { cls, ready } = useClass();
  const [day, setDay] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [report, setReport] = useState<{ rows: { id: string; title: string; plannedSec: number; actualSec: number | null; deltaSec: number | null }[]; behind: number } | null>(null);
  const [fresh, setFresh] = useState<Fresh | null>(null);
  const [saved, setSaved] = useState('');
  const [teachBack, setTeachBack] = useState('');
  const [checked, setChecked] = useState<string[]>([]);
  const [recId, setRecId] = useState('');
  if (!ready) return <p role="status">{t('app.loading')}</p>;
  if (!cls) return <p role="status">{t('tele.noClass')}</p>;
  const d = day ?? cls.todayIndex;

  async function finish(sections: TpSection[], events: TpEvent[], now: number) {
    const r = pace(sections.map((s) => ({ id: s.id, plannedSec: s.plannedSec })), events, now);
    const rows = sections.map((s, i) => ({ id: s.id, title: s.title, plannedSec: s.plannedSec, actualSec: r.perSection[i].actualSec, deltaSec: r.perSection[i].deltaSec }));
    setReport({ rows, behind: r.behindSec }); setRunning(false);
    let f: Fresh = { overall: 'not checked', results: [] };
    try { f = await api<Fresh>(`/api/tele/classes/${cls!.id}/freshness/${d}`); } catch { /* keep not checked */ }
    setFresh(f);
    try {
      const res = await api<{ id: string }>(`/api/tele/classes/${cls!.id}/rehearsals`, { method: 'POST', body: {
        dayIndex: d, rows: rows.map(({ id, plannedSec, actualSec, deltaSec }) => ({ id, plannedSec, actualSec, deltaSec })),
        behindSec: r.behindSec, followUp: cls!.aiOn ? 'teach-back' : 'self-check', freshness: f.overall,
      } });
      setRecId(res.id);
    } catch { setSaved(t('tele.err.generic')); }
  }
  async function saveFollow() {
    try {
      await api(`/api/tele/classes/${cls!.id}/rehearsals`, { method: 'POST', body: {
        id: recId, dayIndex: d, rows: report!.rows.map(({ id, plannedSec, actualSec, deltaSec }) => ({ id, plannedSec, actualSec, deltaSec })),
        behindSec: report!.behind, followUp: cls!.aiOn ? 'teach-back' : 'self-check', teachBack, selfCheck: checked, freshness: fresh?.overall,
      } });
      setSaved(t('tele.rehearsal.saved'));
    } catch { setSaved(t('tele.err.generic')); }
  }

  return (
    <>
      <h1>{t('tele.rehearsal.title')}</h1>
      {!running && !report && (
        <>
          <DayPicker cls={cls} value={d} onChange={setDay} />
          <p className="help">{t('tele.rehearsal.intro')}</p>
          <button type="button" onClick={() => { setStartedAt(Date.now()); setRunning(true); }}>{t('tele.rehearsal.start')}</button>
        </>
      )}
      {running && <Prompter cls={cls} dayIndex={d} rehearsal startedAt={startedAt} onFinish={finish} />}
      {report && (
        <>
          <section data-testid="rehearsal-report" aria-label={t('tele.rehearsal.reportRegion')}>
            <h2>{t('tele.rehearsal.report')}</h2>
            <p>{paceText(report.behind)}</p>
            <table>
              <thead><tr><th scope="col">{t('tele.col.section')}</th><th scope="col">{t('tele.col.planned')}</th><th scope="col">{t('tele.col.actual')}</th><th scope="col">{t('tele.col.delta')}</th></tr></thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.id} data-section={r.id}>
                    <td translate="no">{r.title}</td><td>{fmtDur(r.plannedSec)}</td>
                    <td>{r.actualSec == null ? t('tele.notEntered') : fmtDur(r.actualSec)}</td>
                    <td>{r.deltaSec == null ? t('tele.notEntered') : `${r.deltaSec > 0 ? '+' : r.deltaSec < 0 ? '-' : ''}${fmtDur(r.deltaSec)}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section>
            <h2>{t('tele.fresh.title')}</h2>
            <p>{t('tele.fresh.result', { r: t(`tele.fresh.${(fresh?.overall ?? 'not checked').replace(' ', '_')}`) })}</p>
            <ul>{(fresh?.results ?? []).map((r) => <li key={r.command}><code translate="no">{r.command}</code> {t(`tele.fresh.${r.state}`)}</li>)}</ul>
          </section>
          {cls.aiOn ? (
            <section>
              <h2>{t('tele.teachback.title')}</h2>
              <div className="field"><label htmlFor="tb">{t('tele.teachback.label')}</label>
                <textarea id="tb" rows={5} value={teachBack} onChange={(e) => setTeachBack(e.target.value)} /></div>
              <button type="button" onClick={saveFollow}>{t('tele.rehearsal.save')}</button>
            </section>
          ) : (
            <section>
              <h2>{t('tele.selfcheck.title')}</h2>
              {CHECKS.map((k) => (
                <div className="field check" key={k}>
                  <input id={k} type="checkbox" checked={checked.includes(k)} onChange={(e) => setChecked((o) => (e.target.checked ? [...o, k] : o.filter((x) => x !== k)))} />
                  <label htmlFor={k}>{t(k)}</label>
                </div>
              ))}
              <button type="button" onClick={saveFollow}>{t('tele.rehearsal.save')}</button>
            </section>
          )}
          {saved && <p role="status">{saved}</p>}
          <button type="button" onClick={() => { setReport(null); setFresh(null); setSaved(''); setChecked([]); setTeachBack(''); }}>{t('tele.rehearsal.again')}</button>
        </>
      )}
    </>
  );
}
