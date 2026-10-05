// /teach/handover (AC-150): the substitute's handover pack; "Mark as read" tells the trainer it was seen.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { fmtDur, useClass } from './lib.tsx';

interface Pack {
  index: number; className: string;
  script: { sections: { id: string; title: string; plannedSec: number; text: string }[]; trainerNotes: string };
  boardPages: { id: string; title: string }[]; quickLearn: string;
  status: { enrolled: number; present: number; dayCount: number };
  atRisk: { id: string; name: string; level: string; reasons: string[] }[];
  learnerNotes: { id: string; text: string }[];
  substitution: { mode: string; substituteName: string; handoverReadAt: number | null } | null;
}

export default function Handover() {
  const { cls, ready } = useClass();
  const [days, setDays] = useState<number[]>([]);
  const [day, setDay] = useState<number | null>(null);
  const [pack, setPack] = useState<Pack | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!cls) return;
    api<{ substitutions: { dayIndex: number; mode: string }[] }>(`/api/tele/classes/${cls.id}/substitutions`)
      .then((r) => { const ds = r.substitutions.filter((s) => s.mode === 'substitute').map((s) => s.dayIndex); setDays(ds); setDay(ds[0] ?? null); })
      .catch(() => {});
  }, [cls?.id]);
  useEffect(() => {
    if (!cls || day === null) return;
    api<Pack>(`/api/tele/classes/${cls.id}/handover/${day}`).then(setPack).catch(() => setMsg(t('tele.err.generic')));
  }, [cls?.id, day]);

  if (!ready) return <p role="status">{t('app.loading')}</p>;
  if (!cls || day === null) return <><h1>{t('tele.hand.title')}</h1><p role="status">{t('tele.hand.none')}</p></>;

  async function markRead() {
    try {
      await api(`/api/tele/classes/${cls!.id}/handover/${day}/read`, { method: 'POST', body: {} });
      setPack((p) => (p && p.substitution ? { ...p, substitution: { ...p.substitution, handoverReadAt: Date.now() } } : p));
      setMsg(t('tele.hand.readDone'));
    } catch { setMsg(t('tele.err.generic')); }
  }
  const read = !!pack?.substitution?.handoverReadAt;
  return (
    <>
      <h1>{t('tele.hand.title')}</h1>
      {days.length > 1 && (
        <div className="field"><label htmlFor="ho-day">{t('tele.day.pick')}</label>
          <select id="ho-day" value={day} onChange={(e) => setDay(Number(e.target.value))}>{days.map((d) => <option key={d} value={d}>{t('tele.day.option', { n: d, date: '' })}</option>)}</select></div>
      )}
      {!pack && <p role="status">{t('app.loading')}</p>}
      {pack && (
        <section data-testid="handover-pack" aria-label={t('tele.hand.region', { n: pack.index })}>
          <h2>{t('tele.hand.script')}</h2>
          <ol>{pack.script.sections.map((s) => (
            <li key={s.id}><strong translate="no">{s.title}</strong> ({fmtDur(s.plannedSec)})
              <pre translate="no" style={{ whiteSpace: 'pre-wrap', font: 'inherit' }}>{s.text}</pre></li>))}</ol>
          <h2>{t('tele.hand.board')}</h2>
          {pack.boardPages.length ? <ul>{pack.boardPages.map((b) => <li key={b.id} translate="no">{b.title}</li>)}</ul> : <p>{t('tele.hand.noBoard')}</p>}
          <h2>{t('tele.hand.quick')}</h2>
          <pre translate="no" style={{ whiteSpace: 'pre-wrap', font: 'inherit' }}>{pack.quickLearn || t('tele.hand.noQuick')}</pre>
          <h2>{t('tele.hand.status')}</h2>
          <p>{t('tele.hand.statusLine', { enrolled: pack.status.enrolled, present: pack.status.present })}</p>
          <h2>{t('tele.hand.risk')}</h2>
          {pack.atRisk.length ? <ul>{pack.atRisk.map((l) => <li key={l.id}><span translate="no">{l.name}</span> {t(`tele.level.${l.level}`)}: {l.reasons.join(', ')}</li>)}</ul> : <p>{t('tele.hand.noRisk')}</p>}
          <h2>{t('tele.hand.notes')}</h2>
          <pre translate="no" style={{ whiteSpace: 'pre-wrap', font: 'inherit' }}>{pack.script.trainerNotes || t('tele.hand.noNotes')}</pre>
          {pack.learnerNotes.length > 0 && <ul>{pack.learnerNotes.map((n) => <li key={n.id} translate="no">{n.text}</li>)}</ul>}
          {read ? <p role="status">{t('tele.hand.isRead')}</p> : <button type="button" onClick={markRead}>{t('tele.hand.markRead')}</button>}
          {msg && <p role="status">{msg}</p>}
        </section>
      )}
    </>
  );
}
