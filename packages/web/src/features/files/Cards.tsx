// /learn/phone-cards (AC-95): review the cards due now, on this device, with the core scheduler (D-22).
// Ratings are written to the personal database, which replicates to the hub whenever it is reachable.
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../strings/index.ts';
import * as phone from './phone.ts';
import { usePhone } from './ui.ts';

const RATINGS: [phone.RatingName, string][] = [['again', 'rate-again'], ['hard', 'rate-hard'], ['good', 'rate-good'], ['easy', 'rate-easy']];

export default function Cards() {
  const { bundle, ready } = usePhone();
  const [cards, setCards] = useState<any[] | null>(null);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try { setCards(await phone.listCards()); setError(false); } catch { setError(true); }
  }, []);
  useEffect(() => { if (ready) void load(); }, [ready, load, bundle]);
  useEffect(() => phone.subscribe(() => { void load(); }), [load]);

  if (error) return <p role="alert">{t('files.cards.error')}</p>;
  if (!ready || !cards) return <p role="status">{t('app.loading')}</p>;
  const now = phone.nowMs();
  const due = cards.filter((c) => phone.cardDueAt(c) <= now).sort((a, b) => phone.cardDueAt(a) - phone.cardDueAt(b));
  const card = due[0];

  async function rate(rating: phone.RatingName) {
    setBusy(true);
    try { await phone.rateCard(card, rating); setShown(false); await load(); } catch { setError(true); }
    setBusy(false);
  }

  return (
    <section aria-labelledby="fc-h">
      <h1 id="fc-h">{t('files.cards.title')}</h1>
      <p data-testid="cards-due-count" role="status">{t('files.cards.due', { n: due.length })}</p>
      {card ? (
        <article data-testid="card-show" aria-label={t('files.cards.card')} className="card">
          {card.deck && <p className="help">{t('files.cards.deck', { deck: card.deck })}</p>}
          <p className="front" translate="no">{card.front}</p>
          {shown && <p className="back" translate="no">{card.back}</p>}
          <p><button type="button" onClick={() => setShown(!shown)} aria-expanded={shown}>{shown ? t('files.cards.hide') : t('files.cards.show')}</button></p>
          <p id="fc-rate">{t('files.cards.rate')}</p>
          <div className="row" role="group" aria-labelledby="fc-rate">
            {RATINGS.map(([r, id]) => <button key={r} type="button" data-testid={id} disabled={busy} onClick={() => { void rate(r); }}>{t(`files.cards.${r}`)}</button>)}
          </div>
        </article>
      ) : <p>{t('files.cards.none')}</p>}
      {phone.hubReachable() === false && <p className="help">{t('files.cards.offline')}</p>}
    </section>
  );
}
