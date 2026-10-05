// Explain-it-back (AC-93, B-3) with AI off: the typed explanation is checked against the day's offline checklist.
import { useState, type FormEvent } from 'react';
import { t } from '../../strings/index.ts';
import { api, ApiError } from '../../app/api.ts';

interface Result { covered: string[]; missing: string[]; misconceptions: string[] }

export default function Explain() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [none, setNone] = useState(false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function check(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setError(false); setNone(false);
    try { setResult(await api<Result>('/api/learn/explain', { body: { text } })); }
    catch (x) { if (x instanceof ApiError && x.status === 404) { setNone(true); setResult(null); } else setError(true); }
    setBusy(false);
  }

  const list = (id: string, title: string, items: string[]) => (
    <section>
      <h2>{title}</h2>
      <ul data-testid={id}>
        {items.length ? items.map((i) => <li key={i} translate="no">{i}</li>) : <li>{t('learn.explain.empty')}</li>}
      </ul>
    </section>
  );

  return (
    <section>
      <h1>{t('learn.explain.title')}</h1>
      <p>{t('learn.explain.intro')}</p>
      <form onSubmit={check}>
        <div className="field">
          <label htmlFor="ex-text">{t('learn.explain.field')}</label>
          <textarea id="ex-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <button type="submit" disabled={busy}>{t('learn.explain.check')}</button>
      </form>
      {error && <p role="alert">{t('learn.error')}</p>}
      {none && <p role="status">{t('learn.explain.noChecklist')}</p>}
      {result && (
        <div aria-live="polite">
          {list('explain-covered', t('learn.explain.covered'), result.covered)}
          {list('explain-missing', t('learn.explain.missing'), result.missing)}
          {list('explain-misconceptions', t('learn.explain.misconceptions'), result.misconceptions)}
        </div>
      )}
    </section>
  );
}
