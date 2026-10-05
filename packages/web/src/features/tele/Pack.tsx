// /teach/trainer-pack (AC-157): per day, the trainer's card deck, cheat sheet, command reference and likely questions.
import { useEffect, useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { DayPicker, useClass } from './lib.tsx';

interface PackData { hasPackage: boolean; deck: { front: string; back: string }[]; cheatSheet: string; commands: string[]; likelyQuestions: string[] }

export default function Pack() {
  const { cls, ready } = useClass();
  const [day, setDay] = useState<number | null>(null);
  const [p, setP] = useState<PackData | null>(null);
  const d = day ?? cls?.todayIndex ?? 0;
  useEffect(() => {
    if (!cls) return;
    setP(null);
    api<PackData>(`/api/tele/classes/${cls.id}/pack/${d}`).then(setP).catch(() => setP({ hasPackage: false, deck: [], cheatSheet: '', commands: [], likelyQuestions: [] }));
  }, [cls?.id, d]);
  if (!ready) return <p role="status">{t('app.loading')}</p>;
  if (!cls) return <p role="status">{t('tele.noClass')}</p>;
  const pre = { whiteSpace: 'pre-wrap' as const, font: 'inherit' };
  return (
    <>
      <h1>{t('tele.pack.title')}</h1>
      <DayPicker cls={cls} value={d} onChange={setDay} />
      {!p && <p role="status">{t('app.loading')}</p>}
      {p && (
        <section data-testid="trainer-pack" aria-label={t('tele.pack.region', { n: d })}>
          <h2>{t('tele.pack.deck')}</h2>
          {p.deck.length ? <ul>{p.deck.map((c) => <li key={c.front}><strong translate="no">{c.front}</strong><br /><span translate="no">{c.back}</span></li>)}</ul> : <p>{t('tele.pack.empty')}</p>}
          <h2>{t('tele.pack.cheat')}</h2>
          {p.cheatSheet ? <pre translate="no" style={pre}>{p.cheatSheet}</pre> : <p>{t('tele.pack.empty')}</p>}
          <h2>{t('tele.pack.commands')}</h2>
          {p.commands.length ? <ul>{p.commands.map((c) => <li key={c}><code translate="no">{c}</code></li>)}</ul> : <p>{t('tele.pack.empty')}</p>}
          <h2>{t('tele.pack.questions')}</h2>
          {p.likelyQuestions.length ? <ul>{p.likelyQuestions.map((q) => <li key={q} translate="no">{q}</li>)}</ul> : <p>{t('tele.pack.empty')}</p>}
        </section>
      )}
    </>
  );
}
