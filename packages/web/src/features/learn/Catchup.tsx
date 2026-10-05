// Catch-up gate (AC-84, SPEC §4.3): missed days unlock in order by passing each day's diagnostic.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { t } from '../../strings/index.ts';
import { api } from '../../app/api.ts';

interface Day { index: number; state: string; best: number | null }
interface State { today: number; passMark: number; days: Day[]; nextGate: number | null; selfStudyBlocked: boolean }
interface Question { n: number; text: string }

export default function Catchup() {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState(false);
  const [diag, setDiag] = useState<{ day: number; questions: Question[] } | null>(null);
  const [last, setLast] = useState<{ day: number; questions: Question[] } | null>(null);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [result, setResult] = useState<{ day: number; score: number; max: number; passed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setState(await api<State>('/api/learn/catchup')); setError(false); } catch { setError(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function start(day: number) {
    setResult(null); setAnswers({}); setBusy(true);
    try {
      const d = { day, questions: (await api<{ questions: Question[] }>(`/api/learn/diagnostic?day=${day}`)).questions };
      setDiag(d); setLast(d);
    } catch { setError(true); }
    setBusy(false);
  }

  // A retry reuses the questions already on the device, so the form appears at once.
  function retry() { setResult(null); setAnswers({}); setDiag(last); }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!diag) return;
    setBusy(true);
    try {
      const r = await api<{ score: number; max: number; passed: boolean; state: State }>('/api/learn/diagnostic', {
        body: { day: diag.day, answers: diag.questions.map((q) => ({ n: q.n, answer: answers[q.n] ?? '' })) },
      });
      setResult({ day: diag.day, score: r.score, max: r.max, passed: r.passed });
      setState(r.state);
      setDiag(null);
    } catch { setError(true); }
    setBusy(false);
  }

  if (error) return <p role="alert">{t('learn.error')}</p>;
  if (!state) return <p role="status">{t('learn.loading')}</p>;
  const pass = state.passMark;

  return (
    <section aria-labelledby="cu-h">
      <h1 id="cu-h">{t('learn.catchup.title')}</h1>
      <p>{t('learn.catchup.intro', { pass })}</p>

      {result && (
        <div role="status" data-testid="diag-result">
          <p>{t('learn.catchup.score')} <strong>{result.score}/{result.max}</strong></p>
          <p>{result.passed ? t('learn.catchup.passed') : t('learn.catchup.failed', { pass })}</p>
          {!result.passed && <button type="button" onClick={retry}>{t('learn.catchup.retry')}</button>}
        </div>
      )}

      {diag ? (
        <form onSubmit={submit}>
          <h2>{t('learn.catchup.diagTitle', { n: diag.day })}</h2>
          <p className="help">{t('learn.catchup.answerHelp')}</p>
          <ol className="diag">
            {diag.questions.map((q) => (
              <li key={q.n}>
                <label data-testid={`diag-q-${q.n}`} className="field">
                  <span translate="no">{q.text}</span>
                  <input aria-label={`${t('learn.catchup.answer')} ${q.n}`} value={answers[q.n] ?? ''} autoComplete="off"
                    onChange={(e) => setAnswers({ ...answers, [q.n]: e.target.value })} />
                </label>
              </li>
            ))}
          </ol>
          <button type="submit" disabled={busy}>{t('learn.catchup.submit')}</button>
        </form>
      ) : result && !result.passed ? null : state.nextGate !== null ? (
        <section data-testid={`gate-day-${state.nextGate}`} aria-labelledby="cu-gate">
          <h2 id="cu-gate">{t('learn.catchup.gateTitle', { n: state.nextGate })}</h2>
          <p>{t('learn.catchup.gateText', { n: state.nextGate, pass })}</p>
          <button type="button" onClick={() => { void start(state.nextGate as number); }} disabled={busy}>{t('learn.catchup.start')}</button>
        </section>
      ) : (
        <p>{state.days.some((d) => d.state === 'unlocked') ? t('learn.catchup.allDone') : t('learn.catchup.none')}</p>
      )}

      <h2>{t('learn.catchup.daysHeading')}</h2>
      <ul>
        {state.days.map((d) => (
          <li key={d.index}>{t('learn.catchup.day', { n: d.index })}: {t(`learn.catchup.state.${d.state}`)}{d.best !== null ? ` (${d.best}/8)` : ''}</li>
        ))}
      </ul>
    </section>
  );
}
