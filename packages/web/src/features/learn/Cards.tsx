// Daily cards (AC-85, SPEC §4.2): review the cards due now with FSRS ratings.
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import { api } from '../../app/api.ts';

interface Card { id: string; deck: string; front: string; back: string }
interface Data { due: number; total: number; cards: Card[] }

export default function Cards() {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api<Data>('/api/learn/cards')); setError(false); } catch { setError(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function rate(id: string, rating: string) {
    setBusy(true);
    try { await api('/api/learn/cards/review', { body: { id, rating } }); setShown(false); await load(); }
    catch { setError(true); }
    setBusy(false);
  }

  if (error) return <p role="alert">{t('learn.error')}</p>;
  if (!data) return <p role="status">{t('learn.loading')}</p>;
  const card = data.cards[0];
  const buttons: [string, string][] = [['again', 'rate-again'], ['hard', 'rate-hard'], ['good', 'rate-good'], ['easy', 'rate-easy']];

  return (
    <section aria-labelledby="cd-h">
      <h1 id="cd-h">{t('learn.cards.title')}</h1>
      <p data-testid="cards-due-count" role="status">{t('learn.cards.due', { n: data.due })}</p>
      {card ? (
        <article data-testid="card-show" aria-label={t('learn.cards.title')} className="card">
          {card.deck && <p className="help">{t('learn.cards.deck', { deck: card.deck })}</p>}
          <p className="front" translate="no">{card.front}</p>
          {shown && <p className="back" translate="no">{card.back}</p>}
          <p><button type="button" onClick={() => setShown(!shown)} aria-expanded={shown}>{shown ? t('learn.cards.hide') : t('learn.cards.show')}</button></p>
          <p id="rate-h">{t('learn.cards.rate')}</p>
          <div className="row" role="group" aria-labelledby="rate-h">
            {buttons.map(([r, id]) => (
              <button key={r} type="button" data-testid={id} disabled={busy} onClick={() => { void rate(card.id, r); }}>{t(`learn.cards.${r}`)}</button>
            ))}
          </div>
        </article>
      ) : <p>{t('learn.cards.none')}</p>}
    </section>
  );
}
