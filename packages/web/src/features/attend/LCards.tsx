// Learner: number of cards due now, including the cards the wrap-up published (AC-89).
import { useState } from 'react';
import { api } from '../../app/api.ts';
import { t } from '../../strings/index.ts';
import { useAttendCtx, usePoll } from './lib.ts';

export default function LCards() {
  const { ctx, error } = useAttendCtx();
  const [n, setN] = useState<number | null>(null);
  usePoll(async () => {
    if (!ctx) return;
    try { setN((await api<{ cardsDue: number }>(`/api/classes/${ctx.classId}/today`)).cardsDue); } catch { /* retry */ }
  }, 3000, [ctx?.classId]);
  if (error) return <p role="alert">{t('attend.error')}</p>;
  return (
    <section aria-labelledby="lc-h">
      <h1 id="lc-h">{t('attend.cards.title')}</h1>
      <p data-testid="cards-due-count">{t('attend.today.cardsDue', { n: n ?? 0 })}</p>
    </section>
  );
}
