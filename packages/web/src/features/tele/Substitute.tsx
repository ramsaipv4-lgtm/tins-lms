// /teach/substitute (AC-150, AC-151): "I can't take day N", pick a substitute or self-learn mode.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useClass } from './lib.tsx';
import { SelfLearn } from './SelfLearn.tsx';

interface Sub { dayIndex: number; mode: string; substituteName: string; handoverReadAt: number | null }

export default function Substitute() {
  const { cls, ready } = useClass();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [day, setDay] = useState<number | null>(null);
  const [choice, setChoice] = useState('');
  const [msg, setMsg] = useState('');
  const [shown, setShown] = useState<number | null>(null);

  const load = async (id: string) => {
    const r = await api<{ substitutions: Sub[] }>(`/api/tele/classes/${id}/substitutions`);
    setSubs(r.substitutions);
  };
  useEffect(() => {
    if (!cls) return;
    void load(cls.id).catch(() => {});
    api<{ substitutes: { id: string; name: string }[] }>('/api/tele/substitutes').then((r) => setPeople(r.substitutes)).catch(() => {});
  }, [cls?.id]);

  if (!ready) return <p role="status">{t('app.loading')}</p>;
  if (!cls) return <p role="status">{t('tele.noClass')}</p>;

  async function confirm() {
    if (day === null) return;
    if (!choice) { setMsg(t('tele.sub.pickFirst')); return; }
    try {
      await api(`/api/tele/classes/${cls!.id}/substitution`, { method: 'POST', body: choice === 'self-learn'
        ? { dayIndex: day, mode: 'self-learn' } : { dayIndex: day, mode: 'substitute', substituteId: choice } });
      const who = choice === 'self-learn' ? t('tele.sub.selfLearnName') : people.find((p) => p.id === choice)?.name ?? '';
      setMsg(t('tele.sub.saved', { n: day, who }));
      if (choice === 'self-learn') setShown(day);
      setDay(null); setChoice('');
      await load(cls!.id);
    } catch { setMsg(t('tele.err.generic')); }
  }

  return (
    <>
      <h1>{t('tele.sub.title')}</h1>
      <p className="help">{t('tele.sub.intro')}</p>
      <ul className="row" style={{ listStyle: 'none', padding: 0 }}>
        {cls.days.map((d) => (
          <li key={d.index}><button type="button" onClick={() => { setDay(d.index); setMsg(''); }}>{t('tele.sub.cant', { n: d.index })}</button></li>
        ))}
      </ul>
      {day !== null && (
        <form onSubmit={(e) => { e.preventDefault(); void confirm(); }}>
          <div className="field">
            <label htmlFor="sub-pick">{t('tele.sub.field')}</label>
            <select id="sub-pick" value={choice} onChange={(e) => setChoice(e.target.value)}>
              <option value="">{t('tele.sub.choose')}</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="self-learn">{t('tele.sub.selfLearn')}</option>
            </select>
          </div>
          <button type="submit">{t('tele.sub.confirm', { n: day })}</button>
        </form>
      )}
      {msg && <p role="status">{msg}</p>}
      {subs.length > 0 && (
        <>
          <h2>{t('tele.sub.listTitle')}</h2>
          <ul>
            {subs.map((s) => (
              <li key={s.dayIndex}>
                {t('tele.sub.row', { n: s.dayIndex, who: s.mode === 'self-learn' ? t('tele.sub.selfLearnName') : s.substituteName })}{' '}
                {s.mode === 'substitute' && <span>{t(s.handoverReadAt ? 'tele.sub.read' : 'tele.sub.unread')}</span>}{' '}
                {s.mode === 'self-learn' && <button type="button" onClick={() => setShown(s.dayIndex)}>{t('tele.sub.open', { n: s.dayIndex })}</button>}
              </li>
            ))}
          </ul>
        </>
      )}
      {shown !== null && <SelfLearn cls={cls} dayIndex={shown} />}
    </>
  );
}
