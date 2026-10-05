// /learn/today (AC-83): the learner's day page. Polls the day; a section appears (decrypted in the browser with its
// released key, D-38) as soon as the trainer reaches it, without a reload.
import { useRef, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { openSection } from '../../../../core/src/release.ts';
import { DayPicker, usePoll, useClass } from './lib.tsx';
import { SelfLearn } from './SelfLearn.tsx';
import AttendToday from '../attend/LToday.tsx'; // integration: wrap-up material (board PDF, quick-learn) on the same page

interface Sec { id: string; title: string; graded: boolean; sealed: string; key?: string }
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export default function Today() {
  const { cls, ready } = useClass();
  const [day, setDay] = useState<number | null>(null);
  const [secs, setSecs] = useState<Sec[]>([]);
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [err, setErr] = useState(false);
  const done = useRef(new Set<string>());
  const d = day ?? cls?.todayIndex ?? 0;

  usePoll(async () => {
    if (!cls) return;
    try {
      const r = await api<{ sections: Sec[] }>(`/api/tele/classes/${cls.id}/days/${d}`);
      setSecs(r.sections); setErr(false);
      for (const s of r.sections) {
        const k = `${d}.${s.id}`;
        if (!s.key || done.current.has(k)) continue;
        done.current.add(k);
        try {
          const text = new TextDecoder().decode(await openSection(unb64(s.key), unb64(s.sealed)));
          setTexts((o) => ({ ...o, [k]: text }));
        } catch { done.current.delete(k); }
      }
    } catch { setErr(true); }
  }, 2000, [cls?.id, d]);

  if (!ready) return <p role="status">{t('app.loading')}</p>;
  if (!cls) return <p role="status">{t('tele.noClass')}</p>;
  const released = secs.filter((s) => s.key);
  const locked = secs.filter((s) => !s.key);
  return (
    <>
      <h1>{t('tele.today.title', { n: d })}</h1>
      <DayPicker cls={cls} value={d} onChange={setDay} />
      {err && <p role="alert" className="err">{t('tele.err.generic')}</p>}
      {cls.days.find((x) => x.index === d)?.mode === 'self-learn' && <SelfLearn cls={cls} dayIndex={d} />}
      {released.length === 0 && <p role="status">{t('tele.today.none')}</p>}
      {released.map((s) => (
        <article key={s.id} data-testid={`section-${s.id}`}>
          <h2 translate="no">{s.title}</h2>
          <pre translate="no" style={{ whiteSpace: 'pre-wrap', font: 'inherit' }}>{texts[`${d}.${s.id}`] ?? t('app.loading')}</pre>
        </article>
      ))}
      {locked.length > 0 && (
        <>
          <h2>{t('tele.today.locked')}</h2>
          <ul>{locked.map((s) => <li key={s.id}><span translate="no">{s.title}</span> {t('tele.today.lockedHint')}</li>)}</ul>
        </>
      )}
      <AttendToday embedded />
    </>
  );
}
