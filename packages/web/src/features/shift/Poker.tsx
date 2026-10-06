// Estimation poker (AC-87): hidden votes, revealed together; a spread asks the low and high voters to explain.
import { useState } from 'react';
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type Round = { id: string; title: string; revealed: boolean; voted: number; mine: number | null; cards: number[];
  votes?: { name: string; value: number }[]; result?: { result: 'consensus'; points: number } | { result: 'discuss'; low: string[]; high: string[] } };

export default function Poker() {
  const { data, reload } = usePoll<{ round: Round | null }>('/api/rituals/poker', 2000);
  const [title, setTitle] = useState('');
  const { error, run } = useAction();
  const r = data?.round ?? null;
  const live = r && !r.revealed;
  const post = (path: string, body: unknown) => run(async () => { await api(path, { method: 'POST', body }); await reload(); });
  return (
    <section aria-labelledby="pk-h">
      <h1 id="pk-h">{t('shift.poker.title')}</h1>
      {!live && (
        <div className="field">
          <label htmlFor="pk-t">{t('shift.poker.item')}</label>
          <input id="pk-t" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div><button type="button" onClick={() => post('/api/rituals/poker/start', { title })}>{t('shift.poker.start')}</button></div>
        </div>
      )}
      {live && (
        <>
          {r.title && <p translate="no"><strong>{r.title}</strong></p>}
          <div className="sh-cards" role="group" aria-label={t('shift.poker.cards')}>
            {r.cards.map((c) => <button type="button" key={c} aria-pressed={r.mine === c} onClick={() => post('/api/rituals/poker/vote', { points: c })}>{c}</button>)}
          </div>
          <p role="status">{t('shift.poker.voted', { n: r.voted })}</p>
          <button type="button" data-testid="poker-reveal" onClick={() => post('/api/rituals/poker/reveal', {})}>{t('shift.poker.reveal')}</button>
        </>
      )}
      {r?.revealed && r.result && (
        <div data-testid="poker-result" data-result={r.result.result} aria-live="polite">
          <h2>{t('shift.poker.result')}</h2>
          <ul className="sh-list">{r.votes?.map((v, i) => <li key={i}><span translate="no">{v.name}</span>: {v.value}</li>)}</ul>
          {r.result.result === 'consensus'
            ? <p>{t('shift.poker.consensus', { points: r.result.points })}</p>
            : <p>{t('shift.poker.spread', { low: r.result.low.join(', '), high: r.result.high.join(', ') })}</p>}
        </div>
      )}
      <ErrorNote error={error} />
    </section>
  );
}
