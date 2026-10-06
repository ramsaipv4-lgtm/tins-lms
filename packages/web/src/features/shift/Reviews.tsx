// Peer review (AC-161, B-5): review a classmate's PR with a checklist; the review is scored.
import { useState } from 'react';
import { t } from '../../strings/index.ts';
import { ErrorNote, api, useAction, usePoll } from './lib.tsx';

type R = { id: string; title: string; prRef: string; author: string; checklist: { id: string; text: string }[]; submitted: boolean;
  score: { points: number; total: number; pct: number } | null; checked: string[]; comment: string };

function Review({ r, reload }: { r: R; reload: () => Promise<void> }) {
  const [checked, setChecked] = useState<string[]>(r.checked);
  const [comment, setComment] = useState(r.comment);
  const { error, run } = useAction();
  const toggle = (id: string) => setChecked(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id]);
  return (
    <li className="sh-card" data-status={r.submitted ? 'resolved' : 'waiting'}>
      <h2 translate="no">{r.title}</h2>
      <p>{t('shift.review.by', { author: r.author })} · <span translate="no">{r.prRef}</span></p>
      <fieldset data-testid="review-checklist"><legend>{t('shift.review.checklist')}</legend>
        {r.checklist.map((c) => (
          <div className="field check" key={c.id}>
            <input type="checkbox" id={`rv-${r.id}-${c.id}`} checked={checked.includes(c.id)} onChange={() => toggle(c.id)} disabled={r.submitted} />
            <label htmlFor={`rv-${r.id}-${c.id}`}>{c.text}</label>
          </div>
        ))}
      </fieldset>
      <div className="field sh-form"><label htmlFor={`rc-${r.id}`}>{t('shift.review.comment')}</label>
        <textarea id={`rc-${r.id}`} rows={3} value={comment} onChange={(e) => setComment(e.target.value)} disabled={r.submitted} /></div>
      {!r.submitted && <button type="button" onClick={() => run(async () => { await api(`/api/peer/reviews/${encodeURIComponent(r.id)}`, { method: 'POST', body: { checked, comment } }); await reload(); })}>{t('shift.review.submit')}</button>}
      {r.score && <p role="status" data-testid="review-score">{t('shift.review.score', { points: r.score.points, total: r.score.total, pct: r.score.pct })}</p>}
      <ErrorNote error={error} />
    </li>
  );
}

export default function Reviews() {
  const { data, reload } = usePoll<R[]>('/api/peer/reviews', 5000);
  return (
    <section aria-labelledby="rv-h">
      <h1 id="rv-h">{t('shift.review.title')}</h1>
      {data && data.length === 0 && <p>{t('shift.review.none')}</p>}
      <ul className="sh-list">{(data ?? []).map((r) => <Review key={r.id} r={r} reload={reload} />)}</ul>
    </section>
  );
}
